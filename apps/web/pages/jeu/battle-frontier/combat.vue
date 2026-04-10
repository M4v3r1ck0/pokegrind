<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { ref, onMounted } from 'vue'
import { useBattleFrontierStore } from '@/stores/battleFrontier'
import { useRouter } from 'vue-router'

const store = useBattleFrontierStore()
const router = useRouter()

const is_battling = ref(false)
const replay_index = ref(0)
const shown_actions = ref<any[]>([])
const battle_done = ref(false)
const error = ref('')

onMounted(async () => {
  await store.fetchMySession()
  if (!store.my_session || store.my_session.status !== 'active') {
    router.push('/jeu/battle-frontier')
  }
})

async function startBattle() {
  is_battling.value = true
  error.value = ''
  battle_done.value = false
  shown_actions.value = []
  replay_index.value = 0

  try {
    const result = await store.startBattle()
    // Afficher le replay progressivement
    await playReplay(result.actions_replay)
    battle_done.value = true
  } catch (e: any) {
    error.value = e.response?.data?.message ?? 'Erreur lors du combat'
  } finally {
    is_battling.value = false
  }
}

async function playReplay(actions: any[]) {
  for (const action of actions) {
    shown_actions.value.push(action)
    await sleep(300)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function effectivenessLabel(e: number): string {
  if (e >= 4) return '⚡ Super efficace ×4 !'
  if (e >= 2) return '✓ Super efficace !'
  if (e <= 0) return '✗ Immunité'
  if (e < 1)  return '△ Peu efficace…'
  return ''
}

function hpPercent(remaining: number, max: number): number {
  return Math.round((remaining / max) * 100)
}

function hpColor(pct: number): string {
  if (pct > 50) return 'bg-green-500'
  if (pct > 20) return 'bg-yellow-500'
  return 'bg-red-500'
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/jeu/battle-frontier" class="text-gray-400 hover:text-white">← Retour</NuxtLink>
      <h1 class="text-2xl font-bold text-white">⚔️ Combat Battle Frontier</h1>
    </div>

    <!-- Info session -->
    <div v-if="store.my_session" class="bg-gray-800 rounded-xl p-4 mb-4 flex items-center justify-between">
      <div>
        <span class="font-bold text-yellow-400">Streak : {{ store.my_session.current_streak }}</span>
        <span class="text-gray-400 text-sm ml-3">{{ store.my_session.frontier_points_earned }} PF cumulés</span>
      </div>
      <span class="text-sm text-gray-400">{{ store.my_session.mode.toUpperCase() }}</span>
    </div>

    <!-- Bouton combattre -->
    <div v-if="!is_battling && !battle_done" class="text-center mb-6">
      <button
        @click="startBattle"
        class="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-colors">
        ⚔️ Lancer le combat
      </button>
    </div>

    <!-- Erreur -->
    <div v-if="error" class="bg-red-900/40 border border-red-700 rounded-lg p-3 mb-4 text-red-300">
      {{ error }}
    </div>

    <!-- En cours -->
    <div v-if="is_battling && shown_actions.length === 0" class="text-center text-gray-400 py-8">
      Calcul du combat…
    </div>

    <!-- Replay des actions -->
    <div v-if="shown_actions.length > 0" class="space-y-2 mb-4 max-h-80 overflow-y-auto">
      <div
        v-for="(action, i) in shown_actions"
        :key="i"
        class="bg-gray-800 rounded-lg px-4 py-2 text-sm"
        :class="action.ko ? 'border border-red-700' : 'border border-gray-700'"
      >
        <span class="text-white font-medium">{{ action.attacker_name }}</span>
        <span class="text-gray-400 mx-1">utilise</span>
        <span class="text-blue-300">{{ action.move_name }}</span>
        <span class="text-gray-400 mx-1">sur</span>
        <span class="text-white">{{ action.target_name }}</span>
        <span class="text-red-400 ml-2">−{{ action.damage }}</span>

        <span v-if="action.is_critical" class="text-yellow-400 ml-1 text-xs">Critique !</span>
        <span v-if="action.effectiveness !== 1" class="ml-1 text-xs text-purple-400">
          {{ effectivenessLabel(action.effectiveness) }}
        </span>

        <!-- Barre HP -->
        <div class="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="hpColor(hpPercent(action.remaining_hp, action.max_hp))"
            :style="{ width: hpPercent(action.remaining_hp, action.max_hp) + '%' }"
          />
        </div>
        <p v-if="action.ko" class="text-red-400 text-xs mt-1">💀 {{ action.target_name }} est KO !</p>
      </div>
    </div>

    <!-- Résultat final -->
    <div v-if="battle_done && store.last_battle_result"
      class="rounded-xl p-6 text-center mb-4"
      :class="store.last_battle_result.result === 'win' ? 'bg-green-900/40 border border-green-600' : 'bg-red-900/40 border border-red-600'"
    >
      <p class="text-3xl mb-2">{{ store.last_battle_result.result === 'win' ? '🏆 Victoire !' : '💀 Défaite' }}</p>

      <div v-if="store.last_battle_result.result === 'win'" class="text-green-300">
        <p class="text-lg font-bold">+{{ store.last_battle_result.pf_earned }} PF</p>
        <p class="text-sm">Streak : {{ store.last_battle_result.streak_new }}</p>
        <p v-if="store.my_rank" class="text-sm text-yellow-400 mt-1">Rang #{{ store.my_rank }} mondial</p>
      </div>

      <div v-else class="text-red-300">
        <p class="text-sm">Streak terminé à {{ store.last_battle_result.streak_new === 0 ? store.my_session?.best_streak ?? 0 : store.last_battle_result.streak_new }}</p>
      </div>

      <!-- Arena judgment -->
      <div v-if="store.last_battle_result.arena_judgment" class="mt-3 text-sm text-gray-300">
        <p>Jugement Arena</p>
        <p>Ton équipe : {{ store.last_battle_result.arena_judgment.player_hp_percent }}% HP</p>
        <p>Adversaire : {{ store.last_battle_result.arena_judgment.enemy_hp_percent }}% HP</p>
      </div>

      <div class="flex gap-3 justify-center mt-4">
        <button
          v-if="store.my_session?.status === 'active'"
          @click="startBattle"
          class="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">
          Combat suivant
        </button>
        <NuxtLink to="/jeu/battle-frontier"
          class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
          Retour
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
