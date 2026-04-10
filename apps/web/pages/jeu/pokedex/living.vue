<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { ref, onMounted } from 'vue'
import { useGigantamaxStore } from '~/stores/gigantamax'

const store = useGigantamaxStore()
const loadingObjectives = ref(false)
const loadingMissing = ref(false)
const claiming = ref(false)
const selected_gen = ref<number | undefined>(undefined)

async function claimObjective(id: number) {
  claiming.value = true
  try {
    await store.claimObjective(id)
  } finally {
    claiming.value = false
  }
}

async function claimAllObjectives() {
  claiming.value = true
  try {
    for (const obj of store.unclaimedObjectives) {
      await store.claimObjective(obj.id)
    }
  } finally {
    claiming.value = false
  }
}

async function fetchMissing() {
  loadingMissing.value = true
  await store.fetchMissingSpecies(selected_gen.value)
  loadingMissing.value = false
}

onMounted(async () => {
  loadingObjectives.value = true
  loadingMissing.value = true
  await Promise.all([
    store.fetchLivingDexStatus(),
    store.fetchLivingDexObjectives(),
    store.fetchMissingSpecies(),
  ])
  loadingObjectives.value = false
  loadingMissing.value = false
})
</script>

<template>
  <div class="living-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="living-header">
      <div>
        <h1 class="font-display living-title">Pokédex Vivant</h1>
        <p class="living-sub">Possède chaque espèce simultanément pour compléter ton Pokédex Vivant.</p>
      </div>
    </div>

    <!-- ── Stats grid ──────────────────────────────────────────── -->
    <div v-if="store.living_dex_status" class="stats-grid">
      <div class="stat-card">
        <span class="stat-val">{{ store.living_dex_status.species_owned }}</span>
        <span class="stat-label">Espèces</span>
        <span class="stat-sub">/ {{ store.living_dex_status.species_total }}</span>
      </div>
      <div class="stat-card stat-shiny">
        <span class="stat-val shiny-text">{{ store.living_dex_status.shiny_owned }}</span>
        <span class="stat-label">Shinies</span>
      </div>
      <div class="stat-card">
        <span class="stat-val">{{ store.living_dex_status.forms_owned }}</span>
        <span class="stat-label">Formes</span>
      </div>
      <div class="stat-card stat-gmax">
        <span class="stat-val gmax-text">{{ store.living_dex_status.gmax_unlocked }}</span>
        <span class="stat-label">Gigantamax</span>
        <span class="stat-sub">/ {{ store.living_dex_status.gmax_total }}</span>
      </div>
    </div>

    <!-- ── Global progress ────────────────────────────────────── -->
    <div v-if="store.living_dex_status" class="global-progress">
      <div class="progress-header-row">
        <span class="progress-label">Complétion globale</span>
        <span class="progress-pct">{{ store.living_dex_status.completion_percent.toFixed(1) }}%</span>
      </div>
      <UiProgressBar
        :current="store.living_dex_status.species_owned"
        :max="store.living_dex_status.species_total"
        color="var(--color-accent-purple)"
        :height="12"
      />
    </div>

    <!-- ── Objectives ─────────────────────────────────────────── -->
    <section class="objectives-section">
      <div class="section-head">
        <h2 class="font-display section-title">Objectifs</h2>
        <button
          v-if="store.unclaimedObjectives.length > 0"
          class="btn-claim-all"
          :disabled="claiming"
          @click="claimAllObjectives"
        >
          Tout réclamer ({{ store.unclaimedObjectives.length }})
        </button>
      </div>

      <div v-if="loadingObjectives" class="state-loading">
        <div class="spinner" /> Chargement…
      </div>

      <div v-else class="objectives-list">
        <div
          v-for="obj in store.living_dex_objectives"
          :key="obj.id"
          class="obj-card"
          :class="{
            'obj-claimed':   obj.claimed,
            'obj-completed': obj.completed && !obj.claimed,
          }"
        >
          <div class="obj-left">
            <span class="obj-status-icon">
              <span v-if="obj.claimed">✅</span>
              <span v-else-if="obj.completed">🎁</span>
              <span v-else>🔒</span>
            </span>
            <div class="obj-info">
              <p class="obj-name">{{ obj.name_fr }}</p>
              <p class="obj-desc">{{ obj.description_fr }}</p>
              <UiProgressBar
                :current="obj.progress"
                :max="obj.progress_max"
                :color="obj.completed ? 'var(--color-accent-yellow)' : 'var(--color-accent-blue)'"
                :height="6"
                class="obj-bar"
              />
              <p class="obj-count">{{ obj.progress.toLocaleString('fr-FR') }} / {{ obj.progress_max.toLocaleString('fr-FR') }}</p>
            </div>
          </div>
          <div class="obj-right">
            <div v-if="obj.reward_gems" class="reward-chip">+{{ obj.reward_gems }} 💎</div>
            <div v-if="obj.reward_items?.length" class="reward-chip chip-blue">Item</div>
            <button
              v-if="obj.completed && !obj.claimed"
              class="btn-claim"
              :disabled="claiming"
              @click="claimObjective(obj.id)"
            >Réclamer</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Missing species ────────────────────────────────────── -->
    <section class="missing-section">
      <div class="section-head">
        <h2 class="font-display section-title">Espèces manquantes</h2>
        <div class="filter-row">
          <select v-model="selected_gen" class="gen-select" @change="fetchMissing">
            <option :value="undefined">Toutes gens</option>
            <option v-for="g in 9" :key="g" :value="g">Gen {{ g }}</option>
          </select>
        </div>
      </div>

      <div v-if="loadingMissing" class="state-loading">
        <div class="spinner" /> Chargement…
      </div>

      <div v-else-if="store.missing_species?.length === 0" class="state-empty">
        <p>🎉 Aucune espèce manquante !</p>
      </div>

      <div v-else class="missing-grid">
        <div
          v-for="sp in store.missing_species"
          :key="sp.id"
          class="missing-card"
        >
          <img
            :src="sp.sprite_url"
            :alt="sp.name_fr"
            class="missing-sprite"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = sp.sprite_fallback_url"
          />
          <p class="missing-name">{{ sp.name_fr }}</p>
          <UiTypeBadge :type="sp.type1" size="xs" />
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.living-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 960px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.living-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  color: var(--color-text-primary);
  letter-spacing: 0.05em;
}
.living-sub {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin-top: 4px;
  font-style: italic;
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}
.stat-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.stat-shiny  { border-color: rgba(255,230,102,0.25); }
.stat-gmax   { border-color: rgba(156,106,222,0.25); }

.stat-val {
  font-family: var(--font-display);
  font-size: 2rem;
  color: var(--color-text-primary);
  letter-spacing: 0.02em;
}
.shiny-text { color: var(--color-rarity-shiny); text-shadow: 0 0 12px rgba(255,224,102,0.5); }
.gmax-text  { color: var(--color-accent-purple); }

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.stat-sub { font-size: 0.72rem; color: var(--color-text-muted); }

/* Global progress */
.global-progress {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
}
.progress-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.progress-label { font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary); }
.progress-pct   { font-family: var(--font-display); font-size: 1.4rem; color: var(--color-accent-purple); }

/* Sections */
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.section-title {
  font-size: 1.3rem;
  color: var(--color-text-primary);
  letter-spacing: 0.04em;
}

/* Objectives */
.objectives-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.obj-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: var(--transition-base);
}
.obj-completed {
  border-color: rgba(255,215,0,0.35);
  background: rgba(255,215,0,0.04);
}
.obj-claimed {
  opacity: 0.55;
  border-color: rgba(86,201,109,0.25);
}
.obj-left {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}
.obj-status-icon { font-size: 1.3rem; flex-shrink: 0; margin-top: 2px; }
.obj-info { flex: 1; min-width: 0; }
.obj-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-primary);
}
.obj-desc {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  margin-top: 2px;
  line-height: 1.5;
}
.obj-bar  { margin-top: var(--space-2); }
.obj-count { font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px; }

.obj-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  flex-shrink: 0;
}
.reward-chip {
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(255,215,0,0.12);
  color: var(--color-accent-yellow);
  border-radius: var(--radius-full);
  padding: 2px 10px;
  white-space: nowrap;
}
.chip-blue { background: rgba(79,195,247,0.12); color: var(--color-accent-blue); }

.btn-claim {
  background: linear-gradient(135deg, #c49a00, #ffd700);
  color: #1a1c2e;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.8rem;
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-claim:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.03); }
.btn-claim:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-claim-all {
  background: rgba(156,106,222,0.15);
  border: 1px solid rgba(156,106,222,0.4);
  border-radius: var(--radius-md);
  color: #b894f5;
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.82rem;
  padding: 6px 14px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-claim-all:hover:not(:disabled) { background: rgba(156,106,222,0.25); }
.btn-claim-all:disabled { opacity: 0.45; cursor: not-allowed; }

/* Missing */
.filter-row { display: flex; gap: var(--space-2); }
.gen-select {
  background: var(--color-bg-tertiary);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-family: var(--font-primary);
  font-size: 0.82rem;
  padding: 6px 10px;
  cursor: pointer;
}

.missing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: var(--space-2);
}
.missing-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: var(--transition-fast);
}
.missing-card:hover { border-color: rgba(79,195,247,0.3); }
.missing-sprite {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  filter: brightness(0.7) grayscale(0.5);
}
.missing-name {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.2;
}

/* States */
.state-loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
  padding: var(--space-6);
}
.state-empty {
  text-align: center;
  padding: var(--space-8);
  color: var(--color-text-secondary);
  font-size: 1rem;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(156,106,222,0.3);
  border-top-color: var(--color-accent-purple);
  border-radius: 50%;
  animation: spin-slow 0.8s linear infinite;
}

/* Responsive */
@media (max-width: 700px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .obj-card   { flex-direction: column; }
  .missing-grid { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); }
}
@media (max-width: 400px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
</style>
