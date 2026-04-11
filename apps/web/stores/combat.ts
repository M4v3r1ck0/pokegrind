import { defineStore } from 'pinia'
import { io, type Socket } from 'socket.io-client'
import { useNuxtApp, useRuntimeConfig } from '#app'

// Module-level socket reference to survive store resets
let _socket: Socket | null = null

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CombatMoveState {
  name_fr: string
  pp_current: number
  pp_max: number
  slot: number
}

export interface CombatPokemonState {
  id: string
  name_fr: string
  sprite_url: string
  is_shiny: boolean
  current_hp: number
  max_hp: number
  level: number
  status: string | null
  confusion: boolean
  moves: CombatMoveState[]
  xp?: number
  xp_to_next?: number
}

export interface CombatLogEntry {
  id: number
  message: string
  type: 'action' | 'ko' | 'victory' | 'defeat' | 'status' | 'info' | 'new_floor' | 'timeout'
  effectiveness?: number
  timestamp: number
}

export interface FloorInfo {
  floor_number: number
  floor_name_fr: string
  region: string
}

// ─── Store ───────────────────────────────────────────────────────────────────

let _logId = 0

export const useCombatStore = defineStore('combat', {
  state: () => ({
    floor: null as FloorInfo | null,
    battle_number: 0,
    is_boss: false,
    boss_timer_remaining_ms: null as number | null,
    player_team: [] as CombatPokemonState[],
    enemy_team: [] as CombatPokemonState[],
    combat_log: [] as CombatLogEntry[],
    is_connected: false,
    session_active: false,
    gold: 0,
    total_gold_earned_session: 0,

    boss_trainer_name: null as string | null,

    // Boss timer interval
    _boss_timer_interval: null as ReturnType<typeof setInterval> | null,
  }),

  actions: {
    // ── Connexion Socket.io ──────────────────────────────────────────────
    initCombat(player_id: string) {
      if (!import.meta.client) return

      // Guard : éviter la double-initialisation (HMR, navigation, layout + page)
      if (_socket !== null) return

      const config = useRuntimeConfig()
      const apiBase = (config.public.apiBase as string) || 'http://localhost:3333'
      // Retirer le /api si présent pour l'URL de socket
      const socketUrl = apiBase.replace(/\/api$/, '')

      const socket: Socket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      })

      socket.on('connect', () => {
        this.is_connected = true
        socket.emit('combat:join', player_id)
      })

      socket.on('disconnect', () => {
        this.is_connected = false
      })

      socket.on('combat:full_state', (state: any) => {
        if (!state) return
        this.applyFullState(state)
      })

      socket.on('combat:action', (event: any) => {
        this.handleCombatAction(event)
      })

      socket.on('combat:ko', (event: any) => {
        this.handleKO(event)
      })

      socket.on('combat:victory', (event: any) => {
        this.handleVictory(event)
      })

      socket.on('combat:defeat', (event: any) => {
        this.addLog(`💀 ${event.message}`, 'defeat')
      })

      socket.on('combat:boss_timeout', (event: any) => {
        this.addLog(`⏰ ${event.message}`, 'timeout')
        this.is_boss = false
        this.boss_timer_remaining_ms = null
      })

      socket.on('combat:new_floor', (event: any) => {
        this.floor = {
          floor_number: event.floor_number,
          floor_name_fr: event.floor_name_fr,
          region: event.region,
        }
        const gemsMsg = event.gems_earned ? ` (+${event.gems_earned} 💎)` : ''
        const milestoneMsg = event.is_milestone ? ' 🏆 MILESTONE !' : ''
        this.addLog(
          `✨ Nouvel étage : ${event.floor_name_fr}${gemsMsg}${milestoneMsg}`,
          'new_floor'
        )
      })

      socket.on('combat:status', (event: any) => {
        this.addLog(`🌀 ${event.pokemon_id} → ${event.status_type}`, 'status')
      })

      socket.on('combat:status_damage', (event: any) => {
        this.updateHP(event.pokemon_id, event.hp_remaining, event.hp_max)
      })

      socket.on('combat:level_up', (event: any) => {
        const name = this.getPokemonName(event.pokemon_id)
        this.addLog(`⬆️ ${name} monte au niveau ${event.new_level} !`, 'info')
        const pokemon = this.player_team.find((p) => p.id === event.pokemon_id)
        if (pokemon) {
          pokemon.level = event.new_level
          if (event.xp !== undefined) pokemon.xp = event.xp
          if (event.xp_to_next !== undefined) pokemon.xp_to_next = event.xp_to_next
        }
      })

      socket.on('combat:xp_update', (event: any) => {
        const pokemon = this.player_team.find((p) => p.id === event.pokemon_id)
        if (pokemon) {
          if (event.xp !== undefined) pokemon.xp = event.xp
          if (event.xp_to_next !== undefined) pokemon.xp_to_next = event.xp_to_next
        }
      })

      // Stocker la référence module-level pour le guard
      _socket = socket

      // Stocker la socket dans la nuxtApp pour pouvoir l'utiliser ailleurs
      const nuxtApp = useNuxtApp()
      nuxtApp.provide('socket', socket)
    },

    // ── Nettoyage Socket.io ──────────────────────────────────────────────
    destroyCombat() {
      if (_socket) {
        _socket.removeAllListeners()
        _socket.disconnect()
        _socket = null
      }
      this.is_connected = false
      this.session_active = false
    },

    // ── Application de l'état complet (reconnexion) ──────────────────────
    applyFullState(state: any) {
      this.floor = {
        floor_number: state.floor_number,
        floor_name_fr: state.floor_name_fr,
        region: state.region,
      }
      this.battle_number = state.battle_number
      this.is_boss = state.is_boss
      this.boss_timer_remaining_ms = state.boss_timer_remaining_ms
      this.boss_trainer_name = state.boss_trainer_name ?? null
      this.player_team = state.player_team ?? []
      this.enemy_team = state.enemy_team ?? []
      this.session_active = state.session_active

      if (state.is_boss && state.boss_timer_remaining_ms) {
        this.startBossTimer()
      }
    },

    // ── Action de combat ──────────────────────────────────────────────────
    handleCombatAction(event: any) {
      // 1. Mettre à jour HP et PP immédiatement (déclenche l'animation CSS)
      this.updateHP(event.target_id, event.target_hp_remaining, event.target_hp_max)
      this.decrementPP(event.attacker_id, event.move_name_fr)

      // 2. Afficher le log avec un micro-délai (laisse l'animation HP démarrer)
      const msg = this.buildActionMessage(event)
      setTimeout(() => {
        this.addLog(msg, 'action', event.effectiveness)
      }, 80)
    },

    buildActionMessage(event: any): string {
      let msg = `${this.getPokemonName(event.attacker_id)} utilise ${event.move_name_fr}`
      if (event.damage > 0) {
        msg += ` → ${event.damage} dégâts`
        if (event.effectiveness === 2 || event.effectiveness === 4) msg += ' ✨ super efficace !'
        else if (event.effectiveness === 0.5 || event.effectiveness === 0.25) msg += ' peu efficace...'
        else if (event.effectiveness === 0) msg += ' sans effet'
        if (event.is_critical) msg += ' 💥 CRITIQUE !'
      }
      if (event.status_applied) msg += ` [${event.status_applied}]`
      return msg
    },

    handleKO(event: any) {
      this.updateHP(event.pokemon_id, 0, null)
      const name = this.getPokemonName(event.pokemon_id)
      this.addLog(`☠️ ${name} est K.O. !`, 'ko')
    },

    handleVictory(event: any) {
      this.battle_number = event.next_battle
      this.is_boss = event.is_boss_next
      this.total_gold_earned_session += event.gold_earned
      const msg = `✅ Victoire ! +${event.gold_earned} or | Combat ${event.next_battle}/10${event.is_boss_next ? ' (BOSS !)' : ''}`
      this.addLog(msg, 'victory')
      if (event.boss_trainer_name) {
        this.addLog(`🏆 ${event.boss_trainer_name} est vaincu !`, 'victory')
      }
    },

    // ── Helpers UI ────────────────────────────────────────────────────────
    updateHP(pokemon_id: string, hp: number, hp_max: number | null) {
      const allPokemon = [...this.player_team, ...this.enemy_team]
      const pokemon = allPokemon.find((p) => p.id === pokemon_id)
      if (pokemon) {
        pokemon.current_hp = hp
        if (hp_max !== null) pokemon.max_hp = hp_max
      }
    },

    decrementPP(attacker_id: string, move_name_fr: string) {
      const pokemon = this.player_team.find((p) => p.id === attacker_id)
      if (!pokemon) return
      const move = pokemon.moves.find((m) => m.name_fr === move_name_fr)
      if (move && move.pp_current > 0) move.pp_current -= 1
    },

    getPokemonName(id: string): string {
      const all = [...this.player_team, ...this.enemy_team]
      return all.find((p) => p.id === id)?.name_fr ?? id
    },

    addLog(message: string, type: CombatLogEntry['type'], effectiveness?: number) {
      this.combat_log.push({
        id: _logId++,
        message,
        type,
        effectiveness,
        timestamp: Date.now(),
      })
      // Garder max 100 entrées (FIFO)
      if (this.combat_log.length > 100) {
        this.combat_log.shift()
      }
    },

    startBossTimer() {
      if (this._boss_timer_interval) clearInterval(this._boss_timer_interval)
      this._boss_timer_interval = setInterval(() => {
        if (this.boss_timer_remaining_ms === null) {
          clearInterval(this._boss_timer_interval!)
          return
        }
        this.boss_timer_remaining_ms = Math.max(0, this.boss_timer_remaining_ms - 100)
        if (this.boss_timer_remaining_ms <= 0) {
          clearInterval(this._boss_timer_interval!)
          this.boss_timer_remaining_ms = null
        }
      }, 100)
    },

    // ── Action HTTP : changer d'étage ────────────────────────────────────
    async moveToFloor(floor_number: number) {
      const nuxtApp = useNuxtApp()
      const api = nuxtApp.$api as any
      const { data } = await api.post('/combat/move-to-floor', { floor_number })
      this.applyFullState(data)
    },
  },
})
