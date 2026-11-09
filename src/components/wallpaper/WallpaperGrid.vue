<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
}>()

const emit = defineEmits<{
  loadMore: []
  download: [data: WallpaperData]
}>()

/** Gap between cards — matches `gap-6`. */
const GAP = 24
/** Card aspect ratio — matches `aspect-[4/3]`. */
const CARD_ASPECT = 4 / 3
/** Extra rows kept mounted above and below the viewport. */
const OVERSCAN_ROWS = 2

const scroller = ref<HTMLElement | null>(null)
const contentWidth = ref(0)
const viewportHeight = ref(0)
const scrollTop = ref(0)
const columns = ref(4)

let resizeObserver: ResizeObserver | null = null

/**
 * Column count follows the same breakpoints the Tailwind grid used
 * (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), which are viewport based.
 */
function syncColumns() {
  const width = window.innerWidth
  columns.value = width >= 1024 ? 4 : width >= 640 ? 2 : 1
}

function measure() {
  const element = scroller.value
  if (!element) return

  const style = getComputedStyle(element)
  const paddingLeft = parseFloat(style.paddingLeft) || 0
  const paddingRight = parseFloat(style.paddingRight) || 0

  contentWidth.value = element.clientWidth - paddingLeft - paddingRight
  viewportHeight.value = element.clientHeight
}

function onScroll() {
  scrollTop.value = scroller.value?.scrollTop ?? 0
}

const columnWidth = computed(() => {
  if (!contentWidth.value || !columns.value) return 0
  return (contentWidth.value - GAP * (columns.value - 1)) / columns.value
})

const cardHeight = computed(() => columnWidth.value / CARD_ASPECT)
const rowHeight = computed(() => cardHeight.value + GAP)

const totalRows = computed(() =>
  columns.value ? Math.ceil(props.wallpapers.length / columns.value) : 0,
)

const totalHeight = computed(() => Math.max(0, totalRows.value * rowHeight.value - GAP))

const firstVisibleRow = computed(() =>
  rowHeight.value ? Math.floor(scrollTop.value / rowHeight.value) : 0,
)

const visibleRowCount = computed(
  () => (rowHeight.value ? Math.ceil(viewportHeight.value / rowHeight.value) : 1) + OVERSCAN_ROWS * 2,
)

/**
 * Only the rows intersecting the viewport are mounted.
 *
 * Infinite scroll keeps appending pages, and a plain `v-for` would keep every
 * card alive for the whole session — both the DOM nodes and the decoded
 * bitmaps behind them.
 */
const visibleItems = computed(() => {
  const start = firstVisibleRow.value * columns.value
  const end = Math.min(
    props.wallpapers.length,
    (firstVisibleRow.value + visibleRowCount.value) * columns.value,
  )

  const items: { data: WallpaperData; style: Record<string, string> }[] = []

  for (let index = start; index < end; index++) {
    const data = props.wallpapers[index]
    if (!data) continue

    const row = Math.floor(index / columns.value)
    const column = index % columns.value

    items.push({
      data,
      style: {
        width: `${columnWidth.value}px`,
        height: `${cardHeight.value}px`,
        transform: `translate(${column * (columnWidth.value + GAP)}px, ${row * rowHeight.value}px)`,
      },
    })
  }

  return items
})

// IntersectionObserver sentinel at the bottom of scrollable content
const sentinel = ref<HTMLElement | null>(null)
let isExecuting = false

useIntersectionObserver(
  sentinel,
  ([{ isIntersecting }]) => {
    // Wait until the layout has been measured, otherwise the sentinel sits at
    // the top of an empty scroller and fires a burst of load-more requests.
    if (!isIntersecting || totalHeight.value <= 0) return
    if (props.hasMore && !props.loading && !isExecuting) {
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

// A new search resets the list — scroll back to the top so the user is not
// looking at an empty region of a shorter list.
watch(
  () => props.wallpapers.length,
  (length, previous) => {
    if (length < previous) {
      scroller.value?.scrollTo({ top: 0 })
      scrollTop.value = 0
    }
  },
)

onMounted(() => {
  syncColumns()
  window.addEventListener('resize', syncColumns)

  if (scroller.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(scroller.value)
    measure()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncColumns)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div
    ref="scroller"
    class="flex-1 overflow-y-auto p-10 custom-scrollbar"
    @scroll.passive="onScroll"
  >
    <!-- Virtualised grid: the spacer keeps the scrollbar honest while only
         the visible rows are actually mounted. -->
    <div
      v-if="wallpapers.length > 0"
      class="relative"
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        v-for="item in visibleItems"
        :key="item.data.id"
        class="absolute top-0 left-0"
        :style="item.style"
      >
        <WallpaperCard
          :data="item.data"
          @download="emit('download', item.data)"
        />
      </div>
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
      :title="emptyTitle || 'No wallpapers found'"
      :description="emptyDescription || 'Try adjusting your search filters'"
    />
  </div>
</template>
