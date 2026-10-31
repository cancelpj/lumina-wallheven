<script setup lang="ts">
import { computed, ref, watch, onUnmounted, onMounted } from 'vue'
import type { WallpaperData } from '@/types/wallhaven'
import { wallhavenApi } from '@/api/wallhaven'
import { useCollectionStore } from '@/stores/collection'
import { useDownloadStore } from '@/stores/download'
import { useToastStore } from '@/stores/toast'

const props = defineProps<{
  data: WallpaperData
  hasPrev: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  close: []
  prev: []
  next: []
}>()

const collection = useCollectionStore()
const downloadStore = useDownloadStore()
const toast = useToastStore()

const fullImageUrl = ref('')
const previewImageUrl = ref('')
const loading = ref(true)
const zoomScale = ref(1)
const dragging = ref(false)
const isDragging = ref(false)
const panX = ref(0)
const panY = ref(0)
const settingWallpaper = ref(false)

// Template refs for direct DOM manipulation during drag
const previewImgRef = ref<HTMLImageElement | null>(null)
const fullImgRef = ref<HTMLImageElement | null>(null)

let dragStartX = 0
let dragStartY = 0
let dragOriginX = 0
let dragOriginY = 0
let dragged = false
let suppressNextClick = false

// rAF throttle state
let latestClientX = 0
let latestClientY = 0
let rafPending = false

const isZoomed = computed(() => zoomScale.value > 1)

const imageViewportClass = computed(() => {
  if (!isZoomed.value) return 'cursor-zoom-in'
  return dragging.value ? 'cursor-grabbing' : 'cursor-grab'
})

const imageTransformStyle = computed(() => ({
  transform: isZoomed.value
    ? `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${zoomScale.value})`
    : 'translate3d(0, 0, 0) scale(1)',
}))

async function loadImage(data: WallpaperData) {
  loading.value = true
  zoomScale.value = 1
  resetPan()
  previewImageUrl.value = data.thumbs.large || data.thumbs.original || data.thumbs.small
  fullImageUrl.value = wallhavenApi.getFullImageUrl(data.path)
}

watch(() => props.data, (data) => {
  loadImage(data)
}, { immediate: true })

const isFavorited = computed(() => collection.isCollected(props.data.id))

const favIconStyle = {
  fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
}
const defaultIconStyle = {
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
}

function handleFavorite() {
  const willCollect = !isFavorited.value
  collection.toggle(props.data)
  toast.show(willCollect ? '已收藏到 Favorites' : '已取消收藏', {
    icon: willCollect ? 'favorite' : 'heart_minus',
  })
}

function handleDownload() {
  downloadStore.startDownload(props.data)
}

async function handleSetWallpaper() {
  if (settingWallpaper.value) return

  settingWallpaper.value = true
  try {
    await downloadStore.startDownload(props.data)
    await wallhavenApi.setDesktopWallpaper(props.data.path)
    toast.show('桌面壁纸设置成功', {
      icon: 'wallpaper',
      tone: 'success',
    })
  } catch {
    toast.show('设置壁纸失败，请稍后再试', {
      icon: 'error',
      tone: 'info',
    })
  } finally {
    settingWallpaper.value = false
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function handleShare() {
  const sourceUrl = wallhavenApi.getFullImageUrl(props.data.path)

  try {
    await copyText(sourceUrl)
    toast.show('已复制到粘贴板', {
      icon: 'content_copy',
      tone: 'success',
    })
  } catch {
    toast.show('复制失败，请稍后再试', {
      icon: 'error',
      tone: 'info',
    })
  }
}

function handleImageLoad(event: Event) {
  const image = event.target as HTMLImageElement
  if (image.currentSrc !== fullImageUrl.value) return

  loading.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  switch (e.key) {
    case 'Escape': emit('close'); break
    case 'ArrowLeft': if (props.hasPrev) emit('prev'); break
    case 'ArrowRight': if (props.hasNext) emit('next'); break
  }
}

function toggleZoom() {
  if (isZoomed.value) {
    zoomScale.value = 1
  } else {
    zoomScale.value = 2
  }
  resetPan()
}

function resetPan() {
  dragging.value = false
  panX.value = 0
  panY.value = 0
  dragged = false
  suppressNextClick = false
}

function handleImageClick() {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }

  toggleZoom()
}

function handleWheel(event: WheelEvent) {
  event.preventDefault()

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const cx = event.clientX - rect.left - rect.width / 2
  const cy = event.clientY - rect.top - rect.height / 2

  const delta = -event.deltaY * 0.003
  const oldScale = zoomScale.value
  const newScale = Math.max(0.1, oldScale + delta * oldScale)

  // Zoom toward cursor: adjust pan so the point under cursor stays fixed
  const scaleRatio = newScale / oldScale
  panX.value = panX.value * scaleRatio + cx * (1 - scaleRatio)
  panY.value = panY.value * scaleRatio + cy * (1 - scaleRatio)
  zoomScale.value = newScale
}

function applyDragTransform(x: number, y: number) {
  const s = zoomScale.value
  const val = `translate3d(${x}px, ${y}px, 0) scale(${s})`
  if (previewImgRef.value) previewImgRef.value.style.transform = val
  if (fullImgRef.value) fullImgRef.value.style.transform = val
}

function setDragTransition(on: boolean) {
  const val = on ? '' : 'none'
  if (previewImgRef.value) previewImgRef.value.style.transition = val
  if (fullImgRef.value) fullImgRef.value.style.transition = val
}

function handlePointerDown(event: PointerEvent) {
  if (!isZoomed.value) return
  if ((event.target as HTMLElement).closest('button')) return

  dragging.value = true
  isDragging.value = true
  dragged = false
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragOriginX = panX.value
  dragOriginY = panY.value

  setDragTransition(false)
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  event.preventDefault()
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value) return

  latestClientX = event.clientX
  latestClientY = event.clientY

  if (!rafPending) {
    rafPending = true
    requestAnimationFrame(() => {
      rafPending = false
      const dx = latestClientX - dragStartX
      const dy = latestClientY - dragStartY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true
      applyDragTransform(dragOriginX + dx, dragOriginY + dy)
    })
  }
}

function handlePointerUp(event: PointerEvent) {
  if (!dragging.value) return

  // Sync reactive refs once at drag end
  const dx = latestClientX - dragStartX
  const dy = latestClientY - dragStartY
  panX.value = dragOriginX + dx
  panY.value = dragOriginY + dy

  dragging.value = false
  isDragging.value = false
  suppressNextClick = dragged
  if (dragged) {
    window.setTimeout(() => {
      suppressNextClick = false
    }, 120)
  }

  setDragTransition(true)
  ;(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
}

let scrollDisabled = false
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (!scrollDisabled) {
    document.body.style.overflow = 'hidden'
    scrollDisabled = true
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  scrollDisabled = false
})

// Category display name
const categoryName = () => {
  const map: Record<string, string> = {
    '100': 'Anime',
    '010': 'Anime',
    '001': 'People',
    '111': 'General',
    '101': 'Anime',
    '011': 'Anime',
    '110': 'General',
  }
  return map[props.data.category] || props.data.category || 'General'
}

function copyColor(color: string) {
  navigator.clipboard.writeText(color).then(() => {
    toast.show(`已复制 ${color}`, { icon: 'content_copy', tone: 'success' })
  }).catch(() => {
    toast.show('复制失败', { icon: 'error', tone: 'info' })
  })
}
</script>

<template>
  <Teleport to="body">
    <transition name="detail-fade">
      <div
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 modal-overlay"
        @click.self="emit('close')"
      >
        <div
          class="max-w-7xl w-full h-[92vh] light-glass-modal soft-glow overflow-hidden flex flex-col md:flex-row relative rounded-2xl shadow-xl"
        >
          <!-- macOS-style window dots -->
          <div class="absolute top-6 left-6 flex gap-2 z-50">
            <button @click="emit('close')" class="w-3 h-3 rounded-full bg-[#FF5F57] shadow-inner hover:brightness-90 transition-all" />
            <div class="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-inner" />
            <div class="w-3 h-3 rounded-full bg-[#28C840] shadow-inner" />
          </div>

          <!-- Navigation arrows -->
          <button
            v-if="hasPrev"
            @click.stop="emit('prev')"
            class="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-black/10 backdrop-blur-md border border-black/5 flex items-center justify-center hover:bg-black/20 transition-all text-on-surface-variant"
          >
            <span class="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            v-if="hasNext"
            @click.stop="emit('next')"
            class="absolute right-4 md:right-[380px] top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-black/10 backdrop-blur-md border border-black/5 flex items-center justify-center hover:bg-black/20 transition-all text-on-surface-variant"
          >
            <span class="material-symbols-outlined">chevron_right</span>
          </button>

          <!-- Left: Image Preview -->
          <div class="flex-1 min-h-0 bg-black/5 flex items-center justify-center p-3 md:p-5 relative">
            <div
              class="relative w-full h-full overflow-hidden rounded-2xl shadow-2xl border border-white/30 group image-viewport touch-none select-none"
              :class="imageViewportClass"
              @pointerdown="handlePointerDown"
              @pointermove="handlePointerMove"
              @pointerup="handlePointerUp"
              @pointercancel="handlePointerUp"
              @wheel.prevent="handleWheel"
            >
              <img
                ref="previewImgRef"
                :src="previewImageUrl"
                :alt="`Wallpaper ${data.id} preview`"
                class="absolute inset-0 w-full h-full object-contain will-change-transform"
                :class="[
                  'cursor-inherit',
                  loading ? 'opacity-100 blur-sm' : 'opacity-0',
                  !isDragging && 'duration-300',
                ]"
                :style="imageTransformStyle"
                draggable="false"
                referrerpolicy="no-referrer"
                @click="handleImageClick"
              />

              <img
                ref="fullImgRef"
                :src="fullImageUrl"
                :alt="`Wallpaper ${data.id}`"
                class="absolute inset-0 w-full h-full object-contain will-change-transform"
                :class="[
                  'cursor-inherit',
                  loading ? 'opacity-0' : 'opacity-100',
                  !isDragging && 'duration-300',
                ]"
                :style="imageTransformStyle"
                draggable="false"
                referrerpolicy="no-referrer"
                @load="handleImageLoad"
                @click="handleImageClick"
              />

              <!-- Loading -->
              <div
                v-if="loading"
                class="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"
              >
                <div class="flex gap-2 rounded-full bg-black/20 px-4 py-3 backdrop-blur-md">
                  <span v-for="i in 3" :key="i" class="w-2 h-2 rounded-full bg-white/80 animate-bounce" :style="{ animationDelay: `${i * 0.15}s` }" />
                </div>
              </div>

              <!-- Image controls -->
              <div class="absolute bottom-6 right-6 flex gap-3">
                <button
                  @click.stop="toggleZoom"
                  class="bg-black/20 backdrop-blur-xl hover:bg-black/40 p-2.5 rounded-xl text-white transition-all border border-white/20"
                >
                  <span class="material-symbols-outlined">{{ isZoomed ? 'zoom_out' : 'zoom_in' }}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Right: Detail Panel -->
          <div class="w-full md:w-[360px] p-5 md:p-6 flex flex-col gap-5 detail-panel-glass overflow-y-auto">
            <!-- Title & Author -->
            <div>
              <h2 class="font-headline-lg text-headline-lg text-modal-primary mb-2">
                Wallpaper {{ data.id }}
              </h2>
              <p class="font-body-md text-modal-secondary flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-primary">palette</span>
                By {{ data.uploader?.username || 'wallhaven' }}
              </p>
            </div>

            <!-- Resolution, Category & File Size -->
            <div class="grid grid-cols-2 gap-4">
              <div class="detail-info-card p-4 rounded-2xl">
                <span class="block font-label-caps text-modal-secondary mb-1">RESOLUTION</span>
                <span class="font-headline-md text-modal-primary">{{ data.resolution }}</span>
              </div>
              <div class="detail-info-card p-4 rounded-2xl">
                <span class="block font-label-caps text-modal-secondary mb-1">CATEGORY</span>
                <span class="font-headline-md text-modal-primary">{{ categoryName() }}</span>
              </div>
            </div>
            <div class="detail-info-card p-4 rounded-2xl">
              <span class="block font-label-caps text-modal-secondary mb-1">FILE SIZE</span>
              <span class="font-headline-md text-modal-primary">{{ (data.file_size / 1048576).toFixed(1) }} MB</span>
            </div>

            <!-- Color Palette -->
            <div v-if="data.colors && data.colors.length > 0">
              <span class="block font-label-caps text-modal-secondary mb-4">COLOR PALETTE</span>
              <div class="flex items-center gap-1">
                <div
                  v-for="(color, index) in data.colors"
                  :key="index"
                  class="flex items-center detail-info-card rounded-full cursor-pointer hover:bg-white/50 transition-all duration-300 group"
                  @click="copyColor(color)"
                >
                  <div
                    class="w-9 h-9 rounded-full border-2 border-white/50 shadow-md shrink-0 m-1.5"
                    :style="{ backgroundColor: color }"
                  />
                  <span class="font-mono text-body-sm text-modal-primary whitespace-nowrap overflow-hidden max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-hover:pr-3 transition-all duration-300">{{ color }}</span>
                </div>
              </div>
            </div>

            <!-- Stats -->
            <div class="flex gap-4 text-modal-secondary font-body-sm">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">visibility</span>
                {{ data.views?.toLocaleString() || 0 }}
              </span>
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px]">favorite</span>
                {{ data.favorites?.toLocaleString() || 0 }}
              </span>
            </div>

            <!-- Actions -->
            <div class="mt-auto flex flex-col gap-3">
              <button
                @click="handleSetWallpaper"
                :disabled="settingWallpaper"
                class="w-full py-4 bg-primary/90 text-white rounded-2xl font-headline-md flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg shadow-primary/20 backdrop-blur-xl cursor-pointer disabled:cursor-wait disabled:opacity-70"
              >
                <span class="material-symbols-outlined">{{ settingWallpaper ? 'progress_activity' : 'wallpaper' }}</span>
                {{ settingWallpaper ? 'Setting Wallpaper...' : 'Set as Wallpaper' }}
              </button>
              <button
                @click="handleDownload"
                class="w-full py-4 bg-[#FF7D4E]/90 text-white rounded-2xl font-headline-md flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-lg shadow-[#FF7D4E]/20 backdrop-blur-xl cursor-pointer"
              >
                <span class="material-symbols-outlined">download</span>
                Download Wallpaper
              </button>
              <div class="flex gap-3">
                <button
                  @click="handleFavorite"
                  class="flex-1 py-4 detail-info-card rounded-2xl text-modal-primary font-headline-md flex items-center justify-center gap-3 hover:bg-white/40 transition-all cursor-pointer"
                  :class="{ '!bg-primary/10 !border-primary/20 !text-primary': isFavorited }"
                >
                  <span
                    class="material-symbols-outlined"
                    :class="{ 'text-[#FF7D4E]': !isFavorited }"
                    :style="isFavorited ? favIconStyle : defaultIconStyle"
                  >favorite</span>
                  {{ isFavorited ? 'Favorited' : 'Favorite' }}
                </button>
                <button
                  @click="handleShare"
                  class="w-16 py-4 detail-info-card rounded-2xl text-modal-primary flex items-center justify-center hover:bg-white/40 transition-all cursor-pointer"
                >
                  <span class="material-symbols-outlined">share</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.detail-fade-enter-active {
  transition: opacity 0.3s ease-out;
}
.detail-fade-enter-from {
  opacity: 0;
}
.detail-fade-leave-active {
  transition: opacity 0.2s ease-out;
}
.detail-fade-leave-to {
  opacity: 0;
}

.image-viewport {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05)),
    rgba(0, 0, 0, 0.08);
}

.image-viewport::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.image-viewport::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 999px;
}

.detail-panel-glass {
  background: rgba(255, 255, 255, 0.26);
  border-left: 1px solid rgba(255, 255, 255, 0.38);
  backdrop-filter: blur(28px) saturate(1.15);
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.18);
}

.detail-info-card {
  background: rgba(255, 255, 255, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.34);
  backdrop-filter: blur(18px);
}
</style>
