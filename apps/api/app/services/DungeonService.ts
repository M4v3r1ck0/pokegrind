/**
 * DungeonService — Donjons Ancestraux (roguelite endgame).
 * Reset hebdomadaire, un run par donjon par semaine.
 * Combat résolu instantanément (comme PvP), pas en temps réel.
 *
 * Les fonctions pures sont dans DungeonGeneratorService (testables sans AdonisJS).
 */

import db from '@adonisjs/lucid/services/db'
import type { Server as SocketServer } from 'socket.io'
import gemsService from '#services/GemsService'
import PlayerPokemon from '#models/player_pokemon'
import { buildCombatPokemon, calcDamage, type CombatPokemon, type CombatMove } from '#services/CombatService'
import { createSeededRng } from '#services/TowerGeneratorService'
import type { Nature, PokemonType } from '@pokegrind/shared'
import {
  hashString,
  currentWeekNumber,
  generateRoomLayout,
  modifierCountForDifficulty,
  applyDungeonModifiers,
  calcRestHealing,
  drawRandomReward,
  type DungeonModifier,
  type DungeonModifierEffect,
  type RoomLayout,
  type DungeonPokemonSnapshot,
} from '#services/DungeonGeneratorService'

// Re-export des types et fonctions pures pour le controller
export type { DungeonModifier, DungeonModifierEffect, RoomLayout, DungeonPokemonSnapshot }
export { hashString, currentWeekNumber, generateRoomLayout, modifierCountForDifficulty, applyDungeonModifiers, calcRestHealing, drawRandomReward }

// ─── Types service ────────────────────────────────────────────────────────────

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
  team: DungeonPokemonSnapshot[]
  gold_collected: number
  items_collected: object[]
}

export interface RoomResult {
  room_number: number
  room_type: string
  result: 'victory' | 'defeat' | 'completed' | 'failed'
  run_status: 'active' | 'completed' | 'failed'
  gold_earned?: number
  hp_restored?: Record<string, number>
  item_found?: object | null
  shop_items?: object[]
  modifier_applied?: DungeonModifier | null
  final_rewards?: object[]
  message?: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const POKEMON_TYPES: string[] = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
]

const MAX_BATTLE_ACTIONS = 500

// ─── Service ──────────────────────────────────────────────────────────────────

class DungeonServiceClass {
  private io?: SocketServer

  setIO(io: SocketServer): void {
    this.io = io
  }

  // ─── Démarrer un run ─────────────────────────────────────────────────────────

  async startRun(player_id: string, dungeon_id: number): Promise<DungeonRun> {
    const week = currentWeekNumber()

    const dungeon = await db.from('dungeons').where({ id: dungeon_id, is_active: true }).first()
    if (!dungeon) throw new Error('Donjon introuvable ou inactif.')

    const player = await db.from('players').where('id', player_id).select('prestige_level').first()
    const prestige = Number(player?.prestige_level ?? 0)
    if (prestige < Number(dungeon.min_prestige)) {
      throw new Error(`Ce donjon requiert le prestige ${dungeon.min_prestige}. Vous êtes P${prestige}.`)
    }

    const existing = await db
      .from('dungeon_runs')
      .where({ player_id, dungeon_id })
      .where('season_week', week)
      .first()
    if (existing) {
      throw new Error(
        existing.status === 'active'
          ? 'Vous avez déjà un run actif sur ce donjon cette semaine.'
          : 'Vous avez déjà tenté ce donjon cette semaine. Revenez la semaine prochaine !'
      )
    }

    const team_pokemons = await this.loadPlayerTeam(player_id)
    if (team_pokemons.length === 0) {
      throw new Error("Votre équipe est vide. Assignez au moins un Pokémon avant d'entrer.")
    }

    const rooms    = generateRoomLayout(dungeon_id, player_id, week)
    const mod_count = modifierCountForDifficulty(dungeon.difficulty)
    const modifiers = await this.drawModifiers(mod_count, dungeon.difficulty)

    // Résoudre Anti-Type
    for (const mod of modifiers) {
      if (mod.effect_json.random_type_blocked) {
        const seed = hashString(player_id + dungeon_id + week)
        const rng  = createSeededRng(seed)
        mod.effect_json.blocked_type = POKEMON_TYPES[Math.floor(rng() * POKEMON_TYPES.length)]
      }
    }

    const team_snapshot = this.buildTeamSnapshot(team_pokemons)

    const [run] = await db.table('dungeon_runs').insert({
      player_id,
      dungeon_id,
      season_week: week,
      status: 'active',
      current_room: 1,
      team_snapshot: JSON.stringify(team_snapshot),
      active_modifiers: JSON.stringify(modifiers),
      rooms_layout: JSON.stringify(rooms),
      gold_collected: 0,
      items_collected: JSON.stringify([]),
    }).returning('id')

    const run_id = typeof run === 'object' ? (run as any).id : run

    this.io?.to(`dungeon:${player_id}`).emit('dungeon:run_started', {
      run_id,
      dungeon_name_fr: dungeon.name_fr,
      modifiers: modifiers.map((m) => ({ name_fr: m.name_fr, description_fr: m.description_fr, type: m.modifier_type })),
    })

    return {
      run_id,
      dungeon_id: dungeon.id,
      dungeon_name_fr: dungeon.name_fr,
      dungeon_region: dungeon.region,
      dungeon_difficulty: dungeon.difficulty,
      current_room: 1,
      status: 'active',
      rooms,
      modifiers,
      team: team_snapshot,
      gold_collected: 0,
      items_collected: [],
    }
  }

  // ─── Résoudre une salle ───────────────────────────────────────────────────────

  async resolveRoom(
    player_id: string,
    run_id: string,
    room_number: number
  ): Promise<RoomResult> {
    const run_row = await db.from('dungeon_runs')
      .where({ id: run_id, player_id, status: 'active' })
      .first()
    if (!run_row) throw new Error('Run introuvable ou inactif.')

    if (Number(run_row.current_room) !== room_number) {
      throw new Error(`Salle invalide. Vous êtes à la salle ${run_row.current_room}.`)
    }

    const dungeon = await db.from('dungeons').where('id', run_row.dungeon_id).first()
    const rooms: RoomLayout[] = run_row.rooms_layout
    const modifiers: DungeonModifier[] = run_row.active_modifiers
    let team: DungeonPokemonSnapshot[] = run_row.team_snapshot
    let gold_collected: number = Number(run_row.gold_collected)
    let items_collected: object[] = run_row.items_collected

    const room = rooms.find((r) => r.room_number === room_number)
    if (!room) throw new Error(`Salle ${room_number} introuvable dans le layout.`)

    this.io?.to(`dungeon:${player_id}`).emit('dungeon:room_entered', {
      room_number,
      room_type: room.type,
      room_name_fr: this.roomTypeName(room.type),
    })

    let result: RoomResult

    switch (room.type) {
      case 'combat':
      case 'elite': {
        const is_elite = room.type === 'elite'
        const enemies  = this.buildRoomEnemies(dungeon, room_number, is_elite)
        const combat_result = this.simulateDungeonCombat(team, enemies, modifiers)

        if (combat_result.winner === 'player') {
          const base_gold   = Math.floor(50 * room_number * (is_elite ? 2 : 1))
          gold_collected   += base_gold
          room.completed    = true
          room.result       = 'victory'
          room.gold_earned  = base_gold
          team = this.syncTeamHP(team, combat_result.surviving_player_team)

          this.io?.to(`dungeon:${player_id}`).emit('dungeon:combat_result', {
            room_number, result: 'victory', gold_collected: base_gold,
          })

          result = { room_number, room_type: room.type, result: 'victory', run_status: 'active', gold_earned: base_gold }
        } else {
          room.completed = true
          room.result    = 'defeat'
          this.io?.to(`dungeon:${player_id}`).emit('dungeon:combat_result', {
            room_number, result: 'defeat', run_failed: true,
            message: 'Votre équipe est tombée. Le run est terminé.',
          })
          await db.from('dungeon_runs').where('id', run_id).update({
            status: 'failed', rooms_layout: JSON.stringify(rooms),
            team_snapshot: JSON.stringify(team), gold_collected, completed_at: new Date(),
          })
          return { room_number, room_type: room.type, result: 'defeat', run_status: 'failed', message: 'Défaite — Le run est terminé.' }
        }
        break
      }

      case 'rest': {
        const healing = calcRestHealing(team)
        for (const poke of team) {
          const h = healing[poke.player_pokemon_id] ?? 0
          poke.current_hp = Math.min(poke.max_hp, poke.current_hp + h)
        }
        room.completed = true
        room.result    = 'completed'
        this.io?.to(`dungeon:${player_id}`).emit('dungeon:rest', { hp_restored: healing })
        result = { room_number, room_type: 'rest', result: 'completed', run_status: 'active', hp_restored: healing }
        break
      }

      case 'treasure': {
        const pool: any[] = dungeon.rewards_pool?.random ?? []
        const rng  = createSeededRng(hashString(run_id + room_number))
        const item = drawRandomReward(pool, rng)
        if (item) items_collected = [...items_collected, item]
        room.completed  = true
        room.result     = 'completed'
        room.item_found = item
        this.io?.to(`dungeon:${player_id}`).emit('dungeon:treasure', { item })
        result = { room_number, room_type: 'treasure', result: 'completed', run_status: 'active', item_found: item }
        break
      }

      case 'shop': {
        const shop_items = await this.buildShopOffer(dungeon, gold_collected)
        room.completed = true
        room.result    = 'completed'
        result = { room_number, room_type: 'shop', result: 'completed', run_status: 'active', shop_items }
        break
      }

      case 'trap': {
        const trap_mod = await this.drawModifiers(1, dungeon.difficulty, true)
        if (trap_mod.length > 0) {
          modifiers.push(trap_mod[0])
          this.io?.to(`dungeon:${player_id}`).emit('dungeon:modifier_applied', {
            modifier: { name_fr: trap_mod[0].name_fr, description_fr: trap_mod[0].description_fr, type: 'debuff' },
          })
        }
        room.completed = true
        room.result    = 'completed'
        result = { room_number, room_type: 'trap', result: 'completed', run_status: 'active', modifier_applied: trap_mod[0] ?? null }
        break
      }

      case 'boss': {
        const boss_enemies  = this.buildBossEnemies(dungeon)
        const combat_result = this.simulateDungeonCombat(team, boss_enemies, modifiers)

        if (combat_result.winner === 'player') {
          room.completed = true
          room.result    = 'victory'
          const final_rewards = await this.distributeRewards(player_id, run_id, dungeon)
          this.io?.to(`dungeon:${player_id}`).emit('dungeon:boss_defeated', { boss_name_fr: dungeon.name_fr, rewards: final_rewards })
          this.io?.to(`dungeon:${player_id}`).emit('dungeon:run_complete', {
            dungeon_name_fr: dungeon.name_fr, rooms_cleared: 10, gold_collected, items_collected, final_rewards,
          })
          await db.from('dungeon_runs').where('id', run_id).update({
            status: 'completed', current_room: 10, rooms_layout: JSON.stringify(rooms),
            team_snapshot: JSON.stringify(team), gold_collected,
            items_collected: JSON.stringify(items_collected),
            active_modifiers: JSON.stringify(modifiers), completed_at: new Date(),
          })
          return { room_number: 10, room_type: 'boss', result: 'victory', run_status: 'completed', final_rewards }
        } else {
          room.completed = true
          room.result    = 'defeat'
          this.io?.to(`dungeon:${player_id}`).emit('dungeon:combat_result', {
            room_number: 10, result: 'defeat', run_failed: true,
            message: 'Le boss est trop puissant. Le run est terminé.',
          })
          await db.from('dungeon_runs').where('id', run_id).update({
            status: 'failed', current_room: 10, rooms_layout: JSON.stringify(rooms),
            team_snapshot: JSON.stringify(team), gold_collected, completed_at: new Date(),
          })
          return { room_number: 10, room_type: 'boss', result: 'defeat', run_status: 'failed', message: 'Défaite face au boss.' }
        }
      }

      default:
        throw new Error(`Type de salle inconnu : ${room.type}`)
    }

    const next_room = room_number < 10 ? room_number + 1 : room_number
    await db.from('dungeon_runs').where('id', run_id).update({
      current_room: next_room,
      rooms_layout: JSON.stringify(rooms),
      team_snapshot: JSON.stringify(team),
      gold_collected,
      items_collected: JSON.stringify(items_collected),
      active_modifiers: JSON.stringify(modifiers),
    })

    return result
  }

  // ─── Achat dans la salle marchande ────────────────────────────────────────────

  async buyFromShop(player_id: string, run_id: string, item_name: string) {
    const run_row = await db.from('dungeon_runs').where({ id: run_id, player_id, status: 'active' }).first()
    if (!run_row) throw new Error('Run introuvable ou inactif.')

    const dungeon    = await db.from('dungeons').where('id', run_row.dungeon_id).first()
    const gold       = Number(run_row.gold_collected)
    const shop_items: any[] = await this.buildShopOffer(dungeon, gold)

    const chosen = shop_items.find((i) => i.name_fr === item_name)
    if (!chosen) throw new Error("Cet item n'est pas disponible dans la boutique.")
    if (gold < chosen.price) throw new Error(`Or insuffisant. Prix : ${chosen.price}💰, Vous avez : ${gold}💰.`)

    const items_collected: object[] = [...run_row.items_collected, { type: 'item', item_name, from_shop: true }]
    await db.from('dungeon_runs').where('id', run_id).update({
      gold_collected: gold - chosen.price,
      items_collected: JSON.stringify(items_collected),
    })
    return { success: true, message: `${item_name} acheté pour ${chosen.price}💰.` }
  }

  // ─── Abandonner un run ────────────────────────────────────────────────────────

  async abandonRun(player_id: string, run_id: string): Promise<void> {
    await db.from('dungeon_runs')
      .where({ id: run_id, player_id, status: 'active' })
      .update({ status: 'failed', completed_at: new Date() })
  }

  // ─── Liste des donjons avec statut ────────────────────────────────────────────

  async listDungeons(player_id: string) {
    const week    = currentWeekNumber()
    const dungeons = await db.from('dungeons').where('is_active', true).orderBy('min_prestige', 'asc')
    const runs     = await db.from('dungeon_runs').where({ player_id }).where('season_week', week)
      .select('dungeon_id', 'status', 'completed_at')
    const run_map  = new Map(runs.map((r: any) => [r.dungeon_id, r]))

    const player   = await db.from('players').where('id', player_id).select('prestige_level').first()
    const prestige = Number(player?.prestige_level ?? 0)

    const boss_ids = dungeons.map((d: any) => d.boss_species_id).filter(Boolean)
    const species  = boss_ids.length
      ? await db.from('pokemon_species').whereIn('id', boss_ids).select('id', 'name_fr')
      : []
    const boss_map = new Map((species as any[]).map((s) => [s.id, s.name_fr]))

    return dungeons.map((d: any) => {
      const run = run_map.get(d.id) ?? null
      return {
        id: d.id,
        name_fr: d.name_fr,
        region: d.region,
        difficulty: d.difficulty,
        min_prestige: d.min_prestige,
        boss_name_fr: boss_map.get(d.boss_species_id) ?? 'Boss',
        is_unlocked: prestige >= Number(d.min_prestige),
        run_this_week: run ? { status: run.status, completed_at: run.completed_at ?? null } : null,
      }
    })
  }

  // ─── Run actif ────────────────────────────────────────────────────────────────

  async getActiveRun(player_id: string): Promise<DungeonRun | null> {
    const run_row = await db.from('dungeon_runs')
      .where({ player_id, status: 'active' })
      .orderBy('started_at', 'desc')
      .first()
    if (!run_row) return null
    const dungeon = await db.from('dungeons').where('id', run_row.dungeon_id).first()
    return this.formatRun(run_row, dungeon)
  }

  // ─── Récompenses ─────────────────────────────────────────────────────────────

  async getPendingRewards(player_id: string) {
    return db
      .from('dungeon_rewards as dr')
      .join('dungeons as d', 'd.id', 'dr.dungeon_id')
      .where({ 'dr.player_id': player_id, 'dr.collected': false })
      .orderBy('dr.created_at', 'desc')
      .select('dr.id', 'dr.reward_type', 'dr.reward_data', 'd.name_fr as dungeon_name_fr')
  }

  async collectReward(player_id: string, reward_id: string): Promise<void> {
    const reward = await db.from('dungeon_rewards')
      .where({ id: reward_id, player_id, collected: false })
      .first()
    if (!reward) throw new Error('Récompense introuvable.')

    await db.from('dungeon_rewards').where('id', reward_id).update({ collected: true })

    const data: any = reward.reward_data
    if (reward.reward_type === 'gems') {
      await gemsService.awardGems(player_id, data.amount, `Donjon — ${data.amount} gems`, 'dungeon_reward')
    } else if (reward.reward_type === 'gold') {
      await db.from('players').where('id', player_id).update({ gold: db.raw('gold + ?', [data.amount]) })
    }
    // items/pokemon/ct : distribués lors de futures intégrations
  }

  // ─── Historique ───────────────────────────────────────────────────────────────

  async getHistory(player_id: string, limit = 10) {
    return db
      .from('dungeon_runs as dr')
      .join('dungeons as d', 'd.id', 'dr.dungeon_id')
      .where('dr.player_id', player_id)
      .whereIn('dr.status', ['completed', 'failed'])
      .orderBy('dr.started_at', 'desc')
      .limit(limit)
      .select(
        'dr.id', 'dr.status', 'dr.current_room', 'dr.gold_collected',
        'dr.started_at', 'dr.completed_at',
        'd.name_fr as dungeon_name_fr', 'd.difficulty', 'd.region'
      )
  }

  // ─── Privé — ennemis ──────────────────────────────────────────────────────────

  private buildRoomEnemies(dungeon: any, room_number: number, is_elite: boolean): CombatPokemon[] {
    const level = Math.min(dungeon.boss_level - 5 + Math.floor(room_number * 2), dungeon.boss_level - 2)
    const count = is_elite ? 1 : Math.min(1 + Math.floor(room_number / 3), 4)
    return Array.from({ length: count }, (_, i) => this.buildGenericEnemy(i, level, is_elite ? 1.3 : 1.0))
  }

  private buildBossEnemies(dungeon: any): CombatPokemon[] {
    return [this.buildGenericEnemy(0, dungeon.boss_level, 2.0, dungeon.boss_species_id)]
  }

  private buildGenericEnemy(index: number, level: number, stat_mult: number, species_id?: number): CombatPokemon {
    const base   = 45 + Math.floor(level * 0.6)
    const max_hp = Math.floor((2 * Math.floor(base * stat_mult) + 15) * level / 100 + level + 10)
    const eff_atk   = Math.floor((2 * Math.floor((base + 10) * stat_mult) + 15) * level / 100 + 5)
    const eff_def   = Math.floor((2 * Math.floor(base * stat_mult) + 15) * level / 100 + 5)
    const eff_speed = Math.floor((2 * Math.floor((base + 5) * stat_mult) + 15) * level / 100 + 5)

    const move: CombatMove = {
      id: 0, name_fr: 'Attaque Donjon', type: 'normal' as PokemonType, category: 'physical',
      power: Math.min(150, 40 + Math.floor(level * 0.8)), accuracy: 100, pp: 30, priority: 0, effect: null,
    }

    return {
      id: `dungeon_enemy_${index}_${species_id ?? level}`,
      species_id: species_id ?? 0,
      name_fr: species_id ? `Boss #${species_id}` : 'Ennemi de Donjon',
      level, nature: 'hardy' as Nature,
      ivs: { hp: 15, atk: 15, def: 15, spatk: 15, spdef: 15, speed: 15 },
      type1: 'normal' as PokemonType, type2: null,
      base_hp: base, base_atk: base + 10, base_def: base, base_spatk: base + 10, base_spdef: base, base_speed: base + 5,
      moves: [move],
      sprite_url: species_id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${species_id}.png` : '',
      is_shiny: false, max_hp, current_hp: max_hp, effective_atk: eff_atk, effective_def: eff_def,
      effective_spatk: eff_atk, effective_spdef: eff_def, effective_speed: eff_speed,
      status: null, confusion: null,
      stat_modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 },
      current_move_index: 0, pp_remaining: [move.pp], next_action_at: 0,
    }
  }

  // ─── Privé — combat synchrone ─────────────────────────────────────────────────

  simulateDungeonCombat(
    player_snapshot: DungeonPokemonSnapshot[],
    enemies: CombatPokemon[],
    modifiers: DungeonModifier[]
  ): { winner: 'player' | 'enemy'; surviving_player_team: CombatPokemon[] } {
    const player_team: CombatPokemon[] = player_snapshot
      .filter((p) => p.current_hp > 0)
      .map((p) => this.snapshotToCombatPokemon(p))

    const modified_snapshot = applyDungeonModifiers(player_snapshot, modifiers)
    const modified_team: CombatPokemon[] = modified_snapshot
      .filter((p) => p.current_hp > 0)
      .map((p) => this.snapshotToCombatPokemon(p))

    for (const mod of modifiers) {
      if (mod.effect_json.poison_on_start) {
        for (const p of modified_team) {
          p.status = { type: 'poison', actions_remaining: 999 }
        }
      }
    }

    let atk_alive = modified_team.filter((p) => p.current_hp > 0)
    let def_alive  = enemies.filter((p) => p.current_hp > 0)
    let actions   = 0

    while (atk_alive.length > 0 && def_alive.length > 0 && actions < MAX_BATTLE_ACTIONS) {
      const a = atk_alive[0]
      const d = def_alive[0]

      const pairs = [
        { attacker: a, defender: d },
        { attacker: d, defender: a },
      ].sort((x, y) => y.attacker.effective_speed - x.attacker.effective_speed)

      for (const { attacker, defender } of pairs) {
        if (attacker.current_hp <= 0 || defender.current_hp <= 0) continue
        const move = attacker.moves[0]
        if (!move || !move.power) continue
        const { damage } = calcDamage(attacker, defender, move)
        defender.current_hp = Math.max(0, defender.current_hp - damage)
        actions++
        if (defender.current_hp === 0) {
          atk_alive = modified_team.filter((p) => p.current_hp > 0)
          def_alive  = enemies.filter((p) => p.current_hp > 0)
          break
        }
      }
    }

    const player_wins = atk_alive.length > 0 && def_alive.length === 0

    // Répercuter les HP modifiés dans l'équipe originale (proportionnel)
    for (let i = 0; i < player_team.length; i++) {
      const mod_poke = modified_team[i]
      if (!mod_poke) continue
      const orig = player_team[i]
      if (mod_poke.current_hp <= 0) {
        orig.current_hp = 0
      } else if (orig.max_hp > 0 && mod_poke.max_hp > 0) {
        orig.current_hp = Math.max(1, Math.floor((mod_poke.current_hp / mod_poke.max_hp) * orig.max_hp))
      }
    }

    return { winner: player_wins ? 'player' : 'enemy', surviving_player_team: player_team }
  }

  private snapshotToCombatPokemon(p: DungeonPokemonSnapshot): CombatPokemon {
    return buildCombatPokemon({
      id: p.player_pokemon_id,
      species_id: p.species_id,
      name_fr: p.name_fr,
      level: p.level,
      nature: p.nature as Nature,
      ivs: p.ivs,
      type1: p.type1 as PokemonType,
      type2: p.type2 as PokemonType | null,
      base_hp: p.base_hp, base_atk: p.base_atk, base_def: p.base_def,
      base_spatk: p.base_spatk, base_spdef: p.base_spdef, base_speed: p.base_speed,
      moves: p.moves.map((m) => ({
        id: m.id, name_fr: m.name_fr, type: m.type as PokemonType,
        category: m.category as 'physical' | 'special' | 'status',
        power: m.power, accuracy: m.accuracy, pp: m.pp_remaining, priority: m.priority, effect: m.effect as any,
      })),
      sprite_url: p.sprite_url,
      is_shiny: p.is_shiny,
    })
  }

  private syncTeamHP(snapshot: DungeonPokemonSnapshot[], combat_team: CombatPokemon[]): DungeonPokemonSnapshot[] {
    const hp_map = new Map(combat_team.map((p) => [p.id, p.current_hp]))
    return snapshot.map((p) => ({
      ...p,
      current_hp: hp_map.has(p.player_pokemon_id) ? (hp_map.get(p.player_pokemon_id) ?? 0) : 0,
    }))
  }

  // ─── Privé — récompenses ──────────────────────────────────────────────────────

  private async distributeRewards(player_id: string, run_id: string, dungeon: any): Promise<object[]> {
    const pool: any = dungeon.rewards_pool
    const rows: object[] = []

    for (const reward of (pool.guaranteed ?? []) as any[]) {
      rows.push({ player_id, dungeon_id: dungeon.id, run_id, reward_type: reward.type, reward_data: JSON.stringify(reward), collected: false })
    }

    const random_pool: any[] = pool.random ?? []
    if (random_pool.length > 0) {
      const rng   = createSeededRng(hashString(run_id + 'reward'))
      const drawn = drawRandomReward(random_pool, rng)
      if (drawn) rows.push({ player_id, dungeon_id: dungeon.id, run_id, reward_type: (drawn as any).type, reward_data: JSON.stringify(drawn), collected: false })
    }

    if (rows.length > 0) await db.table('dungeon_rewards').insert(rows)
    return rows
  }

  private async drawModifiers(count: number, _difficulty: string, force_debuff = false): Promise<DungeonModifier[]> {
    let q = db.from('dungeon_modifiers').where('is_active', true)
    if (force_debuff) q = q.where('modifier_type', 'debuff')
    const all: any[] = await q
    if (!all.length) return []
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map((m) => ({
      id: m.id, name_fr: m.name_fr, description_fr: m.description_fr,
      modifier_type: m.modifier_type, effect_json: m.effect_json,
    }))
  }

  private async buildShopOffer(dungeon: any, gold_collected: number): Promise<object[]> {
    const pool: any[] = dungeon.rewards_pool?.random ?? []
    return pool
      .filter((r: any) => r.type === 'item')
      .slice(0, 3)
      .map((r: any) => {
        const price = Math.floor(3000 + Math.floor(Math.random() * 2000))
        return {
          name_fr: r.item_name ?? 'Item',
          type: r.type,
          price,
          can_afford: gold_collected >= price,
        }
      })
  }

  private async loadPlayerTeam(player_id: string) {
    return PlayerPokemon.query()
      .where('playerId', player_id)
      .whereNotNull('slotTeam')
      .orderBy('slotTeam', 'asc')
      .preload('species')
      .preload('moves', (q) => q.preload('move', (mq) => mq.preload('effect')))
      .limit(6)
  }

  private buildTeamSnapshot(pokemons: any[]): DungeonPokemonSnapshot[] {
    return pokemons.map((pp) => {
      const species = pp.species
      const max_hp  = Math.floor(((2 * species.baseHp + pp.ivHp) * pp.level) / 100 + pp.level + 10)
      return {
        player_pokemon_id: pp.id,
        species_id: species.id,
        name_fr: species.nameFr,
        level: pp.level,
        current_hp: max_hp,
        max_hp,
        sprite_url: species.spriteUrl ?? '',
        is_shiny: pp.isShiny,
        nature: pp.nature,
        ivs: { hp: pp.ivHp, atk: pp.ivAtk, def: pp.ivDef, spatk: pp.ivSpatk, spdef: pp.ivSpdef, speed: pp.ivSpeed },
        base_hp: species.baseHp, base_atk: species.baseAtk, base_def: species.baseDef,
        base_spatk: species.baseSpatk, base_spdef: species.baseSpdef, base_speed: species.baseSpeed,
        type1: species.type1, type2: species.type2 ?? null,
        moves: pp.moves
          .sort((a: any, b: any) => a.slot - b.slot)
          .map((pm: any) => ({
            id: pm.move.id, name_fr: pm.move.nameFr, type: pm.move.type, category: pm.move.category,
            power: pm.move.power ?? null, accuracy: pm.move.accuracy ?? null,
            pp: pm.ppMax, pp_remaining: pm.ppMax, priority: pm.move.priority,
            effect: pm.move.effect
              ? { effect_type: pm.move.effect.effectType, stat_target: pm.move.effect.statTarget ?? null,
                  stat_change: pm.move.effect.statChange ?? null, target: pm.move.effect.target ?? 'opponent',
                  duration_min: pm.move.effect.durationMin ?? null, duration_max: pm.move.effect.durationMax ?? null,
                  chance_percent: pm.move.effect.chancePercent ?? 100 }
              : null,
          })),
      }
    })
  }

  private formatRun(run_row: any, dungeon: any): DungeonRun {
    return {
      run_id: run_row.id,
      dungeon_id: run_row.dungeon_id,
      dungeon_name_fr: dungeon?.name_fr ?? '',
      dungeon_region: dungeon?.region ?? '',
      dungeon_difficulty: dungeon?.difficulty ?? '',
      current_room: Number(run_row.current_room),
      status: run_row.status,
      rooms: run_row.rooms_layout,
      modifiers: run_row.active_modifiers,
      team: run_row.team_snapshot,
      gold_collected: Number(run_row.gold_collected),
      items_collected: run_row.items_collected,
    }
  }

  private roomTypeName(type: string): string {
    const names: Record<string, string> = {
      combat: 'Salle de Combat', elite: 'Salle Élite', rest: 'Salle de Repos',
      treasure: 'Salle au Trésor', shop: 'Salle Marchande', trap: 'Salle Piégée', boss: 'Salle du Boss',
    }
    return names[type] ?? type
  }
}

const dungeonService = new DungeonServiceClass()
export default dungeonService
