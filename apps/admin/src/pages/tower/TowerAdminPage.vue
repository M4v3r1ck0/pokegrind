<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const data = ref<any>(null)
const is_loading = ref(false)
const end_loading = ref(false)
const message = ref<string | null>(null)
const confirm_end = ref(false)

async function fetchTower() {
  is_loading.value = true
  try {
    const res = await api.getAdminTower()
    data.value = res.data?.data ?? null
  } finally {
    is_loading.value = false
  }
}

async function endSeason() {
  if (!confirm_end.value) {
    confirm_end.value = true
    return
  }
  end_loading.value = true
  try {
    await api.endTowerSeason()
    message.value = 'Saison Tour Infinie terminée avec succès.'
    confirm_end.value = false
    await fetchTower()
  } catch (err: any) {
    message.value = `Erreur : ${err.response?.data?.message ?? err.message}`
  } finally {
    end_loading.value = false
    setTimeout(() => { message.value = null }, 5000)
  }
}

function daysLeft(end_at: string): number {
  return Math.max(0, Math.round((new Date(end_at).getTime() - Date.now()) / 86400000))
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR')
}

onMounted(fetchTower)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Administration Tour Infinie</h1>
      <button @click="fetchTower" :disabled="is_loading" class="btn btn-sm">
        {{ is_loading ? 'Chargement…' : 'Actualiser' }}
      </button>
    </div>

    <div v-if="message" class="alert" :class="message.startsWith('Erreur') ? 'alert-error' : 'alert-success'">
      {{ message }}
    </div>

    <div v-if="is_loading" class="text-center py-12 opacity-60">Chargement…</div>

    <template v-else-if="data">
      <!-- Saison actuelle -->
      <div v-if="data.season" class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Saison actuelle</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div class="stat-card">
              <div class="stat-label">Nom</div>
              <div class="stat-value text-base font-semibold">{{ data.season.name_fr }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Fin dans</div>
              <div class="stat-value">{{ daysLeft(data.season.end_at) }} jours</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Joueurs actifs</div>
              <div class="stat-value">{{ data.active_players.toLocaleString('fr') }}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Étage max mondial</div>
              <div class="stat-value text-yellow-400">
                {{ data.leaderboard[0]?.max_floor ?? '—' }}
              </div>
            </div>
          </div>

          <!-- Fin de saison -->
          <div class="mt-4 flex gap-3 items-center">
            <button
              class="btn btn-sm"
              :class="confirm_end ? 'btn-error' : 'btn-warning'"
              :disabled="end_loading"
              @click="endSeason"
            >
              {{ confirm_end ? 'Confirmer la fin de saison' : 'Forcer la fin de saison' }}
            </button>
            <button v-if="confirm_end" class="btn btn-sm btn-ghost" @click="confirm_end = false">
              Annuler
            </button>
            <span v-if="confirm_end" class="text-warning text-sm">
              Cette action est irréversible et clôture la saison immédiatement.
            </span>
          </div>
        </div>
      </div>

      <div v-else class="alert alert-info">Aucune saison Tour Infinie active.</div>

      <!-- Distribution des étages -->
      <div v-if="Object.keys(data.floor_distribution).length > 0" class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Distribution des étages</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            <div
              v-for="(count, bucket) in data.floor_distribution"
              :key="bucket"
              class="stat-card text-center"
            >
              <div class="stat-label">Étages {{ bucket }}</div>
              <div class="stat-value">{{ count.toLocaleString('fr') }}</div>
              <div class="text-xs opacity-60">joueurs</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Classement -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Classement live (Top 20)</h2>
          <table class="table table-sm w-full mt-2">
            <thead>
              <tr>
                <th>#</th>
                <th>Joueur</th>
                <th>Étage max</th>
                <th>Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, idx) in data.leaderboard" :key="entry.player_id">
                <td class="font-bold" :class="idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : ''">
                  #{{ idx + 1 }}
                </td>
                <td>{{ entry.username }}</td>
                <td class="font-mono">{{ entry.max_floor }}</td>
                <td class="opacity-60 text-xs">{{ formatDate(entry.updated_at) }}</td>
              </tr>
              <tr v-if="data.leaderboard.length === 0">
                <td colspan="4" class="text-center opacity-60">Aucun joueur classé</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
