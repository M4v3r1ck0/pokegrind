<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { usePrestigeStore } from '~/stores/prestige'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const prestige = usePrestigeStore()

onMounted(async () => {
  await Promise.all([prestige.fetchLevels(), prestige.fetchPrestigeStatus()])
})

const current = computed(() => prestige.current_level)

function rowStatus(level: number): 'done' | 'current' | 'locked' {
  if (level < current.value) return 'done'
  if (level === current.value + 1) return 'current'
  return 'locked'
}
</script>

<template>
  <div class="min-h-screen bg-gray-900 text-white p-6">
    <div class="max-w-3xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <NuxtLink to="/jeu/prestige" class="text-gray-400 hover:text-white">←</NuxtLink>
        <h1 class="text-2xl font-bold text-yellow-400">📊 Progression des 50 niveaux</h1>
      </div>

      <div v-if="prestige.levels.length === 0" class="text-center py-12 text-gray-400">
        Chargement...
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-gray-400 border-b border-gray-700">
              <th class="text-left py-2 pr-3">Niv.</th>
              <th class="text-left py-2 pr-3">Nom</th>
              <th class="text-center py-2 pr-3">Or ×</th>
              <th class="text-center py-2 pr-3">XP ×</th>
              <th class="text-center py-2 pr-3">Pension ×</th>
              <th class="text-center py-2 pr-3">Gems/boss</th>
              <th class="text-center py-2">Récompense</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="lvl in prestige.levels"
              :key="lvl.level"
              :class="{
                'bg-green-900/20': rowStatus(lvl.level) === 'done',
                'bg-yellow-900/30 border border-yellow-600': rowStatus(lvl.level) === 'current',
                'opacity-50': rowStatus(lvl.level) === 'locked',
              }"
              class="border-b border-gray-800"
            >
              <td class="py-2 pr-3 font-mono font-bold">
                <span v-if="rowStatus(lvl.level) === 'done'" class="text-green-400">P{{ lvl.level }} ✅</span>
                <span v-else-if="rowStatus(lvl.level) === 'current'" class="text-yellow-400">P{{ lvl.level }} ←</span>
                <span v-else class="text-gray-500">P{{ lvl.level }} 🔒</span>
              </td>
              <td class="py-2 pr-3">{{ lvl.name_fr }}</td>
              <td class="text-center py-2 pr-3 text-yellow-400">×{{ lvl.gold_multiplier.toFixed(2) }}</td>
              <td class="text-center py-2 pr-3 text-blue-400">×{{ lvl.xp_multiplier.toFixed(2) }}</td>
              <td class="text-center py-2 pr-3 text-green-400">×{{ lvl.daycare_speed_bonus.toFixed(2) }}</td>
              <td class="text-center py-2 pr-3 text-purple-400">
                <span v-if="lvl.gem_bonus_per_boss > 0">+{{ lvl.gem_bonus_per_boss }}</span>
                <span v-else class="text-gray-600">—</span>
              </td>
              <td class="text-center py-2 text-purple-300">{{ lvl.gems_reward }} 💎</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex gap-4 text-sm text-gray-400">
        <span>✅ Accompli</span>
        <span class="text-yellow-400">← Prochain</span>
        <span>🔒 Verrouillé</span>
      </div>
    </div>
  </div>
</template>
