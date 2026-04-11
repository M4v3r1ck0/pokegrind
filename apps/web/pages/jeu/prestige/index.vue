<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePrestigeStore } from '~/stores/prestige'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const prestige = usePrestigeStore()
const auth = useAuthStore()

onMounted(async () => {
  await prestige.fetchPrestigeStatus()
})

const eligibility = computed(() => prestige.eligibility)
const preview = computed(() => prestige.next_level_preview)

// ── Confirmation en deux étapes ───────────────────────────────────────────────

const confirm_step = ref(0) // 0 = idle, 1 = first confirm, 2 = text confirm
const confirm_text = ref('')
const is_loading = ref(false)
const result = ref<any>(null)
const error_msg = ref('')

function startPrestige() {
  if (!eligibility.value?.eligible) return
  confirm_step.value = 1
  confirm_text.value = ''
  error_msg.value = ''
}

function cancelPrestige() {
  confirm_step.value = 0
  confirm_text.value = ''
}

async function finalizePrestige() {
  if (confirm_text.value !== 'PRESTIGE') {
    error_msg.value = 'Tape exactement "PRESTIGE" pour confirmer.'
    return
  }
  is_loading.value = true
  error_msg.value = ''
  try {
    result.value = await prestige.performPrestige()
    confirm_step.value = 0
    // Mettre à jour le profil joueur
    await auth.fetchMe()
  } catch (err: any) {
    error_msg.value = err.response?.data?.error ?? 'Erreur lors du prestige'
  } finally {
    is_loading.value = false
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function formatMult(v: number): string {
  return `×${v.toFixed(2)}`
}
</script>

<template>
  <div class="prestige-page">

    <!-- ── Header ──────────────────────────────────────────────── -->
    <div class="prestige-header">
      <div>
        <h1 class="font-display prestige-title">Prestige</h1>
        <p v-if="prestige.current_level > 0" class="prestige-subtitle">
          <UiPrestigeBadge :level="prestige.current_level" :name-fr="prestige.current_name_fr" />
        </p>
        <p v-else class="prestige-subtitle muted">Aucun prestige pour l'instant</p>
      </div>
      <div class="total-badge">
        <span class="total-num font-display">{{ prestige.total_prestiges }}</span>
        <span class="total-label">prestiges totaux</span>
      </div>
    </div>

    <!-- ── Current multipliers ──────────────────────────────────── -->
    <div class="multipliers-grid">
      <div class="mult-card">
        <span class="mult-icon">💰</span>
        <span class="mult-val font-display" style="color: var(--color-accent-yellow)">{{ formatMult(prestige.multipliers.gold) }}</span>
        <span class="mult-label">Or</span>
      </div>
      <div class="mult-card">
        <span class="mult-icon">⭐</span>
        <span class="mult-val font-display" style="color: var(--color-accent-blue)">{{ formatMult(prestige.multipliers.xp) }}</span>
        <span class="mult-label">XP</span>
      </div>
      <div class="mult-card">
        <span class="mult-icon">🥚</span>
        <span class="mult-val font-display" style="color: var(--type-grass)">{{ formatMult(prestige.multipliers.daycare) }}</span>
        <span class="mult-label">Pension</span>
      </div>
      <div class="mult-card">
        <span class="mult-icon">💎</span>
        <span class="mult-val font-display" style="color: var(--color-accent-purple)">+{{ prestige.multipliers.gem_per_boss }}</span>
        <span class="mult-label">Gems/boss</span>
      </div>
    </div>

    <!-- ── Prestige result ───────────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="result" class="result-banner">
        <div class="result-inner">
          <span class="result-icon">✨</span>
          <div class="result-text">
            <h2 class="result-title font-display">Prestige {{ result.new_prestige_level }} accompli !</h2>
            <p>Titre obtenu : <strong>{{ result.prestige_name_fr }}</strong></p>
            <p class="result-gems">💎 +{{ result.gems_earned }} gems de récompense</p>
            <p v-if="result.badge_earned" class="result-badge-note">🏅 Badge : {{ result.badge_earned }}</p>
          </div>
          <button class="result-close" @click="result = null">✕</button>
        </div>
      </div>
    </Transition>

    <!-- ── Next prestige ─────────────────────────────────────────── -->
    <div v-if="prestige.is_loading" class="loading-state">
      <div class="spinner" /><span>Chargement…</span>
    </div>

    <template v-else-if="eligibility">
      <div class="next-prestige-card">
        <div class="next-header">
          <h2 class="next-title font-display">Prochain prestige</h2>
          <span class="next-name">{{ preview?.name_fr ?? '—' }}</span>
        </div>

        <!-- Not eligible -->
        <div v-if="!eligibility.eligible" class="not-eligible">
          <span class="ne-icon">⚠️</span>
          <div>
            <p class="ne-reason">{{ eligibility.reason }}</p>
            <p v-if="eligibility.current_floor !== undefined" class="ne-floor">
              Étage {{ eligibility.current_floor }} / {{ eligibility.required_floor }} requis
            </p>
          </div>
        </div>

        <!-- 3-column info -->
        <div class="prestige-info-cols">
          <!-- Lose -->
          <div v-if="eligibility.will_lose" class="info-col lose-col">
            <h3 class="col-title" style="color: var(--color-accent-red)">Tu perdras</h3>
            <ul class="col-list">
              <li>❌ Progression d'étage → étage 1</li>
              <li>❌ {{ formatNumber(eligibility.will_lose.gold) }} 💰</li>
              <li>❌ {{ formatNumber(eligibility.will_lose.total_kills) }} kills</li>
            </ul>
          </div>
          <!-- Keep -->
          <div v-if="eligibility.will_keep" class="info-col keep-col">
            <h3 class="col-title" style="color: var(--type-grass)">Tu garderas</h3>
            <ul class="col-list">
              <li>✅ Tous tes Pokémon</li>
              <li>✅ Tes gems</li>
              <li>✅ Tes améliorations</li>
              <li>✅ Ton ELO PvP</li>
              <li>✅ Ton Pokédex</li>
              <li>✅ Tes Points Frontier</li>
            </ul>
          </div>
          <!-- Gain -->
          <div v-if="eligibility.new_bonuses && preview" class="info-col gain-col">
            <h3 class="col-title" style="color: var(--color-accent-yellow)">Tu gagneras</h3>
            <ul class="col-list">
              <li>✨ Titre : {{ preview.name_fr }}</li>
              <li>💎 +{{ eligibility.new_bonuses.gems_reward }} gems</li>
              <li>💰 Or ×{{ eligibility.new_bonuses.gold_multiplier.toFixed(2) }}</li>
              <li>⭐ XP ×{{ eligibility.new_bonuses.xp_multiplier.toFixed(2) }}</li>
              <li v-if="eligibility.new_bonuses.gem_bonus_per_boss > 0">
                💎 +{{ eligibility.new_bonuses.gem_bonus_per_boss }}/boss
              </li>
            </ul>
          </div>
        </div>

        <!-- Prestige button / confirmation flow -->
        <div v-if="eligibility.eligible" class="confirm-zone">
          <!-- Step 0: CTA -->
          <button
            v-if="confirm_step === 0"
            class="btn-prestige"
            @click="startPrestige"
          >
            ⚠️ Effectuer le Prestige
          </button>

          <!-- Step 1: first confirm -->
          <div v-else-if="confirm_step === 1" class="confirm-box">
            <p class="confirm-warn">
              Es-tu sûr ? Tu perdras <strong>{{ formatNumber(eligibility.will_lose!.gold) }} 💰</strong> et retourneras à l'étage 1.
            </p>
            <div class="confirm-actions">
              <button class="btn-confirm-yes" @click="confirm_step = 2">Oui, continuer</button>
              <button class="btn-cancel" @click="cancelPrestige">Annuler</button>
            </div>
          </div>

          <!-- Step 2: text confirm -->
          <div v-else-if="confirm_step === 2" class="confirm-box">
            <p class="confirm-warn">Tape <code class="confirm-code">PRESTIGE</code> pour valider définitivement.</p>
            <input
              v-model="confirm_text"
              type="text"
              placeholder="PRESTIGE"
              class="confirm-input"
              @keyup.enter="finalizePrestige"
            />
            <p v-if="error_msg" class="confirm-error">{{ error_msg }}</p>
            <div class="confirm-actions">
              <button
                class="btn-confirm-yes"
                :disabled="is_loading"
                @click="finalizePrestige"
              >
                {{ is_loading ? 'En cours…' : 'Confirmer le prestige' }}
              </button>
              <button class="btn-cancel" @click="cancelPrestige">Annuler</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Navigation links ──────────────────────────────────────── -->
    <div class="nav-links">
      <NuxtLink to="/jeu/prestige/progression" class="nav-link-card">
        <span>📊</span><span>Les 50 niveaux</span>
      </NuxtLink>
      <NuxtLink to="/jeu/prestige/classement" class="nav-link-card">
        <span>🏆</span><span>Classement</span>
      </NuxtLink>
    </div>

  </div>
</template>

<style scoped>
.prestige-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 860px;
  margin: 0 auto;
  width: 100%;
}

/* ── Header ──────────────────────────────────────────────────────── */
.prestige-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.prestige-title {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  letter-spacing: 0.05em;
  color: var(--color-text-primary);
}

.prestige-subtitle {
  margin-top: var(--space-1);
}

.prestige-subtitle.muted { font-size: 0.85rem; color: var(--color-text-muted); font-style: italic; }

.total-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(156,106,222,0.12);
  border: 1px solid rgba(156,106,222,0.3);
  border-radius: var(--radius-xl);
  padding: var(--space-3) var(--space-5);
}

.total-num  { font-size: 2.4rem; color: #b894f5; letter-spacing: 0.04em; }
.total-label { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.1em; }

/* ── Multipliers ─────────────────────────────────────────────────── */
.multipliers-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}

.mult-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
}

.mult-icon { font-size: 1.4rem; }
.mult-val  { font-size: 1.5rem; letter-spacing: 0.04em; }
.mult-label { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }

/* ── Result banner ───────────────────────────────────────────────── */
.result-banner {
  background: rgba(255,215,0,0.08);
  border: 1px solid rgba(255,215,0,0.4);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-glow-yellow);
}

.result-inner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
}

.result-icon { font-size: 2rem; flex-shrink: 0; animation: twinkle 3s ease-in-out infinite; }

.result-text { flex: 1; }
.result-title { font-size: 1.3rem; color: var(--color-accent-yellow); letter-spacing: 0.04em; }
.result-gems  { color: #b894f5; margin-top: 4px; font-size: 0.9rem; }
.result-badge-note { color: var(--color-accent-yellow); font-size: 0.85rem; }

.result-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px;
  flex-shrink: 0;
}
.result-close:hover { color: var(--color-text-primary); }

/* ── Loading ─────────────────────────────────────────────────────── */
.loading-state { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* ── Next prestige card ──────────────────────────────────────────── */
.next-prestige-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.next-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.next-title {
  font-size: 1.2rem;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

.next-name {
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--color-accent-yellow);
  letter-spacing: 0.04em;
}

/* Not eligible */
.not-eligible {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: rgba(230,57,70,0.08);
  border: 1px solid rgba(230,57,70,0.3);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
}
.ne-icon   { font-size: 1.2rem; flex-shrink: 0; }
.ne-reason { color: var(--color-accent-red); font-size: 0.9rem; font-weight: 600; }
.ne-floor  { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px; }

/* 3-col info */
.prestige-info-cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}

.info-col {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
}

.col-title {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 800;
  margin-bottom: var(--space-2);
}

.col-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

/* Confirm zone */
.confirm-zone { }

.btn-prestige {
  width: 100%;
  padding: var(--space-4);
  background: rgba(230,57,70,0.15);
  border: 2px solid rgba(230,57,70,0.5);
  border-radius: var(--radius-xl);
  color: var(--color-accent-red);
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: var(--transition-base);
}
.btn-prestige:hover {
  background: rgba(230,57,70,0.25);
  box-shadow: 0 0 16px rgba(230,57,70,0.3);
}

.confirm-box {
  background: rgba(230,57,70,0.08);
  border: 1px solid rgba(230,57,70,0.4);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.confirm-warn { font-size: 0.9rem; color: var(--color-text-secondary); line-height: 1.5; }
.confirm-warn strong { color: var(--color-accent-red); }

.confirm-code {
  background: rgba(255,255,255,0.08);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-family: monospace;
  color: var(--color-accent-yellow);
  font-size: 0.95em;
}

.confirm-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-3);
  font-family: monospace;
  font-size: 1rem;
  letter-spacing: 0.1em;
  transition: var(--transition-fast);
}
.confirm-input:focus { outline: none; border-color: rgba(230,57,70,0.5); }

.confirm-error { font-size: 0.8rem; color: var(--color-accent-red); }

.confirm-actions { display: flex; gap: var(--space-3); }

.btn-confirm-yes {
  flex: 1;
  background: var(--color-accent-red);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-confirm-yes:hover:not(:disabled) { filter: brightness(1.15); }
.btn-confirm-yes:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-cancel {
  flex: 1;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  font-size: 0.9rem;
  padding: var(--space-2) var(--space-4);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-cancel:hover { background: rgba(255,255,255,0.12); color: var(--color-text-primary); }

/* ── Nav links ───────────────────────────────────────────────────── */
.nav-links {
  display: flex;
  gap: var(--space-3);
}

.nav-link-card {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  transition: var(--transition-fast);
}
.nav-link-card:hover {
  background: rgba(255,255,255,0.07);
  color: var(--color-text-primary);
  border-color: rgba(255,255,255,0.15);
}

/* Transition */
.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 700px) {
  .multipliers-grid     { grid-template-columns: repeat(2, 1fr); }
  .prestige-info-cols   { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .multipliers-grid { grid-template-columns: repeat(2, 1fr); }
  .nav-links { flex-direction: column; }
}
</style>
