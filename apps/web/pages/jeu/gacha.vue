<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGachaStore } from '~/stores/gacha'
import { useAuthStore } from '~/stores/auth'
import { useConfetti } from '~/composables/useConfetti'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const gacha = useGachaStore()
const auth  = useAuthStore()
const { shinyConfetti } = useConfetti()

// Card flip state — track which result cards have been revealed
const revealed = ref<boolean[]>([])
const revealing = ref(false)

onMounted(async () => {
  await gacha.fetchPity()
})

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire', mythic: 'Mythique',
}

const RARITY_COLORS: Record<string, string> = {
  common:    'var(--color-rarity-common)',
  rare:      'var(--color-rarity-rare)',
  epic:      'var(--color-rarity-epic)',
  legendary: 'var(--color-rarity-legendary)',
  mythic:    'var(--color-rarity-mythic)',
}

async function doPull(count: 1 | 10 | 25 | 50 | 100) {
  try {
    revealed.value = []
    await gacha.pull(count)
    // Animate reveals one by one
    if (gacha.lastResults.length > 0) {
      revealing.value = true
      for (let i = 0; i < gacha.lastResults.length; i++) {
        await new Promise(r => setTimeout(r, count === 1 ? 400 : count <= 10 ? 120 : 60))
        revealed.value.push(true)
        // Fire confetti on shiny reveal
        if (gacha.lastResults[i]?.pokemon?.is_shiny) {
          shinyConfetti()
        }
      }
      revealing.value = false
    }
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    alert(e.response?.data?.message || 'Erreur lors du tirage')
  }
}

function fallbackSprite(event: Event) {
  const img = event.target as HTMLImageElement
  const alt = img.alt.toLowerCase().replace(/[^a-z0-9]/g, '')
  img.src = `https://play.pokemonshowdown.com/sprites/gen5/${alt}.png`
}

// Best pull = rareté la plus haute du dernier batch
const RARITY_ORDER: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4,
}

const bestPull = computed(() => {
  if (gacha.lastResults.length === 0 || revealing.value) return null
  const sorted = [...gacha.lastResults].sort((a, b) =>
    (RARITY_ORDER[b.pokemon.rarity] ?? 0) - (RARITY_ORDER[a.pokemon.rarity] ?? 0)
  )
  return sorted[0] ?? null
})

const raritySummary = computed(() => {
  const counts: Record<string, number> = {}
  for (const r of gacha.lastResults) {
    counts[r.pokemon.rarity] = (counts[r.pokemon.rarity] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([a], [b]) => (RARITY_ORDER[b] ?? 0) - (RARITY_ORDER[a] ?? 0))
})

function rarityGlow(rarity: string): string {
  return {
    common:    '0 0 8px rgba(168,181,194,0.3)',
    rare:      '0 0 10px rgba(79,195,247,0.4)',
    epic:      '0 0 14px rgba(198,120,221,0.5)',
    legendary: 'var(--shadow-glow-yellow)',
    mythic:    '0 0 18px rgba(255,107,157,0.7)',
  }[rarity] ?? 'none'
}
</script>

<template>
  <div class="gacha-page">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="gacha-header">
      <h1 class="font-display gacha-title">Gacha</h1>
      <div class="gold-display">
        <span>💰</span>
        <span class="gold-val">{{ Number(auth.player?.gold ?? 0).toLocaleString('fr') }}</span>
        <span class="gold-label">or</span>
      </div>
    </div>

    <div class="gacha-layout">

      <!-- ── Left panel: pity + pull ─────────────────────────── -->
      <aside class="gacha-sidebar">

        <!-- Pity counters -->
        <div v-if="gacha.pity" class="pity-card">
          <h2 class="pity-title">Compteurs Pity</h2>

          <div class="pity-row">
            <div class="pity-label">Pity Épique</div>
            <UiProgressBar
              :value="(gacha.pity.pity_epic / gacha.pity.epic_threshold) * 100"
              color="var(--color-rarity-epic)"
              height="6px"
            />
            <div class="pity-count pity-epic">
              {{ gacha.pity.pity_epic }}<span class="pity-max">/{{ gacha.pity.epic_threshold }}</span>
            </div>
          </div>

          <div class="pity-row">
            <div class="pity-label">Pity Légendaire</div>
            <UiProgressBar
              :value="(gacha.pity.pity_legendary / gacha.pity.legendary_threshold) * 100"
              color="var(--color-rarity-legendary)"
              height="6px"
            />
            <div class="pity-count pity-legendary">
              {{ gacha.pity.pity_legendary }}<span class="pity-max">/{{ gacha.pity.legendary_threshold }}</span>
            </div>
          </div>

          <div class="pity-total">{{ gacha.pity.total_pulls.toLocaleString('fr') }} pulls au total</div>
        </div>

        <!-- Pull buttons -->
        <div class="pull-section">
          <button
            class="btn-pull btn-pull-1"
            :disabled="gacha.isPulling"
            @click="doPull(1)"
          >
            <span class="pull-count">1 Pull</span>
            <span class="pull-price">1 000 💰</span>
          </button>

          <button
            class="btn-pull btn-pull-10"
            :disabled="gacha.isPulling"
            @click="doPull(10)"
          >
            <span class="pull-count">10 Pulls</span>
            <span class="pull-price">
              9 000 💰 <span class="pull-discount">-10%</span>
            </span>
          </button>

          <button
            class="btn-pull btn-pull-25"
            :disabled="gacha.isPulling"
            @click="doPull(25)"
          >
            <span class="pull-count">25 Pulls</span>
            <span class="pull-price">22 500 💰 <span class="pull-discount">-10%</span></span>
          </button>

          <button
            class="btn-pull btn-pull-50"
            :disabled="gacha.isPulling"
            @click="doPull(50)"
          >
            <span class="pull-count">50 Pulls</span>
            <span class="pull-price">42 500 💰 <span class="pull-discount">-15%</span></span>
          </button>

          <button
            class="btn-pull btn-pull-100"
            :disabled="gacha.isPulling"
            @click="doPull(100)"
          >
            <span class="pull-count">100 Pulls</span>
            <span class="pull-price">80 000 💰 <span class="pull-discount">-20%</span></span>
          </button>
        </div>

        <!-- Rates table -->
        <div class="rates-card">
          <h3 class="rates-title">Taux</h3>
          <div class="rates-list">
            <div class="rate-row">
              <span class="rate-rarity" style="color: var(--color-rarity-common)">Commun</span>
              <span class="rate-pct">55%</span>
            </div>
            <div class="rate-row">
              <span class="rate-rarity" style="color: var(--color-rarity-rare)">Rare</span>
              <span class="rate-pct">33%</span>
            </div>
            <div class="rate-row">
              <span class="rate-rarity" style="color: var(--color-rarity-epic)">Épique</span>
              <span class="rate-pct">9% <small>(pity 50)</small></span>
            </div>
            <div class="rate-row">
              <span class="rate-rarity" style="color: var(--color-rarity-legendary)">Légendaire</span>
              <span class="rate-pct">2.5% <small>(pity 200)</small></span>
            </div>
            <div class="rate-row">
              <span class="rate-rarity" style="color: var(--color-rarity-mythic)">Mythique</span>
              <span class="rate-pct">0.5%</span>
            </div>
            <div class="rate-row">
              <span class="rate-rarity" style="color: var(--color-rarity-shiny)">✨ Shiny</span>
              <span class="rate-pct">1/8192</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- ── Results ─────────────────────────────────────────── -->
      <section class="gacha-results">

        <!-- Pulling spinner -->
        <div v-if="gacha.isPulling" class="pulling-state">
          <div class="ball-spin">
            <div class="pokeball">
              <div class="pokeball-top" />
              <div class="pokeball-middle" />
              <div class="pokeball-bottom" />
              <div class="pokeball-btn" />
            </div>
          </div>
          <p class="pulling-label">Tirage en cours…</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="gacha.lastResults.length === 0" class="results-empty">
          <p class="empty-icon">🎰</p>
          <p class="empty-label">Effectuez un tirage pour voir les résultats</p>
        </div>

        <!-- Results wrapper -->
        <div v-else class="results-wrapper">

          <!-- Best pull showcase (après révélation complète) -->
          <div v-if="bestPull" class="results-section">
            <div class="best-pull-showcase">
              <div class="best-pull-label">✨ Meilleur tirage</div>
              <div
                class="best-pull-card"
                :class="[`rarity-${bestPull.pokemon.rarity}`]"
                :style="{
                  borderColor: RARITY_COLORS[bestPull.pokemon.rarity],
                  boxShadow: rarityGlow(bestPull.pokemon.rarity),
                }"
              >
                <div class="best-pull-badges">
                  <span v-if="bestPull.pokemon.is_shiny" class="badge-shiny">✨ Shiny</span>
                  <span v-if="bestPull.is_new_species" class="badge-new">NEW</span>
                </div>
                <img
                  :src="bestPull.pokemon.is_shiny && bestPull.pokemon.sprite_shiny_url
                    ? bestPull.pokemon.sprite_shiny_url
                    : bestPull.pokemon.sprite_url || ''"
                  :alt="bestPull.pokemon.name_fr"
                  class="best-pull-sprite"
                  :class="{ 'sprite-shiny': bestPull.pokemon.is_shiny }"
                  @error="fallbackSprite"
                />
                <div class="best-pull-name">{{ bestPull.pokemon.name_fr }}</div>
                <div class="best-pull-rarity" :style="{ color: RARITY_COLORS[bestPull.pokemon.rarity] }">
                  {{ RARITY_LABELS[bestPull.pokemon.rarity] }}
                </div>
                <div class="best-pull-nature">{{ bestPull.pokemon.nature }}</div>
              </div>
            </div>
            <!-- Rarity summary chips -->
            <div class="rarity-summary">
              <div
                v-for="[rarity, count] in raritySummary"
                :key="rarity"
                class="rarity-chip"
                :style="{ borderColor: RARITY_COLORS[rarity], color: RARITY_COLORS[rarity] }"
              >
                <span class="rarity-chip-count">{{ count }}×</span>
                <span class="rarity-chip-label">{{ RARITY_LABELS[rarity] }}</span>
              </div>
            </div>
          </div>

          <!-- Results grid (visible pendant ET après la révélation) -->
          <div class="results-grid">
          <TransitionGroup name="card-reveal">
            <div
              v-for="(result, idx) in gacha.lastResults"
              :key="result.pokemon.id + '-' + idx"
              class="result-card"
              :class="[
                `rarity-${result.pokemon.rarity}`,
                { 'card-revealed': revealed[idx], 'card-hidden': !revealed[idx] },
                { 'card-shiny': result.pokemon.is_shiny },
                { 'card-new': result.is_new_species },
              ]"
              :style="{
                borderColor: RARITY_COLORS[result.pokemon.rarity],
                boxShadow: revealed[idx] ? rarityGlow(result.pokemon.rarity) : 'none',
              }"
            >
              <!-- Front (shown when revealed) -->
              <template v-if="revealed[idx]">
                <div class="card-badges">
                  <span v-if="result.pokemon.is_shiny" class="badge-shiny">✨</span>
                  <span v-if="result.is_new_species" class="badge-new">NEW</span>
                </div>
                <img
                  :src="result.pokemon.is_shiny && result.pokemon.sprite_shiny_url
                    ? result.pokemon.sprite_shiny_url
                    : result.pokemon.sprite_url || ''"
                  :alt="result.pokemon.name_fr"
                  class="result-sprite"
                  :class="{ 'sprite-shiny': result.pokemon.is_shiny }"
                  @error="fallbackSprite"
                />
                <div class="result-name">{{ result.pokemon.name_fr }}</div>
                <div class="result-rarity" :style="{ color: RARITY_COLORS[result.pokemon.rarity] }">
                  {{ RARITY_LABELS[result.pokemon.rarity] }}
                </div>
                <div class="result-nature">{{ result.pokemon.nature }}</div>
              </template>

              <!-- Back (hidden card) -->
              <template v-else>
                <div class="card-back">
                  <div class="card-back-pokeball">⚪</div>
                </div>
              </template>
            </div>
          </TransitionGroup>
          </div><!-- /results-grid -->

        </div><!-- /results-wrapper -->

      </section>
    </div>
  </div>
</template>

<style scoped>
.gacha-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Header ──────────────────────────────────────────────────────── */
.gacha-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gacha-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
}

.gold-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-primary);
  font-weight: 700;
  color: var(--color-accent-yellow);
  font-size: 1.1rem;
}
.gold-label { color: var(--color-text-muted); font-size: 0.8rem; }

/* ── Layout ──────────────────────────────────────────────────────── */
.gacha-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: var(--space-6);
  align-items: start;
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
.gacha-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Pity card */
.pity-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.pity-title {
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
}

.pity-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pity-label { font-size: 0.78rem; color: var(--color-text-secondary); font-weight: 600; }

.pity-count {
  font-family: var(--font-display);
  font-size: 1.1rem;
  align-self: flex-end;
  letter-spacing: 0.04em;
}
.pity-max { font-size: 0.7rem; color: var(--color-text-muted); }
.pity-epic      { color: var(--color-rarity-epic); }
.pity-legendary { color: var(--color-rarity-legendary); }

.pity-total {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-align: right;
  font-style: italic;
}

/* Pull buttons */
.pull-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.btn-pull {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  border: none;
  border-radius: var(--radius-xl);
  cursor: pointer;
  font-family: var(--font-primary);
  transition: var(--transition-base);
  gap: 4px;
}
.btn-pull:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-pull:hover:not(:disabled) { transform: translateY(-2px) scale(1.02); }

.btn-pull-1 {
  background: linear-gradient(135deg, #1a6ccc, #4fc3f7);
  color: #fff;
  box-shadow: var(--shadow-glow-blue);
}
.btn-pull-10 {
  background: linear-gradient(135deg, #4a0e8f, #9c6ade);
  color: #fff;
  box-shadow: var(--shadow-glow-purple);
}
.btn-pull-25 {
  background: linear-gradient(135deg, #0e6b4a, #2eca8b);
  color: #fff;
  box-shadow: 0 0 10px rgba(46,202,139,0.35);
}
.btn-pull-50 {
  background: linear-gradient(135deg, #8f6b0e, #ffd700);
  color: #1a1c2e;
  box-shadow: var(--shadow-glow-yellow);
}
.btn-pull-100 {
  background: linear-gradient(135deg, #8f0e0e, #e63946);
  color: #fff;
  box-shadow: 0 0 12px rgba(230,57,70,0.45);
}

.pull-count { font-size: 1.1rem; font-weight: 800; letter-spacing: 0.03em; }
.pull-price { font-size: 0.82rem; opacity: 0.85; }
.pull-discount { color: #56c96d; font-weight: 800; }

/* Rates */
.rates-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
}

.rates-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.rates-list { display: flex; flex-direction: column; gap: 5px; }

.rate-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}
.rate-rarity { font-weight: 700; }
.rate-pct { color: var(--color-text-secondary); }
.rate-pct small { color: var(--color-text-muted); }

/* ── Results ─────────────────────────────────────────────────────── */
.gacha-results {
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.results-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Results section (best pull + summary) */
.results-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Best pull showcase */
.best-pull-showcase {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.best-pull-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.best-pull-card {
  position: relative;
  background: var(--color-bg-secondary);
  border: 2px solid transparent;
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
  animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  min-width: 160px;
}

.best-pull-badges {
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  display: flex;
  justify-content: space-between;
}

.best-pull-sprite {
  width: 96px;
  height: 96px;
  object-fit: contain;
  image-rendering: pixelated;
}

.best-pull-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--color-text-primary);
}

.best-pull-rarity {
  font-size: 0.78rem;
  font-weight: 700;
}

.best-pull-nature {
  font-size: 0.68rem;
  color: var(--color-text-muted);
}

/* Rarity summary chips */
.rarity-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.rarity-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid;
  border-radius: var(--radius-full);
  padding: 3px 10px;
  background: rgba(255,255,255,0.04);
  font-size: 0.75rem;
  font-weight: 700;
}

.rarity-chip-count { opacity: 0.9; }
.rarity-chip-label { opacity: 0.75; font-size: 0.7rem; }

/* Pulling state */
.pulling-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-10);
}

/* Pokéball spinner */
.pokeball {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.2);
  animation: spin-slow 0.8s linear infinite;
  overflow: hidden;
}
.pokeball-top { position: absolute; top: 0; left: 0; right: 0; height: 50%; background: var(--color-accent-red); }
.pokeball-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 50%; background: #fff; }
.pokeball-middle {
  position: absolute;
  top: calc(50% - 2px);
  left: 0;
  right: 0;
  height: 4px;
  background: #333;
  z-index: 2;
}
.pokeball-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #333;
  z-index: 3;
}

.pulling-label {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

/* Empty state */
.results-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12);
  color: var(--color-text-muted);
}
.empty-icon  { font-size: 4rem; opacity: 0.4; }
.empty-label { font-size: 0.9rem; }

/* Results grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-3);
}

.result-card {
  position: relative;
  background: var(--color-bg-secondary);
  border: 2px solid transparent;
  border-radius: var(--radius-xl);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  transition: all 0.3s ease;
  overflow: hidden;
  min-height: 160px;
}

.card-hidden {
  background: var(--color-bg-tertiary);
  border-color: rgba(255,255,255,0.1);
}

.card-revealed {
  animation: scale-in 0.3s ease;
}

.card-shiny {
  background-image: radial-gradient(ellipse at 50% 0%, rgba(255,224,102,0.1) 0%, transparent 60%);
}

/* Rarity special styles */
.rarity-mythic.card-revealed {
  background-image: radial-gradient(ellipse at 50% 0%, rgba(255,107,157,0.15) 0%, transparent 60%);
}
.rarity-legendary.card-revealed {
  background-image: radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.12) 0%, transparent 60%);
}

.card-badges {
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  display: flex;
  justify-content: space-between;
}

.badge-shiny {
  font-size: 0.8rem;
  background: rgba(255,224,102,0.25);
  border-radius: var(--radius-sm);
  padding: 1px 4px;
}

.badge-new {
  font-size: 0.6rem;
  font-weight: 800;
  background: rgba(86,201,109,0.25);
  color: #56c96d;
  border-radius: var(--radius-sm);
  padding: 1px 5px;
  letter-spacing: 0.05em;
}

.result-sprite {
  width: 72px;
  height: 72px;
  object-fit: contain;
  image-rendering: pixelated;
  margin-top: var(--space-3);
}

.sprite-shiny {
  filter: drop-shadow(0 0 6px rgba(255,224,102,0.8));
  animation: twinkle 3s ease-in-out infinite;
}

.result-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-primary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-rarity {
  font-size: 0.68rem;
  font-weight: 700;
}

.result-nature {
  font-size: 0.62rem;
  color: var(--color-text-muted);
}

/* Card back */
.card-back {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  width: 100%;
}
.card-back-pokeball { font-size: 2.5rem; opacity: 0.15; }

/* Transition */
.card-reveal-enter-active { transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.card-reveal-enter-from   { opacity: 0; transform: scale(0.7) rotateY(90deg); }

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .gacha-layout { grid-template-columns: 1fr; }
  .gacha-sidebar { flex-direction: row; flex-wrap: wrap; }
  .pity-card, .rates-card { flex: 1; min-width: 240px; }
  .pull-section { flex-direction: row; flex: 1; min-width: 200px; }
  .btn-pull { flex: 1; }
  .results-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
}

@media (max-width: 480px) {
  .results-grid { grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
}
</style>
