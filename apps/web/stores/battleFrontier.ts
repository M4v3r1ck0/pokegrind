import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'

export interface BfRotation {
  id: string
  mode: 'tower' | 'factory' | 'arena'
  name_fr: string | null
  description_fr: string | null
  challenge_type: string
  tier_restriction: string[] | null
  rules_json: Record<string, unknown>
  start_at: string
  end_at: string
}

export interface BfSession {
  id: string
  mode: 'tower' | 'factory' | 'arena'
  current_streak: number
  best_streak: number
  frontier_points_earned: number
  status: 'active' | 'completed' | 'abandoned'
  started_at: string
}

export interface LeaderboardEntry {
  player_id: string
  username: string
  score: number
  rank: number
}

export interface BfShopItem {
  id: number
  name_fr: string
  description_fr: string | null
  cost_pf: number
  item_type: 'ct_exclusive' | 'iv_capsule' | 'nature_mint' | 'cosmetic'
  item_data: Record<string, unknown>
}

export interface BfBattleResult {
  result: 'win' | 'loss'
  streak_new: number
  pf_earned: number
  score_delta: number
  actions_replay: any[]
  arena_judgment?: { player_hp_percent: number; enemy_hp_percent: number }
  duration_seconds: number
}

export const useBattleFrontierStore = defineStore('battleFrontier', {
  state: () => ({
    current_rotation: null as BfRotation | null,
    timer_seconds: 0,
    my_session: null as BfSession | null,
    my_rank: null as number | null,
    leaderboard: [] as LeaderboardEntry[],
    leaderboard_meta: { total: 0, page: 1, last_page: 1 },
    shop_items: [] as BfShopItem[],
    my_pf: 0,
    my_purchases: [] as any[],
    is_loading: false,
    is_in_battle: false,
    last_battle_result: null as BfBattleResult | null,
    achievements: [] as any[],
    timer_interval: null as ReturnType<typeof setInterval> | null,
  }),

  actions: {
    async fetchCurrentRotation() {
      this.is_loading = true
      try {
        const { $api } = useNuxtApp() as any
        const { data } = await $api.get('/bf/current')
        this.current_rotation = data.rotation
        this.timer_seconds = data.timer_seconds
        this.startTimer()
      } finally {
        this.is_loading = false
      }
    },

    startTimer() {
      if (this.timer_interval) clearInterval(this.timer_interval)
      if (this.timer_seconds > 0) {
        this.timer_interval = setInterval(() => {
          if (this.timer_seconds > 0) {
            this.timer_seconds--
          } else {
            clearInterval(this.timer_interval!)
            this.fetchCurrentRotation()
          }
        }, 1000)
      }
    },

    async fetchMySession() {
      const { $api } = useNuxtApp() as any
      const { data } = await $api.get('/bf/my-session')
      this.my_session = data.session
      this.my_rank = data.my_rank
    },

    async joinRotation(mode: 'tower' | 'factory' | 'arena') {
      const { $api } = useNuxtApp() as any
      const { data } = await $api.post('/bf/join', { mode })
      this.my_session = data.session
    },

    async startBattle(): Promise<BfBattleResult> {
      const { $api } = useNuxtApp() as any
      this.is_in_battle = true
      try {
        const { data } = await $api.post('/bf/battle')
        this.last_battle_result = data
        // Mettre à jour la session
        if (this.my_session) {
          this.my_session.current_streak = data.streak_new
          this.my_session.frontier_points_earned += data.pf_earned
          if (data.result === 'loss') this.my_session.status = 'completed'
        }
        this.my_pf += data.pf_earned
        return data
      } finally {
        this.is_in_battle = false
      }
    },

    async fetchLeaderboard(page = 1) {
      if (!this.current_rotation) return
      const { $api } = useNuxtApp() as any
      const { data } = await $api.get(`/bf/leaderboard/${this.current_rotation.id}`, { params: { page } })
      this.leaderboard = data.data
      this.leaderboard_meta = data.meta
      this.my_rank = data.my_rank
    },

    async fetchShop() {
      const { $api } = useNuxtApp() as any
      const { data } = await $api.get('/bf/shop')
      this.shop_items = data.items
      this.my_pf = data.my_pf
      this.my_purchases = data.my_purchases
    },

    async purchaseItem(item_id: number, quantity = 1) {
      const { $api } = useNuxtApp() as any
      await $api.post('/bf/shop/purchase', { item_id, quantity })
      await this.fetchShop()
    },

    async useIvCapsule(pokemon_id: string, stat: string) {
      const { $api } = useNuxtApp() as any
      await $api.post('/bf/shop/use-capsule', { pokemon_id, stat })
      await this.fetchShop()
    },

    async useNatureMint(pokemon_id: string, nature: string) {
      const { $api } = useNuxtApp() as any
      await $api.post('/bf/shop/use-mint', { pokemon_id, nature })
      await this.fetchShop()
    },

    async fetchAchievements() {
      const { $api } = useNuxtApp() as any
      const { data } = await $api.get('/bf/achievements')
      this.achievements = data.achievements
    },

    async abandonSession() {
      const { $api } = useNuxtApp() as any
      await $api.post('/bf/abandon')
      this.my_session = null
    },

    formatTimer(seconds: number): string {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) return `${h}h ${m}min`
      if (m > 0) return `${m}min ${s}s`
      return `${s}s`
    },
  },
})
