<script setup lang="ts">
type StatusEffect = 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze' | 'confusion' | 'toxic'

const STATUS_CONFIG: Record<StatusEffect, { icon: string; label: string; color: string; bg: string }> = {
  burn:      { icon: '🔥', label: 'Brûlure',    color: '#ff6b35', bg: 'rgba(255,107,53,0.2)' },
  poison:    { icon: '☠️', label: 'Poison',     color: '#a855c8', bg: 'rgba(168,85,200,0.2)' },
  toxic:     { icon: '💜', label: 'Toxik',      color: '#7b2fa8', bg: 'rgba(123,47,168,0.25)' },
  paralysis: { icon: '⚡', label: 'Paralysie',  color: '#ffd700', bg: 'rgba(255,215,0,0.2)' },
  sleep:     { icon: '💤', label: 'Sommeil',    color: '#96d9e8', bg: 'rgba(150,217,232,0.15)' },
  freeze:    { icon: '🧊', label: 'Gel',        color: '#4fc3f7', bg: 'rgba(79,195,247,0.2)' },
  confusion: { icon: '😵', label: 'Confusion',  color: '#ff6b9d', bg: 'rgba(255,107,157,0.2)' },
}

const props = withDefaults(defineProps<{
  status: StatusEffect
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}>(), { size: 'md', showLabel: false })

const config = computed(() => STATUS_CONFIG[props.status])

const animClass = computed(() => ({
  burn:      'anim-pulse-red',
  poison:    'anim-pulse-purple',
  toxic:     'anim-pulse-dark',
  paralysis: 'anim-flash-yellow',
  sleep:     'anim-breathe',
  freeze:    'anim-shimmer-blue',
  confusion: 'anim-spin',
}[props.status]))
</script>

<template>
  <div
    v-if="config"
    class="status-icon"
    :class="[`size-${size}`, animClass]"
    :style="{ background: config.bg, borderColor: config.color + '88' }"
    :title="config.label"
  >
    <span class="status-emoji">{{ config.icon }}</span>
    <span v-if="showLabel" class="status-label" :style="{ color: config.color }">
      {{ config.label }}
    </span>
  </div>
</template>

<style scoped>
.status-icon {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font-family: var(--font-primary);
  font-weight: 700;
}

.size-sm { padding: 2px 5px; font-size: 0.7rem; }
.size-md { padding: 3px 8px; font-size: 0.8rem; }
.size-lg { padding: 4px 12px; font-size: 0.9rem; }

.status-emoji { line-height: 1; }
.status-label { font-size: 0.7em; letter-spacing: 0.02em; }

/* Animations */
.anim-pulse-red     { animation: pulse-status 1.4s ease-in-out infinite; --pulse-color: rgba(255,107,53,0.5); }
.anim-pulse-purple  { animation: pulse-status 1.8s ease-in-out infinite; --pulse-color: rgba(168,85,200,0.5); }
.anim-pulse-dark    { animation: pulse-status 1.2s ease-in-out infinite; --pulse-color: rgba(123,47,168,0.5); }
.anim-flash-yellow  { animation: flash-yellow 0.8s ease-in-out infinite; }
.anim-breathe       { animation: breathe 2.5s ease-in-out infinite; }
.anim-shimmer-blue  { animation: shimmer-blue 2s linear infinite; }
.anim-spin          { animation: spin-slow 3s linear infinite; }

@keyframes pulse-status {
  0%, 100% { box-shadow: 0 0 4px var(--pulse-color); }
  50%       { box-shadow: 0 0 10px var(--pulse-color); }
}

@keyframes flash-yellow {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%       { transform: scale(1.05); opacity: 1; }
}

@keyframes shimmer-blue {
  0%   { filter: brightness(1); }
  50%  { filter: brightness(1.4) saturate(1.5); }
  100% { filter: brightness(1); }
}

@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
