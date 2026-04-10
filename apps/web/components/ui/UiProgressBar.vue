<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number
  color?: string
  label?: string
  animated?: boolean
  height?: string
}>(), { color: 'var(--color-accent-purple)', animated: true, height: '8px' })

const displayed = ref(0)
onMounted(() => {
  if (props.animated) {
    setTimeout(() => { displayed.value = props.value }, 100)
  } else {
    displayed.value = props.value
  }
})
watch(() => props.value, (v) => { displayed.value = v })
</script>

<template>
  <div class="progress-wrapper">
    <div v-if="label" class="progress-label">
      <span>{{ label }}</span>
      <span class="progress-pct">{{ Math.round(displayed) }}%</span>
    </div>
    <div class="progress-track" :style="{ height }">
      <div
        class="progress-fill"
        :style="{
          width: displayed + '%',
          background: `linear-gradient(90deg, ${color}, ${color}bb)`,
          transition: animated ? 'width 0.6s cubic-bezier(0.4,0,0.2,1)' : 'none',
        }"
      />
    </div>
  </div>
</template>

<style scoped>
.progress-wrapper { width: 100%; }
.progress-label { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 4px; }
.progress-pct { color: var(--color-text-primary); font-weight: 700; }
.progress-track { background: rgba(0,0,0,0.4); border-radius: var(--radius-full); overflow: hidden; }
.progress-fill { height: 100%; border-radius: var(--radius-full); min-width: 2px; }
</style>
