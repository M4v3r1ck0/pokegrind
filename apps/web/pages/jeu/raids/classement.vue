<template>
  <div class="classement-page">
    <div class="page-header">
      <NuxtLink to="/jeu/raids" class="back-link">← Retour aux Raids</NuxtLink>
      <h1 class="page-title">📊 Classement</h1>
      <p v-if="raidInfo" class="raid-name">{{ raidInfo.name_fr }}</p>
    </div>

    <!-- HP restants -->
    <div v-if="raidInfo" class="raid-status-card">
      <div class="hp-bar-container">
        <div
          class="hp-bar-fill"
          :style="{ width: `${raidInfo.progress_percent}%` }"
        />
      </div>
      <div class="hp-labels">
        <span>{{ raidInfo.progress_percent.toFixed(1) }}% vaincu</span>
        <span class="status-badge" :class="`status-${raidInfo.status}`">
          {{ statusLabel(raidInfo.status) }}
        </span>
      </div>
    </div>

    <!-- Seuils de tier -->
    <div class="tiers-legend">
      <h2>Seuils de récompenses</h2>
      <div class="tiers-grid">
        <div v-for="tier in TIER_DEFS" :key="tier.key" class="tier-row" :class="`tier-${tier.key}`">
          <span class="tier-icon-label">{{ tier.icon }} {{ tier.label }}</span>
          <span class="tier-threshold">≥ {{ tier.threshold }}%</span>
          <span class="tier-reward">{{ tier.reward }}</span>
        </div>
      </div>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
    </div>

    <!-- Ma position (hors top 50) -->
    <div v-if="store.my_rank && store.my_rank > 50 && store.my_entry" class="my-rank-banner">
      <div class="rank-number">#{{ store.my_rank }}</div>
      <div class="rank-info">
        <span class="rank-username">{{ store.my_entry.username }} (vous)</span>
        <span class="rank-damage">{{ formatNumber(store.my_entry.damage_dealt) }} dégâts</span>
      </div>
      <div class="rank-tier">
        <span class="tier-badge" :class="`tier-${store.my_entry.tier}`">
          {{ tierIcon(store.my_entry.tier) }} {{ tierLabel(store.my_entry.tier) }}
        </span>
      </div>
    </div>

    <!-- Classement -->
    <div class="leaderboard-table">
      <div class="table-header">
        <span>Rang</span>
        <span>Joueur</span>
        <span>Dégâts</span>
        <span>%</span>
        <span>Tier</span>
      </div>

      <div
        v-for="entry in store.leaderboard"
        :key="entry.rank"
        class="table-row"
        :class="{
          'is-me': store.my_entry && entry.username === store.my_entry.username,
          'top-3': entry.rank <= 3
        }"
      >
        <span class="rank-cell">
          <span v-if="entry.rank === 1">🥇</span>
          <span v-else-if="entry.rank === 2">🥈</span>
          <span v-else-if="entry.rank === 3">🥉</span>
          <span v-else>#{{ entry.rank }}</span>
        </span>
        <span class="username-cell">
          {{ entry.username }}
          <span v-if="store.my_entry && entry.username === store.my_entry.username" class="you-label">← vous</span>
        </span>
        <span class="damage-cell">{{ formatNumber(entry.damage_dealt) }}</span>
        <span class="percent-cell">{{ entry.contribution_percent.toFixed(3) }}%</span>
        <span class="tier-cell">
          <span class="tier-badge" :class="`tier-${entry.tier}`">
            {{ tierIcon(entry.tier) }} {{ tierLabel(entry.tier) }}
          </span>
        </span>
      </div>

      <div v-if="!loading && !store.leaderboard.length" class="empty-leaderboard">
        Aucun participant pour l'instant.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRaidStore } from '~/stores/raid'

const route = useRoute()
const store = useRaidStore()
const loading = ref(false)
const raidInfo = ref<any>(null)

const TIER_DEFS = [
  { key: 'legend',   icon: '🏆', label: 'Légende',    threshold: '5.0', reward: 'Pokémon Légendaire + 50 💎 + Méga-Stone' },
  { key: 'champion', icon: '🥈', label: 'Champion',   threshold: '2.0', reward: 'Pokémon Légendaire + 30 💎' },
  { key: 'hero',     icon: '⚔️',  label: 'Héros',      threshold: '0.5', reward: 'Pokémon Rare + 15 💎' },
  { key: 'fighter',  icon: '🗡️',  label: 'Combattant', threshold: '0.1', reward: '10 💎' },
  { key: 'support',  icon: '🤝',  label: 'Support',    threshold: '0.01', reward: '5 💎' },
]

onMounted(async () => {
  const raid_id = route.query.id as string
  if (!raid_id) return

  loading.value = true
  await store.fetchLeaderboard(raid_id)

  // Récupérer les infos du raid
  raidInfo.value = store.leaderboard.length > 0
    ? null  // reconstruit depuis le store
    : null

  // Le leaderboard endpoint inclut raidInfo
  try {
    const { $api } = useNuxtApp() as any
    const data = await $api(`/raids/${raid_id}/leaderboard`)
    raidInfo.value = data.raid
  } catch { /* silencieux */ }

  loading.value = false
})

function tierLabel(t: string) {
  const labels: Record<string, string> = {
    legend: 'Légende', champion: 'Champion', hero: 'Héros',
    fighter: 'Combattant', support: 'Support', none: 'Aucun',
  }
  return labels[t] ?? t
}

function tierIcon(t: string) {
  const icons: Record<string, string> = {
    legend: '🏆', champion: '🥈', hero: '⚔️', fighter: '🗡️', support: '🤝', none: '',
  }
  return icons[t] ?? ''
}

function statusLabel(s: string) {
  return { active: 'En cours', defeated: 'Vaincu !', expired: 'Expiré' }[s] ?? s
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR')
}

function useNuxtApp() {
  return (window as any).__NUXT_APP__ ?? {}
}
</script>

<style scoped>
.classement-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-header { margin-bottom: 1.5rem; }

.back-link {
  color: var(--color-text-secondary, #a0aec0);
  text-decoration: none;
  font-size: 0.9rem;
  display: inline-block;
  margin-bottom: 0.75rem;
}

.page-title {
  font-family: var(--font-display, 'Bangers', cursive);
  font-size: 2rem;
  color: var(--color-accent-yellow, #ffd700);
  margin-bottom: 0.25rem;
}

.raid-name { color: var(--color-text-secondary, #a0aec0); }

.raid-status-card {
  background: var(--color-bg-secondary, #252742);
  border-radius: 10px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.hp-bar-container {
  height: 14px;
  background: var(--color-bg-primary, #1a1c2e);
  border-radius: 7px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.hp-bar-fill {
  height: 100%;
  border-radius: 7px;
  background: linear-gradient(90deg, #e63946, #ff6b6b);
  transition: width 0.5s ease;
}

.hp-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #a0aec0);
}

.status-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-active   { background: #1e3a1e; color: #56c96d; }
.status-defeated { background: #3a2e00; color: var(--color-accent-yellow, #ffd700); }
.status-expired  { background: #3a1a1a; color: #e63946; }

.tiers-legend {
  background: var(--color-bg-secondary, #252742);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
}

.tiers-legend h2 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-secondary, #a0aec0);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tiers-grid { display: flex; flex-direction: column; gap: 0.4rem; }

.tier-row {
  display: grid;
  grid-template-columns: 140px 80px 1fr;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.85rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
}

.tier-icon-label { font-weight: 600; }
.tier-threshold { color: var(--color-text-secondary, #a0aec0); }
.tier-reward { color: var(--color-text-muted, #6b7a99); }

.tier-row.tier-legend   { background: rgba(255, 215, 0, 0.07); }
.tier-row.tier-champion { background: rgba(79, 195, 247, 0.07); }

.loading-state { text-align: center; padding: 2rem; }
.loading-spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--color-bg-tertiary, #2f3259);
  border-top-color: var(--color-accent-yellow, #ffd700);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

.my-rank-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.rank-number { font-size: 1.5rem; font-weight: 700; color: var(--color-accent-yellow, #ffd700); min-width: 60px; }
.rank-info { flex: 1; }
.rank-username { display: block; font-weight: 600; color: var(--color-text-primary, #f0f0f0); }
.rank-damage { font-size: 0.85rem; color: var(--color-text-secondary, #a0aec0); }

.leaderboard-table {
  background: var(--color-bg-secondary, #252742);
  border-radius: 10px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 60px 1fr 140px 80px 120px;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-tertiary, #2f3259);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary, #a0aec0);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-row {
  display: grid;
  grid-template-columns: 60px 1fr 140px 80px 120px;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--color-bg-primary, #1a1c2e);
  align-items: center;
  font-size: 0.9rem;
  transition: background 0.15s ease;
}

.table-row:hover { background: var(--color-bg-tertiary, #2f3259); }
.table-row.is-me { background: rgba(255, 215, 0, 0.05); border-left: 3px solid var(--color-accent-yellow, #ffd700); }
.table-row.top-3 { font-weight: 600; }

.rank-cell { font-weight: 700; font-size: 1rem; }
.username-cell { color: var(--color-text-primary, #f0f0f0); }
.you-label { font-size: 0.75rem; color: var(--color-accent-yellow, #ffd700); margin-left: 0.4rem; }
.damage-cell { color: var(--color-accent-red, #e63946); font-weight: 600; }
.percent-cell { color: var(--color-text-secondary, #a0aec0); font-size: 0.85rem; }

.tier-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.tier-legend   { background: #3a2e00; color: var(--color-accent-yellow, #ffd700); }
.tier-champion { background: #1a2a3a; color: #8ab4d0; }
.tier-hero     { background: #2a1a1a; color: #e07070; }
.tier-fighter  { background: #1a2a1a; color: #70b070; }
.tier-support  { background: #252742; color: #a0aec0; }

.empty-leaderboard {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted, #6b7a99);
}
</style>
