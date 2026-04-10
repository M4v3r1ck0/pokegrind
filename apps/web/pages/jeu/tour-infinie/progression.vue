<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTowerStore } from '~/stores/tower'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const router = useRouter()
const tower = useTowerStore()

const active_tab = ref<'milestones' | 'bosses'>('milestones')

onMounted(async () => {
  await Promise.all([
    tower.fetchMilestones(),
    tower.fetchBosses(),
    tower.fetchStatus(),
  ])
})

const milestones = computed(() => tower.milestones)
const bosses = computed(() => tower.bosses)
const current_floor = computed(() => tower.status?.current_floor ?? 0)

function is_reached(floor: number): boolean {
  return floor <= current_floor.value
}

function mechanic_label(type: string): string {
  const labels: Record<string, string> = {
    enrage: 'Enragé',
    regen: 'Régénération',
    reflect: 'Reflet',
    clone: 'Clonage',
    berserk: 'Berserk',
  }
  return labels[type] ?? type
}

function mechanic_color(type: string): string {
  const colors: Record<string, string> = {
    enrage: 'text-red-400',
    regen: 'text-green-400',
    reflect: 'text-blue-400',
    clone: 'text-purple-400',
    berserk: 'text-orange-400',
  }
  return colors[type] ?? 'text-gray-400'
}

function mechanic_bg(type: string): string {
  const colors: Record<string, string> = {
    enrage: 'bg-red-900/30 border-red-800/50',
    regen: 'bg-green-900/30 border-green-800/50',
    reflect: 'bg-blue-900/30 border-blue-800/50',
    clone: 'bg-purple-900/30 border-purple-800/50',
    berserk: 'bg-orange-900/30 border-orange-800/50',
  }
  return colors[type] ?? 'bg-gray-900 border-gray-800'
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 pb-20">
    <div class="max-w-2xl mx-auto">

      <!-- En-tête -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.push('/jeu/tour-infinie')" class="text-gray-400 hover:text-white text-xl">←</button>
        <h1 class="text-2xl font-bold text-yellow-400">Paliers & Boss</h1>
      </div>

      <!-- Onglets -->
      <div class="flex gap-2 mb-6">
        <button
          @click="active_tab = 'milestones'"
          class="flex-1 py-2 rounded-xl font-medium text-sm transition-colors"
          :class="active_tab === 'milestones' ? 'bg-yellow-600 text-black' : 'bg-gray-900 text-gray-400 hover:text-white'"
        >
          Paliers ({{ milestones.length }})
        </button>
        <button
          @click="active_tab = 'bosses'"
          class="flex-1 py-2 rounded-xl font-medium text-sm transition-colors"
          :class="active_tab === 'bosses' ? 'bg-red-700 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'"
        >
          Boss ({{ bosses.length }})
        </button>
      </div>

      <!-- Paliers -->
      <div v-if="active_tab === 'milestones'" class="space-y-2">
        <div
          v-for="m in milestones"
          :key="m.floor_number"
          class="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3"
          :class="is_reached(m.floor_number) ? 'opacity-50' : ''"
        >
          <div class="w-5 h-5 flex items-center justify-center rounded-full border"
            :class="is_reached(m.floor_number)
              ? 'bg-green-600 border-green-600 text-white text-xs'
              : 'border-gray-600'"
          >
            <span v-if="is_reached(m.floor_number)">✓</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-sm">Étage {{ m.floor_number }}</div>
            <div v-if="m.name_fr" class="text-xs text-gray-400 truncate">{{ m.name_fr }}</div>
          </div>
          <div class="text-green-400 font-bold text-sm">+{{ m.gems_reward }} 💎</div>
        </div>
      </div>

      <!-- Boss -->
      <div v-else class="space-y-3">
        <div
          v-for="boss in bosses"
          :key="boss.floor_number"
          class="rounded-xl p-4 border"
          :class="[mechanic_bg(boss.mechanic_type), is_reached(boss.floor_number) ? 'opacity-50' : '']"
        >
          <div class="flex justify-between items-start mb-2">
            <div>
              <div class="font-bold text-white">Étage {{ boss.floor_number }}</div>
              <div class="text-sm font-medium text-gray-200">{{ boss.name_fr }}</div>
            </div>
            <div class="text-right">
              <div class="text-green-400 font-bold text-sm">+{{ boss.gems_reward }} 💎</div>
              <div v-if="is_reached(boss.floor_number)" class="text-xs text-gray-500 mt-1">Vaincu</div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-xs text-gray-400">Mécanique :</span>
            <span :class="mechanic_color(boss.mechanic_type)" class="text-xs font-semibold">
              {{ mechanic_label(boss.mechanic_type) }}
            </span>
          </div>
          <div v-if="boss.description_fr" class="text-xs text-gray-400 mt-2 italic">
            {{ boss.description_fr }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
