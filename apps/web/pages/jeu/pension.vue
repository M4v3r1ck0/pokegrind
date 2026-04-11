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
  // Seuls les Pokémon niveau 100 non déjà en pension
  const eligible = depositPokemonList.value.filter(
    (p: any) => Number(p.level) >= 100 && !p.slot_daycare
  )
  if (!depositSearch.value?.trim()) return eligible
  const q = depositSearch.value.trim().toLowerCase()
  return eligible.filter((p: any) =>
    (p.name_fr ?? '').toLowerCase().includes(q) ||
    (p.rarity ?? '').toLowerCase().includes(q)
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
      params: { min_level: 100, sort: 'level', limit: 200 },
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

function dmgPct(slot: any) {
  return Math.min(100, slot.progress_percent ?? 0)
}

function hatchThreshold(slot: any) {
  return Math.round((slot.damage_threshold ?? 0) / 1000)
}
</script>

<template>
  <div class="page-wrap">
  <div class="pension-root">
    <div class="pension-slots">
      <!-- Slots -->
      <div
        v-for="slot in daycareStore.slots"
        :key="slot.slot_number"
        class="pension-slot"
        :class="{ occupied: slot.pokemon, ready: slot.is_ready }"
      >
        <!-- Slot vide -->
        <template v-if="!slot.pokemon">
          <div class="slot-empty-icon">+</div>
          <div class="slot-empty-label">Déposer un Pokémon</div>
          <button class="btn-deposit" @click="openDepositModal(slot.slot_number)">Déposer</button>
        </template>
        <!-- Slot occupé -->
        <template v-else>
          <img class="slot-sprite" :src="slot.pokemon.sprite_url" :alt="slot.pokemon.name_fr" />
          <div class="slot-name">{{ slot.pokemon.name_fr }}</div>
          <div class="slot-stars">{{ '★'.repeat(slot.pokemon.stars) }}{{ '☆'.repeat(5 - slot.pokemon.stars) }}</div>
          <div class="dmg-bar-wrap">
            <div class="dmg-bar" :style="{ width: dmgPct(slot) + '%' }" />
          </div>
          <div class="dmg-text">{{ slot.damage_accumulated?.toLocaleString('fr') }} / {{ hatchThreshold(slot) }}k dégâts</div>
          <div v-if="slot.is_ready" class="ready-badge">Prêt à éclore !</div>
          <div class="slot-actions">
            <button v-if="slot.is_ready" class="btn-hatch" @click="hatchSlot(slot.slot_number)">Éclore</button>
            <button class="btn-withdraw" @click="withdrawSlot(slot.slot_number)">Retirer</button>
          </div>
        </template>
      </div>
    </div>
  </div>
  </div>

  <!-- ── Deposit modal ── -->
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
        <template v-if="depositSearch?.trim()">
          Aucun résultat pour "{{ depositSearch }}"
        </template>
        <template v-else>
          Aucun Pokémon niveau 100 disponible hors pension.
        </template>
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

  <!-- ── Hatch modal ── -->
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

  <!-- ── Queue modal ── -->
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
</template>

<style scoped>
.pension-root { padding: 20px; background: #0d0f1a; min-height: calc(100dvh - 48px); }
.pension-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  max-width: 900px;
}
.pension-slot {
  background: rgba(255,255,255,0.03);
  border: 1px dashed rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
  min-height: 180px;
  justify-content: center;
  transition: all 0.2s;
}
.pension-slot.occupied {
  border-style: solid;
  border-color: rgba(86,201,109,0.2);
  background: rgba(86,201,109,0.03);
  justify-content: flex-start;
}
.pension-slot.ready {
  border-color: rgba(251,191,36,0.4);
  background: rgba(251,191,36,0.04);
  animation: pulse-ready 2s ease infinite;
}
@keyframes pulse-ready { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 16px rgba(251,191,36,0.15)} }
.slot-empty-icon  { font-size: 28px; color: rgba(255,255,255,0.1); margin-bottom: 4px; }
.slot-empty-label { font-size: 12px; color: rgba(255,255,255,0.25); }
.btn-deposit {
  margin-top: 8px;
  background: rgba(156,106,222,0.12);
  border: 1px solid rgba(156,106,222,0.25);
  border-radius: 8px;
  color: #c4a0f5;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 16px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.btn-deposit:hover { background: rgba(156,106,222,0.22); }
.slot-sprite { width: 64px; height: 64px; image-rendering: pixelated; }
.slot-name   { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.85); }
.slot-stars  { font-size: 12px; color: #fbbf24; letter-spacing: -1px; }
.dmg-bar-wrap { width: 100%; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
.dmg-bar      { height: 100%; background: linear-gradient(90deg, #56c96d, #22c55e); border-radius: 3px; transition: width 0.5s ease; }
.dmg-text     { font-size: 10px; color: rgba(86,201,109,0.6); font-weight: 600; }
.ready-badge  { background: rgba(251,191,36,0.15); color: #fbbf24; font-size: 11px; font-weight: 700; padding: 3px 12px; border-radius: 99px; }
.slot-actions { display: flex; gap: 6px; margin-top: 4px; }
.btn-hatch    { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.3); border-radius: 7px; color: #fbbf24; font-size: 11px; font-weight: 700; padding: 5px 12px; cursor: pointer; font-family: inherit; }
.btn-withdraw { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 700; padding: 5px 12px; cursor: pointer; font-family: inherit; }

/* ── Modal styles ── */
.deposit-panel { display: flex; flex-direction: column; gap: 12px; }
.deposit-search {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #f0f0f0;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 0.85rem;
  width: 100%;
}
.deposit-search:focus { outline: none; border-color: rgba(156,106,222,0.5); }
.deposit-loading, .deposit-empty { color: rgba(255,255,255,0.35); font-style: italic; font-size: 0.85rem; text-align: center; padding: 16px; }
.deposit-list { display: flex; flex-direction: column; gap: 4px; max-height: 340px; overflow-y: auto; }
.deposit-item {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 8px 12px; cursor: pointer;
  font-family: inherit; text-align: left; transition: all 0.15s;
}
.deposit-item:hover   { background: rgba(255,255,255,0.07); border-color: rgba(156,106,222,0.3); }
.deposit-item.selected { border-color: rgba(156,106,222,0.7); background: rgba(156,106,222,0.12); }
.deposit-sprite { width: 40px; height: 40px; image-rendering: pixelated; flex-shrink: 0; }
.deposit-item-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.deposit-item-name { font-size: 0.85rem; font-weight: 700; color: #f0f0f0; }
.deposit-item-meta { font-size: 0.7rem; font-weight: 600; }
.partner-hint { font-size: 0.82rem; color: rgba(255,255,255,0.55); }
.btn-skip {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: rgba(255,255,255,0.55); font-family: inherit;
  font-size: 0.82rem; padding: 8px 12px; cursor: pointer; text-align: left;
}
.btn-skip:hover { background: rgba(255,255,255,0.1); color: #fff; }

.hatch-body { display: flex; flex-direction: column; align-items: center; gap: 16px; text-align: center; }
.hatch-egg-anim { font-size: 2.5rem; }
.hatch-badges { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.hatch-badge { font-size: 0.9rem; font-weight: 800; padding: 4px 14px; border-radius: 99px; }
.hatch-shiny  { background: rgba(255,224,102,0.2); border: 1px solid rgba(255,224,102,0.5); color: #ffe066; }
.hatch-talent { background: rgba(156,106,222,0.2); border: 1px solid rgba(156,106,222,0.5); color: #b894f5; }
.hatch-result-box { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; width: 100%; }
.hatch-pokemon-name { font-size: 1.2rem; font-weight: 800; color: #f0f0f0; }
.hatch-rarity       { font-size: 0.85rem; font-weight: 700; margin-top: 4px; }
.hatch-talent-move  { font-size: 0.8rem; color: #b894f5; margin-top: 6px; }
.hatch-stars-note   { font-size: 0.8rem; color: #ffd700; margin-top: 4px; }
.hatch-auto-note    { font-size: 0.75rem; color: #56c96d; margin-top: 4px; }

.queue-panel { display: flex; flex-direction: column; gap: 4px; }
.queue-item { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 12px; }
.queue-pos  { font-weight: 700; color: rgba(255,255,255,0.35); min-width: 20px; }
.queue-name { flex: 1; font-size: 0.85rem; color: #f0f0f0; }
.btn-remove { background: none; border: none; color: rgba(255,255,255,0.35); cursor: pointer; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; }
.btn-remove:hover { background: rgba(230,57,70,0.15); color: #f87171; }

.btn-confirm {
  background: linear-gradient(135deg, #6c2ed4, #9c6ade);
  color: #fff; border: none; border-radius: 8px;
  padding: 8px 16px; font-family: inherit; font-weight: 700; font-size: 0.9rem; cursor: pointer;
}
.btn-confirm:hover:not(:disabled) { filter: brightness(1.15); }
.btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-ghost {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: rgba(255,255,255,0.55); padding: 8px 12px;
  font-family: inherit; font-size: 0.9rem; cursor: pointer;
}
.btn-ghost:hover { background: rgba(255,255,255,0.1); color: #fff; }
</style>
