<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const items = ref<any[]>([])
const meta = ref({ total: 0, page: 1, limit: 50, last_page: 1 })
const is_loading = ref(false)
const detail_modal = ref(false)
const selected_item = ref<any>(null)

async function fetchLogs(page = 1) {
  is_loading.value = true
  try {
    const { data } = await api.getAuditLog({ page, limit: 50 })
    items.value = data.data
    meta.value = data.meta
  } finally {
    is_loading.value = false
  }
}

onMounted(() => fetchLogs())

function openDetail(item: any) {
  selected_item.value = item
  detail_modal.value = true
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

const ACTION_COLORS: Record<string, string> = {
  ban_player: 'danger',
  unban_player: 'success',
  grant_gems: 'warning',
  grant_gold: 'secondary',
  force_disconnect: 'info',
}
</script>

<template>
  <div class="pa-4">
    <h1 class="text-2xl font-bold mb-4">Journal d'audit admin</h1>

    <VaDataTable
      :items="items"
      :loading="is_loading"
      :columns="[
        { key: 'admin_username', label: 'Admin' },
        { key: 'action', label: 'Action' },
        { key: 'target_type', label: 'Cible' },
        { key: 'target_id', label: 'ID cible' },
        { key: 'created_at', label: 'Date' },
        { key: 'details', label: '' },
      ]"
    >
      <template #cell(action)="{ row }">
        <VaBadge
          :text="row.rowData.action"
          :color="ACTION_COLORS[row.rowData.action] ?? 'primary'"
        />
      </template>
      <template #cell(target_id)="{ row }">
        <span class="text-xs font-mono text-secondary">{{ row.rowData.target_id?.slice(0, 8) ?? '—' }}…</span>
      </template>
      <template #cell(created_at)="{ row }">{{ formatDate(row.rowData.created_at) }}</template>
      <template #cell(details)="{ row }">
        <VaButton
          v-if="row.rowData.payload"
          size="small"
          preset="plain"
          icon="info"
          @click="openDetail(row.rowData)"
        />
      </template>
    </VaDataTable>

    <div class="flex justify-center mt-4">
      <VaPagination
        v-model="meta.page"
        :pages="meta.last_page"
        @update:model-value="(p: number) => fetchLogs(p)"
      />
    </div>
    <p class="text-center text-sm text-secondary mt-2">
      {{ meta.total.toLocaleString('fr-FR') }} entrées
    </p>

    <!-- Modal détail payload -->
    <VaModal v-model="detail_modal" title="Détail de l'action" hide-default-actions>
      <pre v-if="selected_item" class="text-xs bg-gray-100 rounded pa-3 overflow-auto max-h-64">{{ JSON.stringify(selected_item.payload, null, 2) }}</pre>
      <div class="mt-3 text-right">
        <VaButton @click="detail_modal = false">Fermer</VaButton>
      </div>
    </VaModal>
  </div>
</template>
