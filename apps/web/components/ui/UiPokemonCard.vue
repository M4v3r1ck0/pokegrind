<script setup lang="ts">
const props = withDefaults(defineProps<{
  pokemon: {
    id: string
    species_id: number
    nickname?: string
    level: number
    is_shiny: boolean
    stars: number
    nature: string
    iv_hp: number
    iv_atk: number
    iv_def: number
    iv_spatk: number
    iv_spdef: number
    iv_speed: number
    hidden_talent_move_id?: number | null
    species?: {
      name_fr: string
      type1: string
      type2?: string | null
      rarity: string
      sprite_url?: string
      sprite_shiny_url?: string
      sprite_fallback_url?: string
    }
  }
  size?: 'sm' | 'md' | 'lg'
  clickable?: boolean
  selected?: boolean
}>(), { size: 'md', clickable: false, selected: false })

const emit = defineEmits<{ click: [] }>()

const spriteError = ref(false)

const spriteUrl = computed(() => {
  if (!props.pokemon.species) return ''
  const base = props.pokemon.is_shiny
    ? props.pokemon.species.sprite_shiny_url
    : props.pokemon.species.sprite_url
  return base || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${props.pokemon.species_id}.png`
})

const fallbackUrl = computed(() => {
  if (!props.pokemon.species) return ''
  return props.pokemon.species.sprite_fallback_url
    || `https://play.pokemonshowdown.com/sprites/gen5/${props.pokemon.species?.name_fr?.toLowerCase() || ''}.png`
})

const ivTotal = computed(() => {
  const p = props.pokemon
  return p.iv_hp + p.iv_atk + p.iv_def + p.iv_spatk + p.iv_spdef + p.iv_speed
})

const ivPct = computed(() => Math.round((ivTotal.value / 186) * 100))

const rarityClass = computed(() => `rarity-${props.pokemon.species?.rarity || 'common'}`)

const sizeClass = computed(() => ({
  sm: 'card-sm',
  md: 'card-md',
  lg: 'card-lg',
}[props.size]))

function onImgError(e: Event) {
  if (!spriteError.value) {
    spriteError.value = true
    ;(e.target as HTMLImageElement).src = fallbackUrl.value
  }
}
</script>

<template>
  <div
    class="pokemon-card"
    :class="[rarityClass, sizeClass, { clickable, selected }]"
    @click="clickable && emit('click')"
  >
    <!-- Shiny badge -->
    <span v-if="pokemon.is_shiny" class="shiny-badge">✨</span>

    <!-- Hidden talent badge -->
    <span v-if="pokemon.hidden_talent_move_id" class="talent-badge" title="Talent caché">⚡</span>

    <!-- Sprite -->
    <div class="sprite-wrap">
      <img
        :src="spriteError ? fallbackUrl : spriteUrl"
        :alt="pokemon.species?.name_fr || `#${pokemon.species_id}`"
        class="sprite"
        :class="{ shiny: pokemon.is_shiny }"
        @error="onImgError"
      />
    </div>

    <!-- Info -->
    <div class="card-info">
      <div class="card-name">
        {{ pokemon.nickname || pokemon.species?.name_fr || `#${pokemon.species_id}` }}
      </div>
      <div class="card-level">Niv. {{ pokemon.level }}</div>

      <!-- Types -->
      <div v-if="pokemon.species" class="card-types">
        <UiTypeBadge :type="pokemon.species.type1 as any" size="sm" />
        <UiTypeBadge v-if="pokemon.species.type2" :type="pokemon.species.type2 as any" size="sm" />
      </div>

      <!-- Stars -->
      <UiStarRating :stars="pokemon.stars" size="sm" />

      <!-- IV bar -->
      <div class="iv-row">
        <span class="iv-label">IVs</span>
        <div class="iv-track">
          <div
            class="iv-fill"
            :style="{ width: ivPct + '%' }"
            :class="{
              'iv-low': ivPct < 40,
              'iv-mid': ivPct >= 40 && ivPct < 75,
              'iv-high': ivPct >= 75,
            }"
          />
        </div>
        <span class="iv-val">{{ ivTotal }}/186</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pokemon-card {
  position: relative;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  border: 2px solid transparent;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: var(--transition-base);
  user-select: none;
}

.pokemon-card.clickable { cursor: pointer; }
.pokemon-card.clickable:hover { transform: translateY(-3px) scale(1.02); }
.pokemon-card.selected { outline: 2px solid var(--color-accent-yellow); outline-offset: 2px; }

/* Rarity borders + glow */
.rarity-common   { border-color: var(--color-rarity-common);    box-shadow: 0 0 8px rgba(168,181,194,0.3); }
.rarity-rare     { border-color: var(--color-rarity-rare);      box-shadow: 0 0 10px rgba(79,195,247,0.4); }
.rarity-epic     { border-color: var(--color-rarity-epic);      box-shadow: 0 0 12px rgba(198,120,221,0.5); }
.rarity-legendary{ border-color: var(--color-rarity-legendary); box-shadow: var(--shadow-glow-yellow); }
.rarity-mythic   { border-color: var(--color-rarity-mythic);    box-shadow: 0 0 16px rgba(255,107,157,0.6); }

/* Sizes */
.card-sm { padding: 8px; min-width: 100px; }
.card-md { padding: 12px; min-width: 140px; }
.card-lg { padding: 16px; min-width: 180px; }

.shiny-badge, .talent-badge {
  position: absolute;
  top: 6px;
  font-size: 0.85rem;
  line-height: 1;
  z-index: 2;
}
.shiny-badge  { left: 6px; }
.talent-badge { right: 6px; }

.sprite-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-sm .sprite-wrap { width: 64px; height: 64px; }
.card-md .sprite-wrap { width: 96px; height: 96px; }
.card-lg .sprite-wrap { width: 128px; height: 128px; }

.sprite {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.sprite.shiny {
  filter: drop-shadow(0 0 6px rgba(255,224,102,0.8));
  animation: twinkle 3s ease-in-out infinite;
}

.card-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}

.card-name {
  font-family: var(--font-primary);
  font-weight: 800;
  color: var(--color-text-primary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.card-sm .card-name { font-size: 0.75rem; }
.card-md .card-name { font-size: 0.85rem; }
.card-lg .card-name { font-size: 1rem; }

.card-level { font-size: 0.7rem; color: var(--color-text-muted); }

.card-types { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }

/* IV bar */
.iv-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  margin-top: 2px;
}

.iv-label, .iv-val { font-size: 0.65rem; color: var(--color-text-muted); white-space: nowrap; }
.iv-val { font-weight: 700; color: var(--color-text-secondary); }

.iv-track {
  flex: 1;
  height: 4px;
  background: rgba(0,0,0,0.4);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.iv-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
}

.iv-low  { background: var(--color-accent-red); }
.iv-mid  { background: var(--color-accent-yellow); }
.iv-high { background: var(--type-grass); }
</style>
