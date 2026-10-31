<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import type { WallpaperData } from '@/types/wallhaven'
import WallpaperCard from './WallpaperCard.vue'
import SkeletonGrid from '@/components/common/SkeletonGrid.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const props = defineProps<{
  wallpapers: WallpaperData[]
  loading: boolean
  hasMore: boolean
  emptyTitle?: string
  emptyDescription?: string
  error?: string | null
}>()

const emit = defineEmits<{
  loadMore: []
  download: [data: WallpaperData]
}>()

// IntersectionObserver sentinel at the bottom of scrollable content
const sentinel = ref<HTMLElement | null>(null)
let isExecuting = false

useIntersectionObserver(
  sentinel,
  ([{ isIntersecting }]) => {
    if (isIntersecting && props.hasMore && !props.loading && !isExecuting) {
      isExecuting = true
      emit('loadMore')
      setTimeout(() => { isExecuting = false }, 300)
    }
  },
  {
    threshold: 0,
    rootMargin: '0px 0px 200px 0px',
  },
)
</script>

<template>
  <div class="flex-1 overflow-y-auto p-10 custom-scrollbar">
    <!-- Wallpapers Grid -->
    <div
      v-if="wallpapers.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      <WallpaperCard
        v-for="wallpaper in wallpapers"
        :key="wallpaper.id"
        :data="wallpaper"
        @download="emit('download', wallpaper)"
      />
    </div>

    <!-- Initial loading -->
    <SkeletonGrid v-if="loading && wallpapers.length === 0" />

    <!-- Load more indicator -->
    <div
      v-if="loading && wallpapers.length > 0"
      class="flex justify-center py-12"
    >
      <div class="flex gap-2">
        <span
          v-for="i in 3"
          :key="i"
          class="w-2 h-2 rounded-full bg-primary/40 animate-bounce"
          :style="{ animationDelay: `${i * 0.15}s` }"
        />
      </div>
    </div>

    <!-- Sentinel for infinite scroll — must be inside the scroll container -->
    <div ref="sentinel" class="h-24 w-full" />

    <!-- Empty state -->
    <EmptyState
      v-if="!loading && wallpapers.length === 0"
      :title="error ? '加载失败' : (emptyTitle || 'No wallpapers found')"
      :description="error || emptyDescription || 'Try adjusting your search filters'"
    />
  </div>
</template>
