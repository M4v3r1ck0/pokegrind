<script setup lang="ts">
const props = withDefaults(defineProps<{
  type: string
  size?: 'sm' | 'md'
}>(), { size: 'md' })

const TYPE_LABELS: Record<string, string> = {
  fire: 'FEU', water: 'EAU', grass: 'PLANTE', electric: 'ELEC',
  psychic: 'PSY', ice: 'GLACE', dragon: 'DRAGON', dark: 'TÉNÈBRES',
  fairy: 'FÉE', fighting: 'COMBAT', poison: 'POISON', ground: 'SOL',
  rock: 'ROCHE', bug: 'INSECTE', ghost: 'SPECTRE', steel: 'ACIER',
  normal: 'NORMAL', flying: 'VOL',
}

const TYPE_COLORS: Record<string, string> = {
  fire: '#ff6b35', water: '#4fc3f7', grass: '#56c96d', electric: '#ffd700',
  psychic: '#ff6b9d', ice: '#96d9e8', dragon: '#6c5ce7', dark: '#4a4a6a',
  fairy: '#ffb3d9', fighting: '#d4522a', poison: '#a855c8', ground: '#c8a85e',
  rock: '#8b7355', bug: '#91b800', ghost: '#6c5ce7', steel: '#8fa8c8',
  normal: '#a8a878', flying: '#89aadc',
}

const label = computed(() => TYPE_LABELS[props.type] ?? props.type.toUpperCase())
const color = computed(() => TYPE_COLORS[props.type] ?? '#a8b5c2')
</script>

<template>
  <span
    class="type-badge"
    :class="size"
    :style="{ backgroundColor: color + '22', color, borderColor: color + '55' }"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.type-badge {
  display: inline-block;
  border-radius: var(--radius-full);
  border: 1px solid;
  font-family: var(--font-primary);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.type-badge.sm { padding: 1px 7px; font-size: 0.65rem; }
.type-badge.md { padding: 2px 10px; font-size: 0.75rem; }
</style>
