<script setup lang="ts">
const props = withDefaults(defineProps<{
  current: number
  max: number
  animate?: boolean
  showText?: boolean
  height?: string
}>(), { animate: true, showText: false, height: '8px' })

const pct = computed(() => props.max > 0 ? Math.max(0, Math.min(100, (props.current / props.max) * 100)) : 0)

const barColor = computed(() => {
  const p = pct.value
  if (p > 50) return '#56c96d'
  if (p > 25) return '#ffd700'
  return '#e63946'
})

const isLow = computed(() => pct.value <= 25 && props.animate)
</script>

<template>
  <div class="hp-bar-wrapper">
    <div class="hp-bar-track" :style="{ height: props.height }">
      <div
        class="hp-bar-fill"
        :class="{ 'hp-pulse': isLow }"
        :style="{
          width: pct + '%',
          background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
          transition: animate ? 'width 0.35s ease, background 0.35s ease' : 'none',
          height: '100%',
        }"
      />
    </div>
    <div v-if="showText" class="hp-text">
      {{ current.toLocaleString('fr') }} / {{ max.toLocaleString('fr') }}
    </div>
  </div>
</template>

<style scoped>
.hp-bar-wrapper { display: flex; flex-direction: column; gap: 2px; width: 100%; }

.hp-bar-track {
  width: 100%;
  background: rgba(0,0,0,0.4);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.hp-bar-fill {
  border-radius: var(--radius-full);
  min-width: 2px;
}

.hp-pulse { animation: hp-pulse 1s ease-in-out infinite; }

.hp-text {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-align: right;
}

@keyframes hp-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
</style>
