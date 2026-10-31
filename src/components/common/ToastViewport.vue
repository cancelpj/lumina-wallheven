<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-8 right-8 z-[200] flex w-[min(360px,calc(100vw-48px))] flex-col gap-3 pointer-events-none">
      <transition-group name="toast">
        <div
          v-for="item in toast.items"
          :key="item.id"
          class="toast-glass flex items-center gap-3 rounded-2xl px-4 py-3 text-on-surface shadow-xl pointer-events-auto"
          role="status"
        >
          <span
            class="material-symbols-outlined text-[22px]"
            :class="item.tone === 'success' ? 'text-primary' : 'text-on-surface-variant'"
          >
            {{ item.icon }}
          </span>
          <span class="font-body-sm">{{ item.message }}</span>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
