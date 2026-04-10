<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTowerStore } from '~/stores/tower'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const tower = useTowerStore()
const auth = useAuthStore()

onMounted(async () => {
  await tower.fetchLeaderboard()
  await tower.fetchStatus()
})

const leaderboard = computed(() => tower.leaderboard)
const my_username = computed(() => auth.player?.username)

function rank_badge(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

function floor_tier(floor: number): string {
  if (floor < 50) return 'D-C'
  if (floor < 100) return 'C-B'
  if (floor < 200) return 'B-A'
  if (floor < 300) return 'A-S'
  return 'S+'
}

function tier_color(floor: number): string {
  if (floor < 50) return 'text-gray-400'
  if (floor < 100) return 'text-green-400'
  if (floor < 200) return 'text-blue-400'
  if (floor < 300) return 'text-purple-400'
  return 'text-yellow-400'
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 pb-20">
    <div class="max-w-2xl mx-auto">

      <!-- En-tête -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/jeu/tour-infinie')" class="text-gray-400 hover:text-white text-xl">←</button>
        <div>
          <h1 class="text-2xl font-bold text-yellow-400">Classement Tour</h1>
          <p v-if="tower.status?.season_name_fr" class="text-sm text-gray-400">{{ tower.status.season_name_fr }}</p>
        </div>
      </div>

      <!-- Ma position -->
      <div v-if="my_username" class="bg-gray-900 rounded-xl p-4 mb-4">
        <div class="text-sm text-gray-400 mb-1">Ma progression</div>
        <div class="flex justify-between items-center">
          <div class="font-bold text-white">{{ my_username }}</div>
          <div>
            <span class="text-yellow-400 font-bold text-xl">{{ tower.status?.max_floor_reached ?? 0 }}</span>
            <span class="text-gray-500 text-sm ml-1">étage max</span>
          </div>
        </div>
      </div>

      <!-- Tableau classement -->
      <div class="bg-gray-900 rounded-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800">
          <h2 class="font-semibold text-gray-200">Top 100 — Étage maximum atteint</h2>
        </div>

        <div v-if="leaderboard.length === 0" class="p-8 text-center text-gray-500">
          <div class="text-3xl mb-2">🏗️</div>
          <p>Aucun joueur classé pour le moment.</p>
          <p class="text-sm">Soyez le premier à escalader la Tour !</p>
        </div>

        <div v-else>
          <div
            v-for="entry in leaderboard"
            :key="entry.rank"
            class="flex items-center px-4 py-3 border-b border-gray-800/50 last:border-0"
            :class="entry.username === my_username ? 'bg-yellow-900/20 border-yellow-800/30' : 'hover:bg-gray-800/40'"
          >
            <!-- Rang -->
            <div class="w-10 text-center text-sm font-bold mr-3" :class="entry.rank <= 3 ? 'text-xl' : 'text-gray-400'">
              {{ rank_badge(entry.rank) }}
            </div>

            <!-- Joueur -->
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate" :class="entry.username === my_username ? 'text-yellow-300' : 'text-white'">
                {{ entry.username }}
                <span v-if="entry.username === my_username" class="text-xs text-yellow-500 ml-1">(vous)</span>
              </div>
              <div class="text-xs text-gray-500">
                Tier {{ floor_tier(entry.max_floor) }}
              </div>
            </div>

            <!-- Étage max -->
            <div class="text-right">
              <div class="font-bold text-lg" :class="tier_color(entry.max_floor)">
                {{ entry.max_floor }}
              </div>
              <div class="text-xs text-gray-500">étage</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Légende des tiers -->
      <div class="mt-4 bg-gray-900 rounded-xl p-4">
        <h3 class="text-sm font-semibold text-gray-400 mb-3">Tiers</h3>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-gray-400 font-bold">D-C</span>
            <span class="text-gray-500">Étages 1-49</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-green-400 font-bold">C-B</span>
            <span class="text-gray-500">Étages 50-99</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-blue-400 font-bold">B-A</span>
            <span class="text-gray-500">Étages 100-199</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-purple-400 font-bold">A-S</span>
            <span class="text-gray-500">Étages 200-299</span>
          </div>
          <div class="flex items-center gap-2 col-span-2">
            <span class="text-yellow-400 font-bold">S+</span>
            <span class="text-gray-500">Étage 300+</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
