/**
 * CombatSession — Gère une session de combat idle pour un joueur.
 * Tick toutes les 100ms. Émet les événements Socket.io.
 */

import type { Server as SocketServer } from 'socket.io'
import db from '@adonisjs/lucid/services/db'
import type { CombatPokemon, CombatMove } from '#services/CombatService'
import {
  calcDamage,
  applyStatusBeforeAction,
  applyStatus,
  applyConfusion,
  selectNextMove,
  calcActionDelay,
} from '#services/CombatService'
import {
  applyItemAfterAction,
  applyItemOnHitReceived,
  getChoiceLockMove,
} from '#services/ItemService'
import {
  canMegaEvolve,
  selectMegaEvolution,
  applyMegaEvolution,
  type MegaEvolutionData,
} from '#services/MegaEvolutionService'
import type { Floor } from '#models/floor'

export interface CombatAction {
  attacker_id: string
  move_name_fr: string
  target_id: string
  damage: number
  is_critical: boolean
  effectiveness: number
  target_hp_remaining: number
  target_hp_max: number
  status_applied?: string
  stat_change?: { stat: string; stages: number }
}

export type CombatSessionState = 'fighting' | 'victory' | 'defeat' | 'boss_timeout' | 'idle'

export interface SessionSnapshot {
  floor_number: number
  floor_name_fr: string
  region: string
  battle_number: number
  is_boss: boolean
  boss_timer_remaining_ms: number | null
  player_team: CombatPokemonState[]
  enemy_team: CombatPokemonState[]
  session_active: boolean
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
  moves: { name_fr: string; pp_current: number; pp_max: number; slot: number }[]
  xp?: number
  xp_to_next?: number
}

export default class CombatSession {
  readonly player_id: string
  floor: Floor
  battle_number: number = 1
  player_team: CombatPokemon[]
  enemy_team: CombatPokemon[] = []
  is_boss: boolean = false
  boss_timer_ms: number = 90_000
  boss_started_at: number = 0
  state: CombatSessionState = 'idle'
  gold_pending: number = 0
  xp_pending: number = 0
  readonly socket_room: string
  readonly io: SocketServer
  private tick_interval: NodeJS.Timeout | null = null

  // Dégâts infligés par l'équipe joueur pendant la bataille courante
  private battle_damage_dealt: number = 0

  // Méga-Évolution : une seule par combat (au premier tick du combat)
  private mega_evolved_this_battle: boolean = false
  private mega_data_cache: any[] | null = null

  // Callback pour les récompenses (injection depuis CombatProgressionService)
  onVictoryBattle?: (gold: number, xp: number) => void
  onBossDefeated?: (floor_number: number) => Promise<void>
  onFloorAdvance?: (floor_number: number) => Promise<Floor | null>
  // Callback daycare : distribue les dégâts et retourne les slots prêts
  onDaycareDistribute?: (damage: number) => Promise<{ slot_number: number; pokemon_name_fr: string }[]>
  // Callback auto-hatch : éclosion automatique si auto_collect actif
  onDaycareAutoHatch?: (slot_number: number) => Promise<void>

  constructor(params: {
    player_id: string
    floor: Floor
    player_team: CombatPokemon[]
    io: SocketServer
  }) {
    this.player_id = params.player_id
    this.floor = params.floor
    this.player_team = params.player_team
    this.io = params.io
    this.socket_room = `combat:${params.player_id}`
  }

  // ─── Démarrage ────────────────────────────────────────────────────────────

  start(): void {
    this.loadBattle(this.battle_number)
    this.state = 'fighting'
    this.scheduleTick()
  }

  stop(): void {
    if (this.tick_interval) {
      clearInterval(this.tick_interval)
      this.tick_interval = null
    }
    this.state = 'idle'
  }

  // ─── Chargement d'une bataille ────────────────────────────────────────────

  private loadBattle(battleNum: number): void {
    this.battle_number = battleNum
    this.is_boss = battleNum === 10
    this.battle_damage_dealt = 0

    // Restaurer les HP de l'équipe joueur entre les batailles (idle game)
    for (const p of this.player_team) {
      p.current_hp = p.max_hp
      p.status = null
      p.confusion = null
      p.stat_modifiers = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 }
      // Reset item runtime state
      p.item_used = false
      p.air_balloon_intact = p.equipped_item?.effect_type === 'air_balloon'
      p.actions_taken = 0
      p.choice_locked_move = null
      // Reset mega state (revert to base form each battle)
      p.is_mega_evolved = false
    }
    this.mega_evolved_this_battle = false

    if (this.is_boss) {
      this.enemy_team = this.buildBossTeam()
      this.boss_started_at = Date.now()
    } else {
      this.enemy_team = this.buildRandomEnemyTeam()
    }

    // Initialiser les timers d'action
    const now = Date.now()
    for (const p of [...this.player_team, ...this.enemy_team]) {
      p.next_action_at = now + calcActionDelay(p)
      p.current_move_index = 0
      p.pp_remaining = p.moves.map((m) => m.pp)
    }
  }

  // ─── Construction des équipes ennemies ───────────────────────────────────

  private buildRandomEnemyTeam(): CombatPokemon[] {
    // Génère 1-3 ennemis aléatoires selon le niveau de l'étage
    const count = 1 + Math.floor(Math.random() * 3)
    const enemies: CombatPokemon[] = []

    for (let i = 0; i < count; i++) {
      const level =
        this.floor.minLevel + Math.floor(Math.random() * (this.floor.maxLevel - this.floor.minLevel + 1))
      enemies.push(this.buildGenericEnemy(`enemy_${i}`, level, i))
    }
    return enemies
  }

  private buildBossTeam(): CombatPokemon[] {
    if (!this.floor.bossTeam || this.floor.bossTeam.length === 0) {
      return this.buildRandomEnemyTeam()
    }

    return this.floor.bossTeam.map((entry, i) => {
      return this.buildGenericEnemy(`boss_${i}`, entry.level, i)
    })
  }

  private buildGenericEnemy(id: string, level: number, index: number): CombatPokemon {
    // Ennemi générique basé sur le niveau de l'étage
    const hp_base = 45 + level
    const atk_base = 35 + Math.floor(level * 0.8)
    const def_base = 35 + Math.floor(level * 0.7)
    const speed_base = 40 + Math.floor(level * 0.5)

    const max_hp = Math.floor(((2 * hp_base + 15) * level) / 100) + level + 10
    const effective_stat = Math.floor((Math.floor(((2 * atk_base + 15) * level) / 100) + 5) * 1.0)

    const types = this.floor.enemyTypes as string[]
    const type1 = (types[index % types.length] ?? 'normal') as CombatPokemon['type1']

    return {
      id,
      species_id: 0,
      name_fr: `Ennemi Niv.${level}`,
      level,
      nature: 'hardy',
      ivs: { hp: 15, atk: 15, def: 15, spatk: 15, spdef: 15, speed: 15 },
      type1,
      type2: null,
      base_hp: hp_base,
      base_atk: atk_base,
      base_def: def_base,
      base_spatk: atk_base,
      base_spdef: def_base,
      base_speed: speed_base,
      moves: [this.buildBasicMove(type1, level)],
      sprite_url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${(index % 151) + 1 + Math.floor(level / 10)}.png`,
      is_shiny: false,
      max_hp,
      current_hp: max_hp,
      effective_atk: effective_stat,
      effective_def: effective_stat,
      effective_spatk: effective_stat,
      effective_spdef: effective_stat,
      effective_speed: Math.floor((Math.floor(((2 * speed_base + 15) * level) / 100) + 5) * 1.0),
      status: null,
      confusion: null,
      stat_modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 },
      current_move_index: 0,
      pp_remaining: [35],
      next_action_at: 0,
    }
  }

  private buildBasicMove(type: string, level: number): CombatMove {
    const power = Math.min(150, 40 + Math.floor(level * 0.8))
    return {
      id: 0,
      name_fr: 'Attaque',
      type: type as CombatPokemon['type1'],
      category: 'physical',
      power,
      accuracy: 100,
      pp: 35,
      priority: 0,
      effect: null,
    }
  }

  // ─── Tick principal ───────────────────────────────────────────────────────

  private scheduleTick(): void {
    this.tick_interval = setInterval(() => this.tick(), 100)
  }

  private tick(): void {
    if (this.state !== 'fighting') return

    const now = Date.now()

    // Boss timeout
    if (this.is_boss && now - this.boss_started_at > this.boss_timer_ms) {
      this.handleBossTimeout()
      return
    }

    // Méga-Évolution au premier tick du combat (async fire-and-forget)
    if (!this.mega_evolved_this_battle) {
      this.triggerMegaEvolutionsIfEligible().catch(() => {})
    }

    // Récupérer tous les Pokémon vivants prêts à agir, triés par Speed décroissante
    const ready = this.getReadyPokemon(now)
    for (const pokemon of ready) {
      if (this.state !== 'fighting') break
      this.executeAction(pokemon)
    }

    // Vérifier la fin du combat
    if (this.state !== 'fighting') return
    if (this.allEnemiesDead()) {
      this.handleVictory().catch((err) => console.error('[CombatSession] handleVictory error:', err))
    } else if (this.allPlayerPokemonDead()) {
      this.handleDefeat()
    }
  }

  private getReadyPokemon(now: number): CombatPokemon[] {
    return [...this.player_team, ...this.enemy_team]
      .filter((p) => p.current_hp > 0 && p.next_action_at <= now)
      .sort((a, b) => b.effective_speed - a.effective_speed)
  }

  // ─── Exécution d'une action ───────────────────────────────────────────────

  private executeAction(pokemon: CombatPokemon): void {
    // 1. Effets de statut
    const statusResult = applyStatusBeforeAction(pokemon)
    if (statusResult.damage_taken > 0) {
      this.io.to(this.socket_room).emit('combat:status_damage', {
        pokemon_id: pokemon.id,
        damage: statusResult.damage_taken,
        hp_remaining: pokemon.current_hp,
        hp_max: pokemon.max_hp,
      })
    }

    // Pokémon KO par statut
    if (pokemon.current_hp <= 0) {
      this.emitKO(pokemon)
      pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
      return
    }

    // 2. Skip si statut bloque l'action
    if (statusResult.should_skip) {
      pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
      return
    }

    // 3. Sélectionner la cible
    const targets = this.isPlayerPokemon(pokemon) ? this.enemy_team : this.player_team
    const aliveTargets = targets.filter((t) => t.current_hp > 0)
    if (aliveTargets.length === 0) return

    // 4. Sélectionner le move
    const { move, index } = selectNextMove(pokemon)

    // 5. Sélectionner cible
    const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]

    // 6. Move de statut : appliquer l'effet sans dégâts
    if (move.category === 'status') {
      if (index !== -1 && pokemon.pp_remaining[index] > 0) {
        pokemon.pp_remaining[index] -= 1
      }
      this.applyMoveEffect(pokemon, target, move, 0)
      pokemon.current_move_index = index !== -1 ? (index + 1) % pokemon.moves.length : 0
      pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
      // Émettre le move de statut pour qu'il apparaisse dans le journal
      this.io.to(this.socket_room).emit('combat:action', {
        attacker_id: pokemon.id,
        move_name_fr: move.name_fr,
        target_id: target.id,
        damage: 0,
        is_critical: false,
        effectiveness: 1,
        target_hp_remaining: target.current_hp,
        target_hp_max: target.max_hp,
        status_applied: move.effect?.effect_type ?? null,
      })
      return
    }

    // 7. Calculer les dégâts
    const result = calcDamage(pokemon, target, move)
    target.current_hp = Math.max(0, target.current_hp - result.damage)

    // Accumuler les dégâts infligés par l'équipe joueur (pour la pension)
    if (this.isPlayerPokemon(pokemon) && result.damage > 0) {
      this.battle_damage_dealt += result.damage
    }

    // 8. Décrémenter PP
    if (index !== -1 && pokemon.pp_remaining[index] > 0) {
      pokemon.pp_remaining[index] -= 1
    }

    // 9. Avancer l'index de move
    if (index !== -1) {
      pokemon.current_move_index = (index + 1) % pokemon.moves.length
    }

    // 11. Émettre l'action
    const action: CombatAction = {
      attacker_id: pokemon.id,
      move_name_fr: move.name_fr,
      target_id: target.id,
      damage: result.damage,
      is_critical: result.is_critical,
      effectiveness: result.effectiveness,
      target_hp_remaining: target.current_hp,
      target_hp_max: target.max_hp,
    }

    // 12. Appliquer effets du move (statut, changement de stat)
    if (result.damage > 0 && move.effect) {
      const effectText = this.applyMoveEffect(pokemon, target, move, result.effectiveness)
      if (effectText.status_applied) action.status_applied = effectText.status_applied
      if (effectText.stat_change) action.stat_change = effectText.stat_change
    }

    this.io.to(this.socket_room).emit('combat:action', action)

    // 12b. Item on-hit-received effects on defender
    if (result.damage > 0) {
      const hit_event = applyItemOnHitReceived(target as any, move.type)
      if (hit_event) {
        this.io.to(this.socket_room).emit(`combat:${hit_event.event_type}`, hit_event)
      }
    }

    // 12c. Item after-action effects on attacker
    const after_event = applyItemAfterAction(pokemon as any)
    if (after_event) {
      this.io.to(this.socket_room).emit(`combat:${after_event.event_type}`, after_event)
    }

    // 12d. Choice lock: set locked move after first use
    if (index !== -1) {
      const locked = getChoiceLockMove(pokemon.equipped_item ?? null, move.id)
      if (locked !== null && pokemon.choice_locked_move === null) {
        pokemon.choice_locked_move = locked
      }
    }

    // 13. Émettre KO si target mort
    if (target.current_hp <= 0) {
      this.emitKO(target)
    }

    // 14. Life Orb KO
    if (after_event?.event_type === 'item_triggered' && pokemon.current_hp <= 0) {
      this.emitKO(pokemon)
    }

    // 15. Prochain timer
    pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
  }

  // ─── Application des effets de move ──────────────────────────────────────

  private applyMoveEffect(
    attacker: CombatPokemon,
    target: CombatPokemon,
    move: CombatMove,
    effectiveness: number
  ): { status_applied?: string; stat_change?: { stat: string; stages: number } } {
    if (!move.effect) return {}
    const effect = move.effect
    if (!effect.effect_type) return {}

    // Vérifier la chance d'application
    if (Math.random() * 100 > (effect.chance_percent ?? 100)) return {}

    // Cibles
    const applyTarget = effect.target === 'self' ? attacker : target

    switch (effect.effect_type) {
      case 'burn':
        if (applyStatus(applyTarget, 'burn', effect.duration_min ?? 999, effect.duration_max ?? 999)) {
          this.io.to(this.socket_room).emit('combat:status', {
            pokemon_id: applyTarget.id,
            status_type: 'burn',
            actions_remaining: applyTarget.status?.actions_remaining ?? 999,
          })
          return { status_applied: 'burn' }
        }
        break
      case 'poison':
        if (applyStatus(applyTarget, 'poison', effect.duration_min ?? 999, effect.duration_max ?? 999)) {
          this.io.to(this.socket_room).emit('combat:status', {
            pokemon_id: applyTarget.id,
            status_type: 'poison',
            actions_remaining: applyTarget.status?.actions_remaining ?? 999,
          })
          return { status_applied: 'poison' }
        }
        break
      case 'paralysis':
        if (applyStatus(applyTarget, 'paralysis', effect.duration_min ?? 999, effect.duration_max ?? 999)) {
          this.io.to(this.socket_room).emit('combat:status', {
            pokemon_id: applyTarget.id,
            status_type: 'paralysis',
            actions_remaining: applyTarget.status?.actions_remaining ?? 999,
          })
          return { status_applied: 'paralysis' }
        }
        break
      case 'sleep':
        if (applyStatus(applyTarget, 'sleep', effect.duration_min ?? 2, effect.duration_max ?? 4)) {
          this.io.to(this.socket_room).emit('combat:status', {
            pokemon_id: applyTarget.id,
            status_type: 'sleep',
            actions_remaining: applyTarget.status?.actions_remaining ?? 3,
          })
          return { status_applied: 'sleep' }
        }
        break
      case 'freeze':
        if (applyStatus(applyTarget, 'freeze', 1, 5)) {
          this.io.to(this.socket_room).emit('combat:status', {
            pokemon_id: applyTarget.id,
            status_type: 'freeze',
            actions_remaining: applyTarget.status?.actions_remaining ?? 3,
          })
          return { status_applied: 'freeze' }
        }
        break
      case 'confusion':
        applyConfusion(applyTarget)
        return { status_applied: 'confusion' }
      case 'stat_change':
        if (effect.stat_target && effect.stat_change !== null) {
          const stat = effect.stat_target as keyof typeof applyTarget.stat_modifiers
          if (stat in applyTarget.stat_modifiers) {
            applyTarget.stat_modifiers[stat] = Math.max(
              -6,
              Math.min(6, applyTarget.stat_modifiers[stat] + (effect.stat_change ?? 0))
            )
            return { stat_change: { stat: effect.stat_target, stages: effect.stat_change ?? 0 } }
          }
        }
        break
    }

    return {}
  }

  // ─── Fin de combat ────────────────────────────────────────────────────────

  private async handleVictory(): Promise<void> {
    this.state = 'idle'
    this.stop()

    // Calculer or et XP
    const base_gold = this.floor.goldBase * (0.9 + Math.random() * 0.2)
    const gold = Math.floor(base_gold * (this.is_boss ? 5 : 1))
    let xp = Math.floor(this.floor.xpBase * (this.is_boss ? 3 : 1))

    // XP boost event
    try {
      const { default: eventService } = await import('#services/EventService')
      const { applyXpBoost } = await import('#services/EventService')
      const xp_config = await eventService.getActiveEventConfig('xp_boost')
      xp = applyXpBoost(xp, xp_config)
    } catch { /* ignore */ }

    this.gold_pending += gold
    this.xp_pending += xp

    this.onVictoryBattle?.(gold, xp)

    // Roll item drops (async, non-bloquant)
    this.rollItemDrops(this.floor.floorNumber, this.player_id).then((drops) => {
      if (drops.length > 0) {
        for (const drop of drops) {
          this.io.to(this.socket_room).emit('combat:item_drop', drop)
        }
      }
    }).catch((err) => console.error('[CombatSession] rollItemDrops error:', err))

    // Distribuer les dégâts à la pension (async, non-bloquant)
    const damage_to_distribute = this.battle_damage_dealt
    this.battle_damage_dealt = 0  // reset pour la prochaine bataille

    if (damage_to_distribute > 0 && this.onDaycareDistribute) {
      this.onDaycareDistribute(damage_to_distribute).then((newly_ready) => {
        if (newly_ready.length > 0) {
          this.io.to(this.socket_room).emit('daycare:ready', {
            slots: newly_ready,
          })
          // Auto-hatch si callback fourni
          if (this.onDaycareAutoHatch) {
            for (const slot of newly_ready) {
              this.onDaycareAutoHatch(slot.slot_number).catch((err) =>
                console.error(`[CombatSession] Auto-hatch slot ${slot.slot_number}:`, err)
              )
            }
          }
        }
      }).catch((err) => console.error('[CombatSession] Erreur distributeDamage:', err))
    }

    if (this.is_boss) {
      this.io.to(this.socket_room).emit('combat:victory', {
        gold_earned: gold,
        xp_earned: xp,
        next_battle: 1,
        is_boss_next: false,
      })

      // Callback boss defeated (async — gestion en dehors du tick)
      this.onBossDefeated?.(this.floor.floorNumber)
      return
    }

    const nextBattle = this.battle_number + 1
    const isNextBoss = nextBattle === 10

    this.io.to(this.socket_room).emit('combat:victory', {
      gold_earned: gold,
      xp_earned: xp,
      next_battle: nextBattle,
      is_boss_next: isNextBoss,
    })

    // Charger la prochaine bataille après un court délai
    setTimeout(() => {
      this.loadBattle(nextBattle)
      this.state = 'fighting'
      this.scheduleTick()
    }, 1500)
  }

  private handleDefeat(): void {
    this.state = 'idle'
    this.stop()

    // Retourner à la bataille 1 de l'étage courant
    this.io.to(this.socket_room).emit('combat:defeat', {
      message: "L'équipe est KO ! Retour au début de l'étage.",
      floor_number: this.floor.floorNumber,
    })

    setTimeout(() => {
      this.loadBattle(1)
      this.state = 'fighting'
      this.scheduleTick()
    }, 3000)
  }

  private handleBossTimeout(): void {
    this.state = 'idle'
    this.stop()

    // Vérifier upgrade auto_farm
    import('#services/PlayerUpgradeService').then(async ({ default: playerUpgradeService }) => {
      const has_auto_farm = await playerUpgradeService.hasUpgrade(this.player_id, 'auto_farm')

      if (has_auto_farm) {
        // Retourner à l'étage précédent automatiquement
        const prev_floor = Math.max(1, this.floor.floorNumber - 1)
        const { default: Floor } = await import('#models/floor')
        const new_floor = await Floor.findBy('floor_number', prev_floor)
        if (new_floor) {
          this.floor = new_floor
          this.mega_data_cache = null
          await import('@adonisjs/lucid/services/db').then(({ default: db }) =>
            db.from('players').where('id', this.player_id).update({ current_floor: prev_floor })
          )
        }
        this.io.to(this.socket_room).emit('combat:boss_timeout', {
          message: 'Boss résistant ! Farm auto activé — retour à l\'étage précédent.',
          floor_returned_to: prev_floor,
          auto_farm_active: true,
        })
      } else {
        this.io.to(this.socket_room).emit('combat:boss_timeout', {
          message: "Le dresseur a résisté ! Retour à l'étape 1.",
          floor_returned_to: this.floor.floorNumber,
          auto_farm_active: false,
        })
      }

      setTimeout(() => {
        this.loadBattle(1)
        this.state = 'fighting'
        this.scheduleTick()
      }, 3000)
    }).catch(() => {
      // Fallback sans auto_farm
      this.io.to(this.socket_room).emit('combat:boss_timeout', {
        message: "Le dresseur a résisté ! Retour à l'étape 1.",
        floor_returned_to: this.floor.floorNumber,
        auto_farm_active: false,
      })
      setTimeout(() => {
        this.loadBattle(1)
        this.state = 'fighting'
        this.scheduleTick()
      }, 3000)
    })
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private emitKO(pokemon: CombatPokemon): void {
    this.io.to(this.socket_room).emit('combat:ko', {
      pokemon_id: pokemon.id,
      is_enemy: !this.isPlayerPokemon(pokemon),
    })
  }

  private isPlayerPokemon(pokemon: CombatPokemon): boolean {
    return this.player_team.some((p) => p.id === pokemon.id)
  }

  private allEnemiesDead(): boolean {
    return this.enemy_team.length > 0 && this.enemy_team.every((p) => p.current_hp <= 0)
  }

  private allPlayerPokemonDead(): boolean {
    return this.player_team.length > 0 && this.player_team.every((p) => p.current_hp <= 0)
  }

  // ─── Snapshot pour état client ────────────────────────────────────────────

  toSnapshot(): SessionSnapshot {
    const now = Date.now()
    const boss_timer_remaining_ms = this.is_boss
      ? Math.max(0, this.boss_timer_ms - (now - this.boss_started_at))
      : null

    const xpToNext = (level: number): number =>
      Math.max(1, Math.floor(Math.pow(level + 1, 3) * 0.8) - Math.floor(Math.pow(level, 3) * 0.8))

    const mapPokemon = (p: CombatPokemon, isPlayer: boolean): CombatPokemonState => ({
      id: p.id,
      name_fr: p.name_fr,
      sprite_url: p.sprite_url,
      is_shiny: p.is_shiny,
      current_hp: p.current_hp,
      max_hp: p.max_hp,
      level: p.level,
      status: p.status?.type ?? null,
      confusion: !!p.confusion,
      moves: p.moves.map((m, i) => ({
        name_fr: m.name_fr,
        pp_current: p.pp_remaining[i] ?? 0,
        pp_max: m.pp,
        slot: i + 1,
      })),
      ...(isPlayer && {
        xp: p.experience ?? 0,
        xp_to_next: xpToNext(p.level),
      }),
    })

    return {
      floor_number: this.floor.floorNumber,
      floor_name_fr: this.floor.nameFr,
      region: this.floor.region,
      battle_number: this.battle_number,
      is_boss: this.is_boss,
      boss_timer_remaining_ms,
      player_team: this.player_team.map((p) => mapPokemon(p, true)),
      enemy_team: this.enemy_team.map((p) => mapPokemon(p, false)),
      session_active: this.state === 'fighting',
    }
  }

  // ─── Méga-Évolution ──────────────────────────────────────────────────────

  private async triggerMegaEvolutionsIfEligible(): Promise<void> {
    this.mega_evolved_this_battle = true // Mark immediately to prevent re-entry

    // Load mega data from DB if not cached
    if (this.mega_data_cache === null) {
      const species_ids = this.player_team.map(p => p.species_id)
      this.mega_data_cache = await db
        .from('mega_evolutions')
        .whereIn('species_id', species_ids)
        .select('*') as MegaEvolutionData[]
    }

    const available_megas = this.mega_data_cache as MegaEvolutionData[]
    if (available_megas.length === 0) return

    let mega_used = false
    for (const pokemon of this.player_team) {
      if (mega_used) break
      if (pokemon.current_hp <= 0) continue

      const eligible = {
        id: pokemon.id,
        species_id: pokemon.species_id,
        is_shiny: pokemon.is_shiny,
        equipped_item_id: pokemon.equipped_item?.id ?? null,
      }

      if (!canMegaEvolve(eligible, available_megas, false)) continue

      const mega = selectMegaEvolution(eligible, available_megas)
      if (!mega) continue

      const result = applyMegaEvolution(pokemon.current_hp, pokemon.max_hp, mega)

      // Apply mega stats to the combat pokemon
      pokemon.type1 = result.type1 as any
      pokemon.type2 = result.type2 as any ?? null
      pokemon.max_hp = result.hp
      pokemon.current_hp = result.new_current_hp
      pokemon.effective_atk = result.atk
      pokemon.effective_def = result.def
      pokemon.effective_spatk = result.spatk
      pokemon.effective_spdef = result.spdef
      pokemon.effective_speed = result.speed
      pokemon.is_mega_evolved = true
      pokemon.mega_name_fr = result.mega_name_fr
      pokemon.current_sprite_url = pokemon.is_shiny ? (result.sprite_shiny_url ?? undefined) : (result.sprite_url ?? undefined)

      mega_used = true

      this.io.to(this.socket_room).emit('combat:mega_evolution', {
        pokemon_id: pokemon.id,
        pokemon_name_fr: pokemon.name_fr,
        mega_name_fr: result.mega_name_fr,
        type1: result.type1,
        type2: result.type2,
        sprite_url: pokemon.is_shiny ? result.sprite_shiny_url : result.sprite_url,
        new_stats: {
          hp: result.hp,
          atk: result.atk,
          def: result.def,
          spatk: result.spatk,
          spdef: result.spdef,
          speed: result.speed,
        },
      })
    }
  }

  // ─── Item drops ───────────────────────────────────────────────────────────

  private async rollItemDrops(
    floor_number: number,
    player_id: string
  ): Promise<Array<{ item_id: number; item_name_fr: string; quantity: number }>> {
    try {
      const floor_row = await db.from('floors').where('floor_number', floor_number).select('id').first()
      if (!floor_row) return []

      const configs = await db
        .from('floor_item_drops as fid')
        .join('items as i', 'i.id', 'fid.item_id')
        .where('fid.floor_id', floor_row.id)
        .select('fid.item_id', 'i.name_fr as item_name_fr', 'fid.drop_rate', 'fid.drop_quantity_min as qty_min', 'fid.drop_quantity_max as qty_max')

      const drops: Array<{ item_id: number; item_name_fr: string; quantity: number }> = []

      for (const config of configs) {
        if (Math.random() < Number(config.drop_rate)) {
          const qty_min = config.qty_min ?? 1
          const qty_max = config.qty_max ?? 1
          const qty = qty_min === qty_max ? qty_min : qty_min + Math.floor(Math.random() * (qty_max - qty_min + 1))
          drops.push({ item_id: config.item_id, item_name_fr: config.item_name_fr, quantity: qty })
        }
      }

      // Upsert into player_items
      for (const drop of drops) {
        await db.rawQuery(`
          INSERT INTO player_items (id, player_id, item_id, quantity, obtained_at)
          VALUES (gen_random_uuid(), ?, ?, ?, NOW())
          ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_items.quantity + EXCLUDED.quantity
        `, [player_id, drop.item_id, drop.quantity])
      }

      return drops
    } catch (err) {
      console.error('[CombatSession] rollItemDrops DB error:', err)
      return []
    }
  }
}
