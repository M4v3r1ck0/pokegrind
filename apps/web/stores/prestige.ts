/**
 * PrestigeStore — Gestion du système de prestige côté client.
 */
import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

export interface PrestigeMultipliers {
  gold: number
  xp: number
  daycare: number
  gem_per_boss: number
}

export interface PrestigeLevel {
  level: number
  name_fr: string
  description_fr: string | null
  required_floor: number
  gold_multiplier: number
  xp_multiplier: number
  gem_bonus_per_boss: number
  daycare_speed_bonus: number
  gems_reward: number
  badge_name_fr: string | null
  badge_sprite_url: string | null
}

export interface PrestigeEligibility {
  eligible: boolean
  reason?: string
  current_floor?: number
  required_floor?: number
  next_level?: number
  prestige_def?: PrestigeLevel
  will_lose?: { current_floor: number; gold: number; total_kills: number }
  will_keep?: Record<string, boolean>
  new_bonuses?: {
    gold_multiplier: number
    xp_multiplier: number
    gem_bonus_per_boss: number
    daycare_speed_bonus: number
    gems_reward: number
  }
}

export interface PlayerPrestigeHistory {
  prestige_level: number
  name_fr: string
  floor_at_prestige: number
  total_kills_at_prestige: number
  gold_at_prestige: number
  pokemon_count_at_prestige: number
  prestiged_at: string
}

export interface PrestigeLeaderboardEntry {
  rank: number
  username: string
  prestige_level: number
  prestige_name_fr: string | null
  total_prestiges: number
  max_floor_reached: number
}

export const usePrestigeStore = defineStore('prestige', {
  state: () => ({
    current_level: 0,
    current_name_fr: null as string | null,
    total_prestiges: 0,
    multipliers: { gold: 1, xp: 1, daycare: 1, gem_per_boss: 0 } as PrestigeMultipliers,
    eligibility: null as PrestigeEligibility | null,
    next_level_preview: null as PrestigeLevel | null,
    history_count: 0,
    history: [] as PlayerPrestigeHistory[],
    levels: [] as PrestigeLevel[],
    leaderboard: [] as PrestigeLeaderboardEntry[],
    is_loading: false,
  }),

  actions: {
    async fetchPrestigeStatus() {
      const api = (useNuxtApp() as any).$api
      this.is_loading = true
      try {
        const { data } = await api.get('/player/prestige')
        this.current_level = data.current_level
        this.current_name_fr = data.current_name_fr
        this.total_prestiges = data.total_prestiges
        this.multipliers = data.current_multipliers
        this.eligibility = data.eligibility
        this.next_level_preview = data.next_level_preview
        this.history_count = data.history_count
      } finally {
        this.is_loading = false
      }
    },

    async fetchLevels() {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.get('/player/prestige/levels')
      this.levels = data
    },

    async fetchHistory() {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.get('/player/prestige/history')
      this.history = data
    },

    async performPrestige(): Promise<any> {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.post('/player/prestige/perform')
      await this.fetchPrestigeStatus()
      return data
    },

    async fetchLeaderboard() {
      const api = (useNuxtApp() as any).$api
      const { data } = await api.get('/prestige/leaderboard')
      this.leaderboard = data
    },

    handlePrestigeComplete(event: any) {
      this.current_level = event.new_level
      this.current_name_fr = event.prestige_name_fr
      this.multipliers = {
        gold: event.multipliers.gold,
        xp: event.multipliers.xp,
        daycare: event.multipliers.daycare,
        gem_per_boss: event.multipliers.gem_per_boss,
      }
    },
  },
})
