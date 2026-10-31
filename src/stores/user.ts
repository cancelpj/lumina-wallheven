import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const API_KEY_STORAGE = 'wallhaven-api-key'

export const useUserStore = defineStore('user', () => {
  const apiKey = ref(localStorage.getItem(API_KEY_STORAGE) || '')
  const username = ref('Erik V.')
  const statusLabel = ref('Pro Member')

  // Watch localStorage changes (from SettingsView)
  function syncFromStorage() {
    apiKey.value = localStorage.getItem(API_KEY_STORAGE) || ''
  }

  // Listen for storage events (cross-tab) and custom events
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === API_KEY_STORAGE) {
        syncFromStorage()
      }
    })
    window.addEventListener('api-key-changed', () => {
      syncFromStorage()
    })
  }

  // Reactively update user card based on API key presence
  watch(apiKey, (key) => {
    if (key) {
      username.value = 'API User'
      statusLabel.value = 'API Connected'
    } else {
      username.value = 'Erik V.'
      statusLabel.value = 'Pro Member'
    }
  }, { immediate: true })

  return { apiKey, username, statusLabel, syncFromStorage }
})
