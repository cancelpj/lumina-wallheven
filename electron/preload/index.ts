/**
 * Preload 桥接层 —— 通过 contextBridge 把 Electron 能力安全地暴露为 window.lumina。
 * 渲染进程不再直接接触 Node/Electron API（contextIsolation: true）。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { LuminaApi } from './lumina-api'

const luminaApi: LuminaApi = {
  // ── 窗口控制 ──
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },

  // ── 下载管理 ──
  downloadImage: (payload) => ipcRenderer.invoke('download:start', payload),
  cancelDownload: (id) => ipcRenderer.invoke('download:cancel', id),
  getDownloads: () => ipcRenderer.invoke('download:list'),
  clearDownload: (id) => ipcRenderer.invoke('download:clear', id),
  deleteDownloadFile: (id, filePath) => ipcRenderer.invoke('download:delete-file', { id, filePath }),
  openDownloadFolder: (path) => ipcRenderer.invoke('download:open-folder', path),
  revealDownloadFile: (path) => ipcRenderer.invoke('download:reveal-file', path),
  getDownloadDir: () => ipcRenderer.invoke('download:get-dir'),
  setDownloadDir: (path) => ipcRenderer.invoke('download:set-dir', path),
  chooseDownloadDir: () => ipcRenderer.invoke('download:choose-dir'),

  // ── 应用 / 缓存 ──
  getAppDataPath: () => ipcRenderer.invoke('app:data-path'),
  getCacheInfo: () => ipcRenderer.invoke('cache:info'),
  clearAppCache: () => ipcRenderer.invoke('cache:clear'),

  // ── 图片 / 壁纸 ──
  fetchWallpaperImage: (path) => ipcRenderer.invoke('image:fetch', path),
  fileUrl: (path) => `lumina://file?path=${encodeURIComponent(path)}`,
  setDesktopWallpaper: (path) => ipcRenderer.invoke('wallpaper:set', path),

  // ── Wallhaven API 代理 ──
  fetchWallhavenApi: (endpoint, params, apiKey) =>
    ipcRenderer.invoke('proxy:wallhaven', { endpoint, params, apiKey }),

  // ── 下载事件订阅（替代 Tauri listen）──
  onDownloadProgress: (callback) => {
    const listener = (_event: unknown, payload: unknown) => callback(payload)
    ipcRenderer.on('download-progress', listener)
    return () => {
      ipcRenderer.removeListener('download-progress', listener)
    }
  },
  onDownloadError: (callback) => {
    const listener = (_event: unknown, payload: unknown) => callback(payload)
    ipcRenderer.on('download-error', listener)
    return () => {
      ipcRenderer.removeListener('download-error', listener)
    }
  },
}

contextBridge.exposeInMainWorld('lumina', luminaApi)
