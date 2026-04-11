<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useOfflineStore } from '~/stores/offline'
import { usePrestigeStore } from '~/stores/prestige'
import { useSprite } from '~/composables/useSprite'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const auth = useAuthStore()
const offlineStore = useOfflineStore()
const prestige = usePrestigeStore()
const sprite = useSprite()

onMounted(() => {
  offlineStore.fetchHistory()
  prestige.fetchPrestigeStatus()
})

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `Il y a ${days} jour${days > 1 ? 's' : ''}`
  if (hours > 0) return `Il y a ${hours}h`
  return "Il y a moins d'1h"
}

function formatNum(n: number | undefined | null): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('fr-FR')
}
</script>

<template>
  <div class="profil-page">

    <!-- ── Player card ─────────────────────────────────────────── -->
    <div class="player-card">
      <div class="player-avatar">
        {{ auth.player?.username?.charAt(0).toUpperCase() }}
      </div>
      <div class="player-info">
        <h1 class="player-name font-display">{{ auth.player?.username }}</h1>
        <p class="player-email">{{ auth.player?.email }}</p>
        <div class="player-chips">
          <UiPrestigeBadge v-if="prestige.status?.level" :level="prestige.status.level" />
          <div class="gold-chip">
            <span>🪙</span>
            <span>{{ formatNum(auth.player?.gold) }}</span>
          </div>
          <UiGemCounter :amount="auth.player?.gems ?? 0" size="sm" />
        </div>
      </div>
    </div>

    <!-- ── Stats ──────────────────────────────────────────────── -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon">🏆</span>
        <span class="stat-val font-display">{{ formatNum(auth.player?.current_floor) }}</span>
        <span class="stat-label">Étage actuel</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">💎</span>
        <span class="stat-val font-display">{{ formatNum(auth.player?.gems) }}</span>
        <span class="stat-label">Gems totaux</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🌟</span>
        <span class="stat-val font-display">{{ prestige.status?.level ?? 0 }}</span>
        <span class="stat-label">Niveau Prestige</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">⚔️</span>
        <span class="stat-val font-display">{{ formatNum(auth.player?.frontier_points) }}</span>
        <span class="stat-label">Points Frontier</span>
      </div>
    </div>

    <!-- ── Prestige multipliers ───────────────────────────────── -->
    <div v-if="prestige.status?.multipliers" class="multipliers-section">
      <h2 class="font-display section-title">Multiplicateurs Prestige</h2>
      <div class="multi-grid">
        <div class="multi-card">
          <span class="multi-label">Or</span>
          <span class="multi-val">×{{ prestige.status.multipliers.gold.toFixed(2) }}</span>
        </div>
        <div class="multi-card">
          <span class="multi-label">XP</span>
          <span class="multi-val">×{{ prestige.status.multipliers.xp.toFixed(2) }}</span>
        </div>
        <div class="multi-card">
          <span class="multi-label">Pension</span>
          <span class="multi-val">×{{ prestige.status.multipliers.daycare.toFixed(2) }}</span>
        </div>
        <div class="multi-card">
          <span class="multi-label">Gems/Boss</span>
          <span class="multi-val">+{{ (prestige.status.multipliers.gems_per_boss ?? 0) }}</span>
        </div>
      </div>
    </div>

    <!-- ── Offline history ───────────────────────────────────── -->
    <div v-if="offlineStore.history?.length" class="history-section">
      <h2 class="font-display section-title">Historique Offline</h2>
      <div class="history-list">
        <div
          v-for="report in offlineStore.history.slice(0, 10)"
          :key="report.id"
          class="history-row"
        >
          <div class="history-info">
            <p class="history-when">{{ timeAgo(report.created_at) }}</p>
            <p class="history-duration">{{ Math.floor(report.absence_seconds / 3600) }}h{{ Math.floor((report.absence_seconds % 3600) / 60) }}m d'absence</p>
          </div>
          <div class="history-gains">
            <span class="gain-chip gold-chip-sm">+{{ formatNum(report.gold_earned) }} 🪙</span>
            <span class="gain-chip">{{ formatNum(report.kills) }} kills</span>
            <span v-if="report.hatches > 0" class="gain-chip hatch-chip">{{ report.hatches }} éclosion{{ report.hatches > 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Préférences ──────────────────────────────────────── -->
    <div class="prefs-section">
      <h2 class="font-display section-title">Préférences</h2>
      <div class="pref-row">
        <div class="pref-info">
          <span class="pref-label">Sprites animés</span>
          <span class="pref-desc">Affiche les GIFs animés Gen 5 (peut impacter les performances)</span>
        </div>
        <button
          class="toggle-btn"
          :class="{ active: sprite.animated.value }"
          :title="sprite.animated.value ? 'Désactiver les sprites animés' : 'Activer les sprites animés'"
          @click="sprite.toggle()"
        >
          <span class="toggle-knob" />
        </button>
      </div>
    </div>

    <!-- ── Quick links ────────────────────────────────────────── -->
    <div class="quick-links">
      <NuxtLink to="/jeu/parametres" class="ql-btn">⚙️ Paramètres</NuxtLink>
      <NuxtLink to="/jeu/prestige" class="ql-btn">✨ Prestige</NuxtLink>
      <NuxtLink to="/jeu/pokedex/living" class="ql-btn">📖 Pokédex Vivant</NuxtLink>
    </div>

  </div>
</template>

<style scoped>
.profil-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

/* Player card */
.player-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-5);
}
.player-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 2.5rem;
  color: #fff;
  flex-shrink: 0;
  box-shadow: var(--shadow-glow-purple);
}
.player-name  { font-size: 2rem; color: var(--color-text-primary); letter-spacing: 0.04em; }
.player-email { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 2px; }
.player-chips { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-3); }

.gold-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.25);
  border-radius: var(--radius-full);
  padding: 3px 10px;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-accent-yellow);
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
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
}
.stat-icon  { font-size: 1.3rem; }
.stat-val   { font-size: 1.5rem; color: var(--color-text-primary); }
.stat-label { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }

/* Prestige multipliers */
.section-title { font-size: 1.3rem; color: var(--color-text-primary); letter-spacing: 0.04em; margin-bottom: var(--space-4); }
.multi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}
.multi-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(156,106,222,0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}
.multi-label { font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
.multi-val   { font-family: var(--font-display); font-size: 1.4rem; color: var(--color-accent-purple); }

/* History */
.history-list { display: flex; flex-direction: column; gap: var(--space-2); }
.history-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.history-when     { font-size: 0.82rem; font-weight: 700; color: var(--color-text-primary); }
.history-duration { font-size: 0.72rem; color: var(--color-text-muted); margin-top: 2px; }
.history-gains    { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.gain-chip {
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-full);
  padding: 2px 10px;
  color: var(--color-text-secondary);
}
.gold-chip-sm { background: rgba(255,215,0,0.1); color: var(--color-accent-yellow); }
.hatch-chip   { background: rgba(255,107,157,0.1); color: var(--color-rarity-mythic); }

/* Prefs */
.prefs-section { display: flex; flex-direction: column; gap: var(--space-3); }
.pref-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
.pref-info   { display: flex; flex-direction: column; gap: 3px; }
.pref-label  { font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary); }
.pref-desc   { font-size: 0.75rem; color: var(--color-text-muted); }

.toggle-btn {
  width: 48px;
  height: 26px;
  border-radius: 13px;
  border: none;
  cursor: pointer;
  background: rgba(255,255,255,0.15);
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;
}
.toggle-btn.active { background: #9c6ade; }
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
  display: block;
}
.toggle-btn.active .toggle-knob { transform: translateX(22px); }

/* Quick links */
.quick-links { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.ql-btn {
  font-size: 0.82rem;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  padding: 8px 16px;
  text-decoration: none;
  transition: var(--transition-fast);
}
.ql-btn:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

/* Responsive */
@media (max-width: 700px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .multi-grid { grid-template-columns: repeat(2, 1fr); }
  .player-card { flex-direction: column; text-align: center; }
}
@media (max-width: 450px) {
  .history-row { flex-direction: column; align-items: flex-start; }
}
</style>
