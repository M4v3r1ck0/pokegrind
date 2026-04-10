/**
 * SystemStore — Gestion des broadcasts admin et des événements saisonniers.
 * Socket.io séparé du combat pour écouter les events système globaux.
 */
import { defineStore } from 'pinia'
import { io, type Socket } from 'socket.io-client'
import { useRuntimeConfig } from '#app'

export interface BroadcastMessage {
  id: string
  title_fr: string
  body_fr: string
  type: 'info' | 'warning' | 'success' | 'danger'
  received_at: number
}

export interface ActiveEvent {
  event_type: string
  name_fr: string
  multiplier: number
  ends_at: string
}

let _system_socket: Socket | null = null

export const useSystemStore = defineStore('system', {
  state: () => ({
    broadcasts: [] as BroadcastMessage[],
    active_events: [] as ActiveEvent[],
    maintenance: null as { active: boolean; message_fr?: string; ends_at?: string } | null,
  }),

  actions: {
    initSystemSocket() {
      if (!import.meta.client) return
      if (_system_socket?.connected) return

      const config = useRuntimeConfig()
      const apiBase = (config.public.apiBase as string) || 'http://localhost:3333'
      const socketUrl = apiBase.replace(/\/api$/, '')

      _system_socket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      })

      _system_socket.on('system:broadcast', (msg: Omit<BroadcastMessage, 'id' | 'received_at'>) => {
        this.broadcasts.unshift({
          id: crypto.randomUUID(),
          ...msg,
          received_at: Date.now(),
        })
        // Garder max 10 broadcasts en mémoire
        if (this.broadcasts.length > 10) {
          this.broadcasts = this.broadcasts.slice(0, 10)
        }
      })

      _system_socket.on('event:started', (ev: ActiveEvent) => {
        const idx = this.active_events.findIndex(e => e.event_type === ev.event_type)
        if (idx >= 0) {
          this.active_events[idx] = ev
        } else {
          this.active_events.push(ev)
        }
      })

      _system_socket.on('event:ended', (data: { event_type: string }) => {
        this.active_events = this.active_events.filter(e => e.event_type !== data.event_type)
      })

      _system_socket.on('prestige:complete', (event: any) => {
        // Le store prestige peut être notifié via l'event
        // (La page /jeu/prestige gère aussi directement via HTTP response)
        this.broadcasts.unshift({
          id: crypto.randomUUID(),
          title_fr: `✨ Prestige ${event.new_level} accompli !`,
          body_fr: `${event.prestige_name_fr} — +${event.gems_earned} 💎`,
          type: 'success',
          received_at: Date.now(),
        })
      })

      _system_socket.on('prestige:milestone', (event: any) => {
        this.broadcasts.unshift({
          id: crypto.randomUUID(),
          title_fr: `🏆 ${event.username} a atteint le Prestige ${event.prestige_level} !`,
          body_fr: `${event.prestige_name_fr} — félicitations !`,
          type: 'info',
          received_at: Date.now(),
        })
      })
    },

    dismissBroadcast(id: string) {
      this.broadcasts = this.broadcasts.filter(b => b.id !== id)
    },

    disconnect() {
      _system_socket?.disconnect()
      _system_socket = null
    },
  },
})
