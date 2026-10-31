<script setup lang="ts">
import { useCollectionStore } from '@/stores/collection'
import WallpaperGrid from '@/components/wallpaper/WallpaperGrid.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const collection = useCollectionStore()
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page Header -->
    <div class="h-20 flex items-center px-10 m-4 rounded-2xl border border-black/5 bg-white/40 backdrop-blur-[40px]">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[28px]">favorite</span>
        <div>
          <h2 class="text-headline-lg text-on-surface">My Favorites</h2>
          <p class="text-body-sm text-on-surface-variant">{{ collection.items.length }} wallpapers</p>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <template v-if="collection.items.length > 0">
        <WallpaperGrid
          :wallpapers="collection.items"
          :loading="false"
          :has-more="false"
        />
      </template>
      <div v-else class="flex-1 flex items-center justify-center">
        <EmptyState
          title="No favorites yet"
          description="Click the heart icon on any wallpaper to save it here"
        />
      </div>
    </div>
  </div>
</template>
