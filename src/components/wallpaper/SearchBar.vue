<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { SearchParams } from '@/types/wallhaven'

const emit = defineEmits<{ search: [params: SearchParams]; refresh: [] }>()

const refreshing = ref(false)

const params = reactive<SearchParams>({
  sorting: 'toplist',
  purity: '100',
  atleast: '',
  ratios: '',
  q: '',
  page: 1,
})

const sortOpen = ref(false)
const resOpen = ref(false)

const purityOptions = [
  { label: 'SFW', key: 'sfw' as const },
  { label: 'Sketchy', key: 'sketchy' as const },
  { label: 'NSFW', key: 'nsfw' as const },
]

const purityActiveStyles: Record<string, { backgroundImage: string; boxShadow: string; color: string }> = {
  sfw: {
    backgroundImage: 'linear-gradient(to bottom, #595 0%, #353 100%)',
    boxShadow: '0 0 24px rgba(85,153,85,0.45), 0 0 48px rgba(85,153,85,0.18)',
    color: '#9f9',
  },
  sketchy: {
    backgroundImage: 'linear-gradient(to bottom, #995 0%, #553 100%)',
    boxShadow: '0 0 24px rgba(153,153,85,0.45), 0 0 48px rgba(153,153,85,0.18)',
    color: '#ff9',
  },
  nsfw: {
    backgroundImage: 'linear-gradient(to bottom, #955 0%, #533 100%)',
    boxShadow: '0 0 24px rgba(153,85,85,0.45), 0 0 48px rgba(153,85,85,0.18)',
    color: '#fcc',
  },
}

const puritySelection = reactive({
  sfw: true,
  sketchy: false,
  nsfw: false,
})

function getPurity(): string {
  return (puritySelection.sfw ? '1' : '0')
       + (puritySelection.sketchy ? '1' : '0')
       + (puritySelection.nsfw ? '1' : '0')
}

function onPurityToggle(key: 'sfw' | 'sketchy' | 'nsfw') {
  const selected = purityOptions.filter(o => puritySelection[o.key])
  if (selected.length === 1 && selected[0].key === key) return
  puritySelection[key] = !puritySelection[key]
  params.purity = getPurity()
  doSearch()
}

const sortingOptions = [
  { label: 'Top', value: 'toplist' },
  { label: 'Hot', value: 'hot' },
  { label: 'Newest', value: 'date_added' },
  { label: 'Views', value: 'views' },
  { label: 'Favorites', value: 'favorites' },
  { label: 'Random', value: 'random' },
]

const resolutionOptions = [
  { label: 'All', value: '' },
  { label: '1080p+', value: '1920x1080' },
  { label: '2K+', value: '2560x1440' },
  { label: '4K+', value: '3840x2160' },
  { label: '8K+', value: '7680x4320' },
]

const currentSortLabel = ref('Top')
const currentResLabel = ref('4K+')

function doSearch() {
  params.page = 1
  emit('search', { ...params })
}

function onSortChange(opt: typeof sortingOptions[number]) {
  params.sorting = opt.value
  currentSortLabel.value = opt.label
  sortOpen.value = false
  doSearch()
}

function onResChange(opt: typeof resolutionOptions[number]) {
  params.atleast = opt.value
  currentResLabel.value = opt.label
  resOpen.value = false
  doSearch()
}

function toggleSort() {
  sortOpen.value = !sortOpen.value
  resOpen.value = false
}

function toggleRes() {
  resOpen.value = !resOpen.value
  sortOpen.value = false
}

function onSearchKeyup(e: KeyboardEvent) {
  if (e.key === 'Enter') doSearch()
}

function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  emit('refresh')
  doSearch()
  setTimeout(() => {
    refreshing.value = false
  }, 600)
}
</script>

<template>
  <header
    class="w-full h-20 shrink-0 sticky top-0 z-50 flex justify-between items-center px-10 m-4 rounded-2xl border border-black/5 bg-white/40 backdrop-blur-[40px]"
  >
    <div class="flex items-center gap-3">
      <!-- Purity Toggle (multi-select) -->
      <div class="flex gap-1 bg-surface-container-high/30 p-1 rounded-xl border border-black/5">
        <button
          v-for="opt in purityOptions"
          :key="opt.key"
          @click="onPurityToggle(opt.key)"
          class="px-3 py-2 rounded-lg text-label-caps font-bold transition-all duration-300"
          :class="puritySelection[opt.key]
            ? ''
            : 'text-on-surface-variant hover:text-on-surface font-medium'"
          :style="puritySelection[opt.key] ? purityActiveStyles[opt.key] : {}"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Sort Dropdown -->
      <div class="relative">
        <button
          @click="toggleSort"
          class="flex items-center gap-1.5 bg-black/5 hover:bg-black/10 px-3 py-2 rounded-xl border border-black/5 transition-all"
        >
          <span class="text-label-caps text-on-surface-variant">Sort:</span>
          <span class="text-label-caps text-on-surface font-bold">{{ currentSortLabel }}</span>
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
        </button>
        <div
          v-if="sortOpen"
          class="absolute top-full mt-2 left-0 bg-white/90 backdrop-blur-xl border border-black/5 rounded-xl shadow-xl p-1 min-w-[140px] z-50"
        >
          <button
            v-for="opt in sortingOptions"
            :key="opt.value"
            @click="onSortChange(opt)"
            class="w-full text-left px-4 py-2 rounded-lg text-label-caps transition-all hover:bg-black/5"
            :class="params.sorting === opt.value ? 'text-primary font-bold' : 'text-on-surface-variant'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Resolution Dropdown -->
      <div class="relative">
        <button
          @click="toggleRes"
          class="flex items-center gap-1.5 bg-black/5 hover:bg-black/10 px-3 py-2 rounded-xl border border-black/5 transition-all"
        >
          <span class="text-label-caps text-on-surface-variant">Res:</span>
          <span class="text-label-caps text-on-surface font-bold">{{ currentResLabel }}</span>
          <span class="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
        </button>
        <div
          v-if="resOpen"
          class="absolute top-full mt-2 left-0 bg-white/90 backdrop-blur-xl border border-black/5 rounded-xl shadow-xl p-1 min-w-[120px] z-50"
        >
          <button
            v-for="opt in resolutionOptions"
            :key="opt.value"
            @click="onResChange(opt)"
            class="w-full text-left px-4 py-2 rounded-lg text-label-caps transition-all hover:bg-black/5"
            :class="params.atleast === opt.value ? 'text-primary font-bold' : 'text-on-surface-variant'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Search and Actions -->
    <div class="flex items-center gap-3 flex-1 max-w-xl justify-end ml-6">
      <div class="relative w-full max-w-xs">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
        <input
          v-model="params.q"
          class="w-full bg-white/60 border border-black/5 rounded-full py-2 pl-10 pr-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all backdrop-blur-xl placeholder:text-on-surface-variant/50"
          placeholder="搜索 4K 壁纸…"
          type="text"
          @keyup="onSearchKeyup"
        />
      </div>
      <button
        class="hover:text-primary transition-colors cursor-pointer"
        :class="{ 'animate-spin': refreshing }"
        @click="handleRefresh"
      >
        <span class="material-symbols-outlined text-[20px]">refresh</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Click outside to close dropdowns */
button {
  cursor: pointer;
}
</style>
