import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { wallhavenApi } from '@/api/wallhaven'
import type { WallpaperData, SearchMeta, SearchParams } from '@/types/wallhaven'

export const useWallpaperStore = defineStore('wallpaper', () => {
  const wallpapers = ref<WallpaperData[]>([])
  const meta = reactive<SearchMeta>({ current_page: 1, last_page: 1, per_page: 24, total: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchWallpapers(params: SearchParams, append = false) {
    loading.value = true
    error.value = null
    try {
      const response = await wallhavenApi.search(params)
      if (append) {
        wallpapers.value.push(...response.data)
      } else {
        wallpapers.value = response.data
      }
      Object.assign(meta, response.meta)
    } catch (e: any) {
      error.value = e.message || 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  function reset() {
    wallpapers.value = []
    meta.current_page = 1
    meta.last_page = 1
    meta.total = 0
    loading.value = false
    error.value = null
  }

  return { wallpapers, meta, loading, error, fetchWallpapers, reset }
})
