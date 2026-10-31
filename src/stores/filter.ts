import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { SearchParams } from '@/types/wallhaven'

export const useFilterStore = defineStore('filter', () => {
  const params = reactive<SearchParams>({
    sorting: 'toplist',
    purity: '100',
    atleast: '3840x2160',
    q: '',
    page: 1,
  })

  const refreshCounter = ref(0)

  const purityKeys = reactive({
    sfw: true,
    sketchy: false,
    nsfw: false,
  })

  function getPurity(): string {
    return (purityKeys.sfw ? '1' : '0')
         + (purityKeys.sketchy ? '1' : '0')
         + (purityKeys.nsfw ? '1' : '0')
  }

  function togglePurityKey(key: 'sfw' | 'sketchy' | 'nsfw') {
    const selected = Object.entries(purityKeys).filter(([, v]) => v)
    if (selected.length === 1 && selected[0][0] === key) return
    purityKeys[key] = !purityKeys[key]
    params.purity = getPurity()
  }

  function setPurity(purity: string) {
    params.purity = purity
  }

  function setSorting(sorting: string) {
    params.sorting = sorting
  }

  function setAtleast(atleast: string) {
    params.atleast = atleast
  }

  function setQuery(q: string) {
    params.q = q
  }

  function triggerRefresh() {
    refreshCounter.value++
  }

  function getSnapshot(): SearchParams {
    return { ...params }
  }

  return { params, refreshCounter, purityKeys, togglePurityKey, setPurity, setSorting, setAtleast, setQuery, triggerRefresh, getSnapshot }
})
