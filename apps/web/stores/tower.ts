/**
 * TowerStore — Gestion de la Tour Infinie côté client.
 */
import { defineStore } from 'pinia'
import { useSocket } from '~/composables/useSocket'
import { useNuxtApp } from '#app'

export interface TowerStatus {
  active: boolean
  season_id?: number
  season_name_fr?: string
  season_end_at?: string
  current_floor: number
  max_floor_reached: number
  total_kills_tower: number
  gems_earned_this_season: number
  next_milestone: { floor: number; gems_reward: number; name_fr: string } | null
  next_boss: { floor: number; name_fr: string; mechanic_type: string } | null
}

export interface TowerPokemonState {
  id: string
  name_fr: string
  sprite_url: string
  is_shiny: boolean
  current_hp: number
  max_hp: number
  level: number
  status: string | null
  confusion: boolean
  moves: { name_fr: string; pp_current: number; pp_max: number; slot: number }[]
  is_clone?: boolean
}

export interface TowerSnapshot {
  floor_number: number
  season_id: number
  is_boss: boolean
  boss_mechanic_type: string | null
  boss_timer_remaining_ms: number | null
  player_team: TowerPokemonState[]
  enemy_team: TowerPokemonState[]
  session_active: boolean
}

export interface TowerAction {
  attacker_id: string
  move_name_fr: string
  target_id: string
  damage: number
  is_critical: boolean
  effectiveness: number
  target_hp_remaining: number
  target_hp_max: number
  status_applied?: string
  reflected_damage?: number
}

export interface TowerMilestone {
  floor_number: number
  gems_reward: number
  name_fr: string
}

export interface TowerBoss {
  floor_number: number
  name_fr: string
  description_fr: string | null
  mechanic_type: string
  gems_reward: number
}

export interface TowerLeaderboardEntry {
  rank: number
  username: string
  max_floor: number
  updated_at: string
}

export const useTowerStore = defineStore('tower', {
  state: () => ({
    status: null as TowerStatus | null,
    snapshot: null as TowerSnapshot | null,
    combat_log: [] as TowerAction[],
    milestones: [] as TowerMilestone[],
    bosses: [] as TowerBoss[],
    leaderboard: [] as TowerLeaderboardEntry[],
    loading: false,
    session_active: false,
    boss_timer_remaining_ms: null as number | null,
    last_event: null as string | null,
    socket_connected: false,
  }),

  getters: {
    current_floor: (state) => state.status?.current_floor ?? 1,
    is_boss_floor: (state) => (state.status?.current_floor ?? 1) % 25 === 0,
    next_boss_floor: (state) => {
      const floor = state.status?.current_floor ?? 1
      return Math.ceil(floor / 25) * 25
    },
    progress_to_next_milestone: (state) => {
      const current = state.status?.current_floor ?? 1
      const next = state.status?.next_milestone
      if (!next) return 100
      const prev_milestone = state.milestones
        .filter((m) => m.floor_number < next.floor)
        .at(-1)?.floor_number ?? 0
      const range = next.floor - prev_milestone
      const progress = current - prev_milestone
      return Math.min(100, Math.round((progress / range) * 100))
    },
  },

  actions: {
    // ── Statut ──────────────────────────────────────────────────────────────

    async fetchStatus() {
      try {
        const { data } = await (useNuxtApp() as any).$api.get('/tower/status')
        this.status = data
      } catch (err) {
        console.error('[TowerStore] fetchStatus error:', err)
      }
    },

    // ── Combat ──────────────────────────────────────────────────────────────

    async startSession() {
      const api = (useNuxtApp() as any).$api
      this.loading = true
      try {
        const { data } = await api.post('/tower/start')
        this.snapshot = data.snapshot
        this.session_active = true
        this.combat_log = []
        return data
      } finally {
        this.loading = false
      }
    },

    async stopSession() {
      try {
        await (useNuxtApp() as any).$api.post('/tower/stop')
        this.session_active = false
        this.snapshot = null
      } catch (err) {
        console.error('[TowerStore] stopSession error:', err)
      }
    },

    async abandonSession() {
      try {
        await (useNuxtApp() as any).$api.post('/tower/abandon')
        this.session_active = false
        this.snapshot = null
        if (this.status) this.status.current_floor = 1
      } catch (err) {
        console.error('[TowerStore] abandonSession error:', err)
      }
    },

    async fetchState() {
      try {
        const { data } = await (useNuxtApp() as any).$api.get('/tower/state')
        this.session_active = data.active
        if (data.snapshot) {
          this.snapshot = data.snapshot
        }
      } catch (err) {
        console.error('[TowerStore] fetchState error:', err)
      }
    },

    // ── Catalogue ───────────────────────────────────────────────────────────

    async fetchMilestones() {
      if (this.milestones.length > 0) return
      try {
        const { data } = await (useNuxtApp() as any).$api.get('/tower/milestones')
        this.milestones = data
      } catch (err) {
        console.error('[TowerStore] fetchMilestones error:', err)
      }
    },

    async fetchBosses() {
      if (this.bosses.length > 0) return
      try {
        const { data } = await (useNuxtApp() as any).$api.get('/tower/bosses')
        this.bosses = data
      } catch (err) {
        console.error('[TowerStore] fetchBosses error:', err)
      }
    },

    async fetchLeaderboard() {
      try {
        const { data } = await (useNuxtApp() as any).$api.get('/tower/leaderboard')
        this.leaderboard = data.leaderboard ?? []
      } catch (err) {
        console.error('[TowerStore] fetchLeaderboard error:', err)
      }
    },

    // ── Socket.io ────────────────────────────────────────────────────────────

    initTowerSocket(player_id: string) {
      const { socket } = useSocket()
      if (!socket.value) return

      socket.value.emit('tower:join', player_id)
      this.socket_connected = true

      socket.value.on('tower:full_state', (snapshot: TowerSnapshot | null) => {
        if (snapshot) {
          this.snapshot = snapshot
          this.session_active = snapshot.session_active
          this.boss_timer_remaining_ms = snapshot.boss_timer_remaining_ms
        }
      })

      socket.value.on('tower:action', (action: TowerAction) => {
        // Mettre à jour les HP dans le snapshot
        if (this.snapshot) {
          const updateHp = (team: TowerPokemonState[]) => {
            const target = team.find((p) => p.id === action.target_id)
            if (target) {
              target.current_hp = action.target_hp_remaining
            }
          }
          updateHp(this.snapshot.player_team)
          updateHp(this.snapshot.enemy_team)
        }
        this.combat_log.unshift(action)
        if (this.combat_log.length > 50) this.combat_log.pop()
      })

      socket.value.on('tower:ko', ({ pokemon_id, is_enemy }: { pokemon_id: string; is_enemy: boolean }) => {
        if (!this.snapshot) return
        const team = is_enemy ? this.snapshot.enemy_team : this.snapshot.player_team
        const poke = team.find((p) => p.id === pokemon_id)
        if (poke) poke.current_hp = 0
      })

      socket.value.on('tower:victory', async (data: { floor_number: number; gold_earned: number; xp_earned: number; next_floor: number }) => {
        this.last_event = `Étage ${data.floor_number} cleared ! +${data.gold_earned} or, +${data.xp_earned} XP`
        this.session_active = false
        await this.fetchStatus()
      })

      socket.value.on('tower:defeat', () => {
        this.last_event = 'Équipe KO — Retour à l\'étage 1'
        this.session_active = false
        if (this.status) this.status.current_floor = 1
      })

      socket.value.on('tower:boss_timeout', () => {
        this.last_event = 'Temps écoulé — Retour à l\'étage 1'
        this.session_active = false
        if (this.status) this.status.current_floor = 1
      })

      socket.value.on('tower:milestone', (data: { floor_number: number; milestone_name_fr: string; gems_reward: number }) => {
        this.last_event = `Palier ${data.floor_number} atteint ! +${data.gems_reward} gems (${data.milestone_name_fr})`
      })

      socket.value.on('tower:boss_reward', (data: { floor_number: number; boss_name_fr: string; gems_reward: number }) => {
        this.last_event = `Boss vaincu : ${data.boss_name_fr} ! +${data.gems_reward} gems`
      })

      socket.value.on('tower:boss_berserk', (data: { speed_mult: number; message: string }) => {
        this.last_event = data.message
      })

      socket.value.on('tower:boss_reflect', (data: { target_id: string; damage: number; hp_remaining: number; hp_max: number }) => {
        if (!this.snapshot) return
        const poke = this.snapshot.player_team.find((p) => p.id === data.target_id)
        if (poke) poke.current_hp = data.hp_remaining
      })

      socket.value.on('tower:boss_regen', (data: { pokemon_id: string; heal_amount: number; hp_remaining: number; hp_max: number }) => {
        if (!this.snapshot) return
        const poke = this.snapshot.enemy_team.find((p) => p.id === data.pokemon_id)
        if (poke) poke.current_hp = data.hp_remaining
      })

      socket.value.on('tower:boss_clone', (data: { clone_count: number; message: string }) => {
        this.last_event = data.message
      })

      socket.value.on('tower:status', (data: { pokemon_id: string; status_type: string }) => {
        if (!this.snapshot) return
        const all = [...this.snapshot.player_team, ...this.snapshot.enemy_team]
        const poke = all.find((p) => p.id === data.pokemon_id)
        if (poke) poke.status = data.status_type
      })
    },

    disconnectSocket(player_id: string) {
      const { socket } = useSocket()
      if (!socket.value) return
      socket.value.off('tower:full_state')
      socket.value.off('tower:action')
      socket.value.off('tower:ko')
      socket.value.off('tower:victory')
      socket.value.off('tower:defeat')
      socket.value.off('tower:boss_timeout')
      socket.value.off('tower:milestone')
      socket.value.off('tower:boss_reward')
      socket.value.off('tower:boss_berserk')
      socket.value.off('tower:boss_reflect')
      socket.value.off('tower:boss_regen')
      socket.value.off('tower:boss_clone')
      socket.value.off('tower:status')
      this.socket_connected = false
    },
  },
})
