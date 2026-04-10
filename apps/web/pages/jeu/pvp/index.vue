<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref, computed } from 'vue'
import { usePvpStore } from '@/stores/pvp'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const store  = usePvpStore()
const auth   = useAuthStore()
const router = useRouter()

const finding  = ref(false)
const msg      = ref('')
const msg_type = ref<'success' | 'error'>('success')

const TIER_LABELS: Record<string, string> = {
  bronze:  '🥉 Bronze',
  silver:  '🥈 Argent',
  gold:    '🥇 Or',
  diamond: '💎 Diamant',
  master:  '🔮 Master',
  legend:  '🌟 Légende',
}

const TIER_COLORS: Record<string, string> = {
  bronze:  'var(--color-rarity-common)',
  silver:  '#c0c0c0',
  gold:    'var(--color-accent-yellow)',
  diamond: 'var(--color-accent-blue)',
  master:  'var(--color-accent-purple)',
  legend:  'var(--color-accent-red)',
}

onMounted(async () => {
  await store.fetchSeason()
  await store.fetchNotifications()
})

async function findOpponent() {
  finding.value = true
  try {
    await store.findOpponent()
    if (!store.current_opponent) {
      showMsg('Aucun adversaire disponible pour le moment.', 'error')
    }
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? 'Erreur', 'error')
  } finally {
    finding.value = false
  }
}

async function attack() {
  if (!store.current_opponent) return
  try {
    const result = await store.attack(store.current_opponent.player_id)
    router.push(`/jeu/pvp/replay?battle_id=${result.battle_id}`)
  } catch (e: any) {
    showMsg(e.response?.data?.message ?? "Erreur lors de l'attaque", 'error')
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  msg.value      = text
  msg_type.value = type
  setTimeout(() => { msg.value = '' }, 3000)
}

const season_end_days = computed(() => {
  if (!store.season) return 0
  const ms = new Date(store.season.end_at).getTime() - Date.now()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
})

const tier = computed(() => store.season?.my_entry?.tier ?? 'bronze')
const elo  = computed(() => store.season?.my_entry?.elo ?? 1000)
</script>

<template>
  <div class="pvp-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="pvp-header">
      <div>
        <h1 class="font-display pvp-title">PvP Classé</h1>
        <p class="pvp-sub">Montez dans les rangs — chaque victoire compte.</p>
      </div>
      <div v-if="store.season" class="season-chip">
        <span class="season-icon">📅</span>
        <span class="season-text">{{ season_end_days }}j restants</span>
      </div>
    </div>

    <!-- ── Toast ──────────────────────────────────────────────── -->
    <Transition name="fade">
      <div v-if="msg" class="toast-inline" :class="msg_type === 'success' ? 'toast-success' : 'toast-error'">
        {{ msg }}
      </div>
    </Transition>

    <!-- ── Player rank card ───────────────────────────────────── -->
    <div v-if="store.season" class="rank-card">
      <div class="rank-left">
        <p class="rank-label">Votre rang</p>
        <p class="tier-name font-display" :style="{ color: TIER_COLORS[tier] }">
          {{ TIER_LABELS[tier] ?? tier }}
        </p>
        <p class="elo-val">{{ elo.toLocaleString('fr-FR') }} ELO</p>
      </div>
      <div class="rank-right">
        <div class="rank-stats">
          <div class="stat-item">
            <span class="stat-n">{{ store.season.my_entry?.wins ?? 0 }}</span>
            <span class="stat-l green-text">V</span>
          </div>
          <span class="stat-sep">/</span>
          <div class="stat-item">
            <span class="stat-n">{{ store.season.my_entry?.losses ?? 0 }}</span>
            <span class="stat-l red-text">D</span>
          </div>
        </div>
        <div class="rank-actions">
          <NuxtLink to="/jeu/pvp/classement" class="btn-leaderboard">Classement</NuxtLink>
          <NuxtLink to="/jeu/pvp/defense" class="btn-defense">Défense</NuxtLink>
        </div>
      </div>
    </div>

    <!-- ── Find opponent ──────────────────────────────────────── -->
    <div class="matchmaking-card">
      <div class="matchmaking-top">
        <h2 class="font-display matchmaking-title">Défi</h2>
        <button
          class="btn-find"
          :disabled="finding"
          @click="findOpponent"
        >
          <span v-if="finding" class="btn-spinner" />
          <span v-else>🔍 Trouver un adversaire</span>
        </button>
      </div>

      <!-- Opponent found -->
      <Transition name="slide-down">
        <div v-if="store.current_opponent" class="opponent-card">
          <div class="opp-info">
            <div class="opp-avatar">{{ store.current_opponent.username?.charAt(0).toUpperCase() }}</div>
            <div class="opp-details">
              <p class="opp-name">{{ store.current_opponent.username }}</p>
              <p class="opp-tier" :style="{ color: TIER_COLORS[store.current_opponent.tier] }">
                {{ TIER_LABELS[store.current_opponent.tier] }}
              </p>
              <p class="opp-elo">{{ store.current_opponent.elo }} ELO</p>
            </div>
          </div>
          <button class="btn-attack" @click="attack">⚔️ Attaquer</button>
        </div>
      </Transition>
    </div>

    <!-- ── Recent notifications ───────────────────────────────── -->
    <div v-if="store.notifications?.length" class="notifs-section">
      <h2 class="font-display section-title">Résultats récents</h2>
      <div class="notifs-list">
        <div
          v-for="notif in store.notifications.slice(0, 5)"
          :key="notif.id"
          class="notif-row"
          :class="notif.attacker_id === auth.player?.id ? 'notif-win' : 'notif-loss'"
        >
          <span class="notif-icon">{{ notif.attacker_id === auth.player?.id ? '⚔️' : '🛡️' }}</span>
          <div class="notif-text">
            <span class="notif-msg">{{ notif.message }}</span>
            <span class="notif-elo" :style="{ color: notif.elo_change >= 0 ? 'var(--type-grass)' : 'var(--color-accent-red)' }">
              {{ notif.elo_change >= 0 ? '+' : '' }}{{ notif.elo_change }} ELO
            </span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.pvp-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.pvp-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.pvp-title  { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.pvp-sub    { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

.season-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(79,195,247,0.1);
  border: 1px solid rgba(79,195,247,0.25);
  border-radius: var(--radius-full);
  padding: 4px 12px;
}
.season-icon { font-size: 0.85rem; }
.season-text { font-size: 0.78rem; color: var(--color-accent-blue); font-weight: 700; }

/* Rank card */
.rank-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
}
.rank-label  { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.tier-name   { font-size: 2rem; letter-spacing: 0.04em; margin-top: 2px; }
.elo-val     { font-size: 1rem; color: var(--color-text-secondary); margin-top: 4px; font-weight: 700; }

.rank-right  { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-3); }
.rank-stats  { display: flex; align-items: center; gap: var(--space-2); }
.stat-item   { display: flex; align-items: baseline; gap: 3px; }
.stat-n      { font-family: var(--font-display); font-size: 1.5rem; color: var(--color-text-primary); }
.stat-l      { font-size: 0.75rem; font-weight: 800; }
.stat-sep    { font-size: 1rem; color: var(--color-text-muted); }
.green-text  { color: var(--type-grass); }
.red-text    { color: var(--color-accent-red); }

.rank-actions { display: flex; gap: var(--space-2); }
.btn-leaderboard, .btn-defense {
  font-size: 0.78rem;
  font-weight: 700;
  border-radius: var(--radius-md);
  padding: 6px 14px;
  text-decoration: none;
  transition: var(--transition-fast);
  font-family: var(--font-primary);
}
.btn-leaderboard {
  background: rgba(79,195,247,0.1);
  border: 1px solid rgba(79,195,247,0.25);
  color: var(--color-accent-blue);
}
.btn-leaderboard:hover { background: rgba(79,195,247,0.2); }
.btn-defense {
  background: rgba(230,57,70,0.1);
  border: 1px solid rgba(230,57,70,0.25);
  color: var(--color-accent-red);
}
.btn-defense:hover { background: rgba(230,57,70,0.2); }

/* Matchmaking */
.matchmaking-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.matchmaking-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.matchmaking-title { font-size: 1.3rem; color: var(--color-text-primary); letter-spacing: 0.04em; }

.btn-find {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.9rem;
  padding: var(--space-3) var(--space-6);
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-find:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.02); }
.btn-find:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Opponent */
.opponent-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,215,0,0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
.opp-info   { display: flex; align-items: center; gap: var(--space-3); }
.opp-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: #fff;
  flex-shrink: 0;
}
.opp-name   { font-size: 0.95rem; font-weight: 700; color: var(--color-text-primary); }
.opp-tier   { font-size: 0.8rem; font-weight: 700; margin-top: 2px; }
.opp-elo    { font-size: 0.75rem; color: var(--color-text-muted); }

.btn-attack {
  background: linear-gradient(135deg, #b03030, #e63946);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.9rem;
  padding: var(--space-3) var(--space-5);
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.btn-attack:hover { filter: brightness(1.1); transform: scale(1.02); }

/* Notifications */
.section-title { font-size: 1.2rem; color: var(--color-text-primary); letter-spacing: 0.04em; margin-bottom: var(--space-3); }
.notifs-list { display: flex; flex-direction: column; gap: var(--space-2); }
.notif-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.notif-win  { border-color: rgba(86,201,109,0.2); }
.notif-loss { border-color: rgba(230,57,70,0.15); }
.notif-icon { font-size: 1rem; flex-shrink: 0; }
.notif-text { display: flex; flex: 1; justify-content: space-between; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.notif-msg  { font-size: 0.82rem; color: var(--color-text-secondary); }
.notif-elo  { font-size: 0.82rem; font-weight: 800; white-space: nowrap; }

/* Toast */
.toast-inline { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: 0.85rem; font-weight: 700; }
.toast-success { background: rgba(86,201,109,0.15); border: 1px solid rgba(86,201,109,0.35); color: #56c96d; }
.toast-error   { background: rgba(230,57,70,0.15); border: 1px solid rgba(230,57,70,0.35); color: var(--color-accent-red); }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* Responsive */
@media (max-width: 600px) {
  .pvp-header { flex-direction: column; align-items: flex-start; }
  .rank-card  { flex-direction: column; align-items: flex-start; }
  .rank-right { align-items: flex-start; }
}
</style>
