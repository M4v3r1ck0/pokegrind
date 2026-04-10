<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const items = ref<any[]>([])
const meta = ref({ total: 0, page: 1, limit: 50, last_page: 1 })
const is_loading = ref(false)
const player_search = ref('')

async function fetchAudit(page = 1) {
  is_loading.value = true
  try {
    const params: Record<string, any> = { page, limit: 50 }
    if (player_search.value) params.player = player_search.value
    const { data } = await api.getGemsAudit(params)
    items.value = data.data
    meta.value = data.meta
  } finally {
    is_loading.value = false
  }
}

onMounted(() => fetchAudit())

let search_timeout: ReturnType<typeof setTimeout> | null = null
watch(player_search, () => {
  if (search_timeout) clearTimeout(search_timeout)
  search_timeout = setTimeout(() => fetchAudit(), 400)
})

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="pa-4">
    <h1 class="text-2xl font-bold mb-4">Audit Gems</h1>

    <div class="flex gap-3 mb-4">
      <VaInput
        v-model="player_search"
        placeholder="Filtrer par joueur..."
        clearable
        style="width: 260px"
      />
    </div>

    <VaDataTable
      :items="items"
      :loading="is_loading"
      :columns="[
        { key: 'username', label: 'Joueur' },
        { key: 'amount', label: 'Montant' },
        { key: 'reason', label: 'Raison' },
        { key: 'source', label: 'Source' },
        { key: 'created_at', label: 'Date' },
      ]"
    >
      <template #cell(amount)="{ row }">
        <span :class="row.rowData.amount > 0 ? 'text-success font-bold' : 'text-danger font-bold'">
          {{ row.rowData.amount > 0 ? '+' : '' }}{{ row.rowData.amount }}
        </span>
      </template>
      <template #cell(source)="{ row }">
        <VaBadge v-if="row.rowData.source" :text="row.rowData.source" color="info" />
        <span v-else class="text-secondary">—</span>
      </template>
      <template #cell(created_at)="{ row }">{{ formatDate(row.rowData.created_at) }}</template>
    </VaDataTable>

    <div class="flex justify-center mt-4">
      <VaPagination
        v-model="meta.page"
        :pages="meta.last_page"
        @update:model-value="(p: number) => fetchAudit(p)"
      />
    </div>
    <p class="text-center text-sm text-secondary mt-2">
      {{ meta.total.toLocaleString('fr-FR') }} entrées
    </p>
  </div>
</template>
