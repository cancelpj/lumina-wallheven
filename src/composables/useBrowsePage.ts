import { ref, onMounted } from 'vue'
import { useWallpaperStore } from '@/stores/wallpaper'
import { useDownloadStore } from '@/stores/download'
import type { SearchParams, WallpaperData } from '@/types/wallhaven'

export function useBrowsePage(defaultParams: SearchParams) {
  const store = useWallpaperStore()
  const downloadStore = useDownloadStore()

  const currentParams = ref<SearchParams>({ ...defaultParams, page: 1 })
  const hasMore = ref(true)

  async function loadWallpapers(append = false) {
    if (!append) {
      currentParams.value.page = 1
    }
    await store.fetchWallpapers(currentParams.value, append)
    hasMore.value = (currentParams.value.page || 1) < store.meta.last_page
  }

  function onSearch(params: SearchParams) {
    currentParams.value = { ...currentParams.value, ...params, page: 1 }
    store.reset()
    hasMore.value = false
    loadWallpapers()
  }

  function onLoadMore() {
    if (!hasMore.value || store.loading) return
    currentParams.value.page = (store.meta.current_page || 1) + 1
    loadWallpapers(true)
  }

  function onDownload(data: WallpaperData) {
    downloadStore.startDownload(data)
  }

  onMounted(() => {
    store.reset()
    loadWallpapers()
  })

  return {
    store,
    currentParams,
    hasMore,
    onLoadMore,
    onSearch,
    onDownload,
  }
}
