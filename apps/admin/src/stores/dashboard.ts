import { defineStore } from 'pinia'
import { useAdminApi } from '@/composables/useAdminApi'

export interface DashboardData {
  players: {
    total: number
    active_last_24h: number
    active_last_7d: number
    new_today: number
    new_this_week: number
  }
  economy: {
    total_gems_in_circulation: number
    gems_awarded_today: number
    gems_spent_today: number
    total_gold_in_circulation: number
  }
  combat: {
    avg_floor_all_players: number
    max_floor_reached: number
    total_kills_all_time: number
  }
  daycare: {
    active_slots: number
    hatches_today: number
  }
  server: {
    uptime_seconds: number
    node_version: string
    redis_memory_mb: number
    active_combat_sessions: number
  }
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    data: null as DashboardData | null,
    is_loading: false,
    last_updated: null as Date | null,
  }),

  actions: {
    async fetch() {
      this.is_loading = true
      try {
        const api = useAdminApi()
        const { data } = await api.getDashboard()
        this.data = data
        this.last_updated = new Date()
      } finally {
        this.is_loading = false
      }
    },
  },
})
