import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PvpTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master' | 'legend'

export interface PvpSeason {
  id: number
  name_fr: string
  start_at: string
  end_at: string
}

export interface PvpRanking {
  elo: number
  tier: PvpTier
  wins: number
  losses: number
  win_streak: number
  best_elo: number
  rank: number | null
  win_rate: number
}

export interface PvpOpponent {
  player_id: string
  username: string
  elo: number
  tier: PvpTier
  defense_team: { pokemon: any[] }
  win_probability: number
}

export interface PvpBattleResult {
  battle_id: string
  result: 'attacker_win' | 'defender_win'
  elo_change: number
  elo_after: number
  tier_before: PvpTier
  tier_after: PvpTier
  tier_changed: boolean
  gems_earned: number
  replay: any[]
  duration_simulated_ms: number
}

export interface PvpHistoryEntry {
  battle_id: string
  opponent_username: string
  result: 'win' | 'loss'
  elo_change: number
  elo_after: number
  created_at: string
  i_am_attacker: boolean
}

export interface PvpLeaderboardEntry {
  rank: number
  player_id: string
  username: string
  elo: number
  tier: PvpTier
  wins: number
  losses: number
  win_rate: number
}

export interface PvpNotification {
  id: string
  battle_id: string
  result: string
  attacker_username: string
  elo_change_defender: number
  is_read: boolean
  created_at: string
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePvpStore = defineStore('pvp', {
  state: () => ({
    season:           null as PvpSeason | null,
    my_ranking:       null as PvpRanking | null,
    current_opponent: null as PvpOpponent | null,
    last_battle:      null as PvpBattleResult | null,
    history:          [] as PvpHistoryEntry[],
    leaderboard:      [] as PvpLeaderboardEntry[],
    leaderboard_meta: { total: 0, page: 1, last_page: 1 },
    notifications:    [] as PvpNotification[],
    unread_count:     0,
    defense_team:     null as { pokemon: any[] } | null,
    is_loading:       false,
    is_attacking:     false,
  }),

  actions: {
    async fetchSeason() {
      const { $api } = useNuxtApp()
      const data: any = await $api('/pvp/season')
      this.season     = data.season
      this.my_ranking = data.my_ranking
    },

    async findOpponent() {
      const { $api } = useNuxtApp()
      this.is_loading = true
      try {
        const data: any = await $api('/pvp/opponent')
        this.current_opponent = data.opponent ?? null
      } finally {
        this.is_loading = false
      }
    },

    async attack(defender_id: string): Promise<PvpBattleResult> {
      const { $api } = useNuxtApp()
      this.is_attacking = true
      try {
        const data: any = await $api('/pvp/attack', {
          method: 'POST',
          body: { defender_id },
        })
        this.last_battle = data.result
        // Rafraîchir les stats
        await this.fetchSeason()
        return data.result
      } finally {
        this.is_attacking = false
      }
    },

    async fetchHistory() {
      const { $api } = useNuxtApp()
      const data: any = await $api('/pvp/history')
      this.history = data.battles ?? []
    },

    async fetchLeaderboard(page = 1, tier?: string) {
      const { $api } = useNuxtApp()
      this.is_loading = true
      try {
        const query = new URLSearchParams({ page: String(page) })
        if (tier) query.set('tier', tier)
        const data: any = await $api(`/pvp/leaderboard?${query}`)
        this.leaderboard      = data.data ?? []
        this.leaderboard_meta = data.meta ?? { total: 0, page: 1, last_page: 1 }
      } finally {
        this.is_loading = false
      }
    },

    async setDefenseTeam(pokemon_ids: string[]) {
      const { $api } = useNuxtApp()
      await $api('/pvp/defense-team', {
        method: 'POST',
        body: { pokemon_ids },
      })
      await this.fetchDefenseTeam()
    },

    async fetchDefenseTeam() {
      const { $api } = useNuxtApp()
      const data: any = await $api('/pvp/defense-team')
      this.defense_team = data.defense_team
    },

    async fetchNotifications() {
      const { $api } = useNuxtApp()
      const data: any = await $api('/pvp/notifications')
      this.notifications = data.notifications ?? []
      this.unread_count  = data.unread_count ?? 0
    },

    async markNotificationsRead() {
      const { $api } = useNuxtApp()
      await $api('/pvp/notifications/read', { method: 'POST' })
      this.notifications = this.notifications.map(n => ({ ...n, is_read: true }))
      this.unread_count  = 0
    },

    // Appelé par Socket.io quand le joueur est attaqué
    handleAttackedEvent(event: {
      attacker_username: string
      result: string
      elo_change: number
      battle_id: string
    }) {
      this.unread_count++
      // Le toast est géré dans le composant qui écoute
    },

    // Appelé par Socket.io quand le tier change
    handleTierUpEvent(event: { tier_before: string; tier_after: string; gems_earned: number }) {
      if (this.my_ranking) {
        this.my_ranking.tier = event.tier_after as PvpTier
      }
    },
  },
})
