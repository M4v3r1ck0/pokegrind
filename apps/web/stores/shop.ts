import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'
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
    async fetchShopState() {
      const api = (useNuxtApp() as any).$api
      this.is_loading = true
      try {
        const { data } = await api.get('/player/shop')
        this.upgrades = data.upgrades
        this.player_gems = data.player_gems
      } finally {
        this.is_loading = false
      }
    },

    async purchaseUpgrade(upgrade_id: number): Promise<{ success: boolean; error?: string }> {
      try {
        const api = (useNuxtApp() as any).$api
        const { data } = await api.post('/player/shop/purchase', { upgrade_id })
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
