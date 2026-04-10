<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const events = ref<any[]>([])
const maintenance = ref<any>(null)
const is_loading = ref(false)

const EVENT_TYPES = ['gem_boost', 'xp_boost', 'shiny_boost', 'banner', 'custom']

async function fetchData() {
  is_loading.value = true
  try {
    const [ev, status] = await Promise.all([
      api.getEvents(),
      api.getMaintenance(),
    ])
    events.value = ev.data
    maintenance.value = status.data?.maintenance ?? null
  } finally {
    is_loading.value = false
  }
}

onMounted(fetchData)

// ── Create / Edit modal ───────────────────────────────────────────────────────

const create_modal = ref(false)
const edit_target = ref<any>(null)
const form = ref({
  name_fr: '',
  description_fr: '',
  event_type: 'gem_boost',
  multiplier: 2,
  start_at: '',
  end_at: '',
})

function openCreate() {
  edit_target.value = null
  const now = new Date()
  const later = new Date(now.getTime() + 3600_000)
  form.value = {
    name_fr: '',
    description_fr: '',
    event_type: 'gem_boost',
    multiplier: 2,
    start_at: now.toISOString().slice(0, 16),
    end_at: later.toISOString().slice(0, 16),
  }
  create_modal.value = true
}

function openEdit(ev: any) {
  edit_target.value = ev
  form.value = {
    name_fr: ev.name_fr,
    description_fr: ev.description_fr ?? '',
    event_type: ev.event_type,
    multiplier: ev.config_json?.multiplier ?? 2,
    start_at: new Date(ev.start_at).toISOString().slice(0, 16),
    end_at: new Date(ev.end_at).toISOString().slice(0, 16),
  }
  create_modal.value = true
}

async function saveEvent() {
  const body = {
    name_fr: form.value.name_fr,
    description_fr: form.value.description_fr,
    event_type: form.value.event_type,
    config_json: { multiplier: Number(form.value.multiplier) },
    start_at: new Date(form.value.start_at).toISOString(),
    end_at: new Date(form.value.end_at).toISOString(),
  }
  if (edit_target.value) {
    await api.updateEvent(edit_target.value.id, body)
  } else {
    await api.createEvent(body)
  }
  create_modal.value = false
  await fetchData()
}

async function deleteEvent(id: string) {
  if (!confirm('Supprimer cet événement ?')) return
  await api.deleteEvent(id)
  await fetchData()
}

// ── Maintenance ───────────────────────────────────────────────────────────────

const maint_modal = ref(false)
const maint_message = ref('Maintenance en cours, veuillez patienter.')
const maint_duration = ref(60)

function openMaintenance() {
  maint_message.value = 'Maintenance en cours, veuillez patienter.'
  maint_duration.value = 60
  maint_modal.value = true
}

async function enableMaintenance() {
  await api.enableMaintenance({ message_fr: maint_message.value, duration_minutes: maint_duration.value })
  maint_modal.value = false
  await fetchData()
}

async function disableMaintenance() {
  await api.disableMaintenance()
  await fetchData()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const maintenance_active = computed(() => maintenance.value?.active === true)

function typeLabel(t: string) {
  const MAP: Record<string, string> = {
    gem_boost: '💎 Gems ×2',
    xp_boost: '⬆️ XP boost',
    shiny_boost: '✨ Shiny boost',
    banner: '🎪 Bannière',
    custom: '🎲 Custom',
  }
  return MAP[t] ?? t
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function isActive(ev: any): boolean {
  const now = Date.now()
  return ev.is_active && new Date(ev.end_at).getTime() > now
}
</script>

<template>
  <div class="pa-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Événements saisonniers</h1>
      <div class="flex gap-2">
        <VaButton
          v-if="!maintenance_active"
          color="warning"
          icon="build"
          @click="openMaintenance"
        >
          Activer maintenance
        </VaButton>
        <VaButton
          v-else
          color="success"
          icon="check_circle"
          @click="disableMaintenance"
        >
          Désactiver maintenance
        </VaButton>
        <VaButton icon="add" @click="openCreate">Nouvel événement</VaButton>
      </div>
    </div>

    <!-- Maintenance status -->
    <VaCard v-if="maintenance_active" class="mb-4 border border-warning pa-3">
      <div class="flex items-center gap-3">
        <span class="text-warning text-xl">⚠️</span>
        <div>
          <p class="font-bold text-warning">Maintenance active</p>
          <p class="text-sm text-secondary">{{ maintenance.message_fr }}</p>
          <p v-if="maintenance.ends_at" class="text-xs text-secondary">
            Fin : {{ formatDate(maintenance.ends_at) }}
          </p>
        </div>
      </div>
    </VaCard>

    <!-- Liste des événements -->
    <VaDataTable
      :items="events"
      :loading="is_loading"
      :columns="[
        { key: 'status', label: 'Statut' },
        { key: 'name_fr', label: 'Nom' },
        { key: 'event_type', label: 'Type' },
        { key: 'config_json', label: 'Config' },
        { key: 'start_at', label: 'Début' },
        { key: 'end_at', label: 'Fin' },
        { key: 'actions', label: 'Actions' },
      ]"
    >
      <template #cell(status)="{ row }">
        <VaBadge
          :text="isActive(row.rowData) ? 'Actif' : new Date(row.rowData.end_at) < new Date() ? 'Expiré' : 'Planifié'"
          :color="isActive(row.rowData) ? 'success' : new Date(row.rowData.end_at) < new Date() ? 'secondary' : 'info'"
        />
      </template>
      <template #cell(event_type)="{ row }">
        {{ typeLabel(row.rowData.event_type) }}
      </template>
      <template #cell(config_json)="{ row }">
        ×{{ row.rowData.config_json?.multiplier ?? 1 }}
      </template>
      <template #cell(start_at)="{ row }">{{ formatDate(row.rowData.start_at) }}</template>
      <template #cell(end_at)="{ row }">{{ formatDate(row.rowData.end_at) }}</template>
      <template #cell(actions)="{ row }">
        <div class="flex gap-1">
          <VaButton size="small" preset="plain" icon="edit" @click="openEdit(row.rowData)" />
          <VaButton size="small" preset="plain" icon="delete" color="danger" @click="deleteEvent(row.rowData.id)" />
        </div>
      </template>
    </VaDataTable>

    <!-- Modal créer / éditer -->
    <VaModal
      v-model="create_modal"
      :title="edit_target ? 'Modifier l\'événement' : 'Nouvel événement'"
      ok-text="Enregistrer"
      @ok="saveEvent"
    >
      <div class="flex flex-col gap-3">
        <VaInput v-model="form.name_fr" label="Nom (FR)" required />
        <VaInput v-model="form.description_fr" label="Description" />
        <VaSelect
          v-model="form.event_type"
          label="Type"
          :options="EVENT_TYPES"
        />
        <VaInput
          v-model.number="form.multiplier"
          label="Multiplicateur"
          type="number"
          min="1"
          max="10"
          step="0.1"
        />
        <VaInput v-model="form.start_at" label="Début" type="datetime-local" />
        <VaInput v-model="form.end_at" label="Fin" type="datetime-local" />
      </div>
    </VaModal>

    <!-- Modal maintenance -->
    <VaModal
      v-model="maint_modal"
      title="Activer la maintenance"
      ok-text="Activer"
      ok-color="warning"
      @ok="enableMaintenance"
    >
      <p class="text-sm text-secondary mb-3">
        Les joueurs (non-admin) recevront une erreur 503 jusqu'à la fin de la maintenance.
      </p>
      <VaInput v-model="maint_message" label="Message affiché aux joueurs" class="mb-3" />
      <VaInput v-model.number="maint_duration" label="Durée (minutes)" type="number" min="1" />
    </VaModal>
  </div>
</template>
