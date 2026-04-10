import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DaycareSlotPokemon {
  id: string
  name_fr: string
  rarity: string
  stars: number
  sprite_url: string
  is_shiny: boolean
  species_id: number
}

export interface DaycareSlotState {
  slot_number: number
  is_unlocked: boolean
  pokemon: DaycareSlotPokemon | null
  partner: DaycareSlotPokemon | null
  damage_accumulated: number
  damage_threshold: number
  progress_percent: number
  is_ready: boolean
  started_at: string | null
  is_breeding: boolean
}

export interface HatchResult {
  original_pokemon_id: string
  new_pokemon_id: string
  new_pokemon_name_fr: string
  new_pokemon_rarity: string
  new_pokemon_species_id: number
  stars_gained: number
  is_shiny: boolean
  has_hidden_talent: boolean
  hidden_talent_move?: { id: number; name_fr: string; type: string; category: string; power: number | null }
  auto_restarted: boolean
  slot_number: number
}

export interface DaycareQueueItem {
  id: string
  position: number
  pokemon_id: string
  partner_id: string | null
  target_slot: number | null
  pokemon_name_fr: string
  sprite_url: string
  rarity: string
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDaycareStore = defineStore('daycare', {
  state: () => ({
    slots: [] as DaycareSlotState[],
    queue: [] as DaycareQueueItem[],
    auto_collect_active: false,
    queue_active: false,
    max_slots_unlocked: 5,
    pending_hatches: [] as number[],     // slot_numbers avec éclosion prête
    last_hatch_result: null as HatchResult | null,
    show_hatch_modal: false,
    is_loading: false,
  }),

  getters: {
    activeSlots: (state) => state.slots.filter((s) => s.is_unlocked && s.pokemon !== null),
    readySlots: (state) => state.slots.filter((s) => s.is_ready),
    freeSlots: (state) =>
      state.slots.filter((s) => s.is_unlocked && s.pokemon === null),
  },

  actions: {
    // ── Chargement initial ───────────────────────────────────────────────
    async fetchDaycareState() {
      this.is_loading = true
      try {
        const nuxtApp = useNuxtApp()
        const api = nuxtApp.$api as any
        const { data } = await api.get('/api/player/daycare')
        this.applyState(data)
      } finally {
        this.is_loading = false
      }
    },

    applyState(data: any) {
      this.slots = data.slots ?? []
      this.auto_collect_active = data.auto_collect_active ?? false
      this.queue_active = data.queue_active ?? false
      this.max_slots_unlocked = data.max_slots_unlocked ?? 5
      // Synchroniser les slots prêts
      this.pending_hatches = this.slots
        .filter((s) => s.is_ready)
        .map((s) => s.slot_number)
    },

    // ── Dépôt ────────────────────────────────────────────────────────────
    async deposit(slot_number: number, pokemon_id: string, partner_id?: string) {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.post('/api/player/daycare/deposit', {
        slot_number,
        pokemon_id,
        ...(partner_id ? { partner_id } : {}),
      })
      this.applyState(data)
    },

    // ── Retrait ──────────────────────────────────────────────────────────
    async withdraw(slot_number: number) {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.post('/api/player/daycare/withdraw', { slot_number })
      this.applyState(data)
    },

    // ── Éclosion manuelle ────────────────────────────────────────────────
    async hatch(slot_number: number) {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.post('/api/player/daycare/hatch', { slot_number })
      this.last_hatch_result = data
      this.show_hatch_modal = true
      // Retirer de la liste pending
      this.pending_hatches = this.pending_hatches.filter((n) => n !== slot_number)
      // Rafraîchir l'état
      await this.fetchDaycareState()
    },

    closeHatchModal() {
      this.show_hatch_modal = false
      this.last_hatch_result = null
    },

    // ── File d'attente ───────────────────────────────────────────────────
    async fetchQueue() {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.get('/api/player/daycare/queue')
      this.queue = data.queue ?? []
    },

    async addToQueue(pokemon_id: string, partner_id?: string, target_slot?: number) {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.post('/api/player/daycare/queue/add', {
        pokemon_id,
        ...(partner_id ? { partner_id } : {}),
        ...(target_slot ? { target_slot } : {}),
      })
      this.queue = data.queue ?? []
    },

    async removeFromQueue(position: number) {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.delete(`/api/player/daycare/queue/${position}`)
      this.queue = data.queue ?? []
    },

    // ── Handlers Socket.io ────────────────────────────────────────────────
    handleReadyEvent(event: { slots: { slot_number: number; pokemon_name_fr: string }[] }) {
      for (const s of event.slots) {
        if (!this.pending_hatches.includes(s.slot_number)) {
          this.pending_hatches.push(s.slot_number)
        }
      }
      // Mettre à jour is_ready dans les slots locaux
      for (const s of event.slots) {
        const slot = this.slots.find((sl) => sl.slot_number === s.slot_number)
        if (slot) slot.is_ready = true
      }
    },

    handleHatchedEvent(event: any) {
      this.last_hatch_result = event
      this.show_hatch_modal = true
      this.pending_hatches = this.pending_hatches.filter((n) => n !== event.slot_number)
      // Rafraîchir l'état en fond
      this.fetchDaycareState()
    },

    handleProgressEvent(event: { slots: { slot_number: number; damage_accumulated: number; progress_percent: number }[] }) {
      for (const update of event.slots) {
        const slot = this.slots.find((s) => s.slot_number === update.slot_number)
        if (slot) {
          slot.damage_accumulated = update.damage_accumulated
          slot.progress_percent = update.progress_percent
        }
      }
    },
  },
})
