<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const alerts = ref<any[]>([])
const stats = ref<any>(null)
const meta = ref({ total: 0, page: 1, last_page: 1 })
const is_loading = ref(false)

const filter_severity = ref('')
const filter_type = ref('')
const filter_resolved = ref('false')

const SEVERITIES = ['', 'low', 'medium', 'high', 'critical']
const TYPES = ['', 'dps_anomaly', 'kill_rate_anomaly', 'gems_anomaly']

async function fetchAlerts(page = 1) {
  is_loading.value = true
  try {
    const params: Record<string, any> = { page }
    if (filter_severity.value) params.severity = filter_severity.value
    if (filter_type.value) params.alert_type = filter_type.value
    if (filter_resolved.value !== '') params.resolved = filter_resolved.value
    const { data } = await api.getAnticheatAlerts(params)
    alerts.value = data.data
    meta.value = data.meta
  } finally {
    is_loading.value = false
  }
}

async function fetchStats() {
  const { data } = await api.getAnticheatStats()
  stats.value = data
}

watch([filter_severity, filter_type, filter_resolved], () => fetchAlerts())

onMounted(async () => {
  await Promise.all([fetchAlerts(), fetchStats()])
})

// ── Resolve modal ─────────────────────────────────────────────────────────────

const resolve_modal = ref(false)
const resolve_target = ref<any>(null)
const resolve_action = ref<'false_positive' | 'warned' | 'banned'>('false_positive')
const resolve_note = ref('')
const resolve_loading = ref(false)

const ACTIONS = [
  { value: 'false_positive', label: 'Faux positif' },
  { value: 'warned', label: 'Avertissement' },
  { value: 'banned', label: 'Bannissement' },
]

function openResolve(alert: any) {
  resolve_target.value = alert
  resolve_action.value = 'false_positive'
  resolve_note.value = ''
  resolve_modal.value = true
}

async function confirmResolve() {
  if (!resolve_target.value) return
  resolve_loading.value = true
  try {
    await api.resolveAlert(resolve_target.value.id, {
      action: resolve_action.value,
      resolution_note: resolve_note.value,
    })
    resolve_modal.value = false
    await Promise.all([fetchAlerts(meta.value.page), fetchStats()])
  } finally {
    resolve_loading.value = false
  }
}

// ── Details modal ─────────────────────────────────────────────────────────────

const details_modal = ref(false)
const details_target = ref<any>(null)

function openDetails(alert: any) {
  details_target.value = alert
  details_modal.value = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === 'critical') return 'danger'
  if (s === 'high') return 'warning'
  if (s === 'medium') return 'info'
  return 'secondary'
}

function typeLabel(t: string) {
  const MAP: Record<string, string> = {
    dps_anomaly: 'DPS anormal',
    kill_rate_anomaly: 'Kills suspects',
    gems_anomaly: 'Gems suspects',
  }
  return MAP[t] ?? t
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="pa-4">
    <h1 class="text-2xl font-bold mb-4">Anti-triche — Alertes</h1>

    <!-- Stats rapides -->
    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <VaCard class="text-center pa-3">
        <p class="text-2xl font-bold text-danger">{{ stats.total_unresolved }}</p>
        <p class="text-sm text-secondary">Non résolues</p>
      </VaCard>
      <VaCard class="text-center pa-3">
        <p class="text-2xl font-bold text-danger">{{ stats.by_severity?.critical ?? 0 }}</p>
        <p class="text-sm text-secondary">Critiques</p>
      </VaCard>
      <VaCard class="text-center pa-3">
        <p class="text-2xl font-bold text-warning">{{ stats.by_severity?.medium ?? 0 }}</p>
        <p class="text-sm text-secondary">Moyennes</p>
      </VaCard>
      <VaCard class="text-center pa-3">
        <p class="text-lg font-bold">
          {{ stats.by_type?.gems_anomaly ?? 0 }} gems ·
          {{ stats.by_type?.kill_rate_anomaly ?? 0 }} kills ·
          {{ stats.by_type?.dps_anomaly ?? 0 }} DPS
        </p>
        <p class="text-sm text-secondary">Par type</p>
      </VaCard>
    </div>

    <!-- Filtres -->
    <div class="flex flex-wrap gap-3 mb-4">
      <VaSelect
        v-model="filter_severity"
        placeholder="Sévérité"
        :options="SEVERITIES"
        style="width: 140px"
      />
      <VaSelect
        v-model="filter_type"
        placeholder="Type"
        :options="TYPES"
        style="width: 180px"
      />
      <VaSelect
        v-model="filter_resolved"
        :options="[{ label: 'Non résolues', value: 'false' }, { label: 'Résolues', value: 'true' }, { label: 'Toutes', value: '' }]"
        value-by="value"
        text-by="label"
        style="width: 160px"
      />
      <VaButton preset="secondary" @click="fetchAlerts()">Actualiser</VaButton>
    </div>

    <!-- Tableau -->
    <VaDataTable
      :items="alerts"
      :loading="is_loading"
      :columns="[
        { key: 'severity', label: 'Sévérité' },
        { key: 'alert_type', label: 'Type' },
        { key: 'player', label: 'Joueur' },
        { key: 'created_at', label: 'Date' },
        { key: 'is_resolved', label: 'Statut' },
        { key: 'actions', label: 'Actions' },
      ]"
    >
      <template #cell(severity)="{ row }">
        <VaBadge :text="row.rowData.severity" :color="severityColor(row.rowData.severity)" />
      </template>
      <template #cell(alert_type)="{ row }">
        {{ typeLabel(row.rowData.alert_type) }}
      </template>
      <template #cell(player)="{ row }">
        {{ row.rowData.player?.username ?? row.rowData.player_id.slice(0, 8) }}
      </template>
      <template #cell(created_at)="{ row }">{{ formatDate(row.rowData.created_at) }}</template>
      <template #cell(is_resolved)="{ row }">
        <VaBadge
          :text="row.rowData.is_resolved ? 'Résolue' : 'Ouverte'"
          :color="row.rowData.is_resolved ? 'success' : 'warning'"
        />
      </template>
      <template #cell(actions)="{ row }">
        <div class="flex gap-1">
          <VaButton size="small" preset="plain" icon="info" @click="openDetails(row.rowData)" />
          <VaButton
            v-if="!row.rowData.is_resolved"
            size="small" preset="plain" icon="check_circle" color="success"
            @click="openResolve(row.rowData)"
          />
        </div>
      </template>
    </VaDataTable>

    <div class="flex justify-center mt-4">
      <VaPagination
        v-model="meta.page"
        :pages="meta.last_page"
        @update:model-value="(p: number) => fetchAlerts(p)"
      />
    </div>

    <!-- Modal résolution -->
    <VaModal
      v-model="resolve_modal"
      title="Résoudre l'alerte"
      ok-text="Confirmer"
      :ok-loading="resolve_loading"
      @ok="confirmResolve"
    >
      <p class="mb-3">
        Alerte <strong>{{ typeLabel(resolve_target?.alert_type) }}</strong> —
        joueur <strong>{{ resolve_target?.player?.username ?? resolve_target?.player_id }}</strong>
      </p>
      <VaSelect
        v-model="resolve_action"
        label="Action"
        :options="ACTIONS"
        value-by="value"
        text-by="label"
        class="mb-3"
      />
      <VaInput v-model="resolve_note" label="Note de résolution" />
      <p v-if="resolve_action === 'banned'" class="text-danger text-sm mt-2">
        Attention : cette action bannira automatiquement le joueur.
      </p>
    </VaModal>

    <!-- Modal détails -->
    <VaModal v-model="details_modal" title="Détails de l'alerte" hide-default-actions>
      <template v-if="details_target">
        <div class="mb-2">
          <strong>Joueur :</strong> {{ details_target.player?.username ?? details_target.player_id }}
        </div>
        <div class="mb-2">
          <strong>Type :</strong> {{ typeLabel(details_target.alert_type) }}
          <VaBadge :text="details_target.severity" :color="severityColor(details_target.severity)" class="ml-2" />
        </div>
        <div class="mb-2"><strong>Date :</strong> {{ formatDate(details_target.created_at) }}</div>
        <div v-if="details_target.is_resolved" class="mb-2">
          <strong>Résolu le :</strong> {{ formatDate(details_target.resolved_at) }}
          — <em>{{ details_target.resolution_note }}</em>
        </div>
        <hr class="my-3" />
        <pre class="text-xs bg-gray-100 dark:bg-gray-800 rounded p-3 overflow-auto">{{ JSON.stringify(details_target.details, null, 2) }}</pre>
      </template>
      <template #footer>
        <VaButton @click="details_modal = false">Fermer</VaButton>
      </template>
    </VaModal>
  </div>
</template>
