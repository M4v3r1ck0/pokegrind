import { defineStore } from 'pinia'
import axios from 'axios'
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
    authHeaders() {
      const auth = useAuthStore()
      return auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}
    },

    async fetchInventory(filters?: InventoryFilters, page = 1) {
      this.isLoading = true
      if (filters) this.filters = filters

      const params: Record<string, unknown> = {
        page,
        limit: this.pagination.limit,
        ...this.filters,
      }

      try {
        const { data } = await axios.get('/api/player/pokemon', {
          params,
          withCredentials: true,
          headers: this.authHeaders(),
        })
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
      const { data } = await axios.get('/api/player/team', {
        withCredentials: true,
        headers: this.authHeaders(),
      })
      this.team = data.slots
      return data
    },

    async sellPokemon(ids: string[]) {
      const { data } = await axios.post(
        '/api/player/pokemon/sell',
        { pokemon_ids: ids },
        { withCredentials: true, headers: this.authHeaders() }
      )

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
      const { data } = await axios.post(
        `/api/player/pokemon/${pokemonId}/assign-team`,
        { slot },
        { withCredentials: true, headers: this.authHeaders() }
      )
      this.team = data.slots
      return data
    },
  },
})
