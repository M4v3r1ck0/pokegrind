/**
 * TowerCombatSession — Session de combat pour la Tour Infinie.
 * Génère les ennemis procéduralement (TowerGeneratorService).
 * Gère les mécaniques de boss (enrage/regen/reflect/clone/berserk).
 */

import type { Server as SocketServer } from 'socket.io'
import type { CombatPokemon, CombatMove } from '#services/CombatService'
import {
  calcDamage,
  applyStatusBeforeAction,
  applyStatus,
  applyConfusion,
  selectNextMove,
  calcActionDelay,
  STRUGGLE_MOVE,
} from '#services/CombatService'
import {
  generateEnemiesForFloor,
  calcTowerFloorConfig,
  applyEnrageMechanic,
  calcRegenHeal,
  calcReflectDamage,
  calcCloneHP,
  type GeneratedEnemy,
  type BossMechanic,
} from '#services/TowerGeneratorService'
import type { PokemonType } from '@pokegrind/shared'
import db from '@adonisjs/lucid/services/db'
import {
  canGigantamax,
  selectGigantamax,
  applyGigantamax,
  type GigantamaxData,
} from '#services/GigantamaxFormulas'

export type TowerSessionState = 'fighting' | 'victory' | 'defeat' | 'boss_timeout' | 'idle'

export interface TowerCombatAction {
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
  reflected_damage?: number
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

export default class TowerCombatSession {
  readonly player_id: string
  readonly floor_number: number
  readonly season_id: number
  player_team: CombatPokemon[]
  enemy_team: CombatPokemon[] = []
  is_boss: boolean
  boss_mechanic: BossMechanic | null
  boss_timer_ms: number = 120_000  // 2 min pour la Tour (vs 90s combat normal)
  boss_started_at: number = 0
  state: TowerSessionState = 'idle'
  readonly socket_room: string
  readonly io: SocketServer
  private tick_interval: NodeJS.Timeout | null = null

  // State des mécaniques boss
  private boss_actions_taken: number = 0
  private boss_clones_spawned: boolean = false
  private berserk_triggered: boolean = false

  // Gigantamax : une seule transformation par floor
  private gmax_applied_this_floor: boolean = false
  private gmax_data_cache: GigantamaxData[] | null = null
  private gmax_unlocked_cache: number[] | null = null

  // Callbacks
  onFloorClear?: (floor_number: number, gold: number, xp: number) => Promise<void>
  onFloorFail?: () => void

  constructor(params: {
    player_id: string
    floor_number: number
    season_id: number
    player_team: CombatPokemon[]
    io: SocketServer
    boss_mechanic?: BossMechanic | null
    species_pool?: Array<{ id: number; name_fr: string }>
  }) {
    this.player_id = params.player_id
    this.floor_number = params.floor_number
    this.season_id = params.season_id
    this.player_team = params.player_team
    this.io = params.io
    this.socket_room = `tower:${params.player_id}`
    this.is_boss = params.floor_number % 25 === 0
    this.boss_mechanic = params.boss_mechanic ?? null

    // Générer les ennemis
    const species_pool = params.species_pool ?? []
    const generated = generateEnemiesForFloor(floor_number, season_id, species_pool)
    this.enemy_team = generated.map((e, i) => this.buildEnemyFromGenerated(e, i))
  }

  // ─── Cycle de vie ─────────────────────────────────────────────────────────

  start(): void {
    this.resetTeamState()
    this.state = 'fighting'

    if (this.is_boss) {
      this.boss_started_at = Date.now()
    }

    const now = Date.now()
    for (const p of [...this.player_team, ...this.enemy_team]) {
      p.next_action_at = now + calcActionDelay(p)
      p.current_move_index = 0
      p.pp_remaining = p.moves.map((m) => m.pp)
    }

    this.scheduleTick()
  }

  stop(): void {
    if (this.tick_interval) {
      clearInterval(this.tick_interval)
      this.tick_interval = null
    }
    this.state = 'idle'
  }

  private resetTeamState(): void {
    for (const p of this.player_team) {
      p.current_hp = p.max_hp
      p.status = null
      p.confusion = null
      p.stat_modifiers = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 }
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

    // Mécanique berserk : boost de vitesse après trigger_ms
    if (
      this.is_boss &&
      this.boss_mechanic?.type === 'berserk' &&
      !this.berserk_triggered &&
      now - this.boss_started_at > (this.boss_mechanic.trigger_ms ?? 10000)
    ) {
      this.triggerBerserk()
    }

    // Gigantamax au premier tick du floor (fire-and-forget)
    if (!this.gmax_applied_this_floor) {
      this.triggerGigantamaxIfEligible().catch(() => {})
    }

    const ready = this.getReadyPokemon(now)
    for (const pokemon of ready) {
      if (this.state !== 'fighting') break
      this.executeAction(pokemon)
    }

    if (this.state !== 'fighting') return
    if (this.allEnemiesDead()) {
      this.handleVictory().catch((err) => console.error('[TowerCombatSession] handleVictory error:', err))
    } else if (this.allPlayerPokemonDead()) {
      this.handleDefeat()
    }
  }

  private getReadyPokemon(now: number): CombatPokemon[] {
    return [...this.player_team, ...this.enemy_team]
      .filter((p) => p.current_hp > 0 && p.next_action_at <= now)
      .sort((a, b) => b.effective_speed - a.effective_speed)
  }

  // ─── Mécanique berserk ────────────────────────────────────────────────────

  private triggerBerserk(): void {
    this.berserk_triggered = true
    const mult = this.boss_mechanic?.action_speed_mult ?? 2.0

    for (const boss of this.enemy_team) {
      if (boss.current_hp > 0) {
        // Réduire l'intervalle d'action en augmentant effective_speed
        boss.effective_speed = Math.floor(boss.effective_speed * mult)
      }
    }

    this.io.to(this.socket_room).emit('tower:boss_berserk', {
      speed_mult: mult,
      message: `Le boss entre en mode Berserk ! Vitesse ×${mult}`,
    })
  }

  // ─── Exécution d'une action ───────────────────────────────────────────────

  private executeAction(pokemon: CombatPokemon): void {
    const statusResult = applyStatusBeforeAction(pokemon)
    if (statusResult.damage_taken > 0) {
      this.io.to(this.socket_room).emit('tower:status_damage', {
        pokemon_id: pokemon.id,
        damage: statusResult.damage_taken,
        hp_remaining: pokemon.current_hp,
        hp_max: pokemon.max_hp,
      })
    }

    if (pokemon.current_hp <= 0) {
      this.emitKO(pokemon)
      pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
      return
    }

    if (statusResult.should_skip) {
      pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
      return
    }

    const targets = this.isPlayerPokemon(pokemon) ? this.enemy_team : this.player_team
    const aliveTargets = targets.filter((t) => t.current_hp > 0)
    if (aliveTargets.length === 0) return

    const { move, index } = selectNextMove(pokemon)
    const isStruggle = index === -1
    const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)]

    if (move.category === 'status') {
      if (index !== -1 && pokemon.pp_remaining[index] > 0) {
        pokemon.pp_remaining[index] -= 1
      }
      this.applyMoveEffect(pokemon, target, move, 0)
      pokemon.current_move_index = index !== -1 ? (index + 1) % pokemon.moves.length : 0
      pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
      return
    }

    let result = calcDamage(pokemon, target, move)
    let final_damage = result.damage

    // Mécanique enrage : boss multiplie ses dégâts sous le seuil de HP
    if (
      !this.isPlayerPokemon(pokemon) &&
      this.is_boss &&
      this.boss_mechanic?.type === 'enrage' &&
      this.boss_mechanic.threshold !== undefined &&
      this.boss_mechanic.damage_mult !== undefined
    ) {
      final_damage = applyEnrageMechanic(
        final_damage,
        pokemon.current_hp,
        pokemon.max_hp,
        { threshold: this.boss_mechanic.threshold, damage_mult: this.boss_mechanic.damage_mult }
      )
    }

    target.current_hp = Math.max(0, target.current_hp - final_damage)

    if (!isStruggle && index !== -1 && pokemon.pp_remaining[index] > 0) {
      pokemon.pp_remaining[index] -= 1
    }
    if (!isStruggle && index !== -1) {
      pokemon.current_move_index = (index + 1) % pokemon.moves.length
    }
    if (isStruggle) {
      const recoil = Math.max(1, Math.floor(pokemon.max_hp * 0.25))
      pokemon.current_hp = Math.max(0, pokemon.current_hp - recoil)
    }

    const action: TowerCombatAction = {
      attacker_id: pokemon.id,
      move_name_fr: move.name_fr,
      target_id: target.id,
      damage: final_damage,
      is_critical: result.is_critical,
      effectiveness: result.effectiveness,
      target_hp_remaining: target.current_hp,
      target_hp_max: target.max_hp,
    }

    // Mécanique reflect : renvoyer des dégâts à l'attaquant (joueur → boss)
    if (
      this.isPlayerPokemon(pokemon) &&
      this.is_boss &&
      this.boss_mechanic?.type === 'reflect' &&
      this.boss_mechanic.reflect_percent !== undefined &&
      this.boss_mechanic.move_categories
    ) {
      const reflected = calcReflectDamage(final_damage, move.category, {
        reflect_percent: this.boss_mechanic.reflect_percent,
        move_categories: this.boss_mechanic.move_categories,
      })
      if (reflected > 0) {
        pokemon.current_hp = Math.max(0, pokemon.current_hp - reflected)
        action.reflected_damage = reflected
        this.io.to(this.socket_room).emit('tower:boss_reflect', {
          target_id: pokemon.id,
          damage: reflected,
          hp_remaining: pokemon.current_hp,
          hp_max: pokemon.max_hp,
        })
        if (pokemon.current_hp <= 0) {
          this.emitKO(pokemon)
        }
      }
    }

    if (result.damage > 0 && move.effect) {
      const effectText = this.applyMoveEffect(pokemon, target, move, result.effectiveness)
      if (effectText.status_applied) action.status_applied = effectText.status_applied
      if (effectText.stat_change) action.stat_change = effectText.stat_change
    }

    this.io.to(this.socket_room).emit('tower:action', action)

    if (target.current_hp <= 0) {
      this.emitKO(target)
    }
    if (isStruggle && pokemon.current_hp <= 0) {
      this.emitKO(pokemon)
    }

    // Mécanique regen : le boss se soigne après chaque action
    if (
      !this.isPlayerPokemon(pokemon) &&
      this.is_boss &&
      this.boss_mechanic?.type === 'regen' &&
      this.boss_mechanic.heal_per_action !== undefined
    ) {
      const heal = calcRegenHeal(pokemon.max_hp, { heal_per_action: this.boss_mechanic.heal_per_action })
      if (heal > 0 && pokemon.current_hp < pokemon.max_hp) {
        const old_hp = pokemon.current_hp
        pokemon.current_hp = Math.min(pokemon.max_hp, pokemon.current_hp + heal)
        this.io.to(this.socket_room).emit('tower:boss_regen', {
          pokemon_id: pokemon.id,
          heal_amount: pokemon.current_hp - old_hp,
          hp_remaining: pokemon.current_hp,
          hp_max: pokemon.max_hp,
        })
      }
    }

    // Mécanique clone : spawn des clones quand le boss passe sous 50% HP
    if (
      !this.isPlayerPokemon(pokemon) &&
      this.is_boss &&
      this.boss_mechanic?.type === 'clone' &&
      !this.boss_clones_spawned &&
      pokemon.current_hp > 0 &&
      target.current_hp / target.max_hp < 0.5
    ) {
      this.spawnClones(pokemon)
    }

    this.boss_actions_taken++
    pokemon.next_action_at = Date.now() + calcActionDelay(pokemon)
  }

  // ─── Mécaniques boss ──────────────────────────────────────────────────────

  private spawnClones(original: CombatPokemon): void {
    if (!this.boss_mechanic || this.boss_mechanic.type !== 'clone') return
    this.boss_clones_spawned = true

    const clone_count = this.boss_mechanic.clone_count ?? 2
    const clone_hp = calcCloneHP(original.max_hp, {
      clone_count,
      clone_hp_percent: this.boss_mechanic.clone_hp_percent ?? 0.40,
    })

    const clones: CombatPokemon[] = []
    for (let i = 0; i < clone_count; i++) {
      const clone: CombatPokemon = {
        ...original,
        id: `clone_${i}_${Date.now()}`,
        name_fr: `Ombre de ${original.name_fr}`,
        max_hp: clone_hp,
        current_hp: clone_hp,
        next_action_at: Date.now() + calcActionDelay(original),
        current_move_index: 0,
        pp_remaining: original.moves.map((m) => m.pp),
      }
      clones.push(clone)
      this.enemy_team.push(clone)
    }

    this.io.to(this.socket_room).emit('tower:boss_clone', {
      clone_count,
      clone_hp,
      clone_ids: clones.map((c) => c.id),
      message: `${original.name_fr} crée ${clone_count} clone(s) !`,
    })
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
    if (Math.random() * 100 > (effect.chance_percent ?? 100)) return {}

    const applyTarget = effect.target === 'self' ? attacker : target

    switch (effect.effect_type) {
      case 'burn':
        if (applyStatus(applyTarget, 'burn', effect.duration_min ?? 999, effect.duration_max ?? 999)) {
          this.io.to(this.socket_room).emit('tower:status', { pokemon_id: applyTarget.id, status_type: 'burn' })
          return { status_applied: 'burn' }
        }
        break
      case 'poison':
        if (applyStatus(applyTarget, 'poison', effect.duration_min ?? 999, effect.duration_max ?? 999)) {
          this.io.to(this.socket_room).emit('tower:status', { pokemon_id: applyTarget.id, status_type: 'poison' })
          return { status_applied: 'poison' }
        }
        break
      case 'paralysis':
        if (applyStatus(applyTarget, 'paralysis', effect.duration_min ?? 999, effect.duration_max ?? 999)) {
          this.io.to(this.socket_room).emit('tower:status', { pokemon_id: applyTarget.id, status_type: 'paralysis' })
          return { status_applied: 'paralysis' }
        }
        break
      case 'sleep':
        if (applyStatus(applyTarget, 'sleep', effect.duration_min ?? 2, effect.duration_max ?? 4)) {
          this.io.to(this.socket_room).emit('tower:status', { pokemon_id: applyTarget.id, status_type: 'sleep' })
          return { status_applied: 'sleep' }
        }
        break
      case 'freeze':
        if (applyStatus(applyTarget, 'freeze', 1, 5)) {
          this.io.to(this.socket_room).emit('tower:status', { pokemon_id: applyTarget.id, status_type: 'freeze' })
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

    const config = calcTowerFloorConfig(this.floor_number, this.season_id)
    const gold = Math.floor(config.gold_base * (0.9 + Math.random() * 0.2))
    const xp = Math.floor(config.xp_base * (0.9 + Math.random() * 0.2))

    this.io.to(this.socket_room).emit('tower:victory', {
      floor_number: this.floor_number,
      gold_earned: gold,
      xp_earned: xp,
      next_floor: this.floor_number + 1,
    })

    await this.onFloorClear?.(this.floor_number, gold, xp)
  }

  private handleDefeat(): void {
    this.state = 'idle'
    this.stop()

    this.io.to(this.socket_room).emit('tower:defeat', {
      floor_number: this.floor_number,
      message: 'Votre équipe est tombée. Retour à l\'étage 1 de la Tour.',
    })

    this.onFloorFail?.()
  }

  private handleBossTimeout(): void {
    this.state = 'idle'
    this.stop()

    this.io.to(this.socket_room).emit('tower:boss_timeout', {
      floor_number: this.floor_number,
      message: 'Temps écoulé ! Le boss résiste. Retour à l\'étage 1.',
    })

    this.onFloorFail?.()
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private emitKO(pokemon: CombatPokemon): void {
    this.io.to(this.socket_room).emit('tower:ko', {
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

  toSnapshot(): TowerSnapshot {
    const now = Date.now()
    const boss_timer_remaining_ms = this.is_boss
      ? Math.max(0, this.boss_timer_ms - (now - this.boss_started_at))
      : null

    const mapPokemon = (p: CombatPokemon): TowerPokemonState => ({
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
      is_clone: p.id.startsWith('clone_'),
    })

    return {
      floor_number: this.floor_number,
      season_id: this.season_id,
      is_boss: this.is_boss,
      boss_mechanic_type: this.boss_mechanic?.type ?? null,
      boss_timer_remaining_ms,
      player_team: this.player_team.map(mapPokemon),
      enemy_team: this.enemy_team.map(mapPokemon),
      session_active: this.state === 'fighting',
    }
  }

  // ─── Gigantamax ───────────────────────────────────────────────────────────

  private async triggerGigantamaxIfEligible(): Promise<void> {
    this.gmax_applied_this_floor = true // Empêche les re-entrées

    // Charger les données GMax depuis BDD si non cachées
    if (this.gmax_data_cache === null) {
      const species_ids = this.player_team.map((p) => p.species_id)
      this.gmax_data_cache = (await db
        .from('gigantamax_forms')
        .whereIn('species_id', species_ids)
        .select('*')) as GigantamaxData[]
    }

    if (this.gmax_data_cache.length === 0) return

    // Charger les espèces débloquées par le joueur
    if (this.gmax_unlocked_cache === null) {
      const rows = await db
        .from('player_gigantamax')
        .where('player_id', this.player_id)
        .select('species_id')
      this.gmax_unlocked_cache = rows.map((r: any) => r.species_id)
    }

    const available_gmax = this.gmax_data_cache
    const unlocked_species = this.gmax_unlocked_cache

    let gmax_used = false
    for (const pokemon of this.player_team) {
      if (gmax_used) break
      if (pokemon.current_hp <= 0) continue

      if (!canGigantamax('tower', pokemon.species_id, available_gmax, unlocked_species, false)) continue

      const gmax = selectGigantamax(pokemon.species_id, available_gmax)
      if (!gmax) continue

      const result = applyGigantamax(
        {
          id: pokemon.id,
          species_id: pokemon.species_id,
          is_shiny: pokemon.is_shiny,
          current_hp: pokemon.current_hp,
          max_hp: pokemon.max_hp,
          effective_atk: pokemon.effective_atk,
          effective_def: pokemon.effective_def,
          effective_spatk: pokemon.effective_spatk,
          effective_spdef: pokemon.effective_spdef,
          effective_speed: pokemon.effective_speed,
        },
        gmax
      )

      pokemon.max_hp = result.max_hp
      pokemon.current_hp = result.current_hp
      pokemon.effective_atk = result.effective_atk
      pokemon.effective_def = result.effective_def
      pokemon.effective_spatk = result.effective_spatk
      pokemon.effective_spdef = result.effective_spdef
      pokemon.effective_speed = result.effective_speed

      gmax_used = true

      this.io.to(this.socket_room).emit('tower:gigantamax', {
        pokemon_id: pokemon.id,
        pokemon_name_fr: pokemon.name_fr,
        gmax_name_fr: result.gmax_name_fr,
        sprite_url: pokemon.is_shiny ? result.sprite_shiny_url : result.sprite_url,
        new_stats: {
          hp: result.max_hp,
          atk: result.effective_atk,
          def: result.effective_def,
          spatk: result.effective_spatk,
          spdef: result.effective_spdef,
          speed: result.effective_speed,
        },
      })
    }
  }

  // ─── Construction d'un ennemi depuis GeneratedEnemy ───────────────────────

  private buildEnemyFromGenerated(e: GeneratedEnemy, index: number): CombatPokemon {
    const hp_base = 45 + Math.floor(e.level * 0.6)
    const atk_base = 35 + Math.floor(e.level * 0.8)
    const def_base = 30 + Math.floor(e.level * 0.7)
    const speed_base = 35 + Math.floor(e.level * 0.5)

    const max_hp = Math.floor(
      ((2 * hp_base + e.ivs.hp) * e.level) / 100 + e.level + 10
    )
    const effective_atk = Math.floor(
      ((2 * atk_base + e.ivs.atk) * e.level) / 100 + 5
    )
    const effective_def = Math.floor(
      ((2 * def_base + e.ivs.def) * e.level) / 100 + 5
    )
    const effective_speed = Math.floor(
      ((2 * speed_base + e.ivs.speed) * e.level) / 100 + 5
    )

    const move = this.buildEnemyMove(e.level)

    return {
      id: `tower_enemy_${index}_${e.species_id}`,
      species_id: e.species_id,
      name_fr: e.name_fr ?? `Pokémon #${e.species_id}`,
      level: e.level,
      nature: e.nature,
      ivs: e.ivs,
      type1: 'normal' as PokemonType,
      type2: null,
      base_hp: hp_base,
      base_atk: atk_base,
      base_def: def_base,
      base_spatk: atk_base,
      base_spdef: def_base,
      base_speed: speed_base,
      moves: [move],
      sprite_url: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${e.species_id}.png`,
      is_shiny: false,
      max_hp,
      current_hp: max_hp,
      effective_atk,
      effective_def,
      effective_spatk: effective_atk,
      effective_spdef: effective_def,
      effective_speed,
      status: null,
      confusion: null,
      stat_modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 },
      current_move_index: 0,
      pp_remaining: [move.pp],
      next_action_at: 0,
    }
  }

  private buildEnemyMove(level: number): CombatMove {
    const power = Math.min(150, 40 + Math.floor(level * 0.8))
    return {
      id: 0,
      name_fr: 'Attaque Tour',
      type: 'normal' as PokemonType,
      category: 'physical',
      power,
      accuracy: 100,
      pp: 30,
      priority: 0,
      effect: null,
    }
  }
}
