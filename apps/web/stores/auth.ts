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

const TOKEN_KEY = 'pg_access_token'

function readStoredToken(): string | null {
  if (!import.meta.client) return null
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function saveToken(token: string) {
  if (!import.meta.client) return
  try { localStorage.setItem(TOKEN_KEY, token) } catch {}
}

function removeToken() {
  if (!import.meta.client) return
  try { localStorage.removeItem(TOKEN_KEY) } catch {}
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    player: null as Player | null,
    accessToken: readStoredToken(),
    isAuthenticated: !!readStoredToken(),
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
      saveToken(data.access_token)
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
      saveToken(data.access_token)
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
      saveToken(data.access_token)
      return data
    },

    async fetchMe() {
      const token = this.accessToken ?? readStoredToken()
      if (!token) return
      const api = useApi()
      const data = await api<Player>('/auth/me', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      this.accessToken = token
      this.player = data
      this.isAuthenticated = true
      saveToken(token)
      return data
    },

    setTokenFromUrl(token: string) {
      this.accessToken = token
      this.isAuthenticated = true
      saveToken(token)
    },

    clearSession() {
      this.player = null
      this.accessToken = null
      this.isAuthenticated = false
      removeToken()
    },
  },
})
