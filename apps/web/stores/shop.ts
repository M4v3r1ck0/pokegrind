import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './auth'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShopUpgrade {
  id: number
  category: string
  name_fr: string
  description_fr: string | null
  cost_gems: number
  effect_type: string
  requires_upgrade_id: number | null
  requires_name_fr: string | null
  is_purchased: boolean
  is_available: boolean
}

export interface ShopState {
  upgrades: ShopUpgrade[]
  player_gems: number
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useShopStore = defineStore('shop', {
  state: () => ({
    upgrades: [] as ShopUpgrade[],
    player_gems: 0,
    is_loading: false,
  }),

  getters: {
    byCategory: (state) => {
      const map: Record<string, ShopUpgrade[]> = {}
      for (const u of state.upgrades) {
        if (!map[u.category]) map[u.category] = []
        map[u.category].push(u)
      }
      return map
    },
  },

  actions: {
    authHeaders() {
      const auth = useAuthStore()
      return auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}
    },

    async fetchShopState() {
      this.is_loading = true
      try {
        const { data } = await axios.get('/api/player/shop', {
          withCredentials: true,
          headers: this.authHeaders(),
        })
        this.upgrades = data.upgrades
        this.player_gems = data.player_gems
      } finally {
        this.is_loading = false
      }
    },

    async purchaseUpgrade(upgrade_id: number): Promise<{ success: boolean; error?: string }> {
      try {
        const { data } = await axios.post(
          '/api/player/shop/purchase',
          { upgrade_id },
          { withCredentials: true, headers: this.authHeaders() }
        )
        this.player_gems = data.gems_remaining
        // Rafraîchir l'état boutique pour mettre à jour is_purchased / is_available
        await this.fetchShopState()
        // Mettre à jour les gems dans le store auth
        const auth = useAuthStore()
        if (auth.player) auth.player.gems = data.gems_remaining
        return { success: true }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string }; status?: number } }
        return { success: false, error: e.response?.data?.message || 'Erreur lors de l\'achat' }
      }
    },

    /** Appelé depuis Socket.io lors de l'événement gems:earned */
    handleGemsEarned(amount: number) {
      this.player_gems += amount
      const auth = useAuthStore()
      if (auth.player) auth.player.gems = (auth.player.gems ?? 0) + amount
    },
  },
})
