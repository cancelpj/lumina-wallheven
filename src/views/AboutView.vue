<script setup lang="ts">
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Page Header -->
    <div class="h-20 flex items-center px-10 m-4 rounded-2xl border border-black/5 bg-white/40 backdrop-blur-[40px]">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[28px]">info</span>
        <div>
          <h2 class="text-headline-lg text-on-surface">About</h2>
          <p class="text-body-sm text-on-surface-variant">Lumina 4K Creative Gallery</p>
        </div>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center px-10 pb-8">
      <div class="p-8 rounded-3xl border border-black/5 bg-white/60 backdrop-blur-xl max-w-sm w-full text-center shadow-lg">
        <!-- Logo -->
        <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/30">
          <span class="text-2xl font-bold text-on-primary" style="font-family: 'Manrope', sans-serif;">L</span>
        </div>

        <h1 class="text-headline-lg text-on-surface mb-2">Lumina</h1>
        <p class="text-body-sm text-on-surface-variant leading-relaxed mb-6">
          A 4K wallpaper browser powered by wallhaven.cc,
          <br />
          built with Tauri + Vue 3.
        </p>

        <div class="space-y-2 text-body-sm">
          <div class="flex justify-between py-1.5 border-b border-black/5">
            <span class="text-on-surface-variant">Version</span>
            <span class="text-on-surface font-medium">1.1.0</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-black/5">
            <span class="text-on-surface-variant">Tech Stack</span>
            <span class="text-on-surface font-medium">Tauri + Vue 3 + Tailwind</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-on-surface-variant">Data Source</span>
            <span class="text-primary font-medium">wallhaven.cc</span>
          </div>
          <div class="flex justify-between py-1.5 border-t border-black/5">
            <span class="text-on-surface-variant">Developer（微信公众号）</span>
            <span class="text-on-surface font-medium">HelpToMe</span>
          </div>
        </div>

        <p class="text-[11px] text-on-surface-variant/50 mt-6">
          All wallpapers copyright belongs to original authors
        </p>
      </div>
    </div>
  </div>
</template>
