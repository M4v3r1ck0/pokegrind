<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const seasons = ref<any[]>([])
const active_season = ref<any>(null)
const leaderboard = ref<any[]>([])
const is_loading = ref(false)

async function fetchData() {
  is_loading.value = true
  try {
    const { data } = await api.getPvpSeasons()
    // API returns flat array
    seasons.value = Array.isArray(data) ? data : []
    active_season.value = seasons.value.find((s: any) => s.is_active) ?? null

    // Load leaderboard for active season if any
    if (active_season.value) {
      try {
        const lb = await api.getPvpLeaderboard({ page: 1, limit: 20 })
        leaderboard.value = lb.data?.data ?? []
      } catch { leaderboard.value = [] }
    }
  } finally {
    is_loading.value = false
  }
}

onMounted(fetchData)

// ── Create season modal ───────────────────────────────────────────────────────

const create_modal = ref(false)
const form = ref({
  name_fr: '',
  start_at: '',
  end_at: '',
})

function openCreate() {
  const now = new Date()
  const end = new Date(now.getTime() + 30 * 24 * 3600_000)
  form.value = {
    name_fr: `Saison ${seasons.value.length + 1}`,
    start_at: now.toISOString().slice(0, 16),
    end_at: end.toISOString().slice(0, 16),
  }
  create_modal.value = true
}

async function createSeason() {
  await api.createPvpSeason({
    name_fr: form.value.name_fr,
    start_at: new Date(form.value.start_at).toISOString(),
    end_at: new Date(form.value.end_at).toISOString(),
  })
  create_modal.value = false
  await fetchData()
}

// ── End season ────────────────────────────────────────────────────────────────

const end_loading = ref(false)

async function endSeason() {
  if (!active_season.value) return
  if (!confirm(`Terminer la saison "${active_season.value.name_fr}" et distribuer les récompenses ?`)) return
  end_loading.value = true
  try {
    await api.endPvpSeason(active_season.value.id)
    await fetchData()
  } finally {
    end_loading.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tierFromElo(elo: number): { label: string; color: string } {
  if (elo >= 2200) return { label: 'Maître', color: 'danger' }
  if (elo >= 1800) return { label: 'Diamant', color: 'info' }
  if (elo >= 1500) return { label: 'Platine', color: 'success' }
  if (elo >= 1200) return { label: 'Or', color: 'warning' }
  if (elo >= 900) return { label: 'Argent', color: 'secondary' }
  return { label: 'Bronze', color: 'secondary' }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="pa-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">PvP — Saisons</h1>
      <VaButton icon="add" @click="openCreate">Nouvelle saison</VaButton>
    </div>

    <!-- Saison active -->
    <VaCard v-if="active_season" class="mb-6 pa-4">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <VaBadge text="Active" color="success" />
            <h2 class="text-xl font-bold">{{ active_season.name_fr }}</h2>
          </div>
          <p class="text-secondary text-sm">
            Du {{ formatDate(active_season.start_at) }} au {{ formatDate(active_season.end_at) }}
          </p>
          <p class="text-secondary text-sm mt-1">
            {{ active_season.player_count ?? leaderboard.length }} joueurs classés
          </p>
        </div>
        <VaButton
          color="warning"
          icon="flag"
          :loading="end_loading"
          @click="endSeason"
        >
          Terminer la saison
        </VaButton>
      </div>
    </VaCard>

    <VaCard v-else class="mb-6 pa-4 text-center text-secondary">
      Aucune saison PvP active.
    </VaCard>

    <!-- Classement -->
    <div v-if="leaderboard.length > 0" class="mb-6">
      <h2 class="text-lg font-semibold mb-3">Classement actuel (Top {{ leaderboard.length }})</h2>
      <VaDataTable
        :items="leaderboard"
        :columns="[
          { key: 'rank', label: '#' },
          { key: 'username', label: 'Joueur' },
          { key: 'elo', label: 'ELO' },
          { key: 'tier', label: 'Rang' },
          { key: 'wins', label: 'V' },
          { key: 'losses', label: 'D' },
        ]"
      >
        <template #cell(rank)="{ row }">
          <span :class="row.rowData.rank <= 3 ? 'font-bold text-yellow-400' : ''">
            {{ row.rowData.rank }}
          </span>
        </template>
        <template #cell(elo)="{ row }">
          <span class="font-mono font-bold">{{ row.rowData.elo }}</span>
        </template>
        <template #cell(tier)="{ row }">
          <VaBadge
            :text="tierFromElo(row.rowData.elo).label"
            :color="tierFromElo(row.rowData.elo).color"
          />
        </template>
      </VaDataTable>
    </div>

    <!-- Historique des saisons -->
    <h2 class="text-lg font-semibold mb-3">Historique des saisons</h2>
    <VaDataTable
      :items="seasons.filter(s => !active_season || s.id !== active_season.id)"
      :loading="is_loading"
      :columns="[
        { key: 'name_fr', label: 'Saison' },
        { key: 'start_at', label: 'Début' },
        { key: 'end_at', label: 'Fin' },
        { key: 'player_count', label: 'Joueurs' },
        { key: 'is_active', label: 'Statut' },
      ]"
    >
      <template #cell(start_at)="{ row }">{{ formatDate(row.rowData.start_at) }}</template>
      <template #cell(end_at)="{ row }">{{ formatDate(row.rowData.end_at) }}</template>
      <template #cell(is_active)="{ row }">
        <VaBadge
          :text="row.rowData.is_active ? 'Active' : 'Terminée'"
          :color="row.rowData.is_active ? 'success' : 'secondary'"
        />
      </template>
    </VaDataTable>

    <!-- Modal nouvelle saison -->
    <VaModal
      v-model="create_modal"
      title="Nouvelle saison PvP"
      ok-text="Créer"
      @ok="createSeason"
    >
      <div class="flex flex-col gap-3">
        <VaInput v-model="form.name_fr" label="Nom de la saison" required />
        <VaInput v-model="form.start_at" label="Début" type="datetime-local" />
        <VaInput v-model="form.end_at" label="Fin" type="datetime-local" />
      </div>
    </VaModal>
  </div>
</template>
