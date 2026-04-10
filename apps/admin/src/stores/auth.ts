import { defineStore } from 'pinia'
import axios from 'axios'

export const useAdminAuthStore = defineStore('adminAuth', {
  state: () => ({
    token: localStorage.getItem('admin_token') as string | null,
    username: localStorage.getItem('admin_username') as string | null,
    role: localStorage.getItem('admin_role') as string | null,
    isAuthenticated: !!localStorage.getItem('admin_token'),
  }),

  actions: {
    async login(email: string, password: string) {
      const { data } = await axios.post('/api/auth/login', { email, password }, {
        withCredentials: true,
      })
      const allowed = ['admin', 'mod', 'support']
      if (!allowed.includes(data.player?.role)) {
        throw new Error('Accès refusé : rôle insuffisant')
      }
      this.token = data.access_token
      this.username = data.player.username
      this.role = data.player.role
      this.isAuthenticated = true
      localStorage.setItem('admin_token', data.access_token)
      localStorage.setItem('admin_username', data.player.username)
      localStorage.setItem('admin_role', data.player.role)
    },

    logout() {
      this.token = null
      this.username = null
      this.role = null
      this.isAuthenticated = false
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_username')
      localStorage.removeItem('admin_role')
    },
  },
})
