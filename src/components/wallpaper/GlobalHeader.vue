<script setup lang="ts">
import { ref, watch } from 'vue'
import { useFilterStore } from '@/stores/filter'

const filterStore = useFilterStore()

const sortOpen = ref(false)
const resOpen = ref(false)
const refreshing = ref(false)

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

function onPurityToggle(key: 'sfw' | 'sketchy' | 'nsfw') {
  filterStore.togglePurityKey(key)
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
const searchInput = ref('')

watch(() => filterStore.params.sorting, (val) => {
  const opt = sortingOptions.find(o => o.value === val)
  if (opt) currentSortLabel.value = opt.label
}, { immediate: true })

watch(() => filterStore.params.atleast, (val) => {
  const opt = resolutionOptions.find(o => o.value === val)
  if (opt !== undefined) currentResLabel.value = opt.label
}, { immediate: true })

function onSortChange(opt: typeof sortingOptions[number]) {
  filterStore.setSorting(opt.value)
  currentSortLabel.value = opt.label
  sortOpen.value = false
}

function onResChange(opt: typeof resolutionOptions[number]) {
  filterStore.setAtleast(opt.value)
  currentResLabel.value = opt.label
  resOpen.value = false
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
  if (e.key === 'Enter' && searchInput.value.trim()) {
    filterStore.setQuery(searchInput.value.trim())
  }
}

function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  filterStore.triggerRefresh()
  setTimeout(() => {
    refreshing.value = false
  }, 600)
}

// Close dropdowns on click outside
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.sort-dropdown')) sortOpen.value = false
    if (!target.closest('.res-dropdown')) resOpen.value = false
  })
}
</script>

<template>
  <header
    class="w-full h-20 shrink-0 sticky top-0 z-50 flex justify-between items-center px-10 m-4 rounded-2xl border border-black/5 bg-white/40 backdrop-blur-[40px]"
  >
    <div class="flex items-center gap-6">
      <!-- Purity Toggle (multi-select) -->
      <div class="flex gap-1 bg-surface-container-high/30 p-1 rounded-xl border border-black/5">
        <button
          v-for="opt in purityOptions"
          :key="opt.key"
          @click="onPurityToggle(opt.key)"
          class="px-3 py-2 rounded-lg text-label-caps font-bold transition-all duration-300"
          :class="filterStore.purityKeys[opt.key]
            ? ''
            : 'text-on-surface-variant hover:text-on-surface font-medium'"
          :style="filterStore.purityKeys[opt.key] ? purityActiveStyles[opt.key] : {}"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- Sort Dropdown -->
      <div class="relative sort-dropdown">
        <button
          @click="toggleSort"
          class="flex items-center gap-2 bg-black/5 hover:bg-black/10 px-4 py-2 rounded-xl border border-black/5 transition-all"
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
            :class="filterStore.params.sorting === opt.value ? 'text-primary font-bold' : 'text-on-surface-variant'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Resolution Dropdown -->
      <div class="relative res-dropdown">
        <button
          @click="toggleRes"
          class="flex items-center gap-2 bg-black/5 hover:bg-black/10 px-4 py-2 rounded-xl border border-black/5 transition-all"
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
            :class="filterStore.params.atleast === opt.value ? 'text-primary font-bold' : 'text-on-surface-variant'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Search and Actions -->
    <div class="flex items-center gap-4 flex-1 max-w-xl justify-end ml-6">
      <div class="relative w-full max-w-sm">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        <input
          v-model="searchInput"
          class="w-full bg-white/60 border border-black/5 rounded-full py-2.5 pl-12 pr-4 text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all backdrop-blur-xl placeholder:text-on-surface-variant/50"
          placeholder="Explore 4K wallpapers..."
          type="text"
          @keyup="onSearchKeyup"
        />
      </div>
      <button
        class="hover:text-primary transition-colors cursor-pointer"
        :class="{ 'animate-spin': refreshing }"
        @click="handleRefresh"
      >
        <span class="material-symbols-outlined">refresh</span>
      </button>
    </div>
  </header>
</template>
