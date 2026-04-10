<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()
const router = useRouter()

const players = ref<any[]>([])
const meta = ref({ total: 0, page: 1, limit: 20, last_page: 1 })
const search = ref('')
const role_filter = ref('')
const banned_filter = ref('')
const sort = ref('created_at')
const is_loading = ref(false)

const ROLES = ['player', 'admin', 'mod', 'support']
const SORTS = [
  { value: 'created_at', label: 'Inscription' },
  { value: 'last_seen_at', label: 'Dernière connexion' },
  { value: 'gems', label: 'Gems' },
  { value: 'gold', label: 'Or' },
  { value: 'current_floor', label: 'Étage' },
]

async function fetchPlayers(page = 1) {
  is_loading.value = true
  try {
    const params: Record<string, any> = { page, limit: 20, sort: sort.value }
    if (search.value) params.search = search.value
    if (role_filter.value) params.role = role_filter.value
    if (banned_filter.value !== '') params.banned = banned_filter.value
    const { data } = await api.getPlayers(params)
    players.value = data.data
    meta.value = data.meta
  } finally {
    is_loading.value = false
  }
}

onMounted(() => fetchPlayers())

let search_timeout: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (search_timeout) clearTimeout(search_timeout)
  search_timeout = setTimeout(() => fetchPlayers(), 400)
})
watch([role_filter, banned_filter, sort], () => fetchPlayers())

// ── Actions rapides ──────────────────────────────────────────────────────────

const ban_modal = ref(false)
const ban_target = ref<any>(null)
const ban_reason = ref('')
const ban_hours = ref<number | null>(null)

function openBan(player: any) {
  ban_target.value = player
  ban_reason.value = ''
  ban_hours.value = null
  ban_modal.value = true
}

async function confirmBan() {
  if (!ban_target.value) return
  await api.banPlayer(ban_target.value.id, {
    reason: ban_reason.value,
    duration_hours: ban_hours.value ?? undefined,
  })
  ban_modal.value = false
  await fetchPlayers(meta.value.page)
}

async function unban(player: any) {
  await api.unbanPlayer(player.id)
  await fetchPlayers(meta.value.page)
}

// ── Gems rapides ─────────────────────────────────────────────────────────────

const gems_modal = ref(false)
const gems_target = ref<any>(null)
const gems_amount = ref(0)
const gems_reason = ref('')

function openGems(player: any) {
  gems_target.value = player
  gems_amount.value = 0
  gems_reason.value = ''
  gems_modal.value = true
}

async function confirmGems() {
  if (!gems_target.value) return
  await api.grantGems(gems_target.value.id, { amount: gems_amount.value, reason: gems_reason.value })
  gems_modal.value = false
  await fetchPlayers(meta.value.page)
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="pa-4">
    <h1 class="text-2xl font-bold mb-4">Joueurs</h1>

    <!-- Filtres -->
    <div class="flex flex-wrap gap-3 mb-4">
      <VaInput v-model="search" placeholder="Recherche username / email..." clearable style="width: 240px" />
      <VaSelect v-model="role_filter" placeholder="Rôle" :options="['', ...ROLES]" style="width: 140px" />
      <VaSelect
        v-model="banned_filter"
        placeholder="Statut"
        :options="[{label:'Tous', value:''},{label:'Actifs', value:'false'},{label:'Bannis', value:'true'}]"
        value-by="value"
        text-by="label"
        style="width: 140px"
      />
      <VaSelect v-model="sort" :options="SORTS" value-by="value" text-by="label" style="width: 180px" />
    </div>

    <!-- Tableau -->
    <VaDataTable
      :items="players"
      :loading="is_loading"
      :columns="[
        { key: 'username', label: 'Joueur' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Rôle' },
        { key: 'gems', label: '💎' },
        { key: 'gold', label: '💰' },
        { key: 'current_floor', label: 'Étage' },
        { key: 'last_seen_at', label: 'Dern. connexion' },
        { key: 'actions', label: 'Actions' },
      ]"
    >
      <template #cell(username)="{ row }">
        <span :class="row.rowData.is_banned ? 'line-through text-danger' : ''">
          {{ row.rowData.username }}
        </span>
        <VaBadge v-if="row.rowData.is_banned" text="banni" color="danger" class="ml-1" />
      </template>

      <template #cell(role)="{ row }">
        <VaBadge
          :text="row.rowData.role"
          :color="row.rowData.role === 'admin' ? 'danger' : row.rowData.role === 'mod' ? 'warning' : 'secondary'"
        />
      </template>

      <template #cell(gems)="{ row }">{{ Number(row.rowData.gems).toLocaleString('fr-FR') }}</template>
      <template #cell(gold)="{ row }">{{ Number(row.rowData.gold).toLocaleString('fr-FR') }}</template>
      <template #cell(last_seen_at)="{ row }">{{ formatDate(row.rowData.last_seen_at) }}</template>

      <template #cell(actions)="{ row }">
        <div class="flex gap-1">
          <VaButton size="small" preset="plain" icon="visibility" @click="router.push(`/players/${row.rowData.id}`)" />
          <VaButton size="small" preset="plain" icon="diamond" color="warning" @click="openGems(row.rowData)" />
          <VaButton
            v-if="!row.rowData.is_banned"
            size="small" preset="plain" icon="block" color="danger"
            @click="openBan(row.rowData)"
          />
          <VaButton
            v-else
            size="small" preset="plain" icon="check_circle" color="success"
            @click="unban(row.rowData)"
          />
        </div>
      </template>
    </VaDataTable>

    <!-- Pagination -->
    <div class="flex justify-center mt-4">
      <VaPagination
        v-model="meta.page"
        :pages="meta.last_page"
        @update:model-value="(p: number) => fetchPlayers(p)"
      />
    </div>
    <p class="text-center text-sm text-secondary mt-2">{{ meta.total.toLocaleString('fr-FR') }} joueurs</p>

    <!-- Modal ban -->
    <VaModal v-model="ban_modal" title="Bannir le joueur" ok-text="Confirmer" @ok="confirmBan">
      <p class="mb-3">Joueur : <strong>{{ ban_target?.username }}</strong></p>
      <VaInput v-model="ban_reason" label="Raison" class="mb-3" required />
      <VaInput v-model.number="ban_hours" label="Durée (heures, vide = permanent)" type="number" />
    </VaModal>

    <!-- Modal gems -->
    <VaModal v-model="gems_modal" title="Modifier les gems" ok-text="Appliquer" @ok="confirmGems">
      <p class="mb-3">Joueur : <strong>{{ gems_target?.username }}</strong> ({{ gems_target?.gems }} 💎)</p>
      <VaInput v-model.number="gems_amount" label="Montant (positif = don, négatif = retrait)" type="number" class="mb-3" />
      <VaInput v-model="gems_reason" label="Raison" />
    </VaModal>
  </div>
</template>
