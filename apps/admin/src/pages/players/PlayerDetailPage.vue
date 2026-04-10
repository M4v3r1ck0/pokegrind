<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminApi } from '@/composables/useAdminApi'

const route = useRoute()
const router = useRouter()
const api = useAdminApi()

const data = ref<any>(null)
const is_loading = ref(false)

// Modales
const ban_modal = ref(false)
const ban_reason = ref('')
const ban_hours = ref<number | null>(null)

const gems_modal = ref(false)
const gems_amount = ref(0)
const gems_reason = ref('')

const gold_modal = ref(false)
const gold_amount = ref(0)
const gold_reason = ref('')

async function load() {
  is_loading.value = true
  try {
    const { data: d } = await api.getPlayer(route.params.id as string)
    data.value = d
  } finally {
    is_loading.value = false
  }
}

onMounted(load)

async function doBan() {
  await api.banPlayer(data.value.player.id, {
    reason: ban_reason.value,
    duration_hours: ban_hours.value ?? undefined,
  })
  ban_modal.value = false
  await load()
}

async function doUnban() {
  await api.unbanPlayer(data.value.player.id)
  await load()
}

async function doGems() {
  await api.grantGems(data.value.player.id, { amount: gems_amount.value, reason: gems_reason.value })
  gems_modal.value = false
  await load()
}

async function doGold() {
  await api.grantGold(data.value.player.id, { amount: gold_amount.value, reason: gold_reason.value })
  gold_modal.value = false
  await load()
}

async function doDisconnect() {
  await api.forceDisconnect(data.value.player.id)
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af', rare: '#3b82f6', epic: '#8b5cf6',
  legendary: '#f59e0b', mythic: '#ef4444',
}
</script>

<template>
  <div class="pa-4">
    <div class="flex items-center gap-3 mb-4">
      <VaButton preset="plain" icon="arrow_back" @click="router.push('/players')" />
      <h1 class="text-2xl font-bold">Fiche joueur</h1>
    </div>

    <div v-if="is_loading" class="text-center py-12 text-secondary">Chargement...</div>

    <template v-else-if="data">
      <!-- En-tête joueur -->
      <VaCard class="mb-4">
        <VaCardContent>
          <div class="flex flex-wrap items-start gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h2 class="text-xl font-bold">{{ data.player.username }}</h2>
                <VaBadge
                  :text="data.player.role"
                  :color="data.player.role === 'admin' ? 'danger' : data.player.role === 'mod' ? 'warning' : 'secondary'"
                />
                <VaBadge v-if="data.player.is_banned" text="banni" color="danger" />
              </div>
              <p class="text-secondary text-sm">{{ data.player.email }}</p>
              <p class="text-secondary text-sm">
                Inscrit le {{ formatDate(data.player.created_at) }} ·
                Vu le {{ formatDate(data.player.last_seen_at) }}
              </p>
            </div>
            <!-- Actions -->
            <div class="flex flex-wrap gap-2">
              <VaButton size="small" color="warning" icon="diamond" @click="gems_modal = true">Gems</VaButton>
              <VaButton size="small" color="secondary" icon="monetization_on" @click="gold_modal = true">Or</VaButton>
              <VaButton
                v-if="!data.player.is_banned"
                size="small" color="danger" icon="block"
                @click="ban_modal = true"
              >Bannir</VaButton>
              <VaButton
                v-else
                size="small" color="success" icon="check_circle"
                @click="doUnban"
              >Débannir</VaButton>
              <VaButton size="small" preset="plain" icon="power_off" color="danger" @click="doDisconnect">
                Déconnecter
              </VaButton>
            </div>
          </div>

          <!-- Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div class="text-center">
              <p class="text-xl font-bold text-primary">{{ data.player.gems }}</p>
              <p class="text-sm text-secondary">💎 Gems</p>
            </div>
            <div class="text-center">
              <p class="text-xl font-bold text-warning">{{ Number(data.player.gold).toLocaleString('fr-FR') }}</p>
              <p class="text-sm text-secondary">💰 Or</p>
            </div>
            <div class="text-center">
              <p class="text-xl font-bold">{{ data.player.current_floor }}</p>
              <p class="text-sm text-secondary">🏔️ Étage actuel</p>
            </div>
            <div class="text-center">
              <p class="text-xl font-bold">{{ Number(data.player.total_kills).toLocaleString('fr-FR') }}</p>
              <p class="text-sm text-secondary">⚔️ Total kills</p>
            </div>
          </div>

          <!-- Stats extra -->
          <div class="grid grid-cols-3 gap-3 mt-3">
            <div class="text-center bg-gray-50 rounded pa-2">
              <p class="font-bold">{{ data.stats.pokemon_count }}</p>
              <p class="text-xs text-secondary">Pokémon</p>
            </div>
            <div class="text-center bg-gray-50 rounded pa-2">
              <p class="font-bold">{{ data.stats.pokedex_owned }}</p>
              <p class="text-xs text-secondary">Pokédex</p>
            </div>
            <div class="text-center bg-gray-50 rounded pa-2">
              <p class="font-bold">{{ data.stats.daycare_slots_active }}</p>
              <p class="text-xs text-secondary">Pension actifs</p>
            </div>
          </div>
        </VaCardContent>
      </VaCard>

      <!-- Équipe actuelle -->
      <VaCard class="mb-4">
        <VaCardTitle>Équipe actuelle</VaCardTitle>
        <VaCardContent>
          <div v-if="data.team.length === 0" class="text-secondary">Aucun Pokémon en équipe</div>
          <div v-else class="flex flex-wrap gap-3">
            <div
              v-for="p in data.team"
              :key="p.id"
              class="flex flex-col items-center"
              style="width: 80px"
            >
              <div
                class="rounded-lg border-2 p-1"
                :style="{ borderColor: RARITY_COLORS[p.rarity] ?? '#9ca3af' }"
              >
                <img
                  v-if="p.sprite_url"
                  :src="p.sprite_url"
                  :alt="p.name_fr"
                  class="w-12 h-12 object-contain"
                />
              </div>
              <p class="text-xs text-center mt-1 truncate w-full">{{ p.name_fr }}</p>
              <p class="text-xs text-secondary">Niv. {{ p.level }}</p>
              <span v-if="p.is_shiny" class="text-xs">✨</span>
            </div>
          </div>
        </VaCardContent>
      </VaCard>

      <!-- Upgrades achetées -->
      <VaCard class="mb-4" v-if="data.upgrades_purchased.length > 0">
        <VaCardTitle>Améliorations achetées</VaCardTitle>
        <VaCardContent>
          <div class="flex flex-wrap gap-2">
            <VaBadge
              v-for="u in data.upgrades_purchased"
              :key="u.id"
              :text="u.name_fr"
              color="success"
            />
          </div>
        </VaCardContent>
      </VaCard>

      <!-- Audit gems récents -->
      <VaCard class="mb-4">
        <VaCardTitle>Dernières transactions gems (20)</VaCardTitle>
        <VaCardContent>
          <VaDataTable
            :items="data.recent_gems_audit"
            :columns="[
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
            <template #cell(created_at)="{ row }">{{ formatDate(row.rowData.created_at) }}</template>
          </VaDataTable>
        </VaCardContent>
      </VaCard>

      <!-- Rapports offline récents -->
      <VaCard v-if="data.recent_offline_reports.length > 0">
        <VaCardTitle>Derniers rapports offline (5)</VaCardTitle>
        <VaCardContent>
          <VaDataTable
            :items="data.recent_offline_reports"
            :columns="[
              { key: 'gold_earned', label: '💰 Or' },
              { key: 'kills', label: '⚔️ Kills' },
              { key: 'hatches', label: '🥚 Éclosions' },
              { key: 'absence_seconds', label: 'Durée' },
              { key: 'created_at', label: 'Date' },
            ]"
          >
            <template #cell(gold_earned)="{ row }">{{ Number(row.rowData.gold_earned).toLocaleString('fr-FR') }}</template>
            <template #cell(absence_seconds)="{ row }">
              {{ Math.floor(row.rowData.absence_seconds / 3600) }}h {{ Math.floor((row.rowData.absence_seconds % 3600) / 60) }}min
            </template>
            <template #cell(created_at)="{ row }">{{ formatDate(row.rowData.created_at) }}</template>
          </VaDataTable>
        </VaCardContent>
      </VaCard>
    </template>

    <!-- Modal ban -->
    <VaModal v-model="ban_modal" title="Bannir le joueur" ok-text="Confirmer" @ok="doBan">
      <VaInput v-model="ban_reason" label="Raison" class="mb-3" required />
      <VaInput v-model.number="ban_hours" label="Durée (heures, vide = permanent)" type="number" />
    </VaModal>

    <!-- Modal gems -->
    <VaModal v-model="gems_modal" title="Modifier les gems" ok-text="Appliquer" @ok="doGems">
      <VaInput v-model.number="gems_amount" label="Montant (+/-)" type="number" class="mb-3" />
      <VaInput v-model="gems_reason" label="Raison" />
    </VaModal>

    <!-- Modal or -->
    <VaModal v-model="gold_modal" title="Modifier l'or" ok-text="Appliquer" @ok="doGold">
      <VaInput v-model.number="gold_amount" label="Montant (+/-)" type="number" class="mb-3" />
      <VaInput v-model="gold_reason" label="Raison" />
    </VaModal>
  </div>
</template>
