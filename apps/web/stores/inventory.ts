import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'
import { useAuthStore } from './auth'

export interface PokemonMove {
  slot: number
  move_id: number
  name_fr: string
  type: string
  category: string
  power: number | null
  pp_current: number
  pp_max: number
}

export interface PlayerPokemon {
  id: string
  species_id: number
  name_fr: string
  nickname: string | null
  level: number
  is_shiny: boolean
  stars: number
  nature: string
  ivs: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }
  iv_total: number
  rarity: string
  type1: string
  type2: string | null
  sprite_url: string | null
  sprite_shin_url: string | null
  slot_team: number | null
  slot_daycare: number | null
  moves: PokemonMove[]
}

export interface TeamSlot {
  slot: number
  pokemon: PlayerPokemon | null
}

export interface InventoryFilters {
  rarity?: string
  is_shiny?: boolean
  sort?: 'recent' | 'rarity' | 'iv_total' | 'name'
}

export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    pokemon: [] as PlayerPokemon[],
    team: [] as TeamSlot[],
    pagination: {
      page: 1,
      total: 0,
      lastPage: 1,
      limit: 20,
    },
    filters: {} as InventoryFilters,
    isLoading: false,
  }),

  actions: {
    async fetchInventory(filters?: InventoryFilters, page = 1) {
      const api = (useNuxtApp() as any).$api
      this.isLoading = true
      if (filters) this.filters = filters

      const params: Record<string, unknown> = {
        page,
        limit: this.pagination.limit,
        ...this.filters,
      }

      try {
        const { data } = await api.get('/player/pokemon', { params })
        this.pokemon = data.data
        this.pagination = {
          page: data.meta.page,
          total: data.meta.total,
          lastPage: data.meta.last_page,
          limit: data.meta.limit,
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async fetchTeam() {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.get('/player/team')
      this.team = data.slots
      return data
    },

    async sellPokemon(ids: string[]) {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.post('/player/pokemon/sell', { pokemon_ids: ids })

      // Retirer les pokémon vendus de l'inventaire local
      this.pokemon = this.pokemon.filter((p) => !ids.includes(p.id))

      // Mettre à jour l'or
      const auth = useAuthStore()
      if (auth.player) {
        auth.player.gold = data.gold_total
      }

      return data
    },

    async assignToTeam(pokemonId: string, slot: number) {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.post(`/player/pokemon/${pokemonId}/assign-team`, { slot })
      this.team = data.slots
      return data
    },
  },
})
