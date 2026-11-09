# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build / Dev

```bash
pnpm dev                  # Vite dev server on port 1420 (strict)
pnpm build                # vue-tsc type-check + vite build
cargo tauri dev           # Full Tauri app (starts Vite + Rust backend)
cargo tauri build         # Production Tauri build
```

## Working agreements

**A change is not done until these pass:**

```bash
pnpm install --frozen-lockfile
pnpm build                                                   # vue-tsc type check + vite build
cargo test --manifest-path src-tauri/Cargo.toml --lib        # unit tests
cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc
```

The Windows target check needs `llvm-rc` on PATH (`apt-get install llvm`) —
`tauri-winres` compiles the `.ico` for Windows targets.

**Memory is a product constraint, not an accident.** The webview decodes every
image it renders, so a 4K wallpaper costs ~33 MB of bitmap memory per `<img>`.

- Grid cards use `thumbs.small` (200px). `thumbs.large` (up to 1280px) is only
  for the detail lightbox.
- Never point an `<img>` at a full resolution file. Local files go through
  `fetch_wallpaper_thumbnail`, which produces a bounded 480px JPEG.
- The grid is virtualised. Do not reintroduce a plain `v-for` over the whole
  list — infinite scroll appends pages for the life of the session.
- Caches are bounded and pruned. Do not add unbounded cache writes.

**Setting the wallpaper.**

- Windows goes through `windows` crate calls in
  [wallpaper.rs](src-tauri/src/wallpaper.rs): registry writes plus
  `SystemParametersInfoW`. Do not reintroduce a PowerShell or child-process
  path, and do not use the ANSI `SystemParametersInfoA` — it needs GBK-encoded
  paths and breaks on non-ASCII directories.
- macOS uses `osascript`, Linux uses `gsettings`. Both are the supported way to
  drive those platforms.

**Licence.** The project is MIT (see README). Keep new dependencies MIT or
Apache-2.0.

## Architecture

**Tauri v2 + Vue 3 desktop wallpaper browser for wallhaven.cc.** The Rust backend proxies all Wallhaven HTTP requests — the frontend never calls Wallhaven directly.

### Why Rust proxies everything

- **Wallhaven API**: bypasses CORS
- **Wallpaper images** (w.wallhaven.cc/full/): bypasses CDN hotlinking (returns 403 without `Referer: https://wallhaven.cc/` header). Images cached to `{app_data_dir}/cache/images/`.
- **Downloads**: streaming download with progress events emitted to the frontend

### Backend (`src-tauri/`)

| File | Purpose |
|------|---------|
| [lib.rs](src-tauri/src/lib.rs) | App setup, plugin init, command registration. DevTools shortcuts: `Cmd/Ctrl+J` open, `Cmd/Ctrl+K` close (debug only). |
| [commands.rs](src-tauri/src/commands.rs) | All `#[tauri::command]` handlers: `download_image`, `cancel_download`, `get_downloads`, `clear_download`, `delete_download_file`, `open_download_folder`, `reveal_download_file`, `get_download_dir`, `set_download_dir`, `choose_download_dir`, `get_app_data_path`, `fetch_wallpaper_image`, `set_desktop_wallpaper`, `fetch_wallhaven_api` |
| [download.rs](src-tauri/src/download.rs) | `DownloadState` (managed as `Arc<Mutex<>>`), streaming download with per-100ms progress events, cancellation support |
| [wallpaper.rs](src-tauri/src/wallpaper.rs) | `WallpaperMode` (fill / fit / stretch / tile / center / span / system) and the per-platform setter. Windows goes straight through Win32 (`windows` crate): writes `HKCU\Control Panel\Desktop` (`Wallpaper`, `WallpaperStyle`, `TileWallpaper`) then calls `SystemParametersInfoW(SPI_SETDESKWALLPAPER)`. macOS uses `osascript`, Linux uses `gsettings` |

**Tauri plugins**: `fs`, `dialog`, `global-shortcut`, `log` (debug only)

**Window**: 1400×900 default, 1000×700 min, **no native decorations** (custom titlebar), centered, resizable.

### Frontend (`src/`)

**Stack**: Vue 3 Composition API + `<script setup>`, TypeScript, Vite, Tailwind CSS v4, Pinia, Vue Router, Lucide, Material Symbols, `@vueuse/core`

**Routes** (all under AppShell layout):
| Path | View | categories |
|------|------|------------|
| `/hot` | HomeView | `111` (all) |
| `/acg` | AnimeView | `010` (anime) |
| `/people` | PeopleView | `001` (people) |
| `/collection` | CollectionView | localStorage |
| `/download` | DownloadView | download manager |
| `/about` | AboutView | — |

**Key patterns:**

1. **API layer** ([api/wallhaven.ts](src/api/wallhaven.ts)): `wallhavenApi.search()` → `invoke('fetch_wallhaven_api')` via Rust. `wallhavenApi.fetchImage()` → `invoke('fetch_wallpaper_image')` → `convertFileSrc()` for local file URIs.

2. **Browse page composable** ([composables/useBrowsePage.ts](src/composables/useBrowsePage.ts)): Shared by HomeView/AnimeView/PeopleView. Manages fetching, pagination, and wires up infinite scroll.

3. **Infinite scroll** ([composables/useInfiniteScroll.ts](src/composables/useInfiniteScroll.ts)): `@vueuse/core` `useIntersectionObserver` on a sentinel div. Guarded by `isExecuting` flag (300ms debounce).

4. **Detail lightbox**: Managed in AppShell via `provide('openDetail', fn)`. Any view can call `openDetail(wallpaper, list)` to open WallpaperDetail with prev/next support.

5. **Custom titlebar** ([components/layout/Titlebar.vue](src/components/layout/Titlebar.vue)): Window controls since native decorations are off.

**Stores** (Pinia):
- [wallpaper.ts](src/stores/wallpaper.ts) — search results, pagination meta, loading/error
- [download.ts](src/stores/download.ts) — download queue, listens to `download-progress`/`download-error` Tauri events, persisted to localStorage
- [collection.ts](src/stores/collection.ts) — favorites in localStorage
- [filter.ts](src/stores/filter.ts) — global purity/sorting/resolution/query params. Views `watch` this store and react.

### Wallhaven API (see [docs/wallhaven-api.md](docs/wallhaven-api.md) for full reference)

- Base: `https://wallhaven.cc/api/v1`
- `categories`: 3-bit string `general/anime/people` (e.g. `111` = all, `010` = anime only)
- `purity`: 3-bit string `sfw/sketchy/nsfw` (e.g. `100` = SFW only)
- `sorting`: `toplist`, `hot`, `date_added`, `views`, `favorites`, `random`
- `atleast`: min resolution (e.g. `3840x2160`)
- Rate limit: 45 req/min
- 24 results per page; pagination via `page` param and `meta.current_page`/`meta.last_page`
- NSFW requires API key
- Image CDN: `w.wallhaven.cc/full/{path}` — requires `Referer: https://wallhaven.cc/`

### Design

Glassmorphism + macOS Ventura aesthetic per [docs/init.md](docs/init.md):
- Frosted glass: `bg-white/40 backdrop-blur-[40px]`, rounded-2xl, subtle borders `border-black/5`
- Cold tones (light blue/purple) with warm orange accents
- Sidebar: 280px fixed left nav, 3 groups (在线壁纸 / 我的壁纸 / 其他)
- Global header: purity toggle (SFW/Sketchy/NSFW), sort dropdown, resolution dropdown, search bar
- Wallpaper grid: responsive masonry-like, max 5 per row
- Lightbox detail view with prev/next navigation
- Background: gradient ambient layer over full viewport
- Fonts: Inter (body), Manrope (headings), JetBrains Mono, Material Symbols icons
- `@` path alias resolves to `src/`
