/**
 * useAdminApi — Wrapper axios pour les appels /api/admin/*.
 * Lit le token depuis le store auth admin.
 */
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: `${API_BASE}/admin`,
  withCredentials: true,
})

// Intercepteur : ajouter le Bearer token depuis localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Intercepteur : 401 → redirection login
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export function useAdminApi() {
  return {
    getDashboard: () => api.get('/dashboard'),
    getPlayers: (params: Record<string, any>) => api.get('/players', { params }),
    getPlayer: (id: string) => api.get(`/players/${id}`),
    banPlayer: (id: string, body: { reason: string; duration_hours?: number }) =>
      api.post(`/players/${id}/ban`, body),
    unbanPlayer: (id: string) => api.post(`/players/${id}/unban`),
    grantGems: (id: string, body: { amount: number; reason: string }) =>
      api.post(`/players/${id}/gems`, body),
    grantGold: (id: string, body: { amount: number; reason: string }) =>
      api.post(`/players/${id}/gold`, body),
    forceDisconnect: (id: string) => api.post(`/players/${id}/force-disconnect`),
    getGemsAudit: (params: Record<string, any>) => api.get('/gems-audit', { params }),
    getGemsAuditStats: () => api.get('/gems-audit/stats'),
    getAuditLog: (params: Record<string, any>) => api.get('/audit-log', { params }),
    getStatsCombat: () => api.get('/stats/combat'),
    getStatsGacha: () => api.get('/stats/gacha'),
    getStatsEconomy: () => api.get('/stats/economy'),

    // Anticheat
    getAnticheatAlerts: (params: Record<string, any>) => api.get('/anticheat/alerts', { params }),
    getAnticheatStats: () => api.get('/anticheat/stats'),
    resolveAlert: (id: string, body: { action: string; resolution_note: string }) =>
      api.post(`/anticheat/alerts/${id}/resolve`, body),

    // Events
    getEvents: () => api.get('/events'),
    createEvent: (body: Record<string, any>) => api.post('/events', body),
    updateEvent: (id: string, body: Record<string, any>) => api.put(`/events/${id}`, body),
    deleteEvent: (id: string) => api.delete(`/events/${id}`),
    getMaintenance: () => api.get('/system/status'),
    enableMaintenance: (body: { message_fr: string; duration_minutes: number }) =>
      api.post('/system/maintenance/enable', body),
    disableMaintenance: () => api.post('/system/maintenance/disable'),

    // Economy
    getEconomyOverview: () => api.get('/economy/overview'),
    getPlayerEconomy: (username_or_id: string) => api.get(`/economy/player/${username_or_id}`),

    // PvP
    getPvpSeasons: () => api.get('/pvp/seasons'),
    createPvpSeason: (body: Record<string, any>) => api.post('/pvp/seasons', body),
    endPvpSeason: (id: string) => api.post(`/pvp/seasons/${id}/end`),
    getPvpLeaderboard: (params?: Record<string, any>) => api.get('/pvp/leaderboard', { params }),

    // Battle Frontier
    getBfRotations: () => api.get('/bf/rotations'),
    createBfRotation: (body: Record<string, any>) => api.post('/bf/rotations', body),

    // Raids Mondiaux
    getRaids: () => api.get('/raids'),
    startRaid: (boss_id: number) => api.post('/raids/start', { boss_id }),
    endRaid: (id: string, reason: 'defeated' | 'expired') => api.post(`/raids/${id}/end`, { reason }),
    getRaidStats: (id: string) => api.get(`/raids/${id}/stats`),

    // Broadcast
    sendBroadcast: (body: { title_fr: string; body_fr: string; type: string }) =>
      api.post('/broadcast', body),

    // System
    getSystemStatus: () => api.get('/system/status'),

    // Auth direct (login avec le endpoint joueur)
    login: (email: string, password: string) =>
      axios.post(`${API_BASE}/auth/login`, { email, password }, { withCredentials: true }),

    // ── Config globale ─────────────────────────────────────────────────────
    getConfig: () => api.get('/config'),
    setConfig: (key: string, value: unknown) => api.put(`/config/${key}`, { value }),
    resetConfig: (key: string) => api.post(`/config/reset/${key}`),

    // ── Diagnostics système ────────────────────────────────────────────────
    getSystemHealth: () => api.get('/system/health'),
    getActiveSessions: () => api.get('/system/active-sessions'),
    flushCache: (pattern: string) => api.post(`/system/cache-flush/${pattern}`, { confirm: true }),

    // ── Export CSV ─────────────────────────────────────────────────────────
    exportPlayers: (fields?: string[]) =>
      api.get('/export/players', { params: fields ? { fields: fields.join(',') } : {}, responseType: 'blob' }),
    exportGemsAudit: (from: string, to: string) =>
      api.get('/export/gems-audit', { params: { from, to }, responseType: 'blob' }),
    exportEconomyReport: (from: string, to: string) =>
      api.get('/export/economy-report', { params: { from, to }, responseType: 'blob' }),

    // ── Rapports économiques ───────────────────────────────────────────────
    getEconomyReports: (limit?: number) =>
      api.get('/economy/reports', { params: { limit } }),

    // ── Donjons admin ──────────────────────────────────────────────────────
    getAdminDungeons: () => api.get('/dungeons'),
    toggleDungeon: (id: string) => api.post(`/dungeons/${id}/toggle`),
    getDungeonStats: () => api.get('/dungeons/stats'),

    // ── Tour Infinie admin ─────────────────────────────────────────────────
    getAdminTower: () => api.get('/tower'),
    endTowerSeason: () => api.post('/tower/season/end'),
  }
}
