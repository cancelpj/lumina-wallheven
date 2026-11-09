import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type { WallpaperData, DownloadItem } from '@/types/wallhaven'
import { useToastStore } from '@/stores/toast'

const DOWNLOADS_KEY = 'wallhaven-downloads'
const DOWNLOAD_DIR_KEY = 'wallhaven-download-dir'

export const useDownloadStore = defineStore('download', () => {
  const items = ref<DownloadItem[]>(loadFromStorage())
  const activeIds = ref<Set<string>>(new Set())
  const downloadDir = ref('')
  const selectingDir = ref(false)
  const removedIds = new Set<string>()
  let unlistenProgress: UnlistenFn | null = null
  let unlistenError: UnlistenFn | null = null

  function loadFromStorage(): DownloadItem[] {
    try {
      const raw = localStorage.getItem(DOWNLOADS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function loadSavedDownloadDir(): string {
    try {
      return localStorage.getItem(DOWNLOAD_DIR_KEY) || ''
    } catch {
      return ''
    }
  }

  function persist() {
    // Debounced persistence
    const data = items.value.slice(0, 100)
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(data))
  }

  function persistDownloadDir(path: string) {
    downloadDir.value = path
    localStorage.setItem(DOWNLOAD_DIR_KEY, path)
  }

  async function setupListeners() {
    if (unlistenProgress) return

    unlistenProgress = await listen<DownloadItem>('download-progress', (event) => {
      const payload = event.payload
      if (removedIds.has(payload.id)) return

      const existing = items.value.find(i => i.id === payload.id)
      if (existing) {
        Object.assign(existing, {
          ...payload,
          thumbnail: payload.thumbnail || existing.thumbnail,
        })
      } else {
        items.value.unshift(payload)
      }
      if (payload.state === 'done' || payload.state === 'error') {
        activeIds.value.delete(payload.id)
      }
      persist()
    })

    unlistenError = await listen<{ id: string; error: string }>('download-error', (event) => {
      const { id } = event.payload
      if (removedIds.has(id)) return

      const item = items.value.find(i => i.id === id)
      if (item) item.state = 'error'
      activeIds.value.delete(id)
      persist()
    })
  }

  async function initializeDownloadDir() {
    const saved = loadSavedDownloadDir()

    if (saved) {
      try {
        const path = await invoke<string>('set_download_dir', { path: saved })
        persistDownloadDir(path)
        return
      } catch {
        localStorage.removeItem(DOWNLOAD_DIR_KEY)
      }
    }

    const path = await invoke<string>('get_download_dir')
    persistDownloadDir(path)
  }

  async function chooseDownloadDir() {
    selectingDir.value = true
    try {
      const path = await invoke<string | null>('choose_download_dir')
      if (path) persistDownloadDir(path)
      return path
    } finally {
      selectingDir.value = false
    }
  }

  async function openDownloadDir(path = downloadDir.value) {
    if (!path) return
    await invoke('open_download_folder', { path })
  }

  async function revealDownloadFile(path?: string) {
    if (!path) return
    await invoke('reveal_download_file', { path })
  }

  function isDownloading(id: string): boolean {
    return activeIds.value.has(id)
  }

  function isDownloaded(id: string): boolean {
    return items.value.some(i => i.id === id && i.state === 'done')
  }

  async function startDownload(data: WallpaperData) {
    const toast = useToastStore()

    // 检查是否正在下载中
    if (isDownloading(data.id)) {
      toast.show('正在下载中，请稍后查看', {
        icon: 'download',
        tone: 'info',
      })
      return
    }

    // 检查是否已下载完成
    if (isDownloaded(data.id)) {
      toast.show('当前图片已经下载，无需重复下载', {
        icon: 'check_circle',
        tone: 'info',
      })
      return
    }

    const ext = data.path.substring(data.path.lastIndexOf('.')) || '.jpg'
    const file_name = `wallhaven-${data.id}${ext}`
    removedIds.delete(data.id)

    items.value.unshift({
      id: data.id,
      url: data.path,
      file_name,
      resolution: data.resolution,
      received_bytes: 0,
      total_bytes: data.file_size,
      speed_bytes: 0,
      state: 'waiting',
      thumbnail: data.thumbs.small || data.thumbs.large || data.thumbs.original,
    })

    activeIds.value.add(data.id)
    persist()

    try {
      await invoke('download_image', {
        url: data.path,
        id: data.id,
        fileName: file_name,
        resolution: data.resolution,
      })
    } catch {
      activeIds.value.delete(data.id)
      items.value = items.value.filter(item => item.id !== data.id || item.state !== 'waiting')
      persist()
      toast.show('添加下载失败，请稍后再试', {
        icon: 'error',
        tone: 'info',
      })
    }
  }

  async function cancelDownload(id: string) {
    removedIds.add(id)
    activeIds.value.delete(id)
    items.value = items.value.filter(item => item.id !== id)
    persist()

    await invoke('cancel_download', { id })
  }

  async function deleteDownload(id: string) {
    const item = items.value.find(download => download.id === id)
    removedIds.add(id)
    await invoke('delete_download_file', { id, filePath: item?.file_path ?? null })
    items.value = items.value.filter(item => item.id !== id)
    persist()
  }

  function getActive() {
    return items.value.filter(i => i.state === 'waiting' || i.state === 'downloading')
  }

  function getCompleted() {
    return items.value.filter(i => i.state === 'done')
  }

  return {
    items,
    activeIds,
    downloadDir,
    selectingDir,
    setupListeners,
    initializeDownloadDir,
    chooseDownloadDir,
    openDownloadDir,
    revealDownloadFile,
    isDownloading,
    isDownloaded,
    startDownload,
    cancelDownload,
    deleteDownload,
    getActive,
    getCompleted,
  }
})
