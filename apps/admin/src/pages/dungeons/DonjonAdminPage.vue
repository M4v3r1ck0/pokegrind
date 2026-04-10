<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const dungeons = ref<any[]>([])
const stats = ref<any>(null)
const is_loading = ref(false)
const action_loading = ref<string | null>(null)
const message = ref<string | null>(null)

async function fetchAll() {
  is_loading.value = true
  try {
    const [d, s] = await Promise.all([api.getAdminDungeons(), api.getDungeonStats()])
    dungeons.value = d.data?.data ?? []
    stats.value = s.data?.data ?? null
  } finally {
    is_loading.value = false
  }
}

async function toggleDungeon(dungeon: any) {
  action_loading.value = dungeon.id
  try {
    await api.toggleDungeon(dungeon.id)
    message.value = `Donjon "${dungeon.name_fr}" ${dungeon.is_active ? 'désactivé' : 'activé'}`
    await fetchAll()
  } catch (err: any) {
    message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    action_loading.value = null
    setTimeout(() => { message.value = null }, 4000)
  }
}

const active_dungeons = computed(() => dungeons.value.filter((d) => d.is_active))
const inactive_dungeons = computed(() => dungeons.value.filter((d) => !d.is_active))

function diffLabel(d: string) {
  const MAP: Record<string, string> = { easy: 'Facile', normal: 'Normal', hard: 'Difficile', extreme: 'Extrême' }
  return MAP[d] ?? d
}

onMounted(fetchAll)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Administration Donjons</h1>
      <button @click="fetchAll" :disabled="is_loading" class="btn btn-sm">
        {{ is_loading ? 'Chargement…' : 'Actualiser' }}
      </button>
    </div>

    <!-- Message -->
    <div v-if="message" class="alert" :class="message.startsWith('Erreur') ? 'alert-error' : 'alert-success'">
      {{ message }}
    </div>

    <!-- Stats globales -->
    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="stat-card">
        <div class="stat-label">Runs cette semaine</div>
        <div class="stat-value">{{ stats.runs_this_week.toLocaleString('fr') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Complets</div>
        <div class="stat-value text-green-400">{{ stats.completed_this_week.toLocaleString('fr') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Échoués</div>
        <div class="stat-value text-red-400">{{ stats.failed_this_week.toLocaleString('fr') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Taux complétion</div>
        <div class="stat-value">{{ stats.completion_rate }}%</div>
      </div>
    </div>

    <div v-if="stats?.hardest_dungeon" class="bg-base-200 rounded p-3 text-sm">
      Donjon le plus difficile : <strong>{{ stats.hardest_dungeon.name_fr }}</strong>
      ({{ stats.hardest_dungeon.completion_rate }}% de complétion)
    </div>

    <!-- Donjons actifs -->
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">Donjons actifs ({{ active_dungeons.length }})</h2>
        <div v-if="is_loading" class="text-center py-4 opacity-60">Chargement…</div>
        <table v-else class="table table-sm w-full">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Région</th>
              <th>Difficulté</th>
              <th>Runs/semaine</th>
              <th>Complétion</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in active_dungeons" :key="d.id">
              <td class="font-medium">{{ d.name_fr }}</td>
              <td>{{ d.region }}</td>
              <td>
                <span class="badge badge-sm" :class="{
                  'badge-success': d.difficulty === 'easy',
                  'badge-info': d.difficulty === 'normal',
                  'badge-warning': d.difficulty === 'hard',
                  'badge-error': d.difficulty === 'extreme',
                }">{{ diffLabel(d.difficulty) }}</span>
              </td>
              <td>{{ d.runs_this_week }}</td>
              <td>
                <div class="flex items-center gap-2">
                  <progress class="progress progress-info w-16" :value="d.completion_rate" max="100" />
                  <span class="text-xs">{{ d.completion_rate }}%</span>
                </div>
              </td>
              <td>
                <button
                  class="btn btn-xs btn-warning"
                  :disabled="action_loading === d.id"
                  @click="toggleDungeon(d)"
                >Désactiver</button>
              </td>
            </tr>
            <tr v-if="active_dungeons.length === 0">
              <td colspan="6" class="text-center opacity-60">Aucun donjon actif</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Donjons inactifs -->
    <div v-if="inactive_dungeons.length > 0" class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title opacity-60">Donjons désactivés ({{ inactive_dungeons.length }})</h2>
        <table class="table table-sm w-full">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Région</th>
              <th>Difficulté</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in inactive_dungeons" :key="d.id" class="opacity-60">
              <td class="font-medium">{{ d.name_fr }}</td>
              <td>{{ d.region }}</td>
              <td>{{ diffLabel(d.difficulty) }}</td>
              <td>
                <button
                  class="btn btn-xs btn-success"
                  :disabled="action_loading === d.id"
                  @click="toggleDungeon(d)"
                >Activer</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
