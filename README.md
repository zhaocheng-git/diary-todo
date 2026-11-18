# 日记 · 待办（Diary & Todo）

一体化单页应用：**每日待办** + **日记** 在同一页面，支持深浅色主题，响应式适配手机 / 电脑。

- 网页版：数据存浏览器 **IndexedDB**，可部署到 GitHub Pages，外网手机随时访问
- 桌面版：用 **Electron** 打包，数据存本地「文档/diary」文件夹（每天一个 JSON 文件）

## 功能

- ✅ 每日待办：新增 / 删除任务，点方框打勾，已完成任务加贯穿删除线
- 📝 日记：按日期撰写，自动保存（停止输入 0.5 秒后写入）
- 📅 翻阅历史：前一天 / 后一天 / 日期选择器 /「今天」按钮；底部「历史记录」列出所有有记录的日期
- 🌗 深浅色主题：默认跟随系统，可手动切换并记忆
- 📱 响应式：手机单列、电脑双列，加载快、无第三方依赖

## 文件结构

```
diary-todo/
├── index.html      页面结构（网页版 & 桌面版共用）
├── styles.css      样式（低饱和极简 + 深浅色主题）
├── app.js          应用逻辑 + 存储抽象（自动识别 Web / Electron）
├── main.js         Electron 主进程（仅桌面版）
├── preload.js      Electron 预加载脚本（仅桌面版）
├── package.json    Electron 依赖与打包配置（仅桌面版）
├── .gitignore
└── README.md
```

## 快速开始（本地预览）

直接双击 `index.html` 即可在浏览器打开。或启动本地服务器（更稳）：

```bash
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

> 纯静态文件，无构建步骤。`file://` 直接双击一般也能用，但个别浏览器会限制 IndexedDB，建议用 http 方式。

---

## 一、部署到 GitHub Pages（网页版，手机随时访问）

### 方式 A：网页上传（最简单，无需命令行）

1. 登录 [github.com](https://github.com)，点右上角 **＋ → New repository**
2. 仓库名填 `diary-todo`（或任意英文名），选 **Public**，勾选 **Add a README file**，点 **Create repository**
3. 进入仓库，点 **Add file → Upload files**，把本项目的 `index.html`、`styles.css`、`app.js` 拖进去（`main.js` / `preload.js` / `package.json` 可一并传，不传也不影响网页版），点 **Commit changes**
4. 点 **Settings → 左侧 Pages**
5. **Source** 选 **Deploy from a branch**；**Branch** 选 `main`、目录选 **/(root)**，点 **Save**
6. 等 1~2 分钟，页面顶部会出现网址：`https://你的用户名.github.io/diary-todo/`
7. 手机 / 平板浏览器打开该网址即可使用（建议「添加到主屏幕」当 App 用）

### 方式 B：命令行（git）

```bash
git clone https://github.com/你的用户名/diary-todo.git   # 或先建空仓库再 clone
cd diary-todo
# 把本项目所有文件复制进来，然后：
git add -A
git commit -m "init diary-todo"
git push
# 之后按方式 A 的第 4~6 步开启 Pages
```

> 也可以放到已有仓库的子目录（如 `tests/diary-todo/`），访问地址就是 `https://…/diary-todo/`。

---

## 二、打包成 Electron 桌面程序

### 1. 安装 Node.js

到 [nodejs.org](https://nodejs.org) 下载 LTS 版安装（一路下一步）。

### 2. 安装依赖（只需一次）

在项目目录打开终端（PowerShell / cmd）：

```bash
npm install
```

> 国内网络慢可先切镜像：
> `npm config set registry https://registry.npmmirror.com`

### 3. 本地试运行

```bash
npm start
```

会弹出桌面窗口，数据保存在 **「文档/diary」文件夹**（每天一个 `YYYY-MM-DD.json`）。

### 4. 打包成可执行程序

```bash
npm run dist
```

- 成功后，在 `dist/` 目录得到 **`日记待办 1.0.0.exe`**（便携版，双击即用，免安装）
- 想生成「安装包」而非单文件，把 `package.json` 里 `build.win.target` 改成 `"nsis"` 再 `npm run dist`

### 5. 迁移 / 备份

桌面版数据只在本机。换电脑或备份时，直接拷贝 **「文档/diary」文件夹** 即可。

---

## 数据存储说明

| | 网页版 | 桌面版 |
|---|---|---|
| 存储位置 | 浏览器 IndexedDB | 文档/diary/*.json |
| 数据范围 | 每台设备独立 | 每台电脑独立 |
| 备份 | 需手动 | 直接拷贝 diary 文件夹 |

⚠️ 网页版清除浏览器数据会丢失记录；桌面版删除 diary 文件夹同理。

---

## 常见问题

**Q：手机和电脑数据能同步吗？**
不能。这是纯静态站点，没有服务器。如需跨设备同步，需要额外接后端 / 云存储（Firebase、LeanCloud 等），可在 `app.js` 的存储抽象层替换实现。

**Q：日记没点保存会丢吗？**
不会。日记自动保存（停止输入 0.5 秒后写入），右上角显示「已保存 HH:MM」；切换日期前也会自动落盘。

**Q：文件会不会越来越多？**
只有「写过日记或加过任务」的日期才会生成文件 / 记录；空日期不生成。

**Q：桌面版如何自定义日记保存路径？**
编辑 `main.js` 里的 `diaryDir()` 函数，改成你想要的路径即可。
