import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PokedexStats {
  total: number
  owned: number
  shiny: number
  hatched: number
}

export interface PokedexEntry {
  species_id: number
  name_fr: string
  type1: string
  type2: string | null
  rarity: string
  generation: number
  sprite_url: string | null
  sprite_shiny_url: string | null
  is_owned: boolean
  is_shiny: boolean
  best_iv_total: number | null
  times_obtained: number
}

export interface PokedexEntryDetail extends PokedexEntry {
  base_hp: number
  base_atk: number
  base_def: number
  base_spatk: number
  base_spdef: number
  base_speed: number
  learnset: Array<{ move_id: number; name_fr: string; type: string; category: string; power: number | null; learn_method: string }>
}

export interface PokedexFilters {
  generation: number | null
  rarity: string | null
  owned_only: boolean
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePokedexStore = defineStore('pokedex', {
  state: () => ({
    stats: null as PokedexStats | null,
    entries: [] as PokedexEntry[],
    entries_by_generation: {} as Record<number, PokedexEntry[]>,
    selected_entry: null as PokedexEntryDetail | null,
    filters: {
      generation: null,
      rarity: null,
      owned_only: false,
    } as PokedexFilters,
    is_loading: false,
    is_loading_detail: false,
  }),

  actions: {
    async fetchPokedex() {
      const api = (useNuxtApp() as any).$api
      this.is_loading = true
      try {
        const params: Record<string, string | number> = {}
        if (this.filters.generation !== null) params.generation = this.filters.generation
        if (this.filters.rarity !== null) params.rarity = this.filters.rarity
        if (this.filters.owned_only) params.owned_only = '1'

        const { data } = await api.get('/player/pokedex', { params })
        this.stats = data.stats
        this.entries = data.entries
        this.entries_by_generation = data.by_generation ?? {}
      } finally {
        this.is_loading = false
      }
    },

    async fetchEntry(species_id: number) {
      const api = (useNuxtApp() as any).$api
      this.is_loading_detail = true
      this.selected_entry = null
      try {
        const { data } = await api.get(`/player/pokedex/${species_id}`)
        this.selected_entry = data
      } finally {
        this.is_loading_detail = false
      }
    },

    setFilter(key: keyof PokedexFilters, value: any) {
      (this.filters as any)[key] = value
    },

    clearSelectedEntry() {
      this.selected_entry = null
    },
  },
})
