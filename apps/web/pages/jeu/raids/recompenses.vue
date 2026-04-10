<template>
  <div class="recompenses-page">
    <div class="page-header">
      <NuxtLink to="/jeu/raids" class="back-link">← Retour aux Raids</NuxtLink>
      <h1 class="page-title">🎁 Récompenses Raids</h1>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner" />
      <p>Chargement...</p>
    </div>

    <!-- Pas de récompenses -->
    <div v-else-if="!store.pending_rewards.length" class="empty-state">
      <div class="empty-icon">🎁</div>
      <h2>Aucune récompense en attente</h2>
      <p>Participe à un Raid Mondial pour gagner des récompenses !</p>
      <NuxtLink to="/jeu/raids" class="btn btn-primary">⚔️ Voir les Raids actifs</NuxtLink>
    </div>

    <!-- Récompenses à collecter -->
    <div v-else>
      <p class="rewards-count">
        {{ store.pending_rewards.length }} récompense{{ store.pending_rewards.length > 1 ? 's' : '' }} à collecter
      </p>

      <div class="rewards-list">
        <div
          v-for="reward in store.pending_rewards"
          :key="reward.id"
          class="reward-card"
          :class="`type-${reward.reward_type}`"
        >
          <div class="reward-header">
            <div class="reward-icon">{{ rewardIcon(reward.reward_type) }}</div>
            <div class="reward-info">
              <div class="reward-title">{{ rewardTitle(reward) }}</div>
              <div class="reward-source">{{ reward.boss_name_fr }}</div>
            </div>
          </div>
          <button
            class="btn btn-collect"
            :disabled="collecting === reward.id"
            @click="collect(reward.id)"
          >
            <span v-if="collecting === reward.id">Collecte en cours...</span>
            <span v-else>Collecter</span>
          </button>
        </div>
      </div>

      <!-- Tout collecter -->
      <div v-if="store.pending_rewards.length > 1" class="collect-all">
        <button
          class="btn btn-primary btn-collect-all"
          :disabled="collectingAll"
          @click="collectAll"
        >
          <span v-if="collectingAll">Collecte en cours...</span>
          <span v-else>🎁 Tout collecter ({{ store.pending_rewards.length }})</span>
        </button>
      </div>
    </div>

    <!-- Toast succès -->
    <Transition name="toast">
      <div v-if="toast" class="toast-success">
        ✅ {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { ref, onMounted } from 'vue'
import { useRaidStore } from '~/stores/raid'
import type { RaidReward } from '~/stores/raid'

const store = useRaidStore()
const loading = ref(false)
const collecting = ref<string | null>(null)
const collectingAll = ref(false)
const toast = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  await store.fetchPendingRewards()
  loading.value = false
})

async function collect(reward_id: string) {
  collecting.value = reward_id
  try {
    await store.collectReward(reward_id)
    showToast('Récompense collectée !')
  } catch (err: any) {
    showToast(err.message ?? 'Erreur lors de la collecte.')
  } finally {
    collecting.value = null
  }
}

async function collectAll() {
  collectingAll.value = true
  const ids = [...store.pending_rewards.map((r) => r.id)]
  let count = 0
  for (const id of ids) {
    try {
      await store.collectReward(id)
      count++
    } catch { /* continuer */ }
  }
  collectingAll.value = false
  if (count > 0) showToast(`${count} récompense${count > 1 ? 's' : ''} collectée${count > 1 ? 's' : ''} !`)
}

function rewardIcon(type: string) {
  return { gems: '💎', pokemon: '🐾', item: '🧪', gold: '🪙' }[type] ?? '🎁'
}

function rewardTitle(reward: RaidReward) {
  const data = reward.reward_data as any
  if (reward.reward_type === 'gems') return `${data.amount} Gemmes`
  if (reward.reward_type === 'gold') return `${(data.amount ?? 0).toLocaleString('fr-FR')} Or`
  if (reward.reward_type === 'pokemon') return data.name_fr ?? 'Pokémon Légendaire'
  if (reward.reward_type === 'item') return `Méga-Stone (${data.target ?? '?'})`
  return 'Récompense'
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => { toast.value = null }, 3000)
}
</script>

<style scoped>
.recompenses-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 1.5rem;
  position: relative;
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
}

.loading-state, .empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-secondary, #a0aec0);
}

.empty-icon { font-size: 3rem; margin-bottom: 1rem; }

.loading-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--color-bg-tertiary, #2f3259);
  border-top-color: var(--color-accent-yellow, #ffd700);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}
@keyframes spin { to { transform: rotate(360deg); } }

.rewards-count {
  color: var(--color-text-secondary, #a0aec0);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.rewards-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.reward-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-bg-secondary, #252742);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-bg-tertiary, #2f3259);
  transition: border-color 0.2s ease;
}

.reward-card.type-gems   { border-color: rgba(156, 106, 222, 0.3); }
.reward-card.type-pokemon { border-color: rgba(255, 215, 0, 0.3); }
.reward-card.type-item   { border-color: rgba(79, 195, 247, 0.3); }

.reward-header { display: flex; align-items: center; gap: 0.75rem; }
.reward-icon { font-size: 1.75rem; }
.reward-title { font-weight: 600; color: var(--color-text-primary, #f0f0f0); }
.reward-source { font-size: 0.8rem; color: var(--color-text-muted, #6b7a99); margin-top: 0.2rem; }

.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.btn:hover:not(:disabled) { transform: scale(1.02); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.btn-primary { background: linear-gradient(135deg, #9c6ade, #7c4ab8); color: white; }
.btn-collect { background: var(--color-bg-tertiary, #2f3259); color: var(--color-text-primary, #f0f0f0); }

.collect-all { text-align: center; }
.btn-collect-all { padding: 0.75rem 2rem; font-size: 1rem; }

.toast-success {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: #1e4d2b;
  color: #56c96d;
  border: 1px solid #56c96d;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  z-index: 100;
}

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
