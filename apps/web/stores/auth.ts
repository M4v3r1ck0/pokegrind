import { defineStore } from 'pinia'

export interface Player {
  id: string
  username: string
  email: string
  discord_id: string | null
  gems: number
  gold: number
  frontier_points: number
  current_floor: number
  created_at: string
  upgrades: string[]
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    player: null as Player | null,
    accessToken: null as string | null,
    isAuthenticated: false,
  }),

  actions: {
    async login(email: string, password: string) {
      const api = useApi()
      const data = await api<{ access_token: string; player: Player }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        credentials: 'include',
      })
      this.accessToken = data.access_token
      this.player = data.player
      this.isAuthenticated = true
      return data
    },

    async register(username: string, email: string, password: string, starterId: number) {
      const api = useApi()
      const data = await api<{ access_token: string; player: Player }>('/auth/register', {
        method: 'POST',
        body: { username, email, password, starter_id: starterId },
        credentials: 'include',
      })
      this.accessToken = data.access_token
      this.player = data.player
      this.isAuthenticated = true
      return data
    },

    loginWithDiscord() {
      const { public: { apiBase } } = useRuntimeConfig()
      window.location.href = `${apiBase}/auth/discord`
    },

    async logout() {
      try {
        const api = useApi()
        await api('/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {},
        })
      } catch {
        // ignore
      }
      this.clearSession()
    },

    async refreshToken() {
      const api = useApi()
      const data = await api<{ access_token: string }>('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      this.accessToken = data.access_token
      return data
    },

    async fetchMe() {
      if (!this.accessToken) return
      const api = useApi()
      const data = await api<Player>('/auth/me', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      this.player = data
      this.isAuthenticated = true
      return data
    },

    setTokenFromUrl(token: string) {
      this.accessToken = token
      this.isAuthenticated = true
    },

    clearSession() {
      this.player = null
      this.accessToken = null
      this.isAuthenticated = false
    },
  },

  persist: import.meta.client ? {
    storage: localStorage,
    pick: ['accessToken', 'isAuthenticated', 'player'],
  } : false,
})
