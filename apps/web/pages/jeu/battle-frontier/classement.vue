<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref } from 'vue'
import { useBattleFrontierStore } from '@/stores/battleFrontier'
import { useAuthStore } from '@/stores/auth'

const store = useBattleFrontierStore()
const auth = useAuthStore()
const page = ref(1)

onMounted(async () => {
  if (!store.current_rotation) await store.fetchCurrentRotation()
  await store.fetchLeaderboard(1)
})

async function changePage(p: number) {
  page.value = p
  await store.fetchLeaderboard(p)
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

function rankColor(rank: number): string {
  if (rank === 1) return 'var(--color-accent-yellow)'
  if (rank === 2) return '#c0c0c0'
  if (rank === 3) return '#cd7f32'
  return 'var(--color-text-muted)'
}
</script>

<template>
  <div class="bf-classement-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="bfc-header">
      <div>
        <h1 class="font-display bfc-title">Classement Battle Frontier</h1>
        <p v-if="store.current_rotation" class="bfc-sub">
          Rotation : {{ store.current_rotation.challenge_type_label ?? store.current_rotation.challenge_type }}
        </p>
      </div>
      <NuxtLink to="/jeu/battle-frontier" class="btn-back">← Battle Frontier</NuxtLink>
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
          'lb-top3': entry.rank <= 3,
        }"
      >
        <span class="lb-rank" :style="{ color: rankColor(entry.rank) }">{{ rankMedal(entry.rank) }}</span>
        <div class="lb-player">
          <div class="lb-avatar">{{ entry.username?.charAt(0).toUpperCase() }}</div>
          <span class="lb-username">{{ entry.username }}</span>
        </div>
        <span class="lb-mode">{{ entry.mode_label ?? entry.mode }}</span>
        <span class="lb-score font-display">{{ entry.score.toLocaleString('fr-FR') }}</span>
        <span class="lb-gems">+{{ entry.gems_reward ?? 5 }} 💎</span>
      </div>

      <div v-if="!store.leaderboard?.length" class="state-empty">
        Aucun résultat pour cette rotation.
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
.bf-classement-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.bfc-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
.bfc-title  { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.bfc-sub    { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }
.btn-back   { font-size: 0.82rem; color: var(--color-text-muted); text-decoration: none; transition: var(--transition-fast); white-space: nowrap; }
.btn-back:hover { color: var(--color-text-primary); }

.leaderboard { display: flex; flex-direction: column; gap: var(--space-2); }

.lb-row {
  display: grid;
  grid-template-columns: 48px auto 1fr 100px 60px;
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
.lb-top3  { border-color: rgba(255,215,0,0.2); }

.lb-rank { font-family: var(--font-display); font-size: 1.3rem; text-align: center; }
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
.lb-mode     { font-size: 0.78rem; color: var(--color-text-secondary); }
.lb-score    { font-size: 1.2rem; color: var(--color-text-primary); text-align: right; }
.lb-gems     { font-size: 0.8rem; font-weight: 700; color: var(--color-accent-yellow); text-align: right; }

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
.state-empty   { text-align: center; padding: var(--space-8); color: var(--color-text-muted); font-style: italic; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(255,215,0,0.3); border-top-color: var(--color-accent-yellow); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

@media (max-width: 600px) {
  .lb-row { grid-template-columns: 36px auto 1fr 80px; }
  .lb-gems { display: none; }
}
</style>
