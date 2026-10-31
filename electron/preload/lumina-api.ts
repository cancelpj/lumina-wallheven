/**
 * window.lumina 桥接层的类型定义（纯类型，无任何运行时依赖）。
 * 渲染进程（Vue 代码）通过该接口访问 Electron 能力。
 */

export interface LuminaWindowApi {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<boolean>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
}

export interface LuminaDownloadPayload {
  url: string
  id: string
  fileName: string
  resolution: string
}

export interface LuminaCacheInfo {
  bytes: number
  path: string
  platform: string
}

export interface LuminaApi {
  /** 窗口控制（替代 @tauri-apps/api/window getCurrentWindow） */
  window: LuminaWindowApi
  /** 开始下载（替代 invoke('download_image')） */
  downloadImage: (payload: LuminaDownloadPayload) => Promise<void>
  /** 取消下载（替代 invoke('cancel_download')） */
  cancelDownload: (id: string) => Promise<void>
  /** 已完成的下载列表（替代 invoke('get_downloads')） */
  getDownloads: () => Promise<unknown[]>
  /** 移除下载记录（替代 invoke('clear_download')） */
  clearDownload: (id: string) => Promise<void>
  /** 删除下载文件（替代 invoke('delete_download_file')） */
  deleteDownloadFile: (id: string, filePath: string | null) => Promise<void>
  /** 打开文件夹（替代 invoke('open_download_folder')） */
  openDownloadFolder: (path: string) => Promise<void>
  /** 在文件管理器中定位文件（替代 invoke('reveal_download_file')） */
  revealDownloadFile: (path: string) => Promise<void>
  /** 获取下载目录（替代 invoke('get_download_dir')） */
  getDownloadDir: () => Promise<string>
  /** 设置下载目录（替代 invoke('set_download_dir')） */
  setDownloadDir: (path: string) => Promise<string>
  /** 弹窗选择下载目录（替代 invoke('choose_download_dir')） */
  chooseDownloadDir: () => Promise<string | null>
  /** 应用数据目录（替代 invoke('get_app_data_path')） */
  getAppDataPath: () => Promise<string>
  /** 缓存信息（替代 invoke('get_cache_info')） */
  getCacheInfo: () => Promise<LuminaCacheInfo>
  /** 清空缓存（替代 invoke('clear_app_cache')） */
  clearAppCache: () => Promise<LuminaCacheInfo>
  /** 拉取壁纸图片到本地缓存，返回可访问 URL（替代 invoke('fetch_wallpaper_image') + convertFileSrc） */
  fetchWallpaperImage: (path: string) => Promise<string>
  /** 本地文件 → 可访问 URL（替代 convertFileSrc） */
  fileUrl: (path: string) => string
  /** 设置系统壁纸（替代 invoke('set_desktop_wallpaper')） */
  setDesktopWallpaper: (path: string) => Promise<void>
  /** Wallhaven API 代理（替代 invoke('fetch_wallhaven_api')） */
  fetchWallhavenApi: (
    endpoint: string,
    params: Record<string, string>,
    apiKey: string | null,
  ) => Promise<unknown>
  /** 订阅下载进度（替代 listen('download-progress')），返回取消订阅函数 */
  onDownloadProgress: (callback: (payload: unknown) => void) => () => void
  /** 订阅下载错误（替代 listen('download-error')），返回取消订阅函数 */
  onDownloadError: (callback: (payload: unknown) => void) => () => void
}
