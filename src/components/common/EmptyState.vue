<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full gap-5 py-20">
    <div class="w-16 h-16 rounded-2xl bg-black/[0.02] border border-black/5 flex items-center justify-center">
      <span class="material-symbols-outlined text-[28px] text-on-surface-variant/20">image_not_supported</span>
    </div>
    <div class="text-center">
      <h3 class="text-base font-medium text-on-surface-variant/60">{{ title }}</h3>
      <p v-if="description" class="text-sm font-semibold text-on-surface-variant/75 mt-1.5">{{ description }}</p>
    </div>
  </div>
</template>
