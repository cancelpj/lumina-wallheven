# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Lumina — a 4K wallpaper browser backed by [wallhaven.cc](https://wallhaven.cc), built with Electron + Vue 3. This is an **Electron port of `wallhaven-tauri`** (the sibling Tauri v2 project): the Vue frontend (`src/`) is carried over nearly verbatim, and the Rust backend was replaced wholesale by the Electron main process. The authoritative migration mapping is `docs/migration-tauri-to-electron.md`.

## Commands

Package manager is **pnpm** (not npm/yarn). There is no test suite and no linter.

```bash
pnpm dev          # electron-vite dev: Vite HMR + Electron window
pnpm build        # vue-tsc -b typecheck + electron-vite build (main/preload/renderer → out/)
pnpm typecheck    # vue-tsc -b only
pnpm start        # electron-vite preview: run the built output
pnpm build:mac    # electron-builder package (dmg/zip)  — also build:win / build:linux / build:dir
```

Build output lands in `out/`; packaged installers land in `release/`. `.npmrc` pins an Electron binary mirror (npmmirror) for China — remove it if not needed.

## Architecture

Three layers, built as three separate bundles by electron-vite (`electron.vite.config.ts`):

1. **Main process** (`electron/main/`) — the Node side. Replaces the old Rust backend.
2. **Preload** (`electron/preload/`) — `contextBridge` exposes a frozen API surface as `window.lumina`.
3. **Renderer** (`src/`) — the Vue 3 app (Composition API + `<script setup>`, TypeScript, Tailwind v4, Pinia, Vue Router, Lucide/Material Symbols).

**Core rule: all network I/O is proxied through the main process.** The renderer never talks to wallhaven.cc directly. This exists for two reasons:

- **Wallhaven API** (`api/v1`) is proxied to bypass CORS, and passes the user's API key via the `X-API-Key` header (not the URL). See `electron/main/proxy.ts`.
- **Wallpaper images** (`w.wallhaven.cc/full/`) are proxied because the CDN returns 403 without `Referer: https://wallhaven.cc/`. Images are fetched into `{userData}/cache/images/` and served back through a custom `lumina://` protocol. See `electron/main/cache.ts`.

`{userData}` resolves to `~/Library/Application Support/Lumina` (the main process calls `app.setName('Lumina')` before `ready`).

### Adding a new renderer capability

Every renderer ↔ main capability is wired through three files, in lockstep — miss one and it breaks:

1. `electron/main/ipc.ts` — register an `ipcMain.handle('channel', …)` handler.
2. `electron/preload/index.ts` — expose a method on `window.lumina` that calls `ipcRenderer.invoke('channel', …)`.
3. `electron/preload/lumina-api.ts` — add the method to the `LuminaApi` interface (the global `Window.lumina` type comes from `electron/preload/index.d.ts`, already included in `tsconfig.app.json`).

The renderer then calls it via `window.lumina.*`, with the domain wrapper in `src/api/wallhaven.ts`. Do not add Node/Electron access to the renderer; keep `contextIsolation: true` and the `window.lumina` allowlist.

### Key conventions and gotchas

- **Hash routing.** `src/router/index.ts` uses `createWebHashHistory()` because production loads the app via `file://`, where `createWebHistory` can't match paths (blank page). Routes look like `file:///.../index.html#/hot`.
- **Frameless window drag** is done with CSS `-webkit-app-region: drag` (and `no-drag` on buttons) — there is no JS `startDragging` equivalent.
- **Download progress parity.** `electron/main/download.ts` streams downloads and emits `download-progress` (throttled to ~100ms) and `download-error` events with payload shapes identical to the old Tauri events, so the renderer store (`src/stores/download.ts`) needed no logic changes. Keep those payload shapes stable.
- **`lumina://` protocol** (`electron/main/index.ts`) serves local files to `<img>`: `lumina://cache/<file>` maps to the image cache, and `lumina://file?path=<abs>` maps to any absolute path (download thumbnails).
- **Persistence** is `localStorage` only: favorites, download records (`wallhaven-downloads`), download dir (`wallhaven-download-dir`), and the API key (`wallhaven-api-key`). The download directory itself is held in main-process memory and re-seeded from localStorage on startup (`initializeDownloadDir`).
- **Path alias** `@` → `src/` (configured in both `electron.vite.config.ts` and `tsconfig.app.json`).
- **DevTools** shortcuts `Cmd/Ctrl+J` (open) / `Cmd/Ctrl+K` (close) are registered only when `!app.isPackaged`.
- **Vite is pinned to v7** — electron-vite 5 does not yet support Vite 8. Do not bump Vite past 7.

## Wallhaven API essentials

Full reference is `docs/wallhaven-api.md`. The parts that matter most day-to-day:

- Base URL `https://wallhaven.cc/api/v1`; rate limit **45 req/min**; **24 results/page**.
- `categories` and `purity` are 3-char bit strings: `categories` = `general/anime/people`, `purity` = `sfw/sketchy/nsfw`. E.g. `111` = all categories, `100` = SFW only.
- NSFW requires a valid API key.
- Pagination is page-number based: `hasMore = meta.current_page < meta.last_page`.

## Further reading

- `AGENTS.md` — Chinese-language working notes covering the same architecture and the `ipcMain.handle` channel table.
- `docs/migration-tauri-to-electron.md` — the exhaustive Tauri→Electron command/IPC correspondence (referenced heavily in code comments).
- `docs/wallhaven-api.md`, `docs/project-features.md`, `docs/ui-design-system.md` — API reference, product behavior, and visual system.
