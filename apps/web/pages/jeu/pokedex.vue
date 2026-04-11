<script setup lang="ts">
import { ref, watch, onMounted, computed } from '#imports'
import { usePokedexStore, type PokedexEntry } from '~/stores/pokedex'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const pokedex = usePokedexStore()

// ─── Filtres ──────────────────────────────────────────────────────────────────

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

const RARITIES = [
  { value: 'common', label: 'Commun' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Épique' },
  { value: 'legendary', label: 'Légendaire' },
  { value: 'mythic', label: 'Mythique' },
]

const gen_filter = ref<number | null>(null)
const rarity_filter = ref<string | null>(null)
const owned_only = ref(false)

async function applyFilters() {
  pokedex.setFilter('generation', gen_filter.value)
  pokedex.setFilter('rarity', rarity_filter.value)
  pokedex.setFilter('owned_only', owned_only.value)
  await pokedex.fetchPokedex()
}

watch([gen_filter, rarity_filter, owned_only], applyFilters)

onMounted(() => pokedex.fetchPokedex())

// ─── Modal détail ─────────────────────────────────────────────────────────────

async function openEntry(entry: PokedexEntry) {
  if (!entry.is_owned) return
  await pokedex.fetchEntry(entry.species_id)
}

function closeModal() {
  pokedex.clearSelectedEntry()
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const RARITY_BORDER: Record<string, string> = {
  common: 'border-gray-500',
  rare: 'border-blue-500',
  epic: 'border-purple-500',
  legendary: 'border-yellow-500',
  mythic: 'border-red-500',
}

const RARITY_LABELS: Record<string, string> = {
  common: 'C', rare: 'R', epic: 'É', legendary: 'L', mythic: 'M',
}

const RARITY_COLORS: Record<string, string> = {
  common: 'text-gray-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-yellow-400',
  mythic: 'text-red-400',
}

const TYPE_COLORS: Record<string, string> = {
  normal: 'bg-gray-500', fire: 'bg-red-500', water: 'bg-blue-500',
  electric: 'bg-yellow-400 text-black', grass: 'bg-green-500', ice: 'bg-cyan-300 text-black',
  fighting: 'bg-orange-600', poison: 'bg-purple-500', ground: 'bg-yellow-600',
  flying: 'bg-sky-400', psychic: 'bg-pink-500', bug: 'bg-lime-500',
  rock: 'bg-stone-500', ghost: 'bg-indigo-600', dragon: 'bg-violet-600',
  dark: 'bg-gray-800', steel: 'bg-slate-400', fairy: 'bg-pink-300 text-black',
}

const STAT_LABELS: Record<string, string> = {
  base_hp: 'PV', base_atk: 'ATQ', base_def: 'DEF',
  base_spatk: 'ATQ.S', base_spdef: 'DEF.S', base_speed: 'VIT',
}

const BASE_STATS_ORDER = ['base_hp', 'base_atk', 'base_def', 'base_spatk', 'base_spdef', 'base_speed'] as const

function statBarWidth(value: number): string {
  return `${Math.min(100, Math.round((value / 255) * 100))}%`
}

function statBarColor(value: number): string {
  if (value >= 100) return 'bg-green-500'
  if (value >= 70) return 'bg-yellow-500'
  return 'bg-red-400'
}

function fallbackSprite(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = `https://play.pokemonshowdown.com/sprites/gen5/${img.dataset.nameEn ?? 'unknown'}.png`
}

const detail = computed(() => pokedex.selected_entry)
</script>

<template>
  <div class="pokedex-page">

    <!-- ── Header + Stats ───────────────────────────────────────── -->
    <div class="dex-header">
      <h1 class="font-display dex-title">Pokédex</h1>
      <div v-if="pokedex.stats" class="dex-stats">
        <div class="stat-chip">
          <span class="stat-chip-val">{{ pokedex.stats.owned }}<span class="stat-chip-max">/{{ pokedex.stats.total }}</span></span>
          <span class="stat-chip-label">Obtenus</span>
        </div>
        <div class="stat-chip">
          <span class="stat-chip-val" style="color: var(--color-rarity-shiny)">✨ {{ pokedex.stats.shiny }}</span>
          <span class="stat-chip-label">Shinys</span>
        </div>
        <div class="stat-chip">
          <span class="stat-chip-val" style="color: var(--type-grass)">🥚 {{ pokedex.stats.hatched }}</span>
          <span class="stat-chip-label">Éclos</span>
        </div>
        <div v-if="pokedex.stats?.total" class="dex-progress-wrap">
          <UiProgressBar
            :value="Math.round(((pokedex.stats?.owned ?? 0) / (pokedex.stats?.total || 1)) * 100)"
            color="var(--color-accent-purple)"
            height="6px"
            :label="`${Math.round(((pokedex.stats?.owned ?? 0) / (pokedex.stats?.total || 1)) * 100)}% complété`"
          />
        </div>
      </div>
    </div>

    <!-- ── Filters ───────────────────────────────────────────────── -->
    <div class="dex-filters">
      <select v-model="gen_filter" class="dex-select">
        <option :value="null">Toutes gens</option>
        <option v-for="g in GENERATIONS" :key="g" :value="g">Gén. {{ g }}</option>
      </select>
      <select v-model="rarity_filter" class="dex-select">
        <option :value="null">Toutes raretés</option>
        <option v-for="r in RARITIES" :key="r.value" :value="r.value">{{ r.label }}</option>
      </select>
      <label class="dex-checkbox-label">
        <input type="checkbox" v-model="owned_only" class="dex-checkbox" />
        Obtenus seulement
      </label>
      <NuxtLink to="/jeu/pokedex/living" class="dex-living-link">📋 Living Dex</NuxtLink>
    </div>

    <!-- ── Loading ───────────────────────────────────────────────── -->
    <div v-if="pokedex.is_loading" class="dex-loading">
      <div class="dex-spinner" />Chargement du Pokédex…
    </div>

    <!-- ── Species grid ──────────────────────────────────────────── -->
    <div v-else class="dex-grid">
      <button
        v-for="entry in (pokedex.entries ?? [])"
        :key="entry.species_id"
        class="dex-entry"
        :class="{
          'entry-owned':  entry.is_owned,
          'entry-locked': !entry.is_owned,
          'entry-shiny':  entry.is_shiny,
          [`rarity-${entry.rarity}`]: entry.is_owned,
        }"
        :title="entry.is_owned ? entry.name_fr : '???'"
        :disabled="!entry.is_owned"
        @click="openEntry(entry)"
      >
        <span v-if="entry.is_shiny" class="entry-shiny-badge">✨</span>
        <img
          v-if="entry.sprite_url"
          :src="entry.is_shiny && entry.sprite_shiny_url ? entry.sprite_shiny_url : entry.sprite_url"
          :alt="entry.is_owned ? entry.name_fr : '???'"
          class="entry-sprite"
          loading="lazy"
          :data-name-en="entry.name_fr"
          @error="fallbackSprite"
        />
        <div v-else class="entry-sprite-ph">?</div>
        <span class="entry-num">#{{ entry.species_id }}</span>
        <span class="entry-name">{{ entry.is_owned ? entry.name_fr : '???' }}</span>
        <UiRarityBadge v-if="entry.is_owned" :rarity="entry.rarity as any" size="xs" />
      </button>
    </div>

    <!-- ── Detail modal ──────────────────────────────────────────── -->
    <UiModal
      :open="!!(detail || pokedex.is_loading_detail)"
      :title="detail ? `#${detail.species_id} ${detail.name_fr}` : 'Chargement…'"
      size="lg"
      @close="closeModal"
    >
      <div v-if="pokedex.is_loading_detail && !detail" class="modal-loading">Chargement…</div>
      <div v-else-if="detail" class="detail-body">
        <!-- Header -->
        <div class="detail-header">
          <div class="detail-sprite-wrap">
            <img
              v-if="detail.sprite_url"
              :src="detail.is_shiny && detail.sprite_shiny_url ? detail.sprite_shiny_url : detail.sprite_url"
              :alt="detail.name_fr"
              class="detail-sprite"
              :class="{ 'detail-sprite-shiny': detail.is_shiny }"
              @error="fallbackSprite"
            />
            <span v-if="detail.is_shiny" class="detail-shiny-tag">✨ Shiny</span>
          </div>
          <div class="detail-meta">
            <div class="detail-types">
              <UiTypeBadge :type="detail.type1 as any" />
              <UiTypeBadge v-if="detail.type2" :type="detail.type2 as any" />
            </div>
            <p class="detail-gen">Gén. {{ detail.generation }}</p>
            <UiRarityBadge :rarity="detail.rarity as any" />
          </div>
        </div>

        <!-- Collection stats -->
        <div class="detail-collection">
          <div class="col-stat">
            <span class="col-stat-val">{{ detail.times_obtained }}</span>
            <span class="col-stat-label">Obtenus</span>
          </div>
          <div class="col-stat">
            <span class="col-stat-val" style="color: var(--color-accent-blue)">{{ detail.best_iv_total ?? '—' }}</span>
            <span class="col-stat-label">Meilleur IVs</span>
          </div>
          <div class="col-stat">
            <span class="col-stat-val" style="color: var(--color-rarity-shiny)">{{ detail.is_shiny ? '✨ Oui' : 'Non' }}</span>
            <span class="col-stat-label">Shiny</span>
          </div>
        </div>

        <!-- Base stats -->
        <h3 class="detail-section-title">Statistiques de base</h3>
        <div class="base-stats">
          <div v-for="stat in BASE_STATS_ORDER" :key="stat" class="stat-row">
            <span class="stat-key">{{ STAT_LABELS[stat] }}</span>
            <span class="stat-num">{{ (detail as any)[stat] }}</span>
            <div class="stat-bar-bg">
              <div
                class="stat-bar-fill"
                :style="{
                  width: statBarWidth((detail as any)[stat]),
                  background: (detail as any)[stat] >= 100 ? 'var(--type-grass)' : (detail as any)[stat] >= 70 ? 'var(--color-accent-yellow)' : 'var(--color-accent-red)'
                }"
              />
            </div>
          </div>
        </div>

        <!-- Learnset -->
        <h3 class="detail-section-title">
          Learnset <span class="detail-count">({{ detail.learnset?.length ?? 0 }} moves)</span>
        </h3>
        <div class="learnset-grid">
          <div v-for="move in (detail?.learnset ?? [])" :key="move.move_id" class="learnset-item">
            <UiTypeBadge :type="move.type as any" size="sm" />
            <span class="learnset-name">{{ move.name_fr }}</span>
            <span v-if="move.power" class="learnset-power">{{ move.power }}</span>
          </div>
        </div>
      </div>
    </UiModal>

  </div>
</template>

<style scoped>
.pokedex-page { display: flex; flex-direction: column; gap: var(--space-4); }

/* Header */
.dex-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); }
.dex-title { font-size: clamp(1.8rem, 4vw, 2.4rem); letter-spacing: 0.05em; color: var(--color-text-primary); }
.dex-stats { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
.stat-chip { display: flex; flex-direction: column; align-items: center; background: var(--color-bg-secondary); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); padding: var(--space-2) var(--space-3); }
.stat-chip-val { font-family: var(--font-display); font-size: 1.2rem; color: var(--color-text-primary); }
.stat-chip-max { font-size: 0.8rem; color: var(--color-text-muted); }
.stat-chip-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
.dex-progress-wrap { min-width: 160px; }

/* Filters */
.dex-filters { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.dex-select {
  background: var(--color-bg-secondary); border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md); color: var(--color-text-primary);
  padding: 7px 12px; font-family: var(--font-primary); font-size: 0.82rem; cursor: pointer;
}
.dex-select:focus { outline: none; border-color: rgba(156,106,222,0.5); }
.dex-checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--color-text-secondary); cursor: pointer; }
.dex-checkbox { accent-color: var(--color-accent-purple); }
.dex-living-link {
  margin-left: auto; font-size: 0.82rem; font-weight: 700; color: var(--color-text-secondary);
  text-decoration: none; padding: 6px 14px; border-radius: var(--radius-md);
  border: 1px solid rgba(255,255,255,0.1); transition: var(--transition-fast);
  background: var(--color-bg-secondary);
}
.dex-living-link:hover { color: var(--color-text-primary); border-color: rgba(156,106,222,0.4); }

/* Loading */
.dex-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-10); }
.dex-spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Grid */
.dex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: var(--space-2);
}

.dex-entry {
  position: relative; background: var(--color-bg-secondary); border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg); padding: var(--space-2); display: flex; flex-direction: column;
  align-items: center; gap: 2px; cursor: pointer; transition: var(--transition-fast);
  font-family: var(--font-primary); text-align: center;
}
.entry-owned:hover { transform: scale(1.08); z-index: 2; }
.entry-locked { opacity: 0.35; filter: grayscale(1); cursor: default; }
.entry-shiny  { box-shadow: 0 0 8px rgba(255,224,102,0.4); }

/* Rarity borders */
.rarity-common    { border-color: rgba(168,181,194,0.4); }
.rarity-rare      { border-color: rgba(79,195,247,0.4); }
.rarity-epic      { border-color: rgba(198,120,221,0.4); }
.rarity-legendary { border-color: rgba(255,215,0,0.5); }
.rarity-mythic    { border-color: rgba(255,107,157,0.5); }

.entry-shiny-badge { position: absolute; top: 2px; right: 3px; font-size: 0.6rem; }
.entry-sprite { width: 48px; height: 48px; object-fit: contain; image-rendering: pixelated; }
.entry-sprite-ph { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: var(--color-text-muted); opacity: 0.3; }
.entry-num  { font-size: 0.58rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.entry-name { font-size: 0.62rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

/* Detail modal */
.modal-loading { color: var(--color-text-muted); text-align: center; padding: var(--space-6); }
.detail-body { display: flex; flex-direction: column; gap: var(--space-4); }
.detail-header { display: flex; gap: var(--space-5); align-items: flex-start; }
.detail-sprite-wrap { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
.detail-sprite { width: 96px; height: 96px; object-fit: contain; image-rendering: pixelated; }
.detail-sprite-shiny { filter: drop-shadow(0 0 8px rgba(255,224,102,0.8)); animation: twinkle 3s ease-in-out infinite; }
.detail-shiny-tag { font-size: 0.7rem; color: var(--color-rarity-shiny); font-weight: 700; }
.detail-meta { display: flex; flex-direction: column; gap: var(--space-2); }
.detail-types { display: flex; gap: var(--space-1); }
.detail-gen { font-size: 0.75rem; color: var(--color-text-muted); }

.detail-collection { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
.col-stat { background: rgba(255,255,255,0.04); border-radius: var(--radius-md); padding: var(--space-3); text-align: center; display: flex; flex-direction: column; gap: 2px; }
.col-stat-val { font-family: var(--font-display); font-size: 1.3rem; color: var(--color-text-primary); }
.col-stat-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }

.detail-section-title { font-family: var(--font-primary); font-weight: 800; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted); }
.detail-count { font-weight: 400; color: var(--color-text-muted); text-transform: none; letter-spacing: 0; }

.base-stats { display: flex; flex-direction: column; gap: 5px; }
.stat-row { display: flex; align-items: center; gap: var(--space-2); }
.stat-key { font-size: 0.72rem; color: var(--color-text-muted); width: 40px; text-align: right; flex-shrink: 0; }
.stat-num { font-size: 0.72rem; font-weight: 700; color: var(--color-text-primary); width: 28px; text-align: right; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.stat-bar-bg { flex: 1; height: 6px; background: rgba(0,0,0,0.4); border-radius: var(--radius-full); overflow: hidden; }
.stat-bar-fill { height: 100%; border-radius: var(--radius-full); transition: width 0.5s ease; }

.learnset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; max-height: 160px; overflow-y: auto; }
.learnset-item { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 3px 6px; }
.learnset-name { font-size: 0.75rem; color: var(--color-text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.learnset-power { font-size: 0.68rem; color: var(--color-text-muted); flex-shrink: 0; }

@media (max-width: 640px) {
  .dex-grid { grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); }
  .detail-collection { grid-template-columns: 1fr 1fr; }
  .learnset-grid { grid-template-columns: 1fr; }
}
</style>
