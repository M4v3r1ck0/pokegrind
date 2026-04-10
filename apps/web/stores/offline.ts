import { defineStore } from 'pinia'
import { useNuxtApp } from '#app'

export interface DropItem {
  item_name_fr: string
  quantity: number
}

export interface OfflineReport {
  id: string
  gold_earned: number
  xp_earned: number
  kills: number
  hatches: number
  drops: DropItem[]
  absence_seconds: number
  absence_formatted: string
  floor_farmed: number
  floor_name_fr: string
  created_at: string
}

export const useOfflineStore = defineStore('offline', {
  state: () => ({
    has_report: false,
    pending_report: null as OfflineReport | null,
    show_modal: false,
    history: [] as OfflineReport[],
    history_total: 0,
  }),

  actions: {
    async checkPendingReport() {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.get('/api/player/offline-report/pending')
      this.has_report = data.has_report
      this.pending_report = data.report ?? null
      if (this.has_report) this.show_modal = true
    },

    async collectReport() {
      if (!this.pending_report) return
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      await api.post('/api/player/offline-report/collect', { report_id: this.pending_report.id })
      this.has_report = false
      this.pending_report = null
      this.show_modal = false
    },

    async fetchHistory() {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.get('/api/player/offline-reports')
      this.history = data.reports ?? []
      this.history_total = data.total ?? 0
    },

    closeModal() {
      this.show_modal = false
    },
  },
})
