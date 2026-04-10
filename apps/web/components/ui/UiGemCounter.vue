<script setup lang="ts">
const props = withDefaults(defineProps<{
  amount: number
  animate?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), { animate: false, size: 'md' })

const displayed = ref(props.amount)
let animFrame: number | null = null

watch(() => props.amount, (newVal, oldVal) => {
  if (!props.animate || newVal === oldVal) { displayed.value = newVal; return }
  const diff = newVal - oldVal
  const steps = 30
  const step = diff / steps
  let current = oldVal
  let i = 0
  const tick = () => {
    i++
    current += step
    displayed.value = Math.round(i < steps ? current : newVal)
    if (i < steps) animFrame = requestAnimationFrame(tick)
  }
  if (animFrame) cancelAnimationFrame(animFrame)
  tick()
})
</script>

<template>
  <span class="gem-counter" :class="size">
    <span class="gem-icon">💎</span>
    <span class="gem-amount">{{ displayed.toLocaleString('fr') }}</span>
  </span>
</template>

<style scoped>
.gem-counter { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-primary); font-weight: 700; color: var(--color-accent-purple); }
.gem-counter.sm { font-size: 0.85rem; }
.gem-counter.md { font-size: 1rem; }
.gem-counter.lg { font-size: 1.2rem; }
.gem-icon { line-height: 1; }
</style>
