<script setup lang="ts">
const props = defineProps<{ rarity: string }>()

const LABELS: Record<string, string> = {
  common: 'COMMUN', rare: 'RARE', epic: 'ÉPIQUE',
  legendary: 'LÉGENDAIRE', mythic: 'MYTHIQUE', shiny: '✨ SHINY',
}
const COLORS: Record<string, string> = {
  common: 'var(--color-rarity-common)',
  rare: 'var(--color-rarity-rare)',
  epic: 'var(--color-rarity-epic)',
  legendary: 'var(--color-rarity-legendary)',
  mythic: 'var(--color-rarity-mythic)',
  shiny: 'var(--color-rarity-shiny)',
}

const label = computed(() => LABELS[props.rarity] ?? props.rarity.toUpperCase())
const color = computed(() => COLORS[props.rarity] ?? '#a8b5c2')
</script>

<template>
  <span class="rarity-badge" :style="{ color, borderColor: color + '60', boxShadow: `0 0 6px ${color}33` }">
    {{ label }}
  </span>
</template>

<style scoped>
.rarity-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  border: 1px solid;
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(0,0,0,0.3);
}
</style>
