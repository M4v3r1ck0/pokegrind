<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminApi } from '@/composables/useAdminApi'

const api = useAdminApi()

const overview = ref<any>(null)
const gems_history = ref<any[]>([])
const top_gainers = ref<any[]>([])
const is_loading = ref(false)

async function fetchData() {
  is_loading.value = true
  try {
    const [ov, gems] = await Promise.all([
      api.getEconomyOverview(),
      api.getGemsAuditStats(),
    ])
    overview.value = ov.data
    gems_history.value = gems.data?.daily ?? []
    top_gainers.value = gems.data?.top_gainers ?? []
  } finally {
    is_loading.value = false
  }
}

onMounted(fetchData)

// ── Player search ─────────────────────────────────────────────────────────────

const player_search = ref('')
const player_economy = ref<any>(null)
const player_loading = ref(false)

async function fetchPlayerEconomy() {
  if (!player_search.value.trim()) return
  player_loading.value = true
  try {
    const { data } = await api.getPlayerEconomy(player_search.value.trim())
    player_economy.value = data
  } finally {
    player_loading.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGold(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'G'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function sourceLabel(s: string): string {
  const MAP: Record<string, string> = {
    boss_first_clear: 'Boss 1ère fois',
    region_complete: 'Région complète',
    pokedex_gen: 'Pokédex génération',
    admin_grant: 'Don admin',
    pvp_reward: 'PvP',
    bf_reward: 'Battle Frontier',
    achievement: 'Succès',
    event: 'Événement',
    shop_purchase: 'Boutique (dépense)',
  }
  return MAP[s] ?? s
}
</script>

<template>
  <div class="pa-4">
    <h1 class="text-2xl font-bold mb-6">Économie</h1>

    <!-- Vue d'ensemble -->
    <template v-if="overview">
      <h2 class="text-lg font-semibold mb-2">Circulation</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-primary">{{ overview.gems_total?.toLocaleString('fr-FR') ?? '—' }}</p>
          <p class="text-sm text-secondary">💎 Total gems</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold text-success">+{{ overview.gems_awarded_24h?.toLocaleString('fr-FR') ?? '—' }}</p>
          <p class="text-sm text-secondary">💎 Gagnés 24h</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold text-danger">-{{ overview.gems_spent_24h?.toLocaleString('fr-FR') ?? '—' }}</p>
          <p class="text-sm text-secondary">💎 Dépensés 24h</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold text-warning">{{ formatGold(overview.gold_total ?? 0) }}</p>
          <p class="text-sm text-secondary">💰 Or total</p>
        </VaCard>
      </div>

      <h2 class="text-lg font-semibold mb-2">Gacha</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <VaCard class="text-center pa-3">
          <p class="text-2xl font-bold">{{ overview.gacha_pulls_total?.toLocaleString('fr-FR') ?? '—' }}</p>
          <p class="text-sm text-secondary">Pulls totaux</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold">{{ overview.gacha_pulls_24h?.toLocaleString('fr-FR') ?? '—' }}</p>
          <p class="text-sm text-secondary">Pulls 24h</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold text-yellow-400">{{ overview.shiny_total ?? '—' }}</p>
          <p class="text-sm text-secondary">✨ Shinies obtenus</p>
        </VaCard>
        <VaCard class="text-center pa-3">
          <p class="text-xl font-bold text-purple-400">{{ overview.legendary_total ?? '—' }}</p>
          <p class="text-sm text-secondary">Légendaires obtenus</p>
        </VaCard>
      </div>
    </template>

    <div v-if="is_loading && !overview" class="text-center py-12 text-secondary">Chargement...</div>

    <!-- Top gainers gems -->
    <div v-if="top_gainers.length > 0" class="mb-6">
      <h2 class="text-lg font-semibold mb-2">Top gaineurs de gems (7 jours)</h2>
      <VaDataTable
        :items="top_gainers"
        :columns="[
          { key: 'username', label: 'Joueur' },
          { key: 'total_gems', label: 'Gems gagnés' },
          { key: 'top_source', label: 'Source principale' },
        ]"
      >
        <template #cell(total_gems)="{ row }">{{ Number(row.rowData.total_gems).toLocaleString('fr-FR') }}</template>
        <template #cell(top_source)="{ row }">{{ sourceLabel(row.rowData.top_source) }}</template>
      </VaDataTable>
    </div>

    <!-- Recherche par joueur -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold mb-3">Économie d'un joueur</h2>
      <div class="flex gap-2 mb-4">
        <VaInput
          v-model="player_search"
          placeholder="Username ou UUID..."
          style="width: 280px"
          @keyup.enter="fetchPlayerEconomy"
        />
        <VaButton :loading="player_loading" @click="fetchPlayerEconomy">Rechercher</VaButton>
      </div>

      <template v-if="player_economy">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <VaCard class="text-center pa-3">
            <p class="text-xl font-bold text-primary">{{ Number(player_economy.gems).toLocaleString('fr-FR') }}</p>
            <p class="text-sm text-secondary">💎 Gems actuels</p>
          </VaCard>
          <VaCard class="text-center pa-3">
            <p class="text-xl font-bold text-warning">{{ formatGold(player_economy.gold ?? 0) }}</p>
            <p class="text-sm text-secondary">💰 Or actuel</p>
          </VaCard>
          <VaCard class="text-center pa-3">
            <p class="text-xl font-bold text-success">+{{ player_economy.gems_gained_all_time?.toLocaleString('fr-FR') ?? '—' }}</p>
            <p class="text-sm text-secondary">💎 Gagnés total</p>
          </VaCard>
          <VaCard class="text-center pa-3">
            <p class="text-xl font-bold text-danger">{{ player_economy.gacha_pulls_total?.toLocaleString('fr-FR') ?? '—' }}</p>
            <p class="text-sm text-secondary">Pulls gacha</p>
          </VaCard>
        </div>

        <!-- Historique gems -->
        <h3 class="font-semibold mb-2">Historique gems récent</h3>
        <VaDataTable
          :items="player_economy.recent_gems ?? []"
          :columns="[
            { key: 'amount', label: 'Montant' },
            { key: 'source', label: 'Source' },
            { key: 'reason', label: 'Raison' },
            { key: 'created_at', label: 'Date' },
          ]"
        >
          <template #cell(amount)="{ row }">
            <span :class="Number(row.rowData.amount) > 0 ? 'text-success' : 'text-danger'">
              {{ Number(row.rowData.amount) > 0 ? '+' : '' }}{{ row.rowData.amount }}
            </span>
          </template>
          <template #cell(source)="{ row }">{{ sourceLabel(row.rowData.source) }}</template>
          <template #cell(created_at)="{ row }">
            {{ new Date(row.rowData.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }}
          </template>
        </VaDataTable>
      </template>
    </div>
  </div>
</template>
