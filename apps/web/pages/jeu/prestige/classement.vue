<script setup lang="ts">
import { onMounted } from 'vue'
import { usePrestigeStore } from '~/stores/prestige'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const prestige = usePrestigeStore()
const auth = useAuthStore()

onMounted(async () => {
  await prestige.fetchLeaderboard()
})

function rankIcon(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white p-6">
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <NuxtLink to="/jeu/prestige" class="text-gray-400 hover:text-white">←</NuxtLink>
        <h1 class="text-2xl font-bold text-yellow-400">🏆 Hall of Fame — Prestige</h1>
      </div>

      <div v-if="prestige.leaderboard.length === 0" class="text-center py-12 text-gray-400">
        Aucun joueur n'a encore prestigié.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="entry in prestige.leaderboard"
          :key="entry.rank"
          :class="[
            'flex items-center justify-between p-4 rounded-xl transition',
            entry.username === auth.player?.username
              ? 'bg-yellow-900/30 border border-yellow-600'
              : 'bg-gray-800 hover:bg-gray-700',
          ]"
        >
          <div class="flex items-center gap-4">
            <span class="text-2xl w-10 text-center font-bold">{{ rankIcon(entry.rank) }}</span>
            <div>
              <p class="font-bold">
                {{ entry.username }}
                <span v-if="entry.username === auth.player?.username" class="text-yellow-400 text-xs ml-1">(toi)</span>
              </p>
              <p class="text-sm text-gray-400">
                ✨ {{ entry.prestige_name_fr ?? `Prestige ${entry.prestige_level}` }}
              </p>
            </div>
          </div>

          <div class="text-right">
            <p class="font-bold text-yellow-400">P{{ entry.prestige_level }}</p>
            <p class="text-xs text-gray-400">Étage max : {{ entry.max_floor_reached }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
