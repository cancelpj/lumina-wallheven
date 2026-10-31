# Tauri → Electron 迁移文档（wallhaven-tauri → wallhaven-electron）

> 目标：**只更换构建/运行时外壳**。Vue 前端（`src/`）的 UI 代码零改动迁移，
> Rust 后端（`src-tauri/`）整体替换为 Electron 主进程 + Preload 桥接层。
> 原项目 `wallhaven-tauri/` 保持不动。

---

## 1. 迁移总览

| 维度 | 原 Tauri 项目 | 新 Electron 项目 |
|------|--------------|------------------|
| 项目目录 | `wallhaven-tauri/` | `wallhaven-electron/`（平级新建） |
| 后端 | Rust（`src-tauri/`，tauri v2） | Node/TypeScript 主进程（`electron/main/`） |
| 前后端通信 | `invoke()` / `listen()` / `convertFileSrc()` | `ipcRenderer.invoke()` + `contextBridge`（`window.lumina`） |
| 窗口 | `tauri.conf.json` | `BrowserWindow`（`electron/main/index.ts`） |
| 前端构建 | Vite（`vite.config.ts`） | electron-vite 的 renderer 段（`electron.vite.config.ts`） |
| 打包 | `cargo tauri build` | electron-builder（`electron-builder.yml`） |
| 下载/代理/缓存 | Rust（reqwest / tokio） | Node 原生 `fetch` + `fs` |
| 设置系统壁纸 | Rust（osascript / PowerShell / gsettings） | Node `child_process`（三平台同款命令） |
| 协议 | Tauri 自带 asset 协议（`convertFileSrc`） | 自定义 `lumina://` 协议（`protocol.handle`） |

### 目录对照

```
wallhaven-tauri/                      wallhaven-electron/
├── src/                  ──复制──▶    ├── src/                    （前端，仅 6 个文件改调用层）
├── public/               ──复制──▶    ├── public/
├── index.html            ──复制──▶    ├── index.html
├── vite.config.ts        ──改写成──▶  ├── electron.vite.config.ts （三端构建配置）
├── package.json          ──改写──▶    ├── package.json
├── src-tauri/
│   ├── src/lib.rs        ──改写成──▶  ├── electron/main/index.ts  （应用入口/窗口/协议）
│   ├── src/commands.rs   ──改写成──▶  ├── electron/main/ipc.ts    （全部 IPC 处理器）
│   ├── src/download.rs   ──改写成──▶  ├── electron/main/download.ts（下载管理器）
│   │                                  ├── electron/main/cache.ts  （图片缓存/缓存管理）
│   │                                  ├── electron/main/wallpaper.ts（设置系统壁纸）
│   │                                  ├── electron/main/proxy.ts  （Wallhaven API 代理）
│   │                                  ├── electron/preload/index.ts（contextBridge 桥接）
│   │                                  ├── electron/preload/lumina-api.ts（桥接类型定义）
│   │                                  └── electron/preload/index.d.ts（window.lumina 全局声明）
│   ├── tauri.conf.json   ──改写成──▶  ├── electron-builder.yml    （打包配置）
│   └── icons/            ──复制──▶    ├── resources/              （icon.icns / icon.ico / icon.png）
│                                      └── docs/migration-tauri-to-electron.md（本文档）
```

---

## 2. 构建/运行命令替换

| 原命令 | 新命令 | 说明 |
|--------|--------|------|
| `pnpm dev` | `pnpm dev` | 现在会启动 Vite dev server + Electron 窗口（带 HMR） |
| `cargo tauri dev` | （无，`pnpm dev` 即完整应用） | 不再需要 Rust |
| `pnpm build` | `pnpm build` | vue-tsc 类型检查 + electron-vite 三端构建 |
| `cargo tauri build` | `pnpm build:mac` / `build:win` / `build:linux` | electron-builder 打包 dmg / nsis / AppImage |
| — | `pnpm start` | 预览构建产物（electron-vite preview） |
| — | `pnpm typecheck` | 仅类型检查 |

> 依赖安装：新项目用 `pnpm install` 生成独立的 `pnpm-lock.yaml`，与原项目互不影响。
> `.npmrc` 配置了 Electron 二进制的国内镜像（npmmirror），不需要可删除。

---

## 3. 逐项 API 替换方案（核心对照表）

### 3.1 前端调用层替换（`@tauri-apps/api` → `window.lumina`）

| 原 Tauri 代码 | 新 Electron 代码 | 涉及文件 |
|---------------|-------------------|----------|
| `import { invoke } from '@tauri-apps/api/core'` | 删除；改用 `window.lumina.xxx()` | api/wallhaven.ts、stores/download.ts、views/SettingsView.vue |
| `invoke('fetch_wallhaven_api', { endpoint, params, apiKey })` | `window.lumina.fetchWallhavenApi(endpoint, params, apiKey)` | api/wallhaven.ts |
| `invoke('fetch_wallpaper_image', { path })` + `convertFileSrc(localPath)` | `window.lumina.fetchWallpaperImage(path)`（直接返回 `lumina://` URL） | api/wallhaven.ts |
| `invoke('set_desktop_wallpaper', { path })` | `window.lumina.setDesktopWallpaper(path)` | api/wallhaven.ts |
| `convertFileSrc(item.file_path)` | `window.lumina.fileUrl(item.file_path)` | views/DownloadView.vue |
| `invoke('download_image', { url, id, fileName, resolution })` | `window.lumina.downloadImage({ url, id, fileName, resolution })` | stores/download.ts |
| `invoke('cancel_download', { id })` | `window.lumina.cancelDownload(id)` | stores/download.ts |
| `invoke('delete_download_file', { id, filePath })` | `window.lumina.deleteDownloadFile(id, filePath)` | stores/download.ts |
| `invoke('get_download_dir')` / `invoke('set_download_dir', { path })` | `window.lumina.getDownloadDir()` / `setDownloadDir(path)` | stores/download.ts |
| `invoke('choose_download_dir')` | `window.lumina.chooseDownloadDir()` | stores/download.ts |
| `invoke('open_download_folder', { path })` | `window.lumina.openDownloadFolder(path)` | stores/download.ts、views/SettingsView.vue |
| `invoke('reveal_download_file', { path })` | `window.lumina.revealDownloadFile(path)` | stores/download.ts |
| `invoke('get_cache_info')` / `invoke('clear_app_cache')` | `window.lumina.getCacheInfo()` / `clearAppCache()` | views/SettingsView.vue |
| `import { listen } from '@tauri-apps/api/event'`<br>`listen('download-progress', cb)` | `window.lumina.onDownloadProgress(cb)`（返回取消订阅函数） | stores/download.ts |
| `listen('download-error', cb)` | `window.lumina.onDownloadError(cb)` | stores/download.ts |
| `import { getCurrentWindow } from '@tauri-apps/api/window'`<br>`appWindow.minimize() / toggleMaximize() / close() / isMaximized()` | `window.lumina.window.minimize() / toggleMaximize() / close() / isMaximized()` | components/layout/Titlebar.vue |
| `appWindow.startDragging()` | CSS `-webkit-app-region: drag`（无需 JS） | components/layout/AppShell.vue |
| `createWebHistory()`（vue-router） | `createWebHashHistory()` | src/router/index.ts |

> **关于 hash 路由**：Tauri 生产模式通过 `tauri://localhost` 这类自定义协议加载页面，`createWebHistory`
> 可用；Electron 生产模式通过 `file://` 加载，`pathname` 是完整磁盘路径导致路由无法匹配（页面空白）。
> 改为 hash 路由后 URL 形如 `file:///.../index.html#/hot`，路由行为不变。

### 3.2 窗口配置对照（tauri.conf.json → electron/main/index.ts）

| tauri.conf.json | BrowserWindow 选项 |
|-----------------|---------------------|
| `"title": "Lumina"` | `title: 'Lumina'` |
| `"width": 1400, "height": 900` | `width: 1400, height: 900` |
| `"minWidth": 1000, "minHeight": 700` | `minWidth: 1000, minHeight: 700` |
| `"decorations": false` | `frame: false` |
| `"transparent": true` | `transparent: true` |
| `"backgroundColor": "#00000000"` | `backgroundColor: '#00000000'` |
| `"center": true` | `center: true` |
| `"resizable": true` | `resizable: true` |
| `data-tauri-drag-region` + `startDragging()` | `-webkit-app-region: drag`（CSS），按钮上加 `no-drag` |
| 全局快捷键（debug）：Cmd/Ctrl+J 开、K 关 DevTools | `globalShortcut.register('CommandOrControl+J' / '+K')` |

### 3.3 Rust 命令 → IPC 通道对照

| Rust `#[tauri::command]` | IPC channel（ipcMain.handle） | Preload 方法 |
|--------------------------|-------------------------------|--------------|
| `download_image` | `download:start` | `downloadImage` |
| `cancel_download` | `download:cancel` | `cancelDownload` |
| `get_downloads` | `download:list` | `getDownloads` |
| `clear_download` | `download:clear` | `clearDownload` |
| `delete_download_file` | `download:delete-file` | `deleteDownloadFile` |
| `open_download_folder` | `download:open-folder` | `openDownloadFolder` |
| `reveal_download_file` | `download:reveal-file` | `revealDownloadFile` |
| `get_download_dir` | `download:get-dir` | `getDownloadDir` |
| `set_download_dir` | `download:set-dir` | `setDownloadDir` |
| `choose_download_dir` | `download:choose-dir` | `chooseDownloadDir` |
| `get_app_data_path` | `app:data-path` | `getAppDataPath` |
| `get_cache_info` | `cache:info` | `getCacheInfo` |
| `clear_app_cache` | `cache:clear` | `clearAppCache` |
| `fetch_wallpaper_image` | `image:fetch` | `fetchWallpaperImage` |
| `set_desktop_wallpaper` | `wallpaper:set` | `setDesktopWallpaper` |
| `fetch_wallhaven_api` | `proxy:wallhaven` | `fetchWallhavenApi` |

### 3.4 技术实现要点

1. **下载流式传输**：Rust 用 reqwest `bytes_stream()` + 每 100ms 发进度事件；
   Electron 用原生 `fetch` 的 `ReadableStream`（`res.body.getReader()`）+ 相同节流逻辑，
   事件名 `download-progress` / `download-error` 与负载结构保持完全一致，前端 store 零逻辑改动。

2. **本地文件访问（原 convertFileSrc）**：注册自定义特权协议 `lumina://`：
   - `lumina://cache/<file>` → `{userData}/cache/images/<file>`（壁纸缓存）
   - `lumina://file?path=<绝对路径>` → 任意本地文件（下载缩略图）
   生产/开发环境均可直接用于 `<img src>`。

3. **CSP**：Tauri 配置 `"csp": null`；Electron 同样不设置 CSP（页面加载远程图片）。

4. **外部链接**：设置页的 `target="_blank"` 链接通过
   `webContents.setWindowOpenHandler` 拦截并交给系统浏览器打开（比 Tauri 默认行为更符合桌面习惯）。

5. **安全基线**：`contextIsolation: true` + `nodeIntegration: false` + `sandbox: false`
   （sandbox 关闭是因为 ESM preload 需要；渲染进程仍无 Node 权限，能力全部经 `window.lumina` 白名单暴露）。

6. **下载目录持久化**：与 Tauri 版一致 —— 主进程内存持有当前目录，
   前端 `localStorage` 持久化并在启动时回填（`initializeDownloadDir`）。

---

## 4. 迁移执行步骤（操作清单）

1. **新建目录并复制前端**
   ```bash
   mkdir -p wallhaven-electron/{electron/{main,preload},resources,src,public,docs}
   cp -R wallhaven-tauri/src/.   wallhaven-electron/src/
   cp -R wallhaven-tauri/public/. wallhaven-electron/public/
   cp wallhaven-tauri/index.html wallhaven-electron/
   cp wallhaven-tauri/tsconfig*.json wallhaven-electron/
   cp wallhaven-tauri/src-tauri/icons/{icon.icns,icon.ico,icon.png,128x128.png} wallhaven-electron/resources/
   ```

2. **编写构建配置**：`package.json`（依赖替换为 electron / electron-vite / electron-builder，
   注意 electron-vite 5 只支持 Vite ≤7）、`electron.vite.config.ts`、`electron-builder.yml`、`.npmrc`（镜像）。

3. **编写主进程**：`electron/main/` 下 index / ipc / download / cache / wallpaper / proxy 六个模块
   （见第 3 节对照表，逐一对应 Rust 命令）。

4. **编写 Preload 桥接**：`electron/preload/index.ts`（contextBridge 暴露 `window.lumina`）、
   `lumina-api.ts`（类型）、`index.d.ts`（全局声明，并加入 `tsconfig.app.json` 的 include）。

5. **替换前端调用层**：共 7 个文件（见 3.1 表格：6 个 Tauri API 调用文件 + router 的 hash 路由适配），其余 `src/` 文件原样保留。

6. **安装依赖**：`cd wallhaven-electron && pnpm install`（生成独立 lockfile）。

7. **验证构建**：`pnpm build`（vue-tsc 类型检查 + electron-vite 构建三端产物到 `out/`）。

8. **验证运行**：`pnpm dev`（启动 Vite dev server + Electron 窗口，确认无报错后 Ctrl+C）。

9. **打包发布**：`pnpm build:mac`（产出 `release/` 下的 dmg/zip）。

---

## 5. 已知差异与注意事项

- **Vite 版本**：原项目用 Vite 8，electron-vite 5 暂不支持 Vite 8，新项目用 Vite 7（前端代码不受影响）。
- **路由模式**：生产加载由 `tauri://` 协议变为 `file://`，vue-router 改用 `createWebHashHistory`（见 3.1）。
- **数据目录**：Tauri 用 `~/Library/Application Support/com.lumina.desktop`；
  Electron 统一为 `~/Library/Application Support/Lumina`（主进程已 `app.setName('Lumina')`）。
  首次迁移后缓存/下载历史不互通（下载记录本身存 localStorage，不受影响）。
- **全图加载**：详情页大图仍直接加载 CDN URL（与原 Tauri 行为一致）。
  若某些网络环境触发 w.wallhaven.cc 403 防盗链，可把详情页改为走 `fetchImage()` 缓存代理（一行改动）。
- **透明窗口**：macOS 下透明无边框窗口的最大化动画与圆角表现与 Tauri 基本一致；
  Windows/Linux 下若透明窗口有兼容问题，可去掉 `transparent: true` 并调整背景色。
- **DevTools 快捷键**：仅开发模式注册（`!app.isPackaged`），与 Tauri debug 模式行为一致。
