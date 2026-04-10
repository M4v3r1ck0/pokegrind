/**
 * DungeonStore — Gestion des Donjons Ancestraux côté client.
 */
import { defineStore } from 'pinia'
import { useSocket } from '~/composables/useSocket'
import axios from 'axios'

export interface DungeonListEntry {
  id: number
  name_fr: string
  region: string
  difficulty: 'normal' | 'hard' | 'legendary'
  min_prestige: number
  boss_name_fr: string
  is_unlocked: boolean
  run_this_week: {
    status: 'completed' | 'failed' | 'active'
    completed_at?: string | null
  } | null
}

export interface DungeonModifier {
  id: number
  name_fr: string
  description_fr: string
  modifier_type: 'buff' | 'debuff' | 'neutral'
  effect_json: Record<string, unknown>
}

export interface RoomLayout {
  room_number: number
  type: 'combat' | 'elite' | 'rest' | 'treasure' | 'shop' | 'trap' | 'boss'
  completed: boolean
  result?: 'victory' | 'defeat' | 'completed' | 'skipped'
  gold_earned?: number
  item_found?: object | null
}

export interface DungeonPokemonState {
  player_pokemon_id: string
  name_fr: string
  sprite_url: string
  is_shiny: boolean
  current_hp: number
  max_hp: number
  level: number
}

export interface DungeonRun {
  run_id: string
  dungeon_id: number
  dungeon_name_fr: string
  dungeon_region: string
  dungeon_difficulty: string
  current_room: number
  status: 'active' | 'completed' | 'failed'
  rooms: RoomLayout[]
  modifiers: DungeonModifier[]
  team: DungeonPokemonState[]
  gold_collected: number
  items_collected: object[]
}

export interface DungeonReward {
  id: string
  reward_type: 'item' | 'pokemon' | 'gems' | 'ct'
  reward_data: Record<string, unknown>
  dungeon_name_fr: string
}

export interface DungeonHistoryEntry {
  id: string
  dungeon_name_fr: string
  difficulty: string
  region: string
  status: 'completed' | 'failed'
  current_room: number
  gold_collected: number
  started_at: string
  completed_at: string | null
}

export const useDungeonStore = defineStore('dungeon', {
  state: () => ({
    dungeons: [] as DungeonListEntry[],
    active_run: null as DungeonRun | null,
    current_room: null as RoomLayout | null,
    pending_rewards: [] as DungeonReward[],
    history: [] as DungeonHistoryEntry[],
    shop_items: null as object[] | null,
    loading: false,
    last_room_result: null as object | null,
    socket_connected: false,
  }),

  getters: {
    current_room_data: (state): RoomLayout | null => {
      if (!state.active_run) return null
      return state.active_run.rooms.find(
        (r) => r.room_number === state.active_run!.current_room
      ) ?? null
    },
    rooms_completed: (state): number =>
      state.active_run?.rooms.filter((r) => r.completed).length ?? 0,
    next_reset_in: (): string => {
      const now = Date.now()
      const week_ms = 7 * 24 * 60 * 60 * 1000
      const next_reset = (Math.floor(now / week_ms) + 1) * week_ms
      const diff = next_reset - now
      const days = Math.floor(diff / (24 * 60 * 60 * 1000))
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
      return `${days}j ${hours}h`
    },
  },

  actions: {
    // ── Donjons ──────────────────────────────────────────────────────────────

    async fetchDungeons() {
      try {
        const { data } = await axios.get('/api/dungeons')
        this.dungeons = data
      } catch (err) {
        console.error('[DungeonStore] fetchDungeons error:', err)
      }
    },

    // ── Run ──────────────────────────────────────────────────────────────────

    async startRun(dungeon_id: number) {
      this.loading = true
      try {
        const { data } = await axios.post(`/api/dungeons/${dungeon_id}/start`)
        this.active_run = data
        this.last_room_result = null
        return data
      } finally {
        this.loading = false
      }
    },

    async fetchCurrentRun() {
      try {
        const { data } = await axios.get('/api/dungeons/run/current')
        this.active_run = data.active ? data.run : null
      } catch (err) {
        console.error('[DungeonStore] fetchCurrentRun error:', err)
      }
    },

    async resolveRoom(run_id: string, room_number: number) {
      this.loading = true
      try {
        const { data } = await axios.post(`/api/dungeons/run/${run_id}/room/${room_number}`)
        this.last_room_result = data
        this.shop_items = data.shop_items ?? null

        // Mettre à jour le run local
        if (this.active_run) {
          if (data.run_status === 'active') {
            this.active_run.current_room = room_number + 1
            const room = this.active_run.rooms.find((r) => r.room_number === room_number)
            if (room) {
              room.completed = true
              room.result = data.result
            }
          } else {
            this.active_run.status = data.run_status
          }
          if (data.hp_restored) {
            for (const poke of this.active_run.team) {
              const h = (data.hp_restored as any)[poke.player_pokemon_id] ?? 0
              poke.current_hp = Math.min(poke.max_hp, poke.current_hp + h)
            }
          }
          if (typeof data.gold_earned === 'number') {
            this.active_run.gold_collected += data.gold_earned
          }
        }
        return data
      } finally {
        this.loading = false
      }
    },

    async buyFromShop(run_id: string, item_name: string) {
      const { data } = await axios.post(`/api/dungeons/run/${run_id}/shop/buy`, { item_name })
      if (this.active_run) {
        this.active_run.items_collected.push({ type: 'item', item_name })
      }
      return data
    },

    async abandonRun(run_id: string) {
      try {
        await axios.post(`/api/dungeons/run/${run_id}/abandon`)
        if (this.active_run) this.active_run.status = 'failed'
        this.active_run = null
      } catch (err) {
        console.error('[DungeonStore] abandonRun error:', err)
      }
    },

    // ── Récompenses ──────────────────────────────────────────────────────────

    async fetchPendingRewards() {
      try {
        const { data } = await axios.get('/api/dungeons/rewards')
        this.pending_rewards = data
      } catch (err) {
        console.error('[DungeonStore] fetchPendingRewards error:', err)
      }
    },

    async collectReward(reward_id: string) {
      await axios.post(`/api/dungeons/rewards/${reward_id}/collect`)
      this.pending_rewards = this.pending_rewards.filter((r) => r.id !== reward_id)
    },

    // ── Historique ───────────────────────────────────────────────────────────

    async fetchHistory() {
      try {
        const { data } = await axios.get('/api/dungeons/history')
        this.history = data
      } catch (err) {
        console.error('[DungeonStore] fetchHistory error:', err)
      }
    },

    // ── Socket.io ────────────────────────────────────────────────────────────

    initDungeonSocket(player_id: string) {
      const { socket } = useSocket()
      if (!socket.value) return

      socket.value.emit('dungeon:join', player_id)
      this.socket_connected = true

      socket.value.on('dungeon:run_started', (data: { run_id: string; dungeon_name_fr: string; modifiers: object[] }) => {
        console.log('[DungeonSocket] run_started', data.dungeon_name_fr)
      })

      socket.value.on('dungeon:room_entered', (data: { room_number: number; room_type: string; room_name_fr: string }) => {
        if (this.active_run) {
          this.current_room = this.active_run.rooms.find((r) => r.room_number === data.room_number) ?? null
        }
      })

      socket.value.on('dungeon:combat_result', (data: { room_number: number; result: string; run_failed?: boolean }) => {
        if (data.run_failed && this.active_run) {
          this.active_run.status = 'failed'
        }
      })

      socket.value.on('dungeon:rest', (data: { hp_restored: Record<string, number> }) => {
        if (!this.active_run) return
        for (const poke of this.active_run.team) {
          const h = data.hp_restored[poke.player_pokemon_id] ?? 0
          poke.current_hp = Math.min(poke.max_hp, poke.current_hp + h)
        }
      })

      socket.value.on('dungeon:treasure', (data: { item: object }) => {
        if (this.active_run && data.item) {
          this.active_run.items_collected.push(data.item)
        }
      })

      socket.value.on('dungeon:modifier_applied', (data: { modifier: object }) => {
        if (this.active_run) {
          this.active_run.modifiers.push(data.modifier as DungeonModifier)
        }
      })

      socket.value.on('dungeon:boss_defeated', (data: { boss_name_fr: string; rewards: object[] }) => {
        console.log('[DungeonSocket] boss_defeated:', data.boss_name_fr)
      })

      socket.value.on('dungeon:run_complete', (data: {
        dungeon_name_fr: string
        rooms_cleared: number
        gold_collected: number
        final_rewards: object[]
      }) => {
        if (this.active_run) {
          this.active_run.status = 'completed'
          this.active_run.gold_collected = data.gold_collected
        }
        this.fetchPendingRewards()
      })
    },

    disconnectDungeonSocket() {
      const { socket } = useSocket()
      if (!socket.value) return
      socket.value.off('dungeon:run_started')
      socket.value.off('dungeon:room_entered')
      socket.value.off('dungeon:combat_result')
      socket.value.off('dungeon:rest')
      socket.value.off('dungeon:treasure')
      socket.value.off('dungeon:modifier_applied')
      socket.value.off('dungeon:boss_defeated')
      socket.value.off('dungeon:run_complete')
      this.socket_connected = false
    },

    // ── Handlers directs (pour les appels API) ───────────────────────────────

    handleRoomEntered(event: { room_number: number; room_type: string }) {
      if (this.active_run) {
        this.current_room = this.active_run.rooms.find((r) => r.room_number === event.room_number) ?? null
      }
    },

    handleCombatResult(event: { result: 'victory' | 'defeat'; run_failed?: boolean }) {
      if (event.run_failed && this.active_run) {
        this.active_run.status = 'failed'
      }
    },

    handleRunComplete(event: { gold_collected: number }) {
      if (this.active_run) {
        this.active_run.status = 'completed'
        this.active_run.gold_collected = event.gold_collected
      }
    },
  },
})
