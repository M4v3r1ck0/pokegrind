<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const active_tab = ref<'global' | 'gems' | 'raids' | 'dungeons' | 'candies'>('global')
const reports = ref<any[]>([])
const is_loading = ref(false)
const overview = ref<any>(null)

// Export
const export_from = ref(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
const export_to = ref(new Date().toISOString().split('T')[0])
const export_loading = ref(false)

async function fetchData() {
  is_loading.value = true
  try {
    const [rpts, ov] = await Promise.all([
      api.getEconomyReports(30),
      api.getEconomyOverview(),
    ])
    reports.value = rpts.data?.data ?? []
    overview.value = ov.data?.data ?? null
  } finally {
    is_loading.value = false
  }
}

function latestReport() {
  return reports.value[0]?.data ?? null
}

function sum7d(field: (d: any) => number): number {
  return reports.value.slice(0, 7).reduce((acc, r) => acc + field(r.data), 0)
}

async function downloadReport() {
  export_loading.value = true
  try {
    const res = await api.exportEconomyReport(export_from.value, export_to.value)
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `economy_${export_from.value}_${export_to.value}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } finally {
    export_loading.value = false
  }
}

function fmt(n: number) {
  return (n ?? 0).toLocaleString('fr')
}

onMounted(fetchData)
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h1 class="text-2xl font-bold">Économie V3</h1>
      <div class="flex gap-2 items-center">
        <input type="date" v-model="export_from" class="input input-sm input-bordered" />
        <span class="opacity-60">→</span>
        <input type="date" v-model="export_to" class="input input-sm input-bordered" />
        <button class="btn btn-sm btn-info" :disabled="export_loading" @click="downloadReport">
          {{ export_loading ? 'Export…' : 'Export CSV' }}
        </button>
        <button @click="fetchData" :disabled="is_loading" class="btn btn-sm">
          {{ is_loading ? 'Chargement…' : 'Actualiser' }}
        </button>
      </div>
    </div>

    <!-- Onglets -->
    <div class="tabs tabs-bordered">
      <a class="tab" :class="active_tab === 'global' ? 'tab-active' : ''" @click="active_tab = 'global'">Vue globale</a>
      <a class="tab" :class="active_tab === 'gems' ? 'tab-active' : ''" @click="active_tab = 'gems'">Gems</a>
      <a class="tab" :class="active_tab === 'raids' ? 'tab-active' : ''" @click="active_tab = 'raids'">Raids</a>
      <a class="tab" :class="active_tab === 'dungeons' ? 'tab-active' : ''" @click="active_tab = 'dungeons'">Donjons</a>
      <a class="tab" :class="active_tab === 'candies' ? 'tab-active' : ''" @click="active_tab = 'candies'">Bonbons</a>
    </div>

    <div v-if="is_loading && reports.length === 0" class="text-center py-12 opacity-60">Chargement…</div>

    <!-- Vue globale -->
    <template v-if="active_tab === 'global'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-card">
          <div class="stat-label">Joueurs total</div>
          <div class="stat-value">{{ fmt(latestReport()?.players?.total) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Actifs aujourd'hui</div>
          <div class="stat-value text-green-400">{{ fmt(latestReport()?.players?.active_today) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Nouveaux aujourd'hui</div>
          <div class="stat-value text-blue-400">{{ fmt(latestReport()?.players?.new_today) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Or en circulation</div>
          <div class="stat-value text-yellow-400">{{ fmt(latestReport()?.economy?.gold_in_circulation) }}</div>
        </div>
      </div>

      <!-- Tableau 30 derniers rapports -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Historique 30 jours</h2>
          <div class="overflow-x-auto">
            <table class="table table-xs w-full mt-2">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Joueurs actifs</th>
                  <th>Gems gagnés</th>
                  <th>Gems dépensés</th>
                  <th>Pulls</th>
                  <th>Raids complétés</th>
                  <th>Runs donjons</th>
                  <th>Combats PvP</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in reports" :key="r.date">
                  <td class="font-mono text-xs">{{ r.date }}</td>
                  <td>{{ fmt(r.data?.players?.active_today) }}</td>
                  <td class="text-green-400">+{{ fmt(r.data?.economy?.gems_awarded) }}</td>
                  <td class="text-red-400">-{{ fmt(r.data?.economy?.gems_spent) }}</td>
                  <td>{{ fmt(r.data?.economy?.total_pulls) }}</td>
                  <td>{{ fmt(r.data?.raids?.completed_today) }}</td>
                  <td>{{ fmt(r.data?.dungeons?.runs_completed_today) }}</td>
                  <td>{{ fmt(r.data?.pvp?.battles_today) }}</td>
                </tr>
                <tr v-if="reports.length === 0">
                  <td colspan="8" class="text-center opacity-60">Aucun rapport disponible</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Gems -->
    <template v-if="active_tab === 'gems'">
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="stat-card">
          <div class="stat-label">Gems gagnés (7j)</div>
          <div class="stat-value text-green-400">+{{ fmt(sum7d((d) => d?.economy?.gems_awarded ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Gems dépensés (7j)</div>
          <div class="stat-value text-red-400">-{{ fmt(sum7d((d) => d?.economy?.gems_spent ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Solde net (7j)</div>
          <div class="stat-value">
            {{ fmt(sum7d((d) => (d?.economy?.gems_awarded ?? 0) - (d?.economy?.gems_spent ?? 0))) }}
          </div>
        </div>
      </div>
    </template>

    <!-- Raids -->
    <template v-if="active_tab === 'raids'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-card">
          <div class="stat-label">Raids complétés (7j)</div>
          <div class="stat-value">{{ fmt(sum7d((d) => d?.raids?.completed_today ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Gems distribués via raids (7j)</div>
          <div class="stat-value text-yellow-400">{{ fmt(sum7d((d) => d?.raids?.gems_distributed ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Participants uniques (7j)</div>
          <div class="stat-value">{{ fmt(sum7d((d) => d?.raids?.participants_today ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Raids actifs (maintenant)</div>
          <div class="stat-value">{{ latestReport()?.raids?.active_count ?? 0 }}</div>
        </div>
      </div>
    </template>

    <!-- Donjons -->
    <template v-if="active_tab === 'dungeons'">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat-card">
          <div class="stat-label">Runs complétés (7j)</div>
          <div class="stat-value text-green-400">{{ fmt(sum7d((d) => d?.dungeons?.runs_completed_today ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Runs échoués (7j)</div>
          <div class="stat-value text-red-400">{{ fmt(sum7d((d) => d?.dungeons?.runs_failed_today ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Taux complétion (7j)</div>
          <div class="stat-value">
            {{
              (() => {
                const total = sum7d((d) => (d?.dungeons?.runs_completed_today ?? 0) + (d?.dungeons?.runs_failed_today ?? 0))
                const completed = sum7d((d) => d?.dungeons?.runs_completed_today ?? 0)
                return total > 0 ? Math.round((completed / total) * 100) + '%' : '—'
              })()
            }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Gems distribués via donjons (7j)</div>
          <div class="stat-value text-yellow-400">{{ fmt(sum7d((d) => d?.dungeons?.gems_distributed ?? 0)) }}</div>
        </div>
      </div>
    </template>

    <!-- Bonbons -->
    <template v-if="active_tab === 'candies'">
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div class="stat-card">
          <div class="stat-label">Bonbons Rares utilisés (7j)</div>
          <div class="stat-value">{{ fmt(sum7d((d) => d?.candies?.rare_candy_used ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Bonbons Exp. XL utilisés (7j)</div>
          <div class="stat-value">{{ fmt(sum7d((d) => d?.candies?.exp_candy_xl_used ?? 0)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Aujourd'hui (Rares)</div>
          <div class="stat-value">{{ fmt(latestReport()?.candies?.rare_candy_used) }}</div>
        </div>
      </div>
    </template>
  </div>
</template>
