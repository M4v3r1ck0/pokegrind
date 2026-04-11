<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminApi } from '@/composables/useAdminApi'
import { useToast } from 'vuestic-ui'

const route = useRoute()
const router = useRouter()
const api = useAdminApi()
const { notify } = useToast()

const player_data = ref<any>(null)
const pokemon_list = ref<any[]>([])
const items_list = ref<any[]>([])
const all_items = ref<any[]>([])
const is_loading = ref(false)

// ── Modales ──────────────────────────────────────────────────────────────────

const ban_modal = ref(false)
const ban_reason = ref('')
const ban_hours = ref<number | null>(null)

const gems_modal = ref(false)
const gems_amount = ref(0)
const gems_reason = ref('')

const gold_modal = ref(false)
const gold_amount = ref(0)
const gold_reason = ref('')

const items_modal = ref(false)
const selected_item = ref<any>(null)
const item_quantity = ref(1)

const edit_pokemon_modal = ref(false)
const editing_pokemon = ref<any>(null)
const edit_level = ref(1)
const edit_xp = ref(0)

// ── Chargement ────────────────────────────────────────────────────────────────

async function load() {
  is_loading.value = true
  try {
    const id = route.params.id as string
    const [player_res, pokemon_res, items_res] = await Promise.all([
      api.getPlayer(id),
      api.getPlayerPokemon(id),
      api.getPlayerItems(id),
    ])
    player_data.value = player_res.data
    pokemon_list.value = pokemon_res.data.pokemon ?? []
    items_list.value = items_res.data.items ?? []
  } finally {
    is_loading.value = false
  }
}

async function loadAllItems() {
  if (all_items.value.length > 0) return
  try {
    const res = await api.getItemsList()
    all_items.value = res.data.items ?? []
  } catch { /* ignore */ }
}

onMounted(load)

// ── Actions ───────────────────────────────────────────────────────────────────

async function doBan() {
  try {
    await api.banPlayer(player_data.value.player.id, {
      reason: ban_reason.value,
      duration_hours: ban_hours.value ?? undefined,
    })
    ban_modal.value = false
    notify({ message: 'Joueur banni', color: 'warning' })
    await load()
  } catch { notify({ message: 'Erreur lors du ban', color: 'danger' }) }
}

async function doUnban() {
  try {
    await api.unbanPlayer(player_data.value.player.id)
    notify({ message: 'Joueur débanni', color: 'success' })
    await load()
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

async function doGems() {
  try {
    await api.grantGems(player_data.value.player.id, { amount: gems_amount.value, reason: gems_reason.value })
    gems_modal.value = false
    notify({ message: `${gems_amount.value > 0 ? '+' : ''}${gems_amount.value} gems appliqués`, color: 'success' })
    const res = await api.getPlayer(route.params.id as string)
    player_data.value = res.data
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

async function doGold() {
  try {
    await api.grantGold(player_data.value.player.id, { amount: gold_amount.value, reason: gold_reason.value })
    gold_modal.value = false
    notify({ message: `${gold_amount.value > 0 ? '+' : ''}${gold_amount.value} or appliqués`, color: 'success' })
    const res = await api.getPlayer(route.params.id as string)
    player_data.value = res.data
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

async function doDisconnect() {
  try {
    await api.forceDisconnect(player_data.value.player.id)
    notify({ message: 'Joueur déconnecté', color: 'info' })
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

async function openItemsModal() {
  await loadAllItems()
  selected_item.value = null
  item_quantity.value = 1
  items_modal.value = true
}

async function doGrantItems() {
  if (!selected_item.value) return
  try {
    await api.grantItems(player_data.value.player.id, {
      item_id: selected_item.value.id,
      quantity: item_quantity.value,
    })
    items_modal.value = false
    notify({ message: `${item_quantity.value}x ${selected_item.value.name_fr} accordé`, color: 'success' })
    const res = await api.getPlayerItems(route.params.id as string)
    items_list.value = res.data.items ?? []
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

function openEditPokemon(p: any) {
  editing_pokemon.value = p
  edit_level.value = p.level
  edit_xp.value = p.xp ?? 0
  edit_pokemon_modal.value = true
}

async function doEditPokemon() {
  if (!editing_pokemon.value) return
  try {
    await api.editPokemon(player_data.value.player.id, editing_pokemon.value.id, {
      level: edit_level.value,
      xp: edit_xp.value,
    })
    edit_pokemon_modal.value = false
    notify({ message: `${editing_pokemon.value.name_fr} modifié`, color: 'success' })
    const res = await api.getPlayerPokemon(route.params.id as string)
    pokemon_list.value = res.data.pokemon ?? []
  } catch { notify({ message: 'Erreur', color: 'danger' }) }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatTimeAgo(d: string | null): string {
  if (!d) return '—'
  const ms = Date.now() - new Date(d).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'Il y a moins d\'1h'
  if (h < 24) return `Il y a ${h}h`
  const days = Math.floor(h / 24)
  return `Il y a ${days}j`
}

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b',
  mythic: '#ef4444',
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire', mythic: 'Mythique',
}

const TYPE_COLORS: Record<string, string> = {
  fire: '#ff6b35', water: '#4fc3f7', grass: '#56c96d', electric: '#ffd700',
  psychic: '#ff6b9d', ice: '#96d9e8', dragon: '#6c5ce7', dark: '#4a4a6a',
  fairy: '#ffb3d9', fighting: '#d4522a', poison: '#a855c8', ground: '#c8a85e',
  rock: '#8b7355', bug: '#91b800', ghost: '#6c5ce7', steel: '#8fa8c8',
  normal: '#a8a878', flying: '#89aadc',
}

function isOnline(last_seen: string | null): boolean {
  if (!last_seen) return false
  return Date.now() - new Date(last_seen).getTime() < 5 * 60 * 1000
}

const p = player_data
</script>

<template>
  <div style="background: #0f1117; min-height: 100vh; padding: 16px;">
    <!-- En-tête navigation -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <VaButton preset="plain" icon="arrow_back" @click="router.push('/players')" />
      <template v-if="player_data">
        <h1 style="font-size: 1.5rem; font-weight: 700; color: #f0f0f0; margin: 0;">
          {{ player_data.player.username }}
        </h1>
        <VaBadge
          :text="player_data.player.role"
          :color="player_data.player.role === 'admin' ? 'danger' : player_data.player.role === 'mod' ? 'warning' : 'secondary'"
        />
        <VaBadge v-if="player_data.player.is_banned" text="banni" color="danger" />
        <VaBadge
          v-if="isOnline(player_data.player.last_seen_at)"
          text="en ligne"
          color="success"
        />
      </template>
    </div>

    <div v-if="is_loading" style="text-align: center; padding: 48px; color: #a0aec0;">
      Chargement...
    </div>

    <template v-else-if="player_data">
      <!-- Layout 2 colonnes -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <!-- Col gauche : Infos compte -->
        <VaCard style="background: #1a1d2e; border: 1px solid #2d3158;">
          <VaCardTitle style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
            Infos compte
          </VaCardTitle>
          <VaCardContent>
            <table style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0; width: 140px;">Email</td>
                  <td style="color: #f0f0f0;">{{ player_data.player.email }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Inscrit le</td>
                  <td style="color: #f0f0f0;">{{ formatDate(player_data.player.created_at) }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Dernière connexion</td>
                  <td style="color: #f0f0f0;">{{ formatTimeAgo(player_data.player.last_seen_at) }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Étage actuel</td>
                  <td style="color: #f0f0f0;">{{ player_data.player.current_floor }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Étage max</td>
                  <td style="color: #f0f0f0;">{{ player_data.player.max_floor_reached ?? '—' }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Total kills</td>
                  <td style="color: #f0f0f0;">{{ Number(player_data.player.total_kills ?? 0).toLocaleString('fr-FR') }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Pokémon possédés</td>
                  <td style="color: #f0f0f0;">{{ player_data.stats.pokemon_count }}</td>
                </tr>
                <tr>
                  <td style="color: #6b7a99; padding: 4px 0;">Pokédex</td>
                  <td style="color: #f0f0f0;">{{ player_data.stats.pokedex_owned }}</td>
                </tr>
              </tbody>
            </table>
          </VaCardContent>
        </VaCard>

        <!-- Col droite : Actions + Ressources -->
        <VaCard style="background: #1a1d2e; border: 1px solid #2d3158;">
          <VaCardTitle style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
            Actions rapides
          </VaCardTitle>
          <VaCardContent>
            <!-- Boutons actions -->
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
              <VaButton size="small" color="warning" icon="diamond" @click="gems_amount = 0; gems_reason = ''; gems_modal = true">
                + Gems
              </VaButton>
              <VaButton size="small" color="secondary" icon="monetization_on" @click="gold_amount = 0; gold_reason = ''; gold_modal = true">
                + Or
              </VaButton>
              <VaButton size="small" color="info" icon="inventory_2" @click="openItemsModal">
                + Items
              </VaButton>
              <VaButton
                v-if="!player_data.player.is_banned"
                size="small" color="danger" icon="block"
                @click="ban_reason = ''; ban_hours = null; ban_modal = true"
              >
                Bannir
              </VaButton>
              <VaButton v-else size="small" color="success" icon="check_circle" @click="doUnban">
                Débannir
              </VaButton>
              <VaButton size="small" preset="plain" color="danger" icon="power_off" @click="doDisconnect">
                Déconnecter
              </VaButton>
            </div>

            <!-- Ressources -->
            <div style="border-top: 1px solid #2d3158; padding-top: 16px;">
              <p style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">
                Ressources
              </p>
              <div style="display: flex; gap: 24px;">
                <div style="text-align: center;">
                  <p style="font-size: 1.5rem; font-weight: 700; color: #ffd700;">
                    {{ Number(player_data.player.gems).toLocaleString('fr-FR') }}
                  </p>
                  <p style="font-size: 0.75rem; color: #6b7a99;">💎 Gems</p>
                </div>
                <div style="text-align: center;">
                  <p style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">
                    {{ Number(player_data.player.gold).toLocaleString('fr-FR') }}
                  </p>
                  <p style="font-size: 0.75rem; color: #6b7a99;">💰 Or</p>
                </div>
                <div style="text-align: center;">
                  <p style="font-size: 1.5rem; font-weight: 700; color: #4fc3f7;">
                    {{ player_data.player.frontier_points ?? 0 }}
                  </p>
                  <p style="font-size: 0.75rem; color: #6b7a99;">🏆 FP</p>
                </div>
              </div>
            </div>

            <!-- Ban info -->
            <div v-if="player_data.player.is_banned" style="margin-top: 16px; padding: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;">
              <p style="color: #ef4444; font-size: 0.875rem; font-weight: 600;">Banni</p>
              <p style="color: #a0aec0; font-size: 0.75rem; margin-top: 4px;">
                Raison : {{ player_data.player.ban_reason ?? '—' }}
              </p>
              <p style="color: #a0aec0; font-size: 0.75rem;">
                Jusqu'au : {{ player_data.player.ban_until ? formatDate(player_data.player.ban_until) : 'Permanent' }}
              </p>
            </div>
          </VaCardContent>
        </VaCard>
      </div>

      <!-- Équipe Pokémon -->
      <VaCard style="background: #1a1d2e; border: 1px solid #2d3158; margin-bottom: 16px;">
        <VaCardTitle style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
          Équipe Pokémon ({{ pokemon_list.filter(p => p.slot_team !== null).length }}/6)
        </VaCardTitle>
        <VaCardContent>
          <div v-if="pokemon_list.filter(p => p.slot_team !== null).length === 0" style="color: #6b7a99; font-size: 0.875rem;">
            Aucun Pokémon en équipe
          </div>
          <table v-else style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
            <thead>
              <tr style="color: #6b7a99; border-bottom: 1px solid #2d3158;">
                <th style="text-align: left; padding: 8px 4px; font-weight: 500;">Pokémon</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">Niv.</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">XP</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">Types</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">Rareté</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">★</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="pk in pokemon_list.filter(p => p.slot_team !== null).sort((a: any, b: any) => (a.slot_team ?? 99) - (b.slot_team ?? 99))"
                :key="pk.id"
                style="border-bottom: 1px solid #1a1d2e;"
              >
                <td style="padding: 8px 4px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <img
                      v-if="pk.sprite_url"
                      :src="pk.sprite_url"
                      :alt="pk.name_fr"
                      style="width: 48px; height: 48px; object-fit: contain; image-rendering: pixelated;"
                    />
                    <div style="width: 48px; height: 48px; background: #2d3158; border-radius: 50%;" v-else />
                    <div>
                      <span style="color: #f0f0f0; font-weight: 600;">{{ pk.name_fr }}</span>
                      <span v-if="pk.is_shiny" style="margin-left: 4px;">✨</span>
                      <p style="color: #6b7a99; font-size: 0.75rem; margin: 0;">Slot {{ pk.slot_team }}</p>
                    </div>
                  </div>
                </td>
                <td style="text-align: center; padding: 8px 4px; color: #f0f0f0; font-weight: 600;">
                  {{ pk.level }}
                </td>
                <td style="text-align: center; padding: 8px 4px; color: #a0aec0; font-size: 0.75rem;">
                  {{ pk.xp ?? 0 }}
                </td>
                <td style="text-align: center; padding: 8px 4px;">
                  <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: wrap;">
                    <span
                      v-if="pk.type1"
                      :style="{ background: TYPE_COLORS[pk.type1] ?? '#666', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }"
                    >
                      {{ pk.type1 }}
                    </span>
                    <span
                      v-if="pk.type2"
                      :style="{ background: TYPE_COLORS[pk.type2] ?? '#666', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }"
                    >
                      {{ pk.type2 }}
                    </span>
                  </div>
                </td>
                <td style="text-align: center; padding: 8px 4px;">
                  <span
                    :style="{ color: RARITY_COLORS[pk.rarity] ?? '#9ca3af', fontSize: '0.75rem', fontWeight: '600' }"
                  >
                    {{ RARITY_LABELS[pk.rarity] ?? pk.rarity }}
                  </span>
                </td>
                <td style="text-align: center; padding: 8px 4px; color: #ffd700;">
                  {{ '★'.repeat(pk.stars ?? 0) }}{{ '☆'.repeat(5 - (pk.stars ?? 0)) }}
                </td>
                <td style="text-align: center; padding: 8px 4px;">
                  <VaButton size="small" preset="plain" icon="edit" @click="openEditPokemon(pk)" />
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pokémon hors équipe (pension/boîte) -->
          <div v-if="pokemon_list.filter(p => p.slot_team === null).length > 0" style="margin-top: 16px;">
            <p style="color: #6b7a99; font-size: 0.75rem; margin-bottom: 8px;">
              Autres Pokémon ({{ pokemon_list.filter(p => p.slot_team === null).length }} — boîte/pension)
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <div
                v-for="pk in pokemon_list.filter(p => p.slot_team === null).slice(0, 20)"
                :key="pk.id"
                style="display: flex; align-items: center; gap: 6px; background: #252742; padding: 4px 8px; border-radius: 6px; cursor: pointer;"
                @click="openEditPokemon(pk)"
              >
                <img
                  v-if="pk.sprite_url"
                  :src="pk.sprite_url"
                  :alt="pk.name_fr"
                  style="width: 32px; height: 32px; object-fit: contain; image-rendering: pixelated;"
                />
                <div>
                  <p style="color: #f0f0f0; font-size: 0.75rem; font-weight: 600; margin: 0;">
                    {{ pk.name_fr }} <span v-if="pk.is_shiny">✨</span>
                  </p>
                  <p style="color: #6b7a99; font-size: 0.65rem; margin: 0;">
                    Niv. {{ pk.level }} {{ pk.slot_daycare !== null ? '🥚' : '' }}
                  </p>
                </div>
              </div>
              <p v-if="pokemon_list.filter(p => p.slot_team === null).length > 20" style="color: #6b7a99; font-size: 0.75rem; align-self: center;">
                +{{ pokemon_list.filter(p => p.slot_team === null).length - 20 }} autres
              </p>
            </div>
          </div>
        </VaCardContent>
      </VaCard>

      <!-- Inventaire items -->
      <VaCard style="background: #1a1d2e; border: 1px solid #2d3158; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px;">
          <VaCardTitle style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin: 0; padding: 16px 0;">
            Inventaire Items ({{ items_list.length }})
          </VaCardTitle>
          <VaButton size="small" icon="add" @click="openItemsModal">Donner un item</VaButton>
        </div>
        <VaCardContent>
          <div v-if="items_list.length === 0" style="color: #6b7a99; font-size: 0.875rem;">
            Aucun item dans l'inventaire
          </div>
          <table v-else style="width: 100%; font-size: 0.875rem; border-collapse: collapse;">
            <thead>
              <tr style="color: #6b7a99; border-bottom: 1px solid #2d3158;">
                <th style="text-align: left; padding: 8px 4px; font-weight: 500;">Item</th>
                <th style="text-align: left; padding: 8px 4px; font-weight: 500;">Effet</th>
                <th style="text-align: center; padding: 8px 4px; font-weight: 500;">Quantité</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in items_list"
                :key="item.item_id"
                style="border-bottom: 1px solid #252742;"
              >
                <td style="padding: 8px 4px; color: #f0f0f0; font-weight: 500;">{{ item.name_fr }}</td>
                <td style="padding: 8px 4px;">
                  <span style="background: #252742; color: #a0aec0; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; font-family: monospace;">
                    {{ item.effect_type }}
                  </span>
                </td>
                <td style="padding: 8px 4px; text-align: center; color: #ffd700; font-weight: 700;">
                  {{ item.quantity }}
                </td>
              </tr>
            </tbody>
          </table>
        </VaCardContent>
      </VaCard>

      <!-- Audit gems récents -->
      <VaCard style="background: #1a1d2e; border: 1px solid #2d3158; margin-bottom: 16px;">
        <VaCardTitle style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
          Dernières transactions gems (20)
        </VaCardTitle>
        <VaCardContent>
          <VaDataTable
            :items="player_data.recent_gems_audit"
            :columns="[
              { key: 'amount', label: 'Montant' },
              { key: 'reason', label: 'Raison' },
              { key: 'source', label: 'Source' },
              { key: 'created_at', label: 'Date' },
            ]"
          >
            <template #cell(amount)="{ row }">
              <span :style="{ color: row.rowData.amount > 0 ? '#56c96d' : '#ef4444', fontWeight: '700' }">
                {{ row.rowData.amount > 0 ? '+' : '' }}{{ row.rowData.amount }}
              </span>
            </template>
            <template #cell(created_at)="{ row }">
              <span style="color: #a0aec0; font-size: 0.75rem;">{{ formatDate(row.rowData.created_at) }}</span>
            </template>
          </VaDataTable>
        </VaCardContent>
      </VaCard>

      <!-- Améliorations achetées -->
      <VaCard v-if="player_data.upgrades_purchased.length > 0" style="background: #1a1d2e; border: 1px solid #2d3158; margin-bottom: 16px;">
        <VaCardTitle style="color: #a0aec0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px;">
          Améliorations achetées ({{ player_data.upgrades_purchased.length }})
        </VaCardTitle>
        <VaCardContent>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span
              v-for="u in player_data.upgrades_purchased"
              :key="u.id"
              style="background: #1e3a2f; color: #56c96d; border: 1px solid #2d5a44; font-size: 0.75rem; padding: 4px 10px; border-radius: 6px;"
            >
              {{ u.name_fr }}
            </span>
          </div>
        </VaCardContent>
      </VaCard>
    </template>

    <!-- ── Modales ─────────────────────────────────────────────────────────────── -->

    <!-- Modal ban -->
    <VaModal v-model="ban_modal" title="Bannir le joueur" ok-text="Confirmer le ban" ok-color="danger" @ok="doBan">
      <VaInput v-model="ban_reason" label="Raison" class="mb-3" required />
      <VaInput v-model.number="ban_hours" label="Durée (heures — vide = permanent)" type="number" min="1" />
    </VaModal>

    <!-- Modal gems -->
    <VaModal v-model="gems_modal" title="Modifier les gems" ok-text="Appliquer" @ok="doGems">
      <p style="color: #a0aec0; margin-bottom: 12px; font-size: 0.875rem;">
        Solde actuel : <strong style="color: #ffd700;">{{ player_data?.player.gems }} 💎</strong>
      </p>
      <VaInput v-model.number="gems_amount" label="Montant (+/-)" type="number" class="mb-3" />
      <VaInput v-model="gems_reason" label="Raison (obligatoire)" required />
    </VaModal>

    <!-- Modal or -->
    <VaModal v-model="gold_modal" title="Modifier l'or" ok-text="Appliquer" @ok="doGold">
      <p style="color: #a0aec0; margin-bottom: 12px; font-size: 0.875rem;">
        Solde actuel : <strong style="color: #f59e0b;">{{ Number(player_data?.player.gold).toLocaleString('fr-FR') }} 💰</strong>
      </p>
      <VaInput v-model.number="gold_amount" label="Montant (+/-)" type="number" class="mb-3" />
      <VaInput v-model="gold_reason" label="Raison (obligatoire)" required />
    </VaModal>

    <!-- Modal items -->
    <VaModal v-model="items_modal" title="Donner des items" ok-text="Donner" @ok="doGrantItems">
      <p style="color: #a0aec0; margin-bottom: 12px; font-size: 0.875rem;">
        Rechercher un item et définir la quantité.
      </p>
      <VaSelect
        v-model="selected_item"
        :options="all_items"
        text-by="name_fr"
        track-by="id"
        label="Item"
        searchable
        class="mb-3"
      />
      <VaInput v-model.number="item_quantity" label="Quantité" type="number" min="1" />
    </VaModal>

    <!-- Modal édition Pokémon -->
    <VaModal v-model="edit_pokemon_modal" title="Modifier le Pokémon" ok-text="Sauvegarder" @ok="doEditPokemon">
      <div v-if="editing_pokemon" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <img
          v-if="editing_pokemon.sprite_url"
          :src="editing_pokemon.sprite_url"
          :alt="editing_pokemon.name_fr"
          style="width: 64px; height: 64px; object-fit: contain; image-rendering: pixelated; background: #252742; border-radius: 8px;"
        />
        <div>
          <p style="font-weight: 700; color: #f0f0f0;">
            {{ editing_pokemon.name_fr }} <span v-if="editing_pokemon.is_shiny">✨</span>
          </p>
          <p style="color: #6b7a99; font-size: 0.75rem;">
            {{ RARITY_LABELS[editing_pokemon.rarity] ?? editing_pokemon.rarity }}
          </p>
        </div>
      </div>
      <VaInput v-model.number="edit_level" label="Niveau (1-100)" type="number" min="1" max="100" class="mb-3" />
      <VaInput v-model.number="edit_xp" label="XP (0+)" type="number" min="0" />
    </VaModal>
  </div>
</template>
