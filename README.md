# Lumina (Electron)

一个基于 **Electron + Vue 3** 的 4K 壁纸浏览器，数据源为 [wallhaven.cc](https://wallhaven.cc)。

> 本项目是 `wallhaven-tauri`（Tauri v2 版本）的 Electron 重构版：**仅替换构建/运行时外壳**，
> Vue 前端代码几乎原样保留，Rust 后端整体替换为 Electron 主进程。
> 详细的迁移步骤与替换对照见 [docs/migration-tauri-to-electron.md](docs/migration-tauri-to-electron.md)。

## 技术栈

- **外壳**：Electron 43 + electron-vite 5 + electron-builder
- **前端**：Vue 3 `<script setup>` + TypeScript + Vite 7 + Tailwind CSS v4 + Pinia + Vue Router
- **桥接**：Preload + contextBridge 暴露 `window.lumina`（替代 Tauri 的 invoke/listen/convertFileSrc）

## 快速开始

```bash
pnpm install       # 安装依赖（.npmrc 已配置 Electron 二进制国内镜像）
pnpm dev           # 启动开发模式（Vite HMR + Electron 窗口）
pnpm build         # 类型检查 + 构建（产物在 out/）
pnpm start         # 预览构建产物
pnpm build:mac     # 打包 macOS dmg/zip（Win: build:win / Linux: build:linux）
```

## 目录结构

```
electron/           Electron 主进程与预加载
  main/             主进程：index(窗口/协议) ipc download cache wallpaper proxy
  preload/          桥接层：index(contextBridge) lumina-api(类型) index.d.ts(全局声明)
src/                Vue 前端（与原 Tauri 项目一致）
resources/          打包图标（icon.icns / icon.ico / icon.png）
docs/               迁移文档与 API 参考
```

## 主要能力

- Wallhaven API 代理（绕过 CORS，支持 API Key → NSFW）
- 壁纸图片本地缓存（`{userData}/cache/images`）+ `lumina://` 协议访问（绕过 CDN 防盗链）
- 流式下载管理器（进度/取消/删除/目录选择）
- 一键设置系统壁纸（macOS osascript / Windows PowerShell / Linux gsettings）
- 无边框透明窗口 + 自定义标题栏（CSS drag region 拖拽）
- 收藏/下载记录持久化（localStorage）
