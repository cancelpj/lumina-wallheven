import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'success' | 'info'

export interface ToastItem {
  id: number
  message: string
  icon: string
  tone: ToastTone
}

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])
  let nextId = 1

  function show(message: string, options: { icon?: string; tone?: ToastTone } = {}) {
    const id = nextId++
    items.value.push({
      id,
      message,
      icon: options.icon || 'check_circle',
      tone: options.tone || 'success',
    })

    window.setTimeout(() => {
      dismiss(id)
    }, 2200)
  }

  function dismiss(id: number) {
    const index = items.value.findIndex(item => item.id === id)
    if (index !== -1) items.value.splice(index, 1)
  }

  return { items, show, dismiss }
})
