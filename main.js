// ============================================================
// Electron 主进程：创建窗口 + 提供本地文件读写（diary 文件夹）
// 仅桌面版使用；网页版(GitHub Pages)不加载此文件
// ============================================================
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

// 日记目录：默认放在「文档/diary」，可按需修改
function diaryDir() {
  return path.join(app.getPath("documents"), "diary");
}

// 校验日期格式，防止路径穿越
function validDate(d) {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function dayPath(date) {
  return path.join(diaryDir(), date + ".json");
}
function ensureDir() {
  fs.mkdirSync(diaryDir(), { recursive: true });
}

// 注册 IPC：渲染进程通过 window.electronAPI 调用
ipcMain.handle("diary:list", async () => {
  ensureDir();
  const files = await fsp.readdir(diaryDir());
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
});

ipcMain.handle("diary:read", async (_e, date) => {
  if (!validDate(date)) return null;
  const p = dayPath(date);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(await fsp.readFile(p, "utf8"));
  } catch {
    return null;
  }
});

ipcMain.handle("diary:write", async (_e, record) => {
  if (!record || !validDate(record.date)) return false;
  ensureDir();
  await fsp.writeFile(dayPath(record.date), JSON.stringify(record, null, 2), "utf8");
  return true;
});

ipcMain.handle("diary:delete", async (_e, date) => {
  if (!validDate(date)) return false;
  const p = dayPath(date);
  if (fs.existsSync(p)) await fsp.unlink(p);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 360,
    minHeight: 560,
    title: "日记 · 待办",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,   // 安全：渲染进程与 Node 隔离
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
