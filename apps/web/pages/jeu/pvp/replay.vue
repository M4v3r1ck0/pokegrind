<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'jeu' })
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNuxtApp } from '#app'

const route   = useRoute()
const { $api } = useNuxtApp()

const replay       = ref<any>(null)
const shown_actions = ref<any[]>([])
const playing      = ref(false)
const loaded       = ref(false)

onMounted(async () => {
  const battle_id = route.query.battle_id as string
  if (!battle_id) return
  try {
    const data: any = await $api(`/pvp/replay/${battle_id}`)
    replay.value = data.replay
    loaded.value = true
    await playReplay(replay.value.actions_replay ?? [])
  } catch {}
})

async function playReplay(actions: any[]) {
  playing.value = true
  for (const action of actions) {
    shown_actions.value.push(action)
    await sleep(300)
  }
  playing.value = false
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function hpPercent(remaining: number, max: number) {
  return max > 0 ? Math.round((remaining / max) * 100) : 0
}

function hpColor(pct: number) {
  if (pct > 50) return 'bg-green-500'
  if (pct > 20) return 'bg-yellow-500'
  return 'bg-red-500'
}

function effectivenessLabel(e: number) {
  if (e >= 4) return '⚡ Super efficace ×4 !'
  if (e >= 2) return '✓ Super efficace !'
  if (e <= 0) return '✗ Immunité'
  if (e < 1)  return '△ Peu efficace…'
  return ''
}

function eloStr(delta: number) {
  return delta >= 0 ? `+${delta}` : `${delta}`
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6">
    <div class="flex items-center gap-3 mb-6">
      <NuxtLink to="/jeu/pvp" class="text-gray-400 hover:text-white">← Retour</NuxtLink>
      <h1 class="text-2xl font-bold text-white">📽️ Replay PvP</h1>
    </div>

    <div v-if="!loaded" class="text-center text-gray-400 py-10">Chargement du replay…</div>

    <template v-else-if="replay">
      <!-- Résumé du combat -->
      <div class="bg-gray-800 rounded-xl p-4 mb-5 border border-gray-700 text-sm">
        <div class="flex justify-between mb-1">
          <span class="text-white font-bold">{{ replay.attacker_username }}</span>
          <span :class="replay.result === 'attacker_win' ? 'text-green-400' : 'text-red-400'" class="font-bold">
            {{ replay.result === 'attacker_win' ? `+${replay.elo_change_attacker}` : replay.elo_change_attacker }} ELO
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-white font-bold">{{ replay.defender_username }}</span>
          <span :class="replay.result === 'defender_win' ? 'text-green-400' : 'text-red-400'" class="font-bold">
            {{ replay.result === 'defender_win' ? `+${replay.elo_change_defender}` : replay.elo_change_defender }} ELO
          </span>
        </div>
      </div>

      <!-- Résultat -->
      <div class="rounded-xl p-4 mb-5 text-center font-bold text-xl"
        :class="replay.result === 'attacker_win'
          ? 'bg-green-900/40 border border-green-600 text-green-300'
          : 'bg-red-900/40 border border-red-600 text-red-300'">
        {{ replay.result === 'attacker_win' ? '🏆 Victoire attaquant' : '🛡️ Victoire défenseur' }}
      </div>

      <!-- Actions -->
      <div class="space-y-2 max-h-80 overflow-y-auto mb-4">
        <div v-if="shown_actions.length === 0 && playing" class="text-center text-gray-400 py-4">
          Calcul en cours…
        </div>
        <div
          v-for="(action, i) in shown_actions"
          :key="i"
          class="bg-gray-800 rounded-lg px-4 py-2 text-sm border"
          :class="action.ko ? 'border-red-700' : 'border-gray-700'"
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

      <div class="text-center">
        <NuxtLink to="/jeu/pvp"
          class="inline-block px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">
          Retour
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
