# AGENTS.md

本文件为本仓库（Electron 版）的协作指南。原 Tauri 版的说明见 `../wallhaven-tauri/`。

## Build / Dev

```bash
pnpm dev              # electron-vite dev：Vite dev server + Electron 窗口（HMR）
pnpm build            # vue-tsc 类型检查 + electron-vite 构建（main/preload/renderer → out/）
pnpm start            # electron-vite preview：预览构建产物
pnpm build:mac|win|linux  # electron-builder 打包
```

无测试套件 / 无 linter。

## 架构

**Electron + Vue 3 桌面壁纸浏览器（wallhaven.cc）。** 所有 Wallhaven HTTP 请求由主进程代理，
前端不直接请求 Wallhaven API。

### 为什么用主进程代理一切

- **Wallhaven API**：绕过 CORS
- **壁纸图片**（w.wallhaven.cc/full/）：绕过 CDN 防盗链（无 `Referer: https://wallhaven.cc/` 会 403）。
  图片缓存到 `{userData}/cache/images/`，通过 `lumina://` 自定义协议访问
- **下载**：主进程流式下载，每 100ms 推送进度事件到渲染进程

### 主进程（`electron/main/`）

| 文件 | 用途 |
|------|------|
| [index.ts](electron/main/index.ts) | 应用入口：无边框透明窗口、`lumina://` 协议、DevTools 快捷键（仅 dev）、外部链接拦截 |
| [ipc.ts](electron/main/ipc.ts) | 全部 `ipcMain.handle` 处理器：`window:*` `download:*` `cache:*` `image:fetch` `wallpaper:set` `proxy:wallhaven` |
| [download.ts](electron/main/download.ts) | 下载管理器：活动/完成/取消集合，流式下载 + 100ms 进度事件 |
| [cache.ts](electron/main/cache.ts) | 图片缓存、缓存大小统计、清空缓存 |
| [wallpaper.ts](electron/main/wallpaper.ts) | 设置系统壁纸（osascript / PowerShell / gsettings） |
| [proxy.ts](electron/main/proxy.ts) | Wallhaven API 代理（X-API-Key 头） |

### 桥接层（`electron/preload/`）

`contextBridge` 把能力白名单暴露为 `window.lumina`（见 [lumina-api.ts](electron/preload/lumina-api.ts) 的类型定义）。
渲染进程新增能力必须：① 在 `ipc.ts` 注册 handler；② 在 `preload/index.ts` 暴露方法；
③ 在 `lumina-api.ts` 补类型。全局声明 [index.d.ts](electron/preload/index.d.ts) 已加入 `tsconfig.app.json`。

### 渲染进程（`src/`）

栈与 Tauri 版一致：Vue 3 Composition API + `<script setup>`、TypeScript、Vite、Tailwind v4、Pinia、Vue Router、
Lucide、Material Symbols、`@vueuse/core`。

关键约定：
- API 层 [api/wallhaven.ts](src/api/wallhaven.ts)：`search()` → `window.lumina.fetchWallhavenApi()`；
  `fetchImage()` → `window.lumina.fetchWallpaperImage()`（返回 `lumina://cache/...`）。
- 下载 store [stores/download.ts](src/stores/download.ts)：订阅 `window.lumina.onDownloadProgress/onDownloadError`，
  事件负载与 Rust 版完全一致。
- 无边框窗口拖拽：CSS `-webkit-app-region: drag`（按钮需 `no-drag`），不再调用 `startDragging`。

### 窗口

1400×900 默认 / 1000×700 最小，无边框（`frame: false`）+ 透明（`transparent: true`），居中可缩放。

## Wallhaven API（详见 [docs/wallhaven-api.md](docs/wallhaven-api.md)）

- Base: `https://wallhaven.cc/api/v1`，限流 45 req/min，24 条/页
- `categories`/`purity`：3 位字符串（如 `111` 全类别、`100` 仅 SFW）
- NSFW 需要 API Key（`X-API-Key` 头）
- 图片 CDN：`w.wallhaven.cc/full/{path}`，需要 `Referer: https://wallhaven.cc/`
