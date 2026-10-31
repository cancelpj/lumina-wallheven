<template>
  <div class="p-10">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="i in 12"
        :key="i"
        class="aspect-[4/3] rounded-[2rem] skeleton-pulse"
      />
    </div>
  </div>
</template>

<style scoped>
.skeleton-pulse {
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.03) 0%,
    rgba(0, 0, 0, 0.06) 50%,
    rgba(0, 0, 0, 0.03) 100%
  );
  background-size: 200% 200%;
  animation: shimmer 1.8s ease-in-out infinite;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

@keyframes shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
</style>
