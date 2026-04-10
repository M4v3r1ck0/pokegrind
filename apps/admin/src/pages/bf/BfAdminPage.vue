<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const rotations = ref<any[]>([])
const active_rotation = ref<any>(null)
const leaderboard = ref<any[]>([])
const is_loading = ref(false)

const BF_MODES = ['tower', 'factory', 'arena']

async function fetchData() {
  is_loading.value = true
  try {
    const { data } = await api.getBfRotations()
    // API returns flat array
    rotations.value = Array.isArray(data) ? data : []
    active_rotation.value = rotations.value.find((r: any) => isCurrentlyActive(r)) ?? null
    leaderboard.value = []
  } finally {
    is_loading.value = false
  }
}

onMounted(fetchData)

// ── Create rotation modal ─────────────────────────────────────────────────────

const create_modal = ref(false)
const form = ref({
  mode: 'tower',
  start_at: '',
  end_at: '',
  rules_json: '{}',
  tier_restriction: '',
})
const form_error = ref('')

function openCreate() {
  const now = new Date()
  const end = new Date(now.getTime() + 7 * 24 * 3600_000)
  form.value = {
    mode: 'tower',
    start_at: now.toISOString().slice(0, 16),
    end_at: end.toISOString().slice(0, 16),
    rules_json: '{}',
    tier_restriction: '',
  }
  form_error.value = ''
  create_modal.value = true
}

async function createRotation() {
  let rules = {}
  let tier = null
  try {
    rules = JSON.parse(form.value.rules_json || '{}')
    tier = form.value.tier_restriction ? JSON.parse(form.value.tier_restriction) : null
  } catch {
    form_error.value = 'JSON invalide dans les règles ou tier_restriction.'
    return
  }
  await api.createBfRotation({
    mode: form.value.mode,
    start_at: new Date(form.value.start_at).toISOString(),
    end_at: new Date(form.value.end_at).toISOString(),
    rules_json: rules,
    tier_restriction: tier,
  })
  create_modal.value = false
  await fetchData()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function modeLabel(m: string) {
  const MAP: Record<string, string> = {
    tower: '🗼 Tour',
    factory: '🏭 Usine',
    arena: '🏟️ Arène',
  }
  return MAP[m] ?? m
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function isCurrentlyActive(rot: any): boolean {
  const now = Date.now()
  return new Date(rot.start_at).getTime() <= now && new Date(rot.end_at).getTime() > now
}
</script>

<template>
  <div class="pa-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Battle Frontier — Rotations</h1>
      <VaButton icon="add" @click="openCreate">Nouvelle rotation</VaButton>
    </div>

    <!-- Rotation active -->
    <VaCard v-if="active_rotation" class="mb-6 pa-4">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <VaBadge text="Active" color="success" />
            <h2 class="text-xl font-bold">{{ modeLabel(active_rotation.mode) }}</h2>
          </div>
          <p class="text-secondary text-sm">
            Du {{ formatDate(active_rotation.start_at) }} au {{ formatDate(active_rotation.end_at) }}
          </p>
          <p v-if="active_rotation.tier_restriction" class="text-secondary text-sm mt-1">
            Restriction : {{ JSON.stringify(active_rotation.tier_restriction) }}
          </p>
        </div>
      </div>
    </VaCard>

    <VaCard v-else class="mb-6 pa-4 text-center text-secondary">
      Aucune rotation Battle Frontier active.
    </VaCard>

    <!-- Classement -->
    <div v-if="leaderboard.length > 0" class="mb-6">
      <h2 class="text-lg font-semibold mb-3">Classement actuel (Top {{ leaderboard.length }})</h2>
      <VaDataTable
        :items="leaderboard"
        :columns="[
          { key: 'rank', label: '#' },
          { key: 'username', label: 'Joueur' },
          { key: 'score', label: 'Score' },
          { key: 'updated_at', label: 'Mis à jour' },
        ]"
      >
        <template #cell(rank)="{ row }">
          <span :class="row.rowData.rank <= 10 ? 'font-bold text-yellow-400' : ''">
            {{ row.rowData.rank }}
          </span>
        </template>
        <template #cell(score)="{ row }">
          <span class="font-mono font-bold">{{ Number(row.rowData.score).toLocaleString('fr-FR') }}</span>
        </template>
        <template #cell(updated_at)="{ row }">{{ formatDate(row.rowData.updated_at) }}</template>
      </VaDataTable>
    </div>

    <!-- Historique rotations -->
    <h2 class="text-lg font-semibold mb-3">Historique des rotations</h2>
    <VaDataTable
      :items="rotations"
      :loading="is_loading"
      :columns="[
        { key: 'mode', label: 'Mode' },
        { key: 'start_at', label: 'Début' },
        { key: 'end_at', label: 'Fin' },
        { key: 'status', label: 'Statut' },
      ]"
    >
      <template #cell(mode)="{ row }">{{ modeLabel(row.rowData.mode) }}</template>
      <template #cell(start_at)="{ row }">{{ formatDate(row.rowData.start_at) }}</template>
      <template #cell(end_at)="{ row }">{{ formatDate(row.rowData.end_at) }}</template>
      <template #cell(status)="{ row }">
        <VaBadge
          :text="isCurrentlyActive(row.rowData) ? 'Active' : new Date(row.rowData.end_at) < new Date() ? 'Terminée' : 'Planifiée'"
          :color="isCurrentlyActive(row.rowData) ? 'success' : new Date(row.rowData.end_at) < new Date() ? 'secondary' : 'info'"
        />
      </template>
    </VaDataTable>

    <!-- Modal nouvelle rotation -->
    <VaModal
      v-model="create_modal"
      title="Nouvelle rotation Battle Frontier"
      ok-text="Créer"
      @ok="createRotation"
    >
      <div class="flex flex-col gap-3">
        <VaSelect v-model="form.mode" label="Mode" :options="BF_MODES" />
        <VaInput v-model="form.start_at" label="Début" type="datetime-local" />
        <VaInput v-model="form.end_at" label="Fin" type="datetime-local" />
        <VaInput
          v-model="form.tier_restriction"
          label="Restriction de tier (JSON, optionnel)"
          placeholder='{"max_bst": 600}'
        />
        <VaInput
          v-model="form.rules_json"
          label="Règles spéciales (JSON)"
          placeholder='{}'
        />
        <p v-if="form_error" class="text-danger text-sm">{{ form_error }}</p>
      </div>
    </VaModal>
  </div>
</template>
