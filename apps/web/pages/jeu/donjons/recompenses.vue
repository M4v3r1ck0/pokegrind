<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDungeonStore } from '~/stores/dungeon'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const dungeon = useDungeonStore()

onMounted(async () => {
  await dungeon.fetchPendingRewards()
})

const pending = computed(() => dungeon.pending_rewards)

// Regrouper par donjon_name_fr
const grouped = computed(() => {
  const map = new Map<string, typeof dungeon.pending_rewards>()
  for (const r of pending.value) {
    const key = r.dungeon_name_fr
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return [...map.entries()]
})

function reward_label(r: any): string {
  const data = r.reward_data ?? {}
  if (r.reward_type === 'gems')    return `+${data.amount ?? '?'} 💎`
  if (r.reward_type === 'gold')    return `+${data.amount ?? '?'} 💰`
  if (r.reward_type === 'pokemon') return `Pokémon #${data.species_id ?? '?'}`
  if (r.reward_type === 'ct')      return `CT Capacité #${data.move_id ?? '?'}`
  if (r.reward_type === 'item')    return `Item : ${data.item_name ?? data.item_name_fr ?? '?'}`
  return r.reward_type
}

async function collectAll(rewards: typeof dungeon.pending_rewards) {
  for (const r of rewards) {
    await dungeon.collectReward(r.id)
  }
}

async function collectOne(reward_id: string) {
  await dungeon.collectReward(reward_id)
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 pb-20">
    <div class="max-w-2xl mx-auto">

      <!-- En-tête -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/jeu/donjons')" class="text-gray-400 hover:text-white text-xl">←</button>
        <h1 class="text-2xl font-bold text-yellow-400">🎁 Mes Récompenses</h1>
      </div>

      <!-- Aucune récompense -->
      <div v-if="grouped.length === 0" class="bg-gray-900 rounded-xl p-8 text-center">
        <div class="text-4xl mb-3">📭</div>
        <p class="text-gray-300">Aucune récompense en attente.</p>
        <p class="text-gray-500 text-sm mt-1">Complétez des donjons pour gagner des récompenses !</p>
        <button @click="router.push('/jeu/donjons')" class="mt-4 px-6 py-2 bg-purple-700 hover:bg-purple-600 rounded-xl text-sm font-medium transition-colors">
          Voir les donjons
        </button>
      </div>

      <!-- Récompenses groupées par donjon -->
      <div v-else class="space-y-4">
        <div
          v-for="[dungeon_name, rewards] in grouped"
          :key="dungeon_name"
          class="bg-gray-900 border border-yellow-900/50 rounded-xl p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-sm text-yellow-400 font-semibold">🏆 {{ dungeon_name }}</div>
              <div class="text-xs text-gray-500">{{ rewards.length }} récompense(s)</div>
            </div>
            <button
              @click="collectAll(rewards)"
              class="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-xs font-semibold transition-colors"
            >
              Tout collecter
            </button>
          </div>

          <div class="space-y-2">
            <div
              v-for="reward in rewards"
              :key="reward.id"
              class="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <span class="text-lg">
                  {{ reward.reward_type === 'gems' ? '💎'
                   : reward.reward_type === 'gold' ? '💰'
                   : reward.reward_type === 'pokemon' ? '🔮'
                   : reward.reward_type === 'ct' ? '📀'
                   : '📦' }}
                </span>
                <span class="text-sm text-white">{{ reward_label(reward) }}</span>
              </div>
              <button
                @click="collectOne(reward.id)"
                class="px-3 py-1 bg-green-800 hover:bg-green-700 rounded-lg text-xs font-medium transition-colors"
              >
                Collecter
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
