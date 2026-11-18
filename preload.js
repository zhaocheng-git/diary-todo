// ============================================================
// Electron 预加载脚本：在安全隔离下，向网页暴露最小化的文件读写 API
// 渲染进程只能通过 window.electronAPI 调用，无法直接访问 Node
// ============================================================
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  listDays: () => ipcRenderer.invoke("diary:list"),
  readDay: (date) => ipcRenderer.invoke("diary:read", date),
  writeDay: (record) => ipcRenderer.invoke("diary:write", record),
  deleteDay: (date) => ipcRenderer.invoke("diary:delete", date),
});
