<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRaidStore } from '~/stores/raid'
import { useNuxtApp } from '#app'

const store = useRaidStore()
const { $socket } = useNuxtApp() as any

const attacking = ref<string | null>(null)
const lastResult = ref<any>(null)

onMounted(async () => {
  await store.fetchActiveRaids()
  await store.fetchPendingRewards()

  for (const raid of store.active_raids) {
    store.joinRaidRoom(raid.id)
  }

  if ($socket) {
    $socket.on('raid:hp_update', (event: any) => { store.handleHpUpdate(event) })
    $socket.on('raid:defeated', (event: any) => { store.handleRaidDefeated(event) })
    $socket.on('raid:new', (event: any) => { store.handleNewRaid(event) })
  }
})

onUnmounted(() => {
  for (const raid of store.active_raids) {
    store.leaveRaidRoom(raid.id)
  }
  if ($socket) {
    $socket.off('raid:hp_update')
    $socket.off('raid:attack')
    $socket.off('raid:defeated')
    $socket.off('raid:new')
  }
})

async function attackRaid(raid: any) {
  attacking.value = raid.id
  const result = await store.attack(raid.id)
  if (result) {
    lastResult.value = { ...result, raid_id: raid.id }
    setTimeout(() => { lastResult.value = null }, 5000)
  }
  attacking.value = null
}

function difficultyLabel(d: string) {
  return { normal: 'Normal', hard: 'Difficile', extreme: 'Extrême' }[d] ?? d
}

function difficultyColor(d: string): string {
  return { normal: 'var(--type-grass)', hard: '#ff9a3c', extreme: 'var(--color-accent-red)' }[d] ?? 'var(--color-text-muted)'
}

function tierLabel(t: string) {
  const labels: Record<string, string> = {
    legend: 'Légende', champion: 'Champion', hero: 'Héros',
    fighter: 'Combattant', support: 'Support', none: 'Aucun',
  }
  return labels[t] ?? t
}

function formatNumber(n: number | bigint): string {
  return Number(n).toLocaleString('fr-FR')
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expiré'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${m}min`
}

function formatCooldown(next_attack_at: string | null): string {
  if (!next_attack_at) return '—'
  const remaining = Math.max(0, new Date(next_attack_at).getTime() - Date.now())
  const h = Math.floor(remaining / 3600000)
  const m = Math.floor((remaining % 3600000) / 60000)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${m}min`
}

function hpPercent(raid: any): number {
  if (!raid.hp_max) return 100
  return Math.min(100, Math.round((raid.hp_current / raid.hp_max) * 100))
}
</script>

<template>
  <div class="raids-page">

    <!-- ── Header ─────────────────────────────────────────────── -->
    <div class="raids-header">
      <div>
        <h1 class="font-display raids-title">Raids Mondiaux</h1>
        <p class="raids-sub">Combattez en coopération contre des boss légendaires.</p>
      </div>
      <div v-if="store.pending_rewards?.length" class="chip-pending">
        🎁 {{ store.pending_rewards.length }} récompense{{ store.pending_rewards.length > 1 ? 's' : '' }}
      </div>
    </div>

    <!-- ── Attack result toast ────────────────────────────────── -->
    <Transition name="slide-down">
      <div v-if="lastResult" class="result-toast">
        <span class="result-dmg">−{{ formatNumber(lastResult.damage_dealt) }} PV</span>
        <span v-if="lastResult.rewards?.gems" class="result-gems">+{{ lastResult.rewards.gems }} 💎</span>
        <span v-if="lastResult.loot?.length" class="result-loot">Loot obtenu !</span>
      </div>
    </Transition>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="store.is_loading" class="state-loading">
      <div class="spinner" /> Chargement des raids…
    </div>

    <!-- ── Raids list ─────────────────────────────────────────── -->
    <div v-else-if="store.active_raids?.length" class="raids-list">
      <div
        v-for="raid in store.active_raids"
        :key="raid.id"
        class="raid-card"
        :class="`difficulty-${raid.difficulty}`"
      >

        <!-- Boss portrait -->
        <div class="boss-portrait">
          <img
            v-if="raid.species?.sprite_url"
            :src="raid.species.sprite_url"
            :alt="raid.species?.name_fr"
            class="boss-sprite"
            loading="lazy"
            @error="($event.target as HTMLImageElement).src = raid.species.sprite_fallback_url"
          />
          <span v-else class="boss-sprite-fallback">👾</span>
          <span
            class="diff-badge"
            :style="{ color: difficultyColor(raid.difficulty), borderColor: difficultyColor(raid.difficulty) }"
          >{{ difficultyLabel(raid.difficulty) }}</span>
        </div>

        <!-- Boss info + HP bar -->
        <div class="boss-info">
          <p class="boss-name font-display">{{ raid.species?.name_fr ?? 'Raid Boss' }}</p>
          <div class="boss-hp-row">
            <UiHpBar :current="raid.hp_current" :max="raid.hp_max" />
            <span class="boss-hp-text">{{ formatNumber(raid.hp_current) }} / {{ formatNumber(raid.hp_max) }} PV</span>
          </div>
          <div class="boss-meta">
            <span class="meta-chip">⏱️ {{ formatTimeRemaining(raid.time_remaining_seconds) }}</span>
            <span class="meta-chip">👥 {{ raid.participants_count }} joueurs</span>
            <span class="meta-chip tier-chip">{{ tierLabel(raid.tier) }}</span>
          </div>
        </div>

        <!-- Attack button -->
        <div class="attack-col">
          <div v-if="raid.cooldown_remaining_seconds > 0" class="cooldown-info">
            <p class="cooldown-label">Cooldown</p>
            <p class="cooldown-val">{{ formatCooldown(raid.next_attack_at) }}</p>
          </div>
          <button
            class="btn-attack"
            :disabled="!!attacking || raid.cooldown_remaining_seconds > 0"
            @click="attackRaid(raid)"
          >
            <span v-if="attacking === raid.id" class="btn-spinner" />
            <span v-else>⚔️ Attaquer</span>
          </button>
          <p v-if="lastResult?.raid_id === raid.id && lastResult.damage_dealt" class="last-dmg">
            −{{ formatNumber(lastResult.damage_dealt) }} PV
          </p>
        </div>

      </div>
    </div>

    <div v-else class="state-empty">
      <p class="empty-icon">🌍</p>
      <p class="empty-text">Aucun raid actif pour le moment.</p>
      <p class="empty-sub">Les raids apparaissent régulièrement — revenez bientôt !</p>
    </div>

  </div>
</template>

<style scoped>
.raids-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

/* Header */
.raids-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}
.raids-title { font-size: clamp(1.8rem, 4vw, 2.4rem); color: var(--color-text-primary); letter-spacing: 0.05em; }
.raids-sub   { font-size: 0.82rem; color: var(--color-text-muted); margin-top: 4px; font-style: italic; }

.chip-pending {
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(255,215,0,0.1);
  border: 1px solid rgba(255,215,0,0.3);
  border-radius: var(--radius-full);
  color: var(--color-accent-yellow);
  padding: 4px 12px;
  white-space: nowrap;
}

/* Result toast */
.result-toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(156,106,222,0.15);
  border: 1px solid rgba(156,106,222,0.35);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-5);
}
.result-dmg  { font-family: var(--font-display); font-size: 1.2rem; color: var(--color-accent-red); }
.result-gems { font-weight: 700; color: var(--color-accent-yellow); }
.result-loot { font-size: 0.82rem; color: var(--color-accent-purple); }

/* Raids list */
.raids-list { display: flex; flex-direction: column; gap: var(--space-4); }

.raid-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  padding: var(--space-5) var(--space-6);
  display: grid;
  grid-template-columns: 120px 1fr auto;
  gap: var(--space-5);
  align-items: center;
  transition: var(--transition-base);
}
.raid-card:hover { box-shadow: var(--shadow-lg); }

.difficulty-hard    { border-color: rgba(255,154,60,0.3); }
.difficulty-extreme { border-color: rgba(230,57,70,0.35); box-shadow: 0 0 16px rgba(230,57,70,0.08); }

/* Boss portrait */
.boss-portrait {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}
.boss-sprite { width: 96px; height: 96px; image-rendering: pixelated; }
.boss-sprite-fallback { font-size: 3.5rem; }
.diff-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  border: 1px solid;
  border-radius: var(--radius-full);
  padding: 2px 10px;
}

/* Boss info */
.boss-name { font-size: 1.4rem; letter-spacing: 0.04em; color: var(--color-text-primary); }
.boss-hp-row { display: flex; flex-direction: column; gap: 4px; margin-top: var(--space-2); }
.boss-hp-text { font-size: 0.72rem; color: var(--color-text-muted); }
.boss-meta { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3); }
.meta-chip {
  font-size: 0.72rem;
  font-weight: 700;
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-full);
  padding: 2px 10px;
  color: var(--color-text-secondary);
}
.tier-chip { background: rgba(156,106,222,0.1); color: var(--color-accent-purple); }

/* Attack col */
.attack-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.cooldown-info { text-align: center; }
.cooldown-label { font-size: 0.68rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.cooldown-val   { font-family: var(--font-display); font-size: 1rem; color: var(--color-accent-blue); }

.btn-attack {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
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
  min-width: 120px;
}
.btn-attack:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.03); box-shadow: var(--shadow-glow-red); }
.btn-attack:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin-slow 0.8s linear infinite;
}
.last-dmg { font-size: 0.8rem; color: var(--color-accent-red); font-weight: 700; }

/* States */
.state-loading { display: flex; align-items: center; gap: var(--space-3); color: var(--color-text-muted); padding: var(--space-6); }
.state-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-12);
  text-align: center;
}
.empty-icon { font-size: 3rem; }
.empty-text { font-size: 1rem; font-weight: 700; color: var(--color-text-secondary); }
.empty-sub  { font-size: 0.82rem; color: var(--color-text-muted); font-style: italic; }
.spinner { width: 18px; height: 18px; border: 2px solid rgba(230,57,70,0.3); border-top-color: var(--color-accent-red); border-radius: 50%; animation: spin-slow 0.8s linear infinite; }

/* Slide down transition */
.slide-down-enter-active { transition: all 0.3s ease; }
.slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-12px); }

/* Responsive */
@media (max-width: 700px) {
  .raid-card { grid-template-columns: 80px 1fr; }
  .attack-col { grid-column: 1 / -1; flex-direction: row; justify-content: space-between; }
  .boss-sprite { width: 72px; height: 72px; }
}
@media (max-width: 500px) {
  .raids-header { flex-direction: column; align-items: flex-start; }
  .raid-card { grid-template-columns: 1fr; }
}
</style>
