/**
 * TowerService — Gestion des sessions Tour Infinie.
 * Singleton côté serveur — une session active par joueur.
 */

import type { Server as SocketServer } from 'socket.io'
import db from '@adonisjs/lucid/services/db'
import gemsService from '#services/GemsService'
import TowerCombatSession from '#services/TowerCombatSession'
import { buildCombatPokemon } from '#services/CombatService'
import PlayerPokemon from '#models/player_pokemon'
import type { Nature, PokemonType } from '@pokegrind/shared'

export interface TowerStatus {
  season_id: number
  season_name_fr: string
  season_end_at: string
  current_floor: number
  max_floor_reached: number
  total_kills_tower: number
  gems_earned_this_season: number
  next_milestone: { floor: number; gems_reward: number; name_fr: string } | null
  next_boss: { floor: number; name_fr: string; mechanic_type: string } | null
}

class TowerServiceClass {
  private sessions: Map<string, TowerCombatSession> = new Map()
  private io!: SocketServer

  setIO(io: SocketServer): void {
    this.io = io
  }

  // ─── Saison active ────────────────────────────────────────────────────────

  async getActiveSeason(): Promise<{ id: number; name_fr: string; end_at: string } | null> {
    const season = await db.from('tower_seasons').where('is_active', true).first()
    if (!season) return null
    return { id: season.id, name_fr: season.name_fr, end_at: season.end_at }
  }

  // ─── Progression joueur ───────────────────────────────────────────────────

  async getOrCreateProgress(player_id: string, season_id: number) {
    const existing = await db
      .from('tower_progress')
      .where({ player_id, season_id })
      .first()

    if (existing) return existing

    await db.table('tower_progress').insert({
      id: crypto.randomUUID(),
      player_id,
      season_id,
      current_floor: 1,
      max_floor_reached: 0,
      total_kills_tower: 0,
      gems_earned_this_season: 0,
      last_active_at: new Date(),
    })

    return db.from('tower_progress').where({ player_id, season_id }).first()
  }

  async getTowerStatus(player_id: string): Promise<TowerStatus | null> {
    const season = await this.getActiveSeason()
    if (!season) return null

    const progress = await this.getOrCreateProgress(player_id, season.id)

    // Prochain palier
    const next_milestone = await db
      .from('tower_milestones')
      .where('floor_number', '>', Number(progress.current_floor))
      .orderBy('floor_number', 'asc')
      .select('floor_number', 'gems_reward', 'name_fr')
      .first()

    // Prochain boss
    const next_boss = await db
      .from('tower_bosses')
      .where('floor_number', '>', Number(progress.current_floor))
      .where('floor_number', '<=', Number(progress.current_floor) + 25)
      .orderBy('floor_number', 'asc')
      .select('floor_number', 'name_fr', 'mechanic_type')
      .first()

    return {
      season_id: season.id,
      season_name_fr: season.name_fr,
      season_end_at: season.end_at,
      current_floor: Number(progress.current_floor),
      max_floor_reached: Number(progress.max_floor_reached),
      total_kills_tower: Number(progress.total_kills_tower),
      gems_earned_this_season: Number(progress.gems_earned_this_season),
      next_milestone: next_milestone
        ? { floor: next_milestone.floor_number, gems_reward: next_milestone.gems_reward, name_fr: next_milestone.name_fr }
        : null,
      next_boss: next_boss
        ? { floor: next_boss.floor_number, name_fr: next_boss.name_fr, mechanic_type: next_boss.mechanic_type }
        : null,
    }
  }

  // ─── Démarrer une session ─────────────────────────────────────────────────

  async startSession(player_id: string): Promise<TowerCombatSession | null> {
    // Arrêter session existante
    const existing = this.sessions.get(player_id)
    if (existing) {
      existing.stop()
      this.sessions.delete(player_id)
    }

    const season = await this.getActiveSeason()
    if (!season) return null

    const progress = await this.getOrCreateProgress(player_id, season.id)
    const floor_number = Number(progress.current_floor)

    // Charger l'équipe du joueur
    const player_team = await this.buildPlayerTeam(player_id)
    if (player_team.length === 0) return null

    // Boss mechanic si étage boss
    let boss_mechanic = null
    if (floor_number % 25 === 0) {
      const boss_row = await db.from('tower_bosses').where('floor_number', floor_number).first()
      if (boss_row) {
        boss_mechanic = {
          ...boss_row.mechanic_config,
          type: boss_row.mechanic_type,
        }
      }
    }

    // Species pool selon le tier de l'étage
    const species_pool = await this.getSpeciesPoolForFloor(floor_number)

    const session = new TowerCombatSession({
      player_id,
      floor_number,
      season_id: season.id,
      player_team,
      io: this.io,
      boss_mechanic,
      species_pool,
    })

    // Callback victoire
    session.onFloorClear = async (fn: number, gold: number, xp: number) => {
      await this.handleFloorClear(player_id, season.id, fn, gold, xp)
    }

    // Callback défaite
    session.onFloorFail = () => {
      this.handleFloorFail(player_id, season.id).catch((err) =>
        console.error('[TowerService] handleFloorFail error:', err)
      )
    }

    this.sessions.set(player_id, session)
    session.start()

    // Mettre à jour last_active_at
    await db.from('tower_progress').where({ player_id, season_id: season.id }).update({
      last_active_at: new Date(),
    })

    return session
  }

  stopSession(player_id: string): void {
    const session = this.sessions.get(player_id)
    if (session) {
      session.stop()
      this.sessions.delete(player_id)
    }
  }

  getSession(player_id: string): TowerCombatSession | undefined {
    return this.sessions.get(player_id)
  }

  // ─── Gestion de la progression ────────────────────────────────────────────

  private async handleFloorClear(
    player_id: string,
    season_id: number,
    floor_number: number,
    gold: number,
    xp: number
  ): Promise<void> {
    this.sessions.delete(player_id)

    const next_floor = floor_number + 1

    // Mettre à jour la progression
    await db.from('tower_progress')
      .where({ player_id, season_id })
      .update({
        current_floor: next_floor,
        max_floor_reached: db.raw('GREATEST(max_floor_reached, ?)', [floor_number]),
        total_kills_tower: db.raw('total_kills_tower + 1'),
        last_active_at: new Date(),
      })

    // Mettre à jour le leaderboard
    await db.rawQuery(
      `INSERT INTO tower_leaderboard (season_id, player_id, max_floor, updated_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (season_id, player_id)
       DO UPDATE SET max_floor = GREATEST(tower_leaderboard.max_floor, EXCLUDED.max_floor), updated_at = NOW()`,
      [season_id, player_id, floor_number]
    )

    // Distribuer or et XP
    await db.from('players').where('id', player_id).update({
      gold: db.raw('gold + ?', [gold]),
    })

    // Vérifier milestone
    const milestone = await db
      .from('tower_milestones')
      .where('floor_number', floor_number)
      .first()

    if (milestone) {
      await gemsService.awardGems(
        player_id,
        milestone.gems_reward,
        `Tour Infinie — Palier étage ${floor_number} (${milestone.name_fr})`,
        'tower_milestone'
      )

      await db.from('tower_progress')
        .where({ player_id, season_id })
        .update({
          gems_earned_this_season: db.raw('gems_earned_this_season + ?', [milestone.gems_reward]),
        })

      this.io.to(`tower:${player_id}`).emit('tower:milestone', {
        floor_number,
        milestone_name_fr: milestone.name_fr,
        gems_reward: milestone.gems_reward,
      })
    }

    // Vérifier boss reward
    if (floor_number % 25 === 0) {
      const boss = await db.from('tower_bosses').where('floor_number', floor_number).first()
      if (boss) {
        await gemsService.awardGems(
          player_id,
          boss.gems_reward,
          `Tour Infinie — Boss étage ${floor_number} (${boss.name_fr})`,
          'tower_boss'
        )

        await db.from('tower_progress')
          .where({ player_id, season_id })
          .update({
            gems_earned_this_season: db.raw('gems_earned_this_season + ?', [boss.gems_reward]),
          })

        this.io.to(`tower:${player_id}`).emit('tower:boss_reward', {
          floor_number,
          boss_name_fr: boss.name_fr,
          gems_reward: boss.gems_reward,
        })
      }
    }
  }

  private async handleFloorFail(player_id: string, season_id: number): Promise<void> {
    this.sessions.delete(player_id)

    // Reset au floor 1
    await db.from('tower_progress')
      .where({ player_id, season_id })
      .update({
        current_floor: 1,
        last_active_at: new Date(),
      })
  }

  // ─── Species pool selon tier ──────────────────────────────────────────────

  private async getSpeciesPoolForFloor(
    floor_number: number
  ): Promise<Array<{ id: number; name_fr: string }>> {
    // Mapping tier → rarities pour la DB
    const tier_rarity: Record<string, string[]> = {
      D: ['common'],
      C: ['common', 'rare'],
      B: ['rare', 'epic'],
      A: ['epic', 'legendary'],
      S: ['legendary', 'mythic'],
      'S+': ['legendary', 'mythic'],
    }

    const tiers =
      floor_number < 50  ? ['D', 'C'] :
      floor_number < 100 ? ['C', 'B'] :
      floor_number < 200 ? ['B', 'A'] :
      floor_number < 300 ? ['A', 'S'] :
                           ['S', 'S+']

    const rarities = [...new Set(tiers.flatMap((t) => tier_rarity[t] ?? ['common']))]

    const rows = await db
      .from('pokemon_species')
      .whereIn('rarity', rarities)
      .select('id', 'name_fr')
      .limit(200)

    return rows.map((r: any) => ({ id: r.id, name_fr: r.name_fr }))
  }

  // ─── Construction de l'équipe joueur ─────────────────────────────────────

  private async buildPlayerTeam(player_id: string) {
    const pokemons = await PlayerPokemon.query()
      .where('playerId', player_id)
      .whereNotNull('slotTeam')
      .orderBy('slotTeam', 'asc')
      .preload('species')
      .preload('moves', (q) => q.preload('move', (mq) => mq.preload('effect')))
      .limit(6)

    // Load items
    const item_ids = pokemons.map((p) => p.equippedItemId).filter(Boolean)
    const items = item_ids.length > 0
      ? await db.from('items').whereIn('id', item_ids).select('id', 'effect_type', 'effect_value')
      : []
    const item_map = new Map(items.map((i: any) => [i.id, i]))

    return pokemons.map((pp) => {
      const species = pp.species
      const moves_data = pp.moves
        .sort((a, b) => a.slot - b.slot)
        .map((pm) => ({
          id: pm.move.id,
          name_fr: pm.move.nameFr,
          type: pm.move.type as PokemonType,
          category: pm.move.category as 'physical' | 'special' | 'status',
          power: pm.move.power ?? 0,
          accuracy: pm.move.accuracy ?? 100,
          pp: pm.ppMax,
          priority: pm.move.priority,
          effect: pm.move.effect
            ? {
                effect_type: pm.move.effect.effectType,
                stat_target: pm.move.effect.statTarget ?? undefined,
                stat_change: pm.move.effect.statChange ?? undefined,
                target: pm.move.effect.target ?? 'opponent',
                duration_min: pm.move.effect.durationMin ?? undefined,
                duration_max: pm.move.effect.durationMax ?? undefined,
                chance_percent: pm.move.effect.chancePercent ?? 100,
              }
            : null,
        }))

      const item = pp.equippedItemId ? (item_map.get(pp.equippedItemId) ?? null) : null

      return buildCombatPokemon({
        id: pp.id,
        species_id: species.id,
        name_fr: species.nameFr,
        level: pp.level,
        nature: pp.nature as Nature,
        ivs: {
          hp: pp.ivHp,
          atk: pp.ivAtk,
          def: pp.ivDef,
          spatk: pp.ivSpatk,
          spdef: pp.ivSpdef,
          speed: pp.ivSpeed,
        },
        base_hp: species.baseHp,
        base_atk: species.baseAtk,
        base_def: species.baseDef,
        base_spatk: species.baseSpatk,
        base_spdef: species.baseSpdef,
        base_speed: species.baseSpeed,
        type1: species.type1 as PokemonType,
        type2: species.type2 as PokemonType | null,
        sprite_url: species.spriteUrl ?? '',
        is_shiny: pp.isShiny,
        stars: pp.stars,
        moves: moves_data,
        item,
      })
    })
  }

  // ─── Classement ───────────────────────────────────────────────────────────

  async getLeaderboard(season_id: number, limit = 100) {
    const rows = await db
      .from('tower_leaderboard as tl')
      .join('players as p', 'p.id', 'tl.player_id')
      .where('tl.season_id', season_id)
      .orderBy('tl.max_floor', 'desc')
      .orderBy('tl.updated_at', 'asc')
      .limit(limit)
      .select('p.username', 'tl.max_floor', 'tl.rank', 'tl.updated_at')

    return rows.map((r: any, i: number) => ({
      rank: i + 1,
      username: r.username,
      max_floor: r.max_floor,
      updated_at: r.updated_at,
    }))
  }

  async updateRanks(season_id: number): Promise<void> {
    await db.rawQuery(`
      UPDATE tower_leaderboard tl
      SET rank = ranked.r
      FROM (
        SELECT player_id,
               ROW_NUMBER() OVER (ORDER BY max_floor DESC, updated_at ASC) AS r
        FROM tower_leaderboard
        WHERE season_id = ?
      ) ranked
      WHERE tl.player_id = ranked.player_id AND tl.season_id = ?
    `, [season_id, season_id])
  }
}

const towerService = new TowerServiceClass()
export default towerService
