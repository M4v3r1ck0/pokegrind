import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'
import { useAuthStore } from './auth'

export interface GachaResultItem {
  pokemon: {
    id: string
    species_id: number
    name_fr: string
    rarity: string
    is_shiny: boolean
    nature: string
    ivs: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }
    sprite_url: string | null
    sprite_shiny_url: string | null
  }
  is_new_species: boolean
  pity_epic_current: number
  pity_legendary_current: number
}

export interface GachaPity {
  pity_epic: number
  pity_legendary: number
  total_pulls: number
  legendary_threshold: number
  epic_threshold: number
}

export const useGachaStore = defineStore('gacha', {
  state: () => ({
    pity: null as GachaPity | null,
    lastResults: [] as GachaResultItem[],
    isPulling: false,
  }),

  actions: {
    async fetchPity() {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.get('/gacha/pity')
      this.pity = data
      return data
    },

    async pull(count: 1 | 10 | 25 | 50 | 100) {
      const api = (useNuxtApp() as any).$api
      this.isPulling = true
      try {
        const { data } = await api.post('/gacha/pull', { count })
        this.lastResults = data.results
        if (this.pity && data.results.length > 0) {
          const last = data.results[data.results.length - 1]
          this.pity.pity_epic = last.pity_epic_current
          this.pity.pity_legendary = last.pity_legendary_current
          this.pity.total_pulls = data.total_pulls
        }

        // Mettre à jour l'or dans le store auth
        const auth = useAuthStore()
        if (auth.player) {
          auth.player.gold = data.gold_remaining
        }

        return data
      } finally {
        this.isPulling = false
      }
    },
  },
})
