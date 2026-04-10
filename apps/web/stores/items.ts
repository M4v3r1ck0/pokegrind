import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Item {
  id: number
  name_fr: string
  description_fr: string
  category: 'offensive' | 'defensive' | 'utility' | 'passive'
  effect_type: string
  effect_value: Record<string, any>
  sprite_url: string
  rarity: string
}

export interface PlayerItem extends Item {
  player_item_id: string
  item_id: number
  quantity: number
  obtained_at: string
}

export interface GoldShopEntry extends Item {
  shop_id: number
  item_id: number
  cost_gold: number
  stock_type: 'unlimited' | 'weekly'
}

export interface GoldShop {
  permanent: GoldShopEntry[]
  weekly: GoldShopEntry[]
  rotation_resets_in_seconds: number
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useItemsStore = defineStore('items', {
  state: () => ({
    inventory: [] as PlayerItem[],
    inventory_meta: { total: 0, page: 1, per_page: 20, last_page: 1 },
    catalog: [] as Item[],
    catalog_meta: { total: 0, page: 1, per_page: 20, last_page: 1 },
    gold_shop: null as GoldShop | null,
    is_loading: false,
    is_purchasing: false,
    is_equipping: false,
  }),

  actions: {
    async fetchInventory(page = 1) {
      const { $api } = useNuxtApp()
      this.is_loading = true
      try {
        const data: any = await $api(`/player/items?page=${page}&per_page=20`)
        this.inventory = data.data
        this.inventory_meta = data.meta
      } finally {
        this.is_loading = false
      }
    },

    async fetchCatalog(page = 1, category?: string) {
      const { $api } = useNuxtApp()
      this.is_loading = true
      try {
        const url = category
          ? `/items/catalog/${category}`
          : `/items/catalog?page=${page}&per_page=50`
        const data: any = await $api(url)
        this.catalog = data.data
        if (data.meta) this.catalog_meta = data.meta
      } finally {
        this.is_loading = false
      }
    },

    async fetchGoldShop() {
      const { $api } = useNuxtApp()
      this.is_loading = true
      try {
        const data: any = await $api('/shop/gold')
        this.gold_shop = data
      } finally {
        this.is_loading = false
      }
    },

    async equipItem(pokemon_id: string, item_id: number) {
      const { $api } = useNuxtApp()
      this.is_equipping = true
      try {
        await $api(`/player/pokemon/${pokemon_id}/equip`, {
          method: 'POST',
          body: { item_id },
        })
        // Refresh inventory after equip
        await this.fetchInventory(this.inventory_meta.page)
      } finally {
        this.is_equipping = false
      }
    },

    async unequipItem(pokemon_id: string) {
      const { $api } = useNuxtApp()
      this.is_equipping = true
      try {
        await $api(`/player/pokemon/${pokemon_id}/unequip`, { method: 'POST' })
        await this.fetchInventory(this.inventory_meta.page)
      } finally {
        this.is_equipping = false
      }
    },

    async purchaseFromGoldShop(item_id: number, quantity: number) {
      const { $api } = useNuxtApp()
      this.is_purchasing = true
      try {
        const result: any = await $api('/shop/gold/purchase', {
          method: 'POST',
          body: { item_id, quantity },
        })
        // Refresh gold shop and inventory
        await Promise.all([this.fetchGoldShop(), this.fetchInventory()])
        return result
      } finally {
        this.is_purchasing = false
      }
    },

    handleItemDrop(event: { item_id: number; item_name_fr: string; quantity: number }) {
      // Find existing item in inventory and increment, or add new entry
      const existing = this.inventory.find(i => i.item_id === event.item_id)
      if (existing) {
        existing.quantity += event.quantity
      }
      // If not in inventory, refresh on next page load (avoid full refresh every drop)
    },
  },
})
