<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNuxtApp } from '#app'
import { useDaycareStore } from '~/stores/daycare'
import { useConfetti } from '~/composables/useConfetti'

definePageMeta({ middleware: 'auth', layout: 'jeu' })

const daycareStore = useDaycareStore()
const nuxtApp = useNuxtApp()
const { shinyConfetti, hatchConfetti } = useConfetti()

const showDepositModal = ref(false)
const showQueueModal   = ref(false)
const depositSlotNumber = ref(1)
const depositStep       = ref<'main' | 'partner'>('main')
const selectedPokemonId = ref<string | null>(null)
const selectedPartnerId = ref<string | null>(null)
const depositSearch     = ref('')
const depositPokemonList = ref<any[]>([])
const compatiblePokemon  = ref<any[]>([])
const isLoadingPokemon   = ref(false)

onMounted(async () => {
  await daycareStore.fetchDaycareState()
  if (daycareStore.queue_active) await daycareStore.fetchQueue()
  const socket = (nuxtApp as any).$socket
  if (socket) {
    socket.on('daycare:ready',    (e: any) => daycareStore.handleReadyEvent(e))
    socket.on('daycare:hatched',  (e: any) => daycareStore.handleHatchedEvent(e))
    socket.on('daycare:progress', (e: any) => daycareStore.handleProgressEvent(e))
  }
})

const filteredDepositPokemon = computed(() => {
  if (!depositSearch.value) return depositPokemonList.value
  const q = depositSearch.value.toLowerCase()
  return depositPokemonList.value.filter((p: any) =>
    p.name_fr.toLowerCase().includes(q) || p.rarity.toLowerCase().includes(q)
  )
})

async function openDepositModal(slot_number: number) {
  depositSlotNumber.value = slot_number
  depositStep.value = 'main'
  selectedPokemonId.value = null
  selectedPartnerId.value = null
  depositSearch.value = ''
  showDepositModal.value = true
  isLoadingPokemon.value = true
  try {
    const api = nuxtApp.$api as any
    const { data } = await api.get('/player/pokemon', {
      params: { level: 100, available_for_daycare: true, per_page: 100 },
    })
    depositPokemonList.value = data.data ?? []
  } catch (e) {
    console.error(e)
  } finally {
    isLoadingPokemon.value = false
  }
}

async function goToPartnerStep() {
  if (!selectedPokemonId.value) return
  depositStep.value = 'partner'
  try {
    const api = nuxtApp.$api as any
    const { data } = await api.get(`/player/daycare/compatible/${selectedPokemonId.value}`)
    compatiblePokemon.value = data.pokemon ?? []
  } catch { compatiblePokemon.value = [] }
}

async function confirmDeposit() {
  if (!selectedPokemonId.value) return
  try {
    await daycareStore.deposit(depositSlotNumber.value, selectedPokemonId.value, selectedPartnerId.value ?? undefined)
    showDepositModal.value = false
  } catch (e: any) {
    alert(e?.response?.data?.message ?? 'Erreur lors du dépôt')
  }
}

async function withdrawSlot(slot_number: number) {
  if (!confirm('Retirer ce Pokémon de la pension ?')) return
  try {
    await daycareStore.withdraw(slot_number)
  } catch (e: any) {
    alert(e?.response?.data?.message ?? 'Erreur lors du retrait')
  }
}

async function hatchSlot(slot_number: number) {
  try {
    await daycareStore.hatch(slot_number)
    // Fire confetti for shiny or 5★ hatches
    const result = daycareStore.last_hatch_result
    if (result?.is_shiny) {
      shinyConfetti()
    } else if (result?.new_pokemon_stars >= 5) {
      hatchConfetti()
    }
  } catch (e: any) {
    alert(e?.response?.data?.message ?? "Erreur lors de l'éclosion")
  }
}

function rarityLabel(rarity: string): string {
  return { common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire', mythic: 'Mythique' }[rarity] ?? rarity
}

function rarityColor(rarity: string): string {
  return {
    common: 'var(--color-rarity-common)', rare: 'var(--color-rarity-rare)',
    epic: 'var(--color-rarity-epic)', legendary: 'var(--color-rarity-legendary)',
    mythic: 'var(--color-rarity-mythic)',
  }[rarity] ?? 'var(--color-text-muted)'
}

function formatDamage(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K'
  return n.toString()
}
</script>

<template>
  <div class="pension-page">

    <!-- ── Page header ──────────────────────────────────────────── -->
    <div class="page-topbar">
      <div class="page-heading">
        <h1 class="font-display page-title">Pension Pokémon</h1>
        <span class="slots-badge">
          {{ daycareStore.activeSlots.length }}/{{ daycareStore.max_slots_unlocked }} slots
        </span>
      </div>
      <div class="page-actions">
        <span v-if="daycareStore.auto_collect_active" class="status-chip chip-green">
          ✓ Auto-collect
        </span>
        <button
          v-if="daycareStore.queue_active"
          class="status-chip chip-purple"
          @click="showQueueModal = true"
        >
          📋 File ({{ daycareStore.queue.length }})
        </button>
        <span v-if="daycareStore.pending_hatches.length > 0" class="status-chip chip-gold chip-pulse">
          🐣 {{ daycareStore.pending_hatches.length }} prête(s) !
        </span>
      </div>
    </div>

    <!-- ── Loading ──────────────────────────────────────────────── -->
    <div v-if="daycareStore.is_loading" class="loading-state">
      <div class="loading-spinner" />
      <span>Chargement de la pension…</span>
    </div>

    <!-- ── Slots grid ───────────────────────────────────────────── -->
    <div v-else class="slots-grid">
      <div
        v-for="slot in daycareStore.slots"
        :key="slot.slot_number"
        class="slot-card"
        :class="{
          'slot-locked': !slot.is_unlocked,
          'slot-ready':  slot.is_ready,
        }"
      >
        <!-- Locked slot -->
        <template v-if="!slot.is_unlocked">
          <div class="slot-num">Slot #{{ slot.slot_number }}</div>
          <div class="slot-locked-body">
            <span class="lock-icon">🔒</span>
            <span class="lock-label">Débloquez dans la Boutique Gems</span>
          </div>
        </template>

        <!-- Empty slot -->
        <template v-else-if="!slot.pokemon">
          <div class="slot-num">Slot #{{ slot.slot_number }}</div>
          <button class="btn-deposit" @click="openDepositModal(slot.slot_number)">
            <span class="deposit-plus">+</span>
            Déposer un Pokémon
          </button>
        </template>

        <!-- Occupied slot -->
        <template v-else>
          <div class="slot-header-row">
            <span class="slot-num">Slot #{{ slot.slot_number }}</span>
            <div class="slot-actions">
              <button v-if="slot.is_ready" class="btn-hatch" @click="hatchSlot(slot.slot_number)">
                🐣 Éclore !
              </button>
              <button class="btn-withdraw" @click="withdrawSlot(slot.slot_number)">Retirer</button>
            </div>
          </div>

          <!-- Pokémon pair -->
          <div class="pokemon-pair">
            <div class="poke-mini">
              <img
                :src="slot.pokemon.sprite_url || ''"
                :alt="slot.pokemon.name_fr"
                class="poke-mini-sprite"
              />
              <div class="poke-mini-info">
                <span class="poke-mini-name">
                  {{ slot.pokemon.name_fr }}
                  <span v-if="slot.pokemon.is_shiny">✨</span>
                </span>
                <span class="poke-mini-meta" :style="{ color: rarityColor(slot.pokemon.rarity) }">
                  {{ rarityLabel(slot.pokemon.rarity) }}
                </span>
                <UiStarRating :stars="slot.pokemon.stars" size="sm" />
              </div>
            </div>
            <div v-if="slot.partner" class="breeding-divider">♥</div>
            <div v-if="slot.partner" class="poke-mini poke-mini-partner">
              <img
                :src="slot.partner.sprite_url || ''"
                :alt="slot.partner.name_fr"
                class="poke-mini-sprite"
              />
              <div class="poke-mini-info">
                <span class="poke-mini-name">{{ slot.partner.name_fr }}</span>
                <span class="poke-mini-meta breeding">Dressage actif</span>
              </div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="slot-progress">
            <div class="progress-meta">
              <span>{{ formatDamage(slot.damage_accumulated) }} / {{ formatDamage(slot.damage_threshold) }}</span>
              <span class="progress-pct-label">{{ slot.progress_percent.toFixed(1) }}%</span>
            </div>
            <UiProgressBar
              :value="Math.min(100, slot.progress_percent)"
              :color="slot.is_ready ? 'var(--color-accent-yellow)' : 'var(--color-accent-purple)'"
              :animated="true"
              height="7px"
            />
            <span v-if="slot.is_breeding" class="breeding-note">IVs hérités actifs</span>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Deposit modal ────────────────────────────────────────── -->
    <UiModal
      :open="showDepositModal"
      :title="`Déposer en Pension — Slot #${depositSlotNumber}`"
      size="md"
      @close="showDepositModal = false"
    >
      <!-- Step 1: pick Pokémon -->
      <div v-if="depositStep === 'main'" class="deposit-panel">
        <input
          v-model="depositSearch"
          class="deposit-search"
          placeholder="Rechercher un Pokémon…"
        />
        <div v-if="isLoadingPokemon" class="deposit-loading">Chargement…</div>
        <div v-else-if="filteredDepositPokemon.length === 0" class="deposit-empty">
          Aucun Pokémon niveau 100 disponible.
        </div>
        <div v-else class="deposit-list">
          <button
            v-for="pp in filteredDepositPokemon"
            :key="pp.id"
            class="deposit-item"
            :class="{ selected: selectedPokemonId === pp.id }"
            @click="selectedPokemonId = pp.id"
          >
            <img :src="pp.sprite_url || ''" :alt="pp.name_fr" class="deposit-sprite" />
            <div class="deposit-item-info">
              <span class="deposit-item-name">{{ pp.name_fr }} <span v-if="pp.is_shiny">✨</span></span>
              <span class="deposit-item-meta" :style="{ color: rarityColor(pp.rarity) }">
                {{ rarityLabel(pp.rarity) }} · Niv.{{ pp.level }}
              </span>
            </div>
            <UiStarRating :stars="pp.stars" size="sm" />
          </button>
        </div>
      </div>

      <!-- Step 2: pick partner -->
      <div v-if="depositStep === 'partner'" class="deposit-panel">
        <p class="partner-hint">Choisir un partenaire de dressage pour hériter des IVs (optionnel).</p>
        <button class="btn-skip" @click="confirmDeposit()">Continuer sans partenaire →</button>
        <div class="deposit-list">
          <button
            v-for="pp in compatiblePokemon"
            :key="pp.id"
            class="deposit-item"
            :class="{ selected: selectedPartnerId === pp.id }"
            @click="selectedPartnerId = pp.id"
          >
            <img :src="pp.sprite_url || ''" :alt="pp.name_fr" class="deposit-sprite" />
            <div class="deposit-item-info">
              <span class="deposit-item-name">{{ pp.name_fr }}</span>
              <span class="deposit-item-meta" :style="{ color: rarityColor(pp.rarity) }">
                {{ rarityLabel(pp.rarity) }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <template #footer>
        <button class="btn-ghost" @click="showDepositModal = false">Annuler</button>
        <button
          v-if="depositStep === 'main'"
          class="btn-confirm"
          :disabled="!selectedPokemonId"
          @click="goToPartnerStep()"
        >Suivant →</button>
        <button
          v-if="depositStep === 'partner'"
          class="btn-confirm"
          @click="confirmDeposit()"
        >Confirmer le dépôt</button>
      </template>
    </UiModal>

    <!-- ── Hatch modal ──────────────────────────────────────────── -->
    <UiModal
      :open="!!daycareStore.show_hatch_modal && !!daycareStore.last_hatch_result"
      title="Éclosion !"
      size="sm"
      :closable="false"
    >
      <div v-if="daycareStore.last_hatch_result" class="hatch-body">
        <div class="hatch-egg-anim">🥚 → 🐣</div>

        <div class="hatch-badges">
          <span v-if="daycareStore.last_hatch_result.is_shiny" class="hatch-badge hatch-shiny">✨ SHINY !</span>
          <span v-if="daycareStore.last_hatch_result.has_hidden_talent" class="hatch-badge hatch-talent">🌟 Talent Caché !</span>
        </div>

        <div class="hatch-result-box">
          <p class="hatch-pokemon-name">{{ daycareStore.last_hatch_result.new_pokemon_name_fr }}</p>
          <p class="hatch-rarity" :style="{ color: rarityColor(daycareStore.last_hatch_result.new_pokemon_rarity) }">
            {{ rarityLabel(daycareStore.last_hatch_result.new_pokemon_rarity) }}
          </p>
          <p v-if="daycareStore.last_hatch_result.has_hidden_talent && daycareStore.last_hatch_result.hidden_talent_move" class="hatch-talent-move">
            Talent : {{ daycareStore.last_hatch_result.hidden_talent_move.name_fr }}
            ({{ daycareStore.last_hatch_result.hidden_talent_move.type }})
          </p>
          <p class="hatch-stars-note">Le parent gagne une étoile ★{{ daycareStore.last_hatch_result.stars_gained }}</p>
          <p v-if="daycareStore.last_hatch_result.auto_restarted" class="hatch-auto-note">
            🔄 Auto-collect : redépôt automatique
          </p>
        </div>
      </div>
      <template #footer>
        <button class="btn-confirm" style="flex: 1" @click="daycareStore.closeHatchModal()">Récupérer</button>
      </template>
    </UiModal>

    <!-- ── Queue modal ──────────────────────────────────────────── -->
    <UiModal :open="showQueueModal" title="File d'attente Pension" size="sm" @close="showQueueModal = false">
      <div class="queue-panel">
        <div v-if="daycareStore.queue.length === 0" class="deposit-empty">
          File vide — les Pokémon seront déposés automatiquement quand un slot se libère.
        </div>
        <div v-for="item in daycareStore.queue" :key="item.id" class="queue-item">
          <span class="queue-pos">{{ item.position }}.</span>
          <img :src="item.sprite_url || ''" class="deposit-sprite" :alt="item.pokemon_name_fr" />
          <span class="queue-name">{{ item.pokemon_name_fr }}</span>
          <button class="btn-remove" @click="daycareStore.removeFromQueue(item.position)">✕</button>
        </div>
      </div>
    </UiModal>

  </div>
</template>

<style scoped>
.pension-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* ── Top bar ─────────────────────────────────────────────────────── */
.page-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.page-heading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.page-title {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  letter-spacing: 0.04em;
  color: var(--color-text-primary);
}

.slots-badge {
  font-size: 0.78rem;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.07);
  color: var(--color-text-muted);
  font-weight: 700;
}

.page-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  cursor: default;
  background: none;
  font-family: var(--font-primary);
}
button.status-chip { cursor: pointer; }

.chip-green  { background: rgba(86,201,109,0.12); border-color: rgba(86,201,109,0.4); color: #56c96d; }
.chip-purple { background: rgba(156,106,222,0.12); border-color: rgba(156,106,222,0.4); color: #b894f5; }
.chip-gold   { background: rgba(255,215,0,0.12); border-color: rgba(255,215,0,0.4); color: var(--color-accent-yellow); }
.chip-pulse  { animation: pulse-gold 1.5s ease-in-out infinite; }

/* ── Loading ─────────────────────────────────────────────────────── */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-10);
  color: var(--color-text-muted);
}
.loading-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(156,106,222,0.3);
  border-top-color: var(--color-accent-purple);
  border-radius: 50%;
  animation: spin-slow 0.8s linear infinite;
}

/* ── Slots grid ──────────────────────────────────────────────────── */
.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}

.slot-card {
  background: var(--color-bg-secondary);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  transition: var(--transition-base);
  min-height: 160px;
}

.slot-card.slot-locked {
  opacity: 0.45;
  pointer-events: none;
}

.slot-card.slot-ready {
  border-color: rgba(255,215,0,0.5);
  box-shadow: var(--shadow-glow-yellow);
  animation: pulse-gold 2s ease-in-out infinite;
}

/* Slot header */
.slot-num {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-muted);
  font-weight: 700;
}

.slot-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.slot-actions { display: flex; gap: var(--space-2); }

/* Locked body */
.slot-locked-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-2);
}
.lock-icon  { font-size: 1.8rem; opacity: 0.5; }
.lock-label { font-size: 0.75rem; color: var(--color-text-muted); text-align: center; }

/* Deposit button */
.btn-deposit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex: 1;
  border: 2px dashed rgba(255,255,255,0.12);
  background: transparent;
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  font-family: var(--font-primary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: var(--space-5);
  transition: var(--transition-fast);
  min-height: 100px;
}
.btn-deposit:hover {
  border-color: rgba(156,106,222,0.5);
  color: #b894f5;
  background: rgba(156,106,222,0.06);
}
.deposit-plus { font-size: 1.4rem; font-weight: 300; }

/* Hatch / Withdraw buttons */
.btn-hatch {
  background: var(--color-accent-yellow);
  color: #1a1c2e;
  border: none;
  border-radius: var(--radius-md);
  padding: 4px 12px;
  font-family: var(--font-primary);
  font-weight: 800;
  font-size: 0.78rem;
  cursor: pointer;
  animation: pulse-gold 1.5s ease-in-out infinite;
}

.btn-withdraw {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  font-size: 0.72rem;
  padding: 3px 10px;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-withdraw:hover { background: rgba(230,57,70,0.15); border-color: rgba(230,57,70,0.4); color: var(--color-accent-red); }

/* Pokemon pair */
.pokemon-pair {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.poke-mini {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.poke-mini-sprite {
  width: 52px;
  height: 52px;
  object-fit: contain;
  image-rendering: pixelated;
  flex-shrink: 0;
}

.poke-mini-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.poke-mini-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.poke-mini-meta {
  font-size: 0.68rem;
  font-weight: 600;
}

.poke-mini-partner { opacity: 0.8; }
.breeding         { color: #b894f5 !important; }

.breeding-divider {
  color: #ec4899;
  font-size: 1.2rem;
  flex-shrink: 0;
}

/* Progress */
.slot-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--color-text-muted);
}
.progress-pct-label { font-weight: 700; color: var(--color-text-secondary); }

.breeding-note {
  font-size: 0.65rem;
  color: #b894f5;
  font-style: italic;
}

/* ── Deposit modal content ───────────────────────────────────────── */
.deposit-panel { display: flex; flex-direction: column; gap: var(--space-3); }

.deposit-search {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-primary);
  font-size: 0.85rem;
  width: 100%;
  transition: var(--transition-fast);
}
.deposit-search:focus {
  outline: none;
  border-color: rgba(156,106,222,0.5);
  background: rgba(255,255,255,0.07);
}

.deposit-loading, .deposit-empty {
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.85rem;
  text-align: center;
  padding: var(--space-4);
}

.deposit-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 340px;
  overflow-y: auto;
}

.deposit-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  font-family: var(--font-primary);
  text-align: left;
  transition: var(--transition-fast);
}
.deposit-item:hover   { background: rgba(255,255,255,0.07); border-color: rgba(156,106,222,0.3); }
.deposit-item.selected { border-color: rgba(156,106,222,0.7); background: rgba(156,106,222,0.12); }

.deposit-sprite { width: 40px; height: 40px; image-rendering: pixelated; flex-shrink: 0; }

.deposit-item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.deposit-item-name { font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); }
.deposit-item-meta { font-size: 0.7rem; font-weight: 600; }

.partner-hint { font-size: 0.82rem; color: var(--color-text-secondary); margin-bottom: var(--space-2); }

.btn-skip {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-family: var(--font-primary);
  font-size: 0.82rem;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: var(--transition-fast);
  text-align: left;
  margin-bottom: var(--space-2);
}
.btn-skip:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

/* ── Hatch modal ─────────────────────────────────────────────────── */
.hatch-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}

.hatch-egg-anim {
  font-size: 2.5rem;
  animation: float 1.5s ease-in-out infinite;
}

.hatch-badges { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; }

.hatch-badge {
  font-size: 0.9rem;
  font-weight: 800;
  padding: 4px 14px;
  border-radius: var(--radius-full);
}
.hatch-shiny  { background: rgba(255,224,102,0.2); border: 1px solid rgba(255,224,102,0.5); color: #ffe066; }
.hatch-talent { background: rgba(156,106,222,0.2); border: 1px solid rgba(156,106,222,0.5); color: #b894f5; }

.hatch-result-box {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  width: 100%;
}

.hatch-pokemon-name { font-size: 1.2rem; font-weight: 800; color: var(--color-text-primary); }
.hatch-rarity       { font-size: 0.85rem; font-weight: 700; margin-top: 4px; }
.hatch-talent-move  { font-size: 0.8rem; color: #b894f5; margin-top: 6px; }
.hatch-stars-note   { font-size: 0.8rem; color: var(--color-accent-yellow); margin-top: 4px; }
.hatch-auto-note    { font-size: 0.75rem; color: var(--type-grass); margin-top: 4px; }

/* ── Queue modal ─────────────────────────────────────────────────── */
.queue-panel { display: flex; flex-direction: column; gap: 4px; }

.queue-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}
.queue-pos  { font-weight: 700; color: var(--color-text-muted); min-width: 20px; }
.queue-name { flex: 1; font-size: 0.85rem; color: var(--color-text-primary); }

.btn-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: var(--transition-fast);
}
.btn-remove:hover { background: rgba(230,57,70,0.15); color: var(--color-accent-red); }

/* ── Modal footer buttons ────────────────────────────────────────── */
.btn-confirm {
  background: linear-gradient(135deg, #6c2ed4, #9c6ade);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-primary);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-confirm:hover:not(:disabled) { filter: brightness(1.15); }
.btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-ghost {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-primary);
  font-size: 0.9rem;
  cursor: pointer;
  transition: var(--transition-fast);
}
.btn-ghost:hover { background: rgba(255,255,255,0.1); color: var(--color-text-primary); }

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .slots-grid { grid-template-columns: 1fr; }
}
</style>
