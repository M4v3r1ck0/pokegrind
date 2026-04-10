import { defineStore } from 'pinia'
import axios from 'axios'

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
      const { data } = await axios.post('/api/auth/login', { email, password }, {
        withCredentials: true,
      })
      this.accessToken = data.access_token
      this.player = data.player
      this.isAuthenticated = true
      return data
    },

    async register(username: string, email: string, password: string, starterId: number) {
      const { data } = await axios.post('/api/auth/register', {
        username,
        email,
        password,
        starter_id: starterId,
      }, { withCredentials: true })
      this.accessToken = data.access_token
      this.player = data.player
      this.isAuthenticated = true
      return data
    },

    loginWithDiscord() {
      window.location.href = '/api/auth/discord'
    },

    async logout() {
      try {
        await axios.post('/api/auth/logout', {}, {
          withCredentials: true,
          headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {},
        })
      } catch {
        // ignore
      }
      this.clearSession()
    },

    async refreshToken() {
      const { data } = await axios.post('/api/auth/refresh', {}, {
        withCredentials: true,
      })
      this.accessToken = data.access_token
      return data
    },

    async fetchMe() {
      if (!this.accessToken) return
      const { data } = await axios.get('/api/auth/me', {
        withCredentials: true,
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
