import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

export interface TeamMove {
  id?: string
  slot: number
  move_id: number
  name_fr: string
  type: string
  category: 'physical' | 'special' | 'status'
  power: number | null
  pp_current: number
  pp_max: number
}

export interface TeamPokemonSpecies {
  name_fr: string
  type1: string
  type2: string | null
  sprite_url: string | null
  sprite_shiny_url: string | null
}

export interface TeamPokemon {
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
  slot_team: number | null
  slot_daycare: number | null
  species: TeamPokemonSpecies
  moves: TeamMove[]
}

export interface AvailableMove {
  move_id: number
  level_learned_at: number
  name_fr: string
  type: string
  category: 'physical' | 'special' | 'status'
  power: number | null
  accuracy: number | null
  pp: number
  priority: number
}

export const useTeamStore = defineStore('team', {
  state: () => ({
    pokemons: [] as TeamPokemon[],
    loading: false,
    error: null as string | null,
  }),

  getters: {
    teamSlots: (state) => {
      return Array.from({ length: 6 }, (_, i) => ({
        slot: i + 1,
        pokemon: state.pokemons.find((p) => p.slot_team === i + 1) ?? null,
      }))
    },
    benchPokemons: (state) => state.pokemons.filter((p) => p.slot_team === null && p.slot_daycare === null),
  },

  actions: {
    async fetchTeam() {
      this.loading = true
      this.error = null
      try {
        const nuxtApp = useNuxtApp()
        const api = nuxtApp.$api as any
        const { data } = await api.get('/team')
        this.pokemons = data.data
      } catch (err: any) {
        this.error = err?.response?.data?.message ?? 'Erreur lors du chargement de l\'équipe.'
      } finally {
        this.loading = false
      }
    },

    async setSlot(pokemon_id: string, slot: number | null) {
      try {
        const nuxtApp = useNuxtApp()
        const api = nuxtApp.$api as any
        await api.post('/team/slot', { pokemon_id, slot })
        await this.fetchTeam()
      } catch (err: any) {
        this.error = err?.response?.data?.message ?? 'Erreur lors de la modification de l\'équipe.'
        throw err
      }
    },

    async getAvailableMoves(pokemon_id: string): Promise<AvailableMove[]> {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.get(`/team/${pokemon_id}/moves`)
      return data.moves
    },

    async updateMoves(pokemon_id: string, slots: { slot: number; move_id: number }[]) {
      try {
        const nuxtApp = useNuxtApp()
        const api = nuxtApp.$api as any
        const { data } = await api.put(`/team/${pokemon_id}/moves`, { slots })
        // Mettre à jour les moves localement
        const pokemon = this.pokemons.find((p) => p.id === pokemon_id)
        if (pokemon) {
          pokemon.moves = data.moves
        }
        return data.moves
      } catch (err: any) {
        this.error = err?.response?.data?.message ?? 'Erreur lors de la mise à jour des moves.'
        throw err
      }
    },
  },
})
