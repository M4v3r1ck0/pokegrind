<script setup lang="ts">
const props = withDefaults(defineProps<{
  stars: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
}>(), { max: 5, size: 'md' })
</script>

<template>
  <div class="star-rating" :class="size">
    <span v-for="i in props.max" :key="i" :class="['star', i <= props.stars ? 'star-filled' : 'star-empty']">
      ★
    </span>
  </div>
</template>

<style scoped>
.star-rating { display: inline-flex; gap: 1px; }
.star { font-style: normal; transition: var(--transition-fast); }
.star-filled { color: #ffd700; text-shadow: 0 0 6px rgba(255,215,0,0.6); }
.star-empty  { color: rgba(255,255,255,0.15); }
.star-rating.sm .star { font-size: 0.8rem; }
.star-rating.md .star { font-size: 1rem; }
.star-rating.lg .star { font-size: 1.25rem; }
</style>
