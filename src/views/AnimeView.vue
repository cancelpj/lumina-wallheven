<script setup lang="ts">
import { watch, computed } from 'vue'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid.vue'
import { useBrowsePage } from '@/composables/useBrowsePage'
import { useFilterStore } from '@/stores/filter'

const filterStore = useFilterStore()

const { store, hasMore, onLoadMore, onSearch, onDownload } = useBrowsePage({
  categories: '010',
  purity: filterStore.params.purity || '100',
  sorting: filterStore.params.sorting || 'toplist',
  atleast: filterStore.params.atleast || '3840x2160',
  q: filterStore.params.q || '',
})

const emptyDescription = computed(() => {
  if (filterStore.purityKeys.nsfw && !localStorage.getItem('wallhaven-api-key')) {
    return '使用NSFW类别，需要在设置中配置 ApiKey'
  }
  return undefined
})

watch(
  () => [filterStore.params.purity, filterStore.params.sorting, filterStore.params.atleast, filterStore.params.q, filterStore.refreshCounter],
  () => {
    onSearch(filterStore.getSnapshot())
  },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <WallpaperGrid
      :wallpapers="store.wallpapers"
      :loading="store.loading"
      :has-more="hasMore"
      :empty-description="emptyDescription"
      :error="store.error"
      @load-more="onLoadMore"
      @download="onDownload"
    />
  </div>
</template>
