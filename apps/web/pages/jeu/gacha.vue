<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

async function doPull(count: 1 | 10 | 25 | 100) {
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

function reveal(idx: number) {
  revealed.value[idx] = true
}

// Best pull = rareté la plus haute du dernier batch
const RARITY_ORDER: Record<string, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4,
}

const bestResult = computed(() => {
  if (gacha.lastResults.length === 0 || revealing.value) return null
  const sorted = [...gacha.lastResults].sort((a, b) =>
    (RARITY_ORDER[b.pokemon.rarity] ?? 0) - (RARITY_ORDER[a.pokemon.rarity] ?? 0)
  )
  return sorted[0] ?? null
})

const pullSummary = computed(() => {
  if (gacha.lastResults.length === 0) return null
  const counts: Record<string, number> = {}
  let shinies = 0
  for (const r of gacha.lastResults) {
    counts[r.pokemon.rarity] = (counts[r.pokemon.rarity] ?? 0) + 1
    if (r.pokemon.is_shiny) shinies++
  }
  return { counts, shinies }
})

const epicPct = computed(() => Math.min(100, Math.round((gacha.pity.pity_epic / (gacha.pity.epic_threshold || 50)) * 100)))
const legendPct = computed(() => Math.min(100, Math.round((gacha.pity.pity_legendary / (gacha.pity.legendary_threshold || 200)) * 100)))
const showBest = computed(() => !gacha.isPulling && gacha.lastResults.some((_, i) => revealed.value[i]))
</script>

<template>
  <div class="gacha-root">
    <!-- Panneau gauche : pity + pulls -->
    <aside class="gacha-left">
      <div class="pity-block">
        <div class="pity-label">Pity Épique</div>
        <div class="pity-bar-wrap"><div class="pity-bar pity-epic" :style="{ width: epicPct + '%' }" /></div>
        <div class="pity-num">{{ gacha.pity.pity_epic }} / {{ gacha.pity.epic_threshold }}</div>
      </div>
      <div class="pity-block">
        <div class="pity-label">Pity Légendaire</div>
        <div class="pity-bar-wrap"><div class="pity-bar pity-legend" :style="{ width: legendPct + '%' }" /></div>
        <div class="pity-num">{{ gacha.pity.pity_legendary }} / {{ gacha.pity.legendary_threshold }}</div>
      </div>
      <div class="pity-total">{{ gacha.pity.total_pulls.toLocaleString('fr') }} pulls total</div>

      <div class="pull-btns">
        <button class="pull-btn pull-1"   :disabled="gacha.isPulling" @click="doPull(1)">
          <span class="pull-count">× 1 Pull</span>
          <span class="pull-price">1 000 💰</span>
        </button>
        <button class="pull-btn pull-10"  :disabled="gacha.isPulling" @click="doPull(10)">
          <span class="pull-count">× 10 Pulls</span>
          <span class="pull-price">9 000 💰 <span class="discount">-10%</span></span>
        </button>
        <button class="pull-btn pull-25"  :disabled="gacha.isPulling" @click="doPull(25)">
          <span class="pull-count">× 25 Pulls</span>
          <span class="pull-price">22 500 💰 <span class="discount">-10%</span></span>
        </button>
        <button class="pull-btn pull-100" :disabled="gacha.isPulling" @click="doPull(100)">
          <span class="pull-count">× 100 Pulls</span>
          <span class="pull-price">80 000 💰 <span class="discount">-20%</span></span>
        </button>
      </div>
    </aside>

    <!-- Panneau droit : résultats -->
    <div class="gacha-right">
      <!-- Meilleur pull -->
      <div v-if="bestResult && showBest" class="best-pull-card" :style="{ borderColor: RARITY_COLORS[bestResult.pokemon.rarity] }">
        <img class="best-sprite" :src="bestResult.pokemon.sprite_url" @error="fallbackSprite" />
        <div class="best-info">
          <div class="best-label">✨ Meilleur tirage</div>
          <div class="best-name">{{ bestResult.pokemon.name_fr }}</div>
          <div class="best-rarity" :style="{ color: RARITY_COLORS[bestResult.pokemon.rarity] }">
            {{ RARITY_LABELS[bestResult.pokemon.rarity] }}
            <span v-if="bestResult.pokemon.is_shiny"> · SHINY</span>
          </div>
        </div>
      </div>

      <!-- Résumé chips -->
      <div v-if="pullSummary" class="pull-summary">
        <span v-if="pullSummary.counts.mythic"    class="s-chip s-mythic">   ★ {{ pullSummary.counts.mythic }}    Mythique</span>
        <span v-if="pullSummary.counts.legendary" class="s-chip s-legendary">★ {{ pullSummary.counts.legendary }} Légendaire</span>
        <span v-if="pullSummary.counts.epic"      class="s-chip s-epic">     ★ {{ pullSummary.counts.epic }}     Épique</span>
        <span v-if="pullSummary.counts.rare"      class="s-chip s-rare">     · {{ pullSummary.counts.rare }}     Rare</span>
        <span v-if="pullSummary.counts.common"    class="s-chip s-common">   · {{ pullSummary.counts.common }}   Commun</span>
        <span v-if="pullSummary.shinies > 0"      class="s-chip s-shiny">    ✨ {{ pullSummary.shinies }} Shiny</span>
      </div>

      <!-- Grille résultats -->
      <div v-if="gacha.lastResults.length > 0" class="results-grid">
        <div
          v-for="(result, idx) in gacha.lastResults"
          :key="result.pokemon.id + '-' + idx"
          class="result-card"
          :class="[`rc-${result.pokemon.rarity}`, { revealed: revealed[idx] }]"
          @click="reveal(idx)"
        >
          <template v-if="revealed[idx]">
            <span v-if="result.pokemon.is_shiny" class="badge-shiny">✨</span>
            <span v-if="result.is_new_species"   class="badge-new">NEW</span>
            <img class="result-sprite" :src="result.pokemon.sprite_url" :alt="result.pokemon.name_fr" @error="fallbackSprite" />
            <div class="result-name">{{ result.pokemon.name_fr }}</div>
            <div class="rarity-dot" :class="`dot-${result.pokemon.rarity}`" />
          </template>
          <template v-else>
            <div class="card-back">⚪</div>
          </template>
        </div>
      </div>
      <div v-else-if="!gacha.isPulling" class="gacha-empty">
        <div class="empty-ball">⚪</div>
        <p>Effectuez un tirage pour commencer</p>
      </div>
      <div v-if="gacha.isPulling" class="gacha-pulling">Tirage en cours…</div>
    </div>
  </div>
</template>

<style scoped>
.gacha-root { display: flex; height: calc(100dvh - 48px); background: #0d0f1a; }

.gacha-left {
  width: 200px; min-width: 200px;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-right: 1px solid rgba(255,255,255,0.05);
  overflow-y: auto;
}
.pity-block {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 10px 12px;
}
.pity-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.3); margin-bottom: 6px; }
.pity-bar-wrap { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; margin-bottom: 4px; overflow: hidden; }
.pity-bar { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
.pity-epic   { background: linear-gradient(90deg, #8b5cf6, #c678dd); }
.pity-legend { background: linear-gradient(90deg, #fbbf24, #ffd700); }
.pity-num { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); text-align: right; }
.pity-total { font-size: 11px; color: rgba(255,255,255,0.25); text-align: center; }

.pull-btns { display: flex; flex-direction: column; gap: 7px; }
.pull-btn {
  width: 100%;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  font-family: inherit;
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  transition: transform 0.1s, opacity 0.1s;
}
.pull-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.pull-btn:not(:disabled):hover  { transform: scale(1.02); }
.pull-btn:not(:disabled):active { transform: scale(0.98); }
.pull-count { font-size: 12px; font-weight: 800; color: #fff; }
.pull-price { font-size: 10px; color: rgba(255,255,255,0.7); }
.discount   { background: rgba(255,255,255,0.2); padding: 0 4px; border-radius: 3px; font-size: 9px; }
.pull-1   { background: linear-gradient(135deg, #e63946, #9c1a24); }
.pull-10  { background: linear-gradient(135deg, #7c3aed, #4c1d95); }
.pull-25  { background: linear-gradient(135deg, #0891b2, #0c4a6e); }
.pull-100 { background: linear-gradient(135deg, #d97706, #78350f); }

.gacha-right { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }

.best-pull-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.best-sprite { width: 72px; height: 72px; image-rendering: pixelated; }
.best-label  { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,215,0,0.55); font-weight: 700; }
.best-name   { font-size: 18px; font-weight: 900; color: #fff; }
.best-rarity { font-size: 12px; font-weight: 700; }

.pull-summary { display: flex; gap: 5px; flex-wrap: wrap; }
.s-chip { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 99px; }
.s-mythic    { background: rgba(255,107,157,0.12); color: #ff6b9d; border: 1px solid rgba(255,107,157,0.25); }
.s-legendary { background: rgba(251,191,36,0.12);  color: #fbbf24;  border: 1px solid rgba(251,191,36,0.25);  }
.s-epic      { background: rgba(139,92,246,0.12);   color: #a78bfa;  border: 1px solid rgba(139,92,246,0.25);  }
.s-rare      { background: rgba(79,195,247,0.1);    color: #4fc3f7;  border: 1px solid rgba(79,195,247,0.2);   }
.s-common    { background: rgba(255,255,255,0.05);  color: rgba(255,255,255,0.35); border: 1px solid rgba(255,255,255,0.1); }
.s-shiny     { background: rgba(255,224,102,0.12);  color: #ffe066;  border: 1px solid rgba(255,224,102,0.25); }

.results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 7px; }
.result-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 7px 5px;
  text-align: center;
  position: relative;
  cursor: pointer;
  transition: transform 0.1s;
}
.result-card:hover { transform: scale(1.03); }
.rc-legendary { border-color: rgba(251,191,36,0.4);  background: rgba(251,191,36,0.06);  }
.rc-epic      { border-color: rgba(139,92,246,0.35); background: rgba(139,92,246,0.06); }
.rc-mythic    { border-color: rgba(255,107,157,0.4); background: rgba(255,107,157,0.06);}
.rc-rare      { border-color: rgba(79,195,247,0.3);  background: rgba(79,195,247,0.04);  }
.result-sprite { width: 44px; height: 44px; image-rendering: pixelated; display: block; margin: 0 auto; }
.result-name   { font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.65); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rarity-dot    { width: 6px; height: 6px; border-radius: 50%; margin: 3px auto 0; }
.dot-legendary { background: #fbbf24; }
.dot-epic      { background: #a78bfa; }
.dot-mythic    { background: #ff6b9d; }
.dot-rare      { background: #4fc3f7; }
.dot-common    { background: rgba(255,255,255,0.2); }
.badge-shiny, .badge-new { position: absolute; top: 4px; right: 4px; font-size: 9px; font-weight: 700; }
.badge-new { background: #56c96d; color: #fff; padding: 1px 4px; border-radius: 3px; top: 4px; left: 4px; right: auto; }
.card-back { font-size: 28px; padding: 14px 0; opacity: 0.4; }
.gacha-empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.25); }
.empty-ball  { font-size: 48px; margin-bottom: 10px; }
.gacha-pulling { text-align: center; padding: 20px; color: rgba(255,255,255,0.4); }
</style>
