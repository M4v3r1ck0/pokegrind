<script setup lang="ts">
const props = defineProps<{ level: number; nameFr?: string }>()

const badgeClass = computed(() => {
  if (props.level <= 0) return ''
  if (props.level <= 10) return 'prestige-purple'
  if (props.level <= 30) return 'prestige-gold'
  return 'prestige-rainbow'
})
</script>

<template>
  <div v-if="level > 0" class="prestige-badge" :class="badgeClass">
    <span class="prestige-icon">✦</span>
    <span class="prestige-label">P{{ level }}</span>
    <span v-if="nameFr" class="prestige-name">{{ nameFr }}</span>
  </div>
</template>

<style scoped>
.prestige-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 12px;
  border-radius: var(--radius-full);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.75rem;
}

.prestige-purple {
  background: linear-gradient(135deg, #4a0e8f, #9c6ade);
  color: #fff;
  box-shadow: var(--shadow-glow-purple);
}

.prestige-gold {
  background: linear-gradient(135deg, #7a4800, #ffd700);
  color: #1a1c2e;
  box-shadow: var(--shadow-glow-yellow);
}

.prestige-rainbow {
  background: linear-gradient(135deg, #ff6b9d, #ffd700, #4fc3f7, #56c96d, #c678dd);
  background-size: 300%;
  color: #fff;
  animation: shimmer-badge 4s linear infinite;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
}

@keyframes shimmer-badge {
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
}

.prestige-icon { opacity: 0.9; }
.prestige-name { opacity: 0.85; font-weight: 600; }
</style>
