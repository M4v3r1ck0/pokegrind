<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref } from 'vue'
import { usePvpStore } from '@/stores/pvp'
import { useAuthStore } from '@/stores/auth'
import { useNuxtApp } from '#app'

const store  = usePvpStore()
const auth   = useAuthStore()
const { $api } = useNuxtApp()

const page        = ref(1)
const tier_filter = ref('')

const TIER_LABELS: Record<string, string> = {
  '':       'Tous',
  bronze:   '🥉 Bronze',
  silver:   '🥈 Argent',
  gold:     '🥇 Or',
  diamond:  '💎 Diamant',
  master:   '🔮 Master',
  legend:   '🌟 Légende',
}

const TIER_COLORS: Record<string, string> = {
  bronze:  'var(--color-rarity-common)',
  silver:  '#c0c0c0',
  gold:    'var(--color-accent-yellow)',
  diamond: 'var(--color-accent-blue)',
  master:  'var(--color-accent-purple)',
  legend:  'var(--color-accent-red)',
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

onMounted(async () => {
  await store.fetchLeaderboard(1)
})

async function changePage(p: number) {
  page.value = p
  await store.fetchLeaderboard(p, tier_filter.value || undefined)
}

async function filterByTier(t: string) {
  tier_filter.value = t
  page.value = 1
  await store.fetchLeaderboard(1, t || undefined)
}
</script>

<template>
  <div class="classement-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="cl-header">
      <div>
        <h1 class="font-display cl-title">Classement PvP</h1>
        <p class="cl-sub">Saison en cours — Top classés</p>
      </div>
      <NuxtLink to="/jeu/pvp" class="btn-back">← PvP</NuxtLink>
    </div>

    <!-- ── Tier filter ────────────────────────────────────────── -->
    <div class="tier-filters">
      <button
        v-for="(label, key) in TIER_LABELS"
        :key="key"
        class="tier-btn"
        :class="{ 'tier-active': tier_filter === key }"
        :style="tier_filter === key && key ? { color: TIER_COLORS[key], borderColor: TIER_COLORS[key] } : {}"
        @click="filterByTier(key)"
      >{{ label }}</button>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="store.is_loading" class="state-loading">
      <div class="spinner" /> Chargement…
    </div>

    <!-- ── Leaderboard ────────────────────────────────────────── -->
    <div v-else class="leaderboard">
      <div
        v-for="entry in store.leaderboard"
        :key="entry.player_id"
        class="lb-row"
        :class="{
          'lb-me':   entry.player_id === auth.player?.id,
          'lb-top1': entry.rank === 1,
          'lb-top3': entry.rank <= 3,
        }"
      >
        <span class="lb-rank">{{ rankMedal(entry.rank) }}</span>
        <div class="lb-player">
          <div class="lb-avatar">{{ entry.username?.charAt(0).toUpperCase() }}</div>
          <span class="lb-username">{{ entry.username }}</span>
        </div>
        <span class="lb-tier" :style="{ color: TIER_COLORS[entry.tier] }">
          {{ TIER_LABELS[entry.tier] ?? entry.tier }}
        </span>
        <span class="lb-elo">{{ entry.elo.toLocaleString('fr-FR') }}</span>
        <div class="lb-record">
          <span class="wins">{{ entry.wins }}V</span>
          <span class="sep">/</span>
          <span class="losses">{{ entry.losses }}D</span>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="store.leaderboard_total > 20" class="pagination">
        <button class="page-btn" :disabled="page === 1" @click="changePage(page - 1)">←</button>
        <span class="page-info">Page {{ page }}</span>
        <button class="page-btn" :disabled="store.leaderboard_total <= page * 20" @click="changePage(page + 1)">→</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.classement-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.cl-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.cl-title  { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.cl-sub    { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }
.btn-back  { font-size: 0.82rem; color: var(--color-text-muted); text-decoration: none; transition: var(--transition-fast); }
.btn-back:hover { color: var(--color-text-primary); }

.tier-filters { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.tier-btn {
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  padding: 5px 14px;
  cursor: pointer;
  transition: var(--transition-fast);
  font-family: var(--font-primary);
}
.tier-btn:hover  { background: rgba(255,255,255,0.1); }
.tier-active     { background: rgba(255,255,255,0.08); }

.leaderboard { display: flex; flex-direction: column; gap: var(--space-2); }

.lb-row {
  display: grid;
  grid-template-columns: 48px auto 1fr 100px 80px;
  align-items: center;
  gap: var(--space-3);
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  transition: var(--transition-fast);
}
.lb-row:hover { border-color: rgba(255,255,255,0.12); }
.lb-me    { border-color: rgba(156,106,222,0.35); background: rgba(156,106,222,0.06); }
.lb-top1  { border-color: rgba(255,215,0,0.4); background: rgba(255,215,0,0.05); }
.lb-top3  { border-color: rgba(255,215,0,0.2); }

.lb-rank { font-family: var(--font-display); font-size: 1.2rem; text-align: center; }
.lb-player { display: flex; align-items: center; gap: var(--space-2); }
.lb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7a4db8, #9c6ade);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 1rem;
  color: #fff;
  flex-shrink: 0;
}
.lb-username { font-size: 0.9rem; font-weight: 700; color: var(--color-text-primary); }
.lb-tier     { font-size: 0.8rem; font-weight: 700; }
.lb-elo      { font-family: var(--font-display); font-size: 1.1rem; color: var(--color-text-primary); text-align: right; }
.lb-record   { display: flex; gap: 4px; align-items: center; font-size: 0.78rem; }
.wins    { color: var(--type-grass); font-weight: 700; }
.losses  { color: var(--color-accent-red); font-weight: 700; }
.sep     { color: var(--color-text-muted); }

.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-3); padding: var(--space-3); }
.page-btn {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  padding: 6px 14px;
  cursor: pointer;
  font-family: var(--font-primary);
  transition: var(--transition-fast);
}
.page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: var(--color-text-muted); }

.state-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(156,106,222,0.3); border-top-color: var(--color-accent-purple); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

@media (max-width: 600px) {
  .lb-row { grid-template-columns: 36px auto 1fr 80px; }
  .lb-record { display: none; }
}
</style>
