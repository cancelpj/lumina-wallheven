<script setup lang="ts">
import { computed, onMounted, ref, provide, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import Sidebar from './Sidebar.vue'
import GlobalHeader from '@/components/wallpaper/GlobalHeader.vue'
import WallpaperDetail from '@/components/wallpaper/WallpaperDetail.vue'
import ToastViewport from '@/components/common/ToastViewport.vue'
import DownloadProgressPopup from '@/components/common/DownloadProgressPopup.vue'
import { useWallpaperStore } from '@/stores/wallpaper'
import { useDownloadStore } from '@/stores/download'
import type { WallpaperData } from '@/types/wallhaven'

const detailTarget = ref<WallpaperData | null>(null)
const detailList = ref<WallpaperData[]>([])
const detailVisible = ref(false)
const detailIndex = ref(0)
const route = useRoute()
const onlineWallpaperRoutes = new Set(['hot', 'acg', 'people'])
const showGlobalHeader = computed(() => onlineWallpaperRoutes.has(String(route.name)))

const openDetail = (data: WallpaperData, list?: WallpaperData[]) => {
  detailTarget.value = data
  detailVisible.value = true
  if (list && list.length > 0) {
    detailList.value = list
    detailIndex.value = list.findIndex(item => item.id === data.id)
  } else {
    detailList.value = []
    detailIndex.value = 0
  }
}

const closeDetail = () => {
  detailVisible.value = false
  detailTarget.value = null
}

const nextDetail = () => {
  if (detailList.value.length > 0 && detailIndex.value < detailList.value.length - 1) {
    detailIndex.value++
    detailTarget.value = detailList.value[detailIndex.value]
  }
}

const prevDetail = () => {
  if (detailList.value.length > 0 && detailIndex.value > 0) {
    detailIndex.value--
    detailTarget.value = detailList.value[detailIndex.value]
  }
}

// 窗口拖拽：Electron 下由 CSS -webkit-app-region: drag 实现（见模板拖拽条），
// 无需 JS 调用 startDragging。
const wallpaperStore = useWallpaperStore()
const downloadStore = useDownloadStore()
const bgImageUrl = ref('')
const bgLoaded = ref(false)

watch(() => wallpaperStore.wallpapers, (papers) => {
  if (papers.length === 0) return
  const best = papers.reduce((a, b) => (a.favorites || 0) > (b.favorites || 0) ? a : b)
  const thumb = best.thumbs.small
  if (!thumb || thumb === bgImageUrl.value) return
  const img = new Image()
  img.onload = () => {
    bgImageUrl.value = thumb
    bgLoaded.value = true
  }
  img.src = thumb
})

provide('openDetail', openDetail)
provide('closeDetail', closeDetail)

onMounted(() => {
  downloadStore.setupListeners()
  downloadStore.initializeDownloadDir()
})
</script>

<template>
  <div class="app-window-shell flex h-screen overflow-hidden text-on-surface bg-background">
    <!-- Background Layer -->
    <div class="absolute inset-0 z-0 overflow-hidden rounded-[24px]">
      <!-- Ambient gradient (always visible) -->
      <div class="absolute inset-0 bg-gradient-to-br from-primary-fixed/20 via-surface-bright/40 to-tertiary-fixed/20" />
      <!-- Wallpaper thumbnail background (blurred) -->
      <div
        v-if="bgImageUrl"
        class="absolute inset-0 bg-cover bg-center scale-110 transition-opacity duration-1000"
        :class="bgLoaded ? 'opacity-40' : 'opacity-0'"
        :style="{
          backgroundImage: `url(${bgImageUrl})`,
          filter: 'blur(24px) saturate(1.3)',
        }"
      />
    </div>

    <!-- 无边框窗口的隐形拖拽条（Electron: -webkit-app-region: drag） -->
    <div
      style="-webkit-app-region: drag"
      class="absolute left-6 right-6 top-0 z-[240] h-4 cursor-grab active:cursor-grabbing"
    />

    <!-- Sidebar Navigation (fixed, matching layout.html) -->
    <Sidebar />

    <!-- Main Content Area (ml-[280px] matching layout.html sidebar width) -->
    <main class="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
      <!-- Global Header (SFW/Sketchy/NSFW, Sort/Res dropdowns, Search) -->
      <GlobalHeader v-if="showGlobalHeader" />

      <!-- Page Content -->
      <RouterView v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" class="min-h-0 flex-1" />
        </transition>
      </RouterView>

    </main>

    <!-- Wallpaper Detail Lightbox -->
    <template v-if="detailVisible && detailTarget">
      <WallpaperDetail
        :data="detailTarget"
        :has-prev="detailIndex > 0"
        :has-next="detailIndex < detailList.length - 1"
        @close="closeDetail"
        @prev="prevDetail"
        @next="nextDetail"
      />
    </template>

    <ToastViewport />
    <DownloadProgressPopup />
  </div>
</template>
