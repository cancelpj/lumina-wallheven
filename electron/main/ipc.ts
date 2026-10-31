/**
 * IPC 处理器 —— 对应原 Rust 端 lib.rs 中注册的全部 #[tauri::command]。
 * 每个 ipcMain.handle 都对应 preload 桥接层暴露的一个 window.lumina 方法。
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'fs/promises'
import { downloadManager } from './download'
import type { DownloadPayload } from './download'
import { clearAppCache, fetchWallpaperImage, cacheWallpaperImage, getCacheInfo } from './cache'
import { setSystemWallpaper } from './wallpaper'
import { fetchWallhavenApi } from './proxy'

export function registerIpcHandlers(): void {
  // ── 窗口控制（对应 Titlebar.vue / AppShell.vue 的 getCurrentWindow()）──
  ipcMain.handle('window:minimize', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.minimize()
  })
  ipcMain.handle('window:toggle-maximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })
  ipcMain.handle('window:close', (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })
  ipcMain.handle('window:is-maximized', (e) => {
    return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
  })

  // ── 下载管理（对应 download_image / cancel_download / get_downloads / clear_download / delete_download_file）──
  ipcMain.handle('download:start', (_e, payload: DownloadPayload) => {
    downloadManager.start(payload)
  })
  ipcMain.handle('download:cancel', (_e, id: string) => {
    downloadManager.cancel(id)
  })
  ipcMain.handle('download:list', () => {
    return downloadManager.list()
  })
  ipcMain.handle('download:clear', (_e, id: string) => {
    downloadManager.clear(id)
  })
  ipcMain.handle('download:delete-file', async (_e, payload: { id: string; filePath: string | null }) => {
    await downloadManager.deleteFile(payload.id, payload.filePath)
  })

  // ── 打开目录 / 定位文件（对应 open_download_folder / reveal_download_file）──
  ipcMain.handle('download:open-folder', async (_e, path: string) => {
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  })
  ipcMain.handle('download:reveal-file', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  // ── 下载目录（对应 get_download_dir / set_download_dir / choose_download_dir）──
  ipcMain.handle('download:get-dir', () => {
    return downloadManager.getDownloadDir()
  })
  ipcMain.handle('download:set-dir', async (_e, path: string) => {
    await mkdir(path, { recursive: true })
    downloadManager.setDownloadDir(path)
    return path
  })
  ipcMain.handle('download:choose-dir', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: 'Select Download Folder',
          defaultPath: downloadManager.getDownloadDir(),
          properties: ['openDirectory', 'createDirectory'],
        })
      : { canceled: true, filePaths: [] as string[] }

    if (result.canceled || result.filePaths.length === 0) return null

    const path = result.filePaths[0]
    await mkdir(path, { recursive: true })
    downloadManager.setDownloadDir(path)
    return path
  })

  // ── 应用数据目录（对应 get_app_data_path）──
  ipcMain.handle('app:data-path', () => {
    return app.getPath('userData')
  })

  // ── 缓存管理（对应 get_cache_info / clear_app_cache）──
  ipcMain.handle('cache:info', () => {
    return getCacheInfo()
  })
  ipcMain.handle('cache:clear', () => {
    return clearAppCache()
  })

  // ── 图片代理缓存（对应 fetch_wallpaper_image）──
  ipcMain.handle('image:fetch', (_e, path: string) => {
    return fetchWallpaperImage(path)
  })

  // ── 设置系统壁纸（对应 set_desktop_wallpaper：先缓存到本地再用本地路径设置）──
  ipcMain.handle('wallpaper:set', async (_e, path: string) => {
    const localPath = await cacheWallpaperImage(path)
    await setSystemWallpaper(localPath)
  })

  // ── Wallhaven API 代理（对应 fetch_wallhaven_api）──
  ipcMain.handle(
    'proxy:wallhaven',
    (_e, payload: { endpoint: string; params: Record<string, string>; apiKey: string | null }) => {
      return fetchWallhavenApi(payload.endpoint, payload.params, payload.apiKey)
    },
  )
}
