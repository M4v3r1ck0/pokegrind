<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminApi } from '@/composables/useAdminApi'
import { useToast } from 'vuestic-ui'

const api = useAdminApi()
const router = useRouter()
const { notify } = useToast()

const players = ref<any[]>([])
const meta = ref({ total: 0, page: 1, limit: 50, last_page: 1 })
const search = ref('')
const role_filter = ref('')
const banned_filter = ref('')
const sort = ref('created_at')
const is_loading = ref(false)

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
    const params: Record<string, any> = { page, limit: 50, sort: sort.value }
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

// ── Ban rapide ───────────────────────────────────────────────────────────────

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
  try {
    await api.banPlayer(ban_target.value.id, {
      reason: ban_reason.value,
      duration_hours: ban_hours.value ?? undefined,
    })
    ban_modal.value = false
    notify({ message: `${ban_target.value.username} banni`, color: 'warning' })
    await fetchPlayers(meta.value.page)
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

async function unban(player: any) {
  try {
    await api.unbanPlayer(player.id)
    notify({ message: `${player.username} débanni`, color: 'success' })
    await fetchPlayers(meta.value.page)
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
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
  try {
    await api.grantGems(gems_target.value.id, { amount: gems_amount.value, reason: gems_reason.value })
    gems_modal.value = false
    notify({ message: `${gems_amount.value > 0 ? '+' : ''}${gems_amount.value} gems pour ${gems_target.value.username}`, color: 'success' })
    await fetchPlayers(meta.value.page)
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function getPlayerStatus(player: any): { label: string; color: string } {
  if (player.is_banned) return { label: 'banni', color: '#ef4444' }
  if (!player.last_seen_at) return { label: 'inactif', color: '#6b7a99' }
  const hours = (Date.now() - new Date(player.last_seen_at).getTime()) / 3600000
  if (hours < 24) return { label: 'actif', color: '#56c96d' }
  if (hours < 24 * 7) return { label: '7j', color: '#f59e0b' }
  return { label: 'inactif', color: '#6b7a99' }
}

function formatGold(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'G'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
</script>

<template>
  <div style="background: #0f1117; min-height: 100vh; padding: 16px;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <h1 style="font-size: 1.5rem; font-weight: 700; color: #f0f0f0; margin: 0;">Joueurs</h1>
      <span style="color: #6b7a99; font-size: 0.875rem;">
        {{ meta.total.toLocaleString('fr-FR') }} joueurs
      </span>
    </div>

    <!-- Filtres -->
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; padding: 16px; background: #1a1d2e; border-radius: 8px; border: 1px solid #2d3158;">
      <VaInput
        v-model="search"
        placeholder="Rechercher par username ou email..."
        clearable
        style="width: 280px;"
      >
        <template #prepend>
          <VaIcon name="search" size="small" />
        </template>
      </VaInput>
      <VaSelect
        v-model="role_filter"
        placeholder="Tous les rôles"
        :options="[{ label: 'Tous', value: '' }, { label: 'Player', value: 'player' }, { label: 'Admin', value: 'admin' }, { label: 'Mod', value: 'mod' }, { label: 'Support', value: 'support' }]"
        value-by="value"
        text-by="label"
        style="width: 160px;"
      />
      <VaSelect
        v-model="banned_filter"
        placeholder="Statut"
        :options="[{ label: 'Tous', value: '' }, { label: 'Actifs', value: 'false' }, { label: 'Bannis', value: 'true' }]"
        value-by="value"
        text-by="label"
        style="width: 140px;"
      />
      <VaSelect
        v-model="sort"
        :options="SORTS"
        value-by="value"
        text-by="label"
        style="width: 200px;"
      />
    </div>

    <!-- Tableau -->
    <div style="background: #1a1d2e; border: 1px solid #2d3158; border-radius: 8px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
        <thead>
          <tr style="background: #252742; border-bottom: 2px solid #2d3158;">
            <th style="text-align: left; padding: 12px 16px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Joueur</th>
            <th style="text-align: left; padding: 12px 8px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Email</th>
            <th style="text-align: center; padding: 12px 8px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">💎 Gems</th>
            <th style="text-align: center; padding: 12px 8px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">💰 Or</th>
            <th style="text-align: center; padding: 12px 8px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Étage</th>
            <th style="text-align: center; padding: 12px 8px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Statut</th>
            <th style="text-align: center; padding: 12px 8px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Dern. connexion</th>
            <th style="text-align: center; padding: 12px 16px; color: #6b7a99; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="is_loading">
            <td colspan="8" style="text-align: center; padding: 32px; color: #6b7a99;">Chargement...</td>
          </tr>
          <tr v-else-if="players.length === 0">
            <td colspan="8" style="text-align: center; padding: 32px; color: #6b7a99;">Aucun joueur trouvé</td>
          </tr>
          <tr
            v-for="player in players"
            :key="player.id"
            style="border-bottom: 1px solid #1e2240; transition: background 0.1s;"
            @mouseover="($event.currentTarget as HTMLElement).style.background = '#1e2240'"
            @mouseout="($event.currentTarget as HTMLElement).style.background = 'transparent'"
          >
            <td style="padding: 10px 16px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div>
                  <p
                    style="font-weight: 600; margin: 0; cursor: pointer;"
                    :style="{ color: player.is_banned ? '#ef4444' : '#f0f0f0', textDecoration: player.is_banned ? 'line-through' : 'none' }"
                    @click="router.push(`/players/${player.id}`)"
                  >
                    {{ player.username }}
                  </p>
                  <span
                    v-if="player.role !== 'player'"
                    :style="{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      color: player.role === 'admin' ? '#ef4444' : player.role === 'mod' ? '#f59e0b' : '#4fc3f7',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }"
                  >
                    {{ player.role }}
                  </span>
                </div>
              </div>
            </td>
            <td style="padding: 10px 8px; color: #a0aec0; font-size: 0.8rem;">{{ player.email }}</td>
            <td style="padding: 10px 8px; text-align: center; color: #ffd700; font-weight: 700;">
              {{ Number(player.gems).toLocaleString('fr-FR') }}
            </td>
            <td style="padding: 10px 8px; text-align: center; color: #f59e0b; font-weight: 600;">
              {{ formatGold(Number(player.gold)) }}
            </td>
            <td style="padding: 10px 8px; text-align: center; color: #f0f0f0;">
              {{ player.current_floor }}
            </td>
            <td style="padding: 10px 8px; text-align: center;">
              <span
                :style="{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  background: getPlayerStatus(player).color + '22',
                  color: getPlayerStatus(player).color,
                  border: `1px solid ${getPlayerStatus(player).color}44`,
                }"
              >
                {{ getPlayerStatus(player).label }}
              </span>
            </td>
            <td style="padding: 10px 8px; text-align: center; color: #6b7a99; font-size: 0.75rem;">
              {{ formatDate(player.last_seen_at) }}
            </td>
            <td style="padding: 10px 16px; text-align: center;">
              <div style="display: flex; gap: 4px; justify-content: center;">
                <VaButton
                  size="small"
                  preset="plain"
                  icon="visibility"
                  title="Voir le profil"
                  @click="router.push(`/players/${player.id}`)"
                />
                <VaButton
                  size="small"
                  preset="plain"
                  icon="diamond"
                  color="warning"
                  title="Modifier les gems"
                  @click="openGems(player)"
                />
                <VaButton
                  v-if="!player.is_banned"
                  size="small"
                  preset="plain"
                  icon="block"
                  color="danger"
                  title="Bannir"
                  @click="openBan(player)"
                />
                <VaButton
                  v-else
                  size="small"
                  preset="plain"
                  icon="check_circle"
                  color="success"
                  title="Débannir"
                  @click="unban(player)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="meta.last_page > 1" style="display: flex; justify-content: center; margin-top: 20px;">
      <VaPagination
        v-model="meta.page"
        :pages="meta.last_page"
        @update:model-value="(p: number) => fetchPlayers(p)"
      />
    </div>

    <!-- Modal ban -->
    <VaModal v-model="ban_modal" title="Bannir le joueur" ok-text="Confirmer le ban" ok-color="danger" @ok="confirmBan">
      <p style="margin-bottom: 12px; color: #a0aec0; font-size: 0.875rem;">
        Joueur : <strong style="color: #f0f0f0;">{{ ban_target?.username }}</strong>
      </p>
      <VaInput v-model="ban_reason" label="Raison" class="mb-3" required />
      <VaInput v-model.number="ban_hours" label="Durée (heures — vide = permanent)" type="number" min="1" />
    </VaModal>

    <!-- Modal gems -->
    <VaModal v-model="gems_modal" title="Modifier les gems" ok-text="Appliquer" @ok="confirmGems">
      <p style="margin-bottom: 12px; color: #a0aec0; font-size: 0.875rem;">
        Joueur : <strong style="color: #f0f0f0;">{{ gems_target?.username }}</strong>
        — Actuel : <strong style="color: #ffd700;">{{ gems_target?.gems }} 💎</strong>
      </p>
      <VaInput v-model.number="gems_amount" label="Montant (positif = don, négatif = retrait)" type="number" class="mb-3" />
      <VaInput v-model="gems_reason" label="Raison" required />
    </VaModal>
  </div>
</template>
