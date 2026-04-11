/**
 * CombatProgressionService — Gestion des sessions actives + calcul offline
 * Singleton côté serveur — une session par joueur.
 */

import type { Server as SocketServer } from 'socket.io'
import db from '@adonisjs/lucid/services/db'
import Player from '#models/player'
import PlayerPokemon from '#models/player_pokemon'
import Floor from '#models/floor'
import CombatSession from '#services/CombatSession'
import daycareService, { hasUpgrade } from '#services/DaycareService'
import PushService from '#services/PushService'
import gemsService from '#services/GemsService'
import {
  buildCombatPokemon,
  estimatePokemonDPS,
  type CombatPokemon,
  type CombatMove,
  type StatBlock,
} from '#services/CombatService'
import { checkKillMilestone, KILL_MILESTONES } from '#services/ShopFormulas'
import { applyPrestigeGoldMult, applyPrestigeXpMult, calcBossGems } from '#services/PrestigeFormulas'
import type { Nature, PokemonType } from '@pokegrind/shared'

export interface OfflineReport {
  gold_earned: number
  xp_earned: number
  kills: number
  hatches: number
  drops_json: object
  absence_seconds: number
  floor_farmed: number
  player_id: string
}

export interface BossRewards {
  gems_earned: number
  first_time: boolean
}

class CombatProgressionService {
  private sessions: Map<string, CombatSession> = new Map()
  private io!: SocketServer
  private saveIntervals: Map<string, NodeJS.Timeout> = new Map()

  setIO(io: SocketServer): void {
    this.io = io
  }

  getActiveSessionCount(): number {
    return this.sessions.size
  }

  // ─── Démarrer ou reprendre une session ────────────────────────────────────

  async startSession(player_id: string): Promise<CombatSession> {
    // Arrêter session existante
    const existing = this.sessions.get(player_id)
    if (existing) {
      existing.stop()
    }

    const player = await Player.findOrFail(player_id)
    const floor = await Floor.findByOrFail('floor_number', player.currentFloor)
    const playerTeam = await this.buildPlayerTeam(player_id)

    const session = new CombatSession({
      player_id,
      floor,
      player_team: playerTeam,
      io: this.io,
    })

    // Callbacks
    session.onVictoryBattle = async (gold: number, xp: number) => {
      await this.applyBattleRewards(player_id, gold, xp)
    }

    session.onBossDefeated = async (floor_number: number) => {
      // Avancer l'étage
      const nextFloorNum = floor_number + 1
      const nextFloor = await Floor.findBy('floor_number', nextFloorNum)

      // Mettre à jour max_floor_reached
      const currentPlayer = await Player.findOrFail(player_id)
      if (nextFloorNum > currentPlayer.maxFloorReached) {
        currentPlayer.maxFloorReached = nextFloorNum
        await currentPlayer.save()
      }
      currentPlayer.currentFloor = nextFloorNum
      await currentPlayer.save()

      // Récompenses boss
      const rewards = await this.applyBossRewards(player_id, floor_number)

      // Émettre new_floor
      if (nextFloor) {
        session.floor = nextFloor
        session.io.to(session.socket_room).emit('combat:new_floor', {
          floor_number: nextFloorNum,
          floor_name_fr: nextFloor.nameFr,
          region: nextFloor.region,
          gems_earned: rewards.gems_earned > 0 ? rewards.gems_earned : undefined,
          is_milestone: nextFloor.isMilestone,
        })
      }
    }

    // Callback daycare : distribuer les dégâts + notifier les éclosions prêtes
    session.onDaycareDistribute = async (damage: number) => {
      const newly_ready = await daycareService.distributeDamage(player_id, damage)
      if (newly_ready.length > 0) {
        await PushService.notifyHatchReady(player_id, newly_ready)
      }
      return newly_ready
    }

    // Callback auto-hatch : éclosion automatique si upgrade auto_collect
    session.onDaycareAutoHatch = async (slot_number: number) => {
      const auto = await hasUpgrade(player_id, 'auto_collect')
      if (!auto) return
      const result = await daycareService.hatchEgg(player_id, slot_number)
      session.io.to(session.socket_room).emit('daycare:hatched', {
        slot_number: result.slot_number,
        original_pokemon: { name_fr: result.new_pokemon_name_fr, stars: result.stars_gained },
        new_pokemon: {
          name_fr: result.new_pokemon_name_fr,
          rarity: result.new_pokemon_rarity,
          is_shiny: result.is_shiny,
          has_hidden_talent: result.has_hidden_talent,
        },
        auto_restarted: result.auto_restarted,
      })
      if (result.is_shiny || result.has_hidden_talent) {
        await PushService.notifyHatched(
          player_id,
          result.new_pokemon_name_fr,
          result.is_shiny,
          result.has_hidden_talent
        )
      }
    }

    this.sessions.set(player_id, session)
    session.start()

    // Auto-save toutes les 30s + daycare progress broadcast
    const interval = setInterval(async () => {
      await this.saveProgress(player_id)
      await this.broadcastDaycareProgress(player_id)
    }, 30_000)
    this.saveIntervals.set(player_id, interval)

    return session
  }

  // ─── Broadcast progression pension ───────────────────────────────────────

  private async broadcastDaycareProgress(player_id: string): Promise<void> {
    const session = this.sessions.get(player_id)
    if (!session) return
    try {
      const state = await daycareService.getDaycareState(player_id)
      const active = state.slots
        .filter((s) => s.pokemon !== null)
        .map((s) => ({
          slot_number: s.slot_number,
          damage_accumulated: s.damage_accumulated,
          progress_percent: s.progress_percent,
        }))
      if (active.length > 0) {
        session.io.to(session.socket_room).emit('daycare:progress', { slots: active })
      }
    } catch {}
  }

  // ─── Arrêter une session ──────────────────────────────────────────────────

  async stopSession(player_id: string): Promise<void> {
    const session = this.sessions.get(player_id)
    if (session) {
      session.stop()
      this.sessions.delete(player_id)
    }
    const interval = this.saveIntervals.get(player_id)
    if (interval) {
      clearInterval(interval)
      this.saveIntervals.delete(player_id)
    }
  }

  getSession(player_id: string): CombatSession | undefined {
    return this.sessions.get(player_id)
  }

  // ─── Construire l'équipe joueur depuis la BDD ─────────────────────────────

  private async buildPlayerTeam(player_id: string): Promise<CombatPokemon[]> {
    const pokemons = await PlayerPokemon.query()
      .where('player_id', player_id)
      .whereNotNull('slot_team')
      .orderBy('slot_team', 'asc')
      .preload('species')
      .preload('moves', (q) => q.preload('move', (mq) => mq.preload('effect')))

    // Load item data for all equipped item IDs
    const item_ids = pokemons.map(p => p.equippedItemId).filter(Boolean) as number[]
    const items_data = item_ids.length > 0
      ? await db.from('items').whereIn('id', item_ids).select('id', 'name_fr', 'effect_type', 'effect_value')
      : []
    const item_map = new Map(items_data.map((i: any) => [i.id, i]))

    return pokemons.map((pp) => {
      const species = pp.species
      const moves: CombatMove[] = pp.moves
        .sort((a, b) => a.slot - b.slot)
        .map((ppm) => ({
          id: ppm.moveId,
          name_fr: ppm.move.nameFr,
          type: ppm.move.type as PokemonType,
          category: ppm.move.category,
          power: ppm.move.power,
          accuracy: ppm.move.accuracy,
          pp: ppm.ppMax,
          priority: ppm.move.priority,
          effect: ppm.move.effect
            ? {
                effect_type: ppm.move.effect.effectType,
                stat_target: ppm.move.effect.statTarget,
                stat_change: ppm.move.effect.statChange,
                target: ppm.move.effect.target,
                duration_min: ppm.move.effect.durationMin,
                duration_max: ppm.move.effect.durationMax,
                chance_percent: ppm.move.effect.chancePercent,
              }
            : null,
        }))

      const ivs: StatBlock = {
        hp: pp.ivHp ?? 0,
        atk: pp.ivAtk ?? 0,
        def: pp.ivDef ?? 0,
        spatk: pp.ivSpatk ?? 0,
        spdef: pp.ivSpdef ?? 0,
        speed: pp.ivSpeed ?? 0,
      }

      const raw_item = pp.equippedItemId ? item_map.get(pp.equippedItemId) ?? null : null
      const item = raw_item ? {
        id: raw_item.id,
        effect_type: raw_item.effect_type,
        effect_value: typeof raw_item.effect_value === 'string'
          ? JSON.parse(raw_item.effect_value)
          : raw_item.effect_value,
      } : null

      const combat_pokemon = buildCombatPokemon({
        id: pp.id,
        species_id: pp.speciesId,
        name_fr: pp.nickname ?? species.nameFr,
        level: pp.level,
        nature: pp.nature as Nature,
        ivs,
        type1: species.type1 as PokemonType,
        type2: species.type2 as PokemonType | null,
        base_hp: species.baseHp ?? 45,
        base_atk: species.baseAtk ?? 45,
        base_def: species.baseDef ?? 45,
        base_spatk: species.baseSpatk ?? 45,
        base_spdef: species.baseSpdef ?? 45,
        base_speed: species.baseSpeed ?? 45,
        moves,
        sprite_url: species.spriteUrl ?? '',
        sprite_shiny_url: species.spriteShinyUrl ?? undefined,
        is_shiny: pp.isShiny,
        item,
        item_name_fr: raw_item?.name_fr ?? undefined,
      })
      combat_pokemon.experience = pp.xp ?? 0
      return combat_pokemon
    })
  }

  // ─── Sauvegarde périodique ────────────────────────────────────────────────

  async saveProgress(player_id: string): Promise<void> {
    const session = this.sessions.get(player_id)
    if (!session) return

    await Player.query().where('id', player_id).update({
      current_floor: session.floor.floorNumber,
    })
  }

  // ─── Récompenses de bataille ──────────────────────────────────────────────

  async applyBattleRewards(player_id: string, gold: number, xp: number): Promise<void> {
    // Appliquer les multiplicateurs prestige
    const player_row = await db.from('players').where('id', player_id).select('prestige_gold_mult', 'prestige_xp_mult').first()
    if (player_row) {
      gold = applyPrestigeGoldMult(gold, Number(player_row.prestige_gold_mult ?? 1))
      xp = applyPrestigeXpMult(xp, Number(player_row.prestige_xp_mult ?? 1))
    }

    await db
      .from('players')
      .where('id', player_id)
      .increment('gold', gold)
      .increment('total_gold_earned', gold)
      .increment('total_kills', 1)

    // Vérifier milestones kills
    const player = await db.from('players').where('id', player_id).select('total_kills').first()
    const total_kills_after = Number(player?.total_kills ?? 0)
    const milestone = checkKillMilestone(total_kills_after - 1, 1)
    if (milestone !== null) {
      await gemsService.awardGems(
        player_id,
        5,
        `Milestone : ${milestone.toLocaleString('fr-FR')} victoires`,
        'kills_milestone'
      )
      const session = this.sessions.get(player_id)
      if (session) {
        const gems_total = await gemsService.getBalance(player_id)
        session.io.to(session.socket_room).emit('gems:earned', {
          amount: 5,
          reason: `Milestone : ${milestone.toLocaleString('fr-FR')} victoires`,
          source: 'kills_milestone',
          total_gems: gems_total,
        })
      }
    }

    // Distribuer l'XP aux Pokémon de l'équipe
    const session = this.sessions.get(player_id)
    if (session && xp > 0) {
      await this.distributeXpToTeam(player_id, xp, session)
    }
  }

  // ─── XP + montée de niveau des Pokémon ───────────────────────────────────

  /**
   * XP total requis pour atteindre un niveau donné (croissance cubique modérée).
   */
  private xpForLevel(level: number): number {
    if (level <= 1) return 0
    return Math.floor(Math.pow(level, 3) * 0.8)
  }

  /**
   * XP nécessaire pour passer du niveau `level` au niveau `level + 1`.
   */
  private xpToNextLevel(level: number): number {
    return this.xpForLevel(level + 1) - this.xpForLevel(level)
  }

  /**
   * Distribue l'XP de bataille à tous les Pokémon vivants de l'équipe.
   * Applique les montées de niveau en cascade jusqu'au niveau 100.
   */
  private async distributeXpToTeam(
    player_id: string,
    xp_total: number,
    session: CombatSession
  ): Promise<void> {
    const team = await db
      .from('player_pokemon')
      .where('player_id', player_id)
      .whereNotNull('slot_team')
      .where('level', '<', 100)
      .select('id', 'level', 'xp', 'species_id')

    if (team.length === 0) return

    const xp_per_pokemon = Math.max(1, Math.floor(xp_total / team.length))

    for (const pokemon of team) {
      let level = Number(pokemon.level)
      let current_xp = Number(pokemon.xp ?? 0) + xp_per_pokemon

      // Montées de niveau en cascade
      const level_ups: number[] = []
      while (level < 100 && current_xp >= this.xpToNextLevel(level)) {
        current_xp -= this.xpToNextLevel(level)
        level++
        level_ups.push(level)
      }
      current_xp = Math.max(0, current_xp)

      await db
        .from('player_pokemon')
        .where('id', pokemon.id)
        .update({ level, xp: current_xp })

      // Synchroniser l'objet CombatPokemon en mémoire (snapshot temps réel)
      const live = session.player_team.find((p) => p.id === pokemon.id)
      if (live) {
        live.level = level
        live.experience = current_xp
      }

      const xp_to_next = Math.max(1,
        Math.floor(Math.pow(level + 1, 3) * 0.8) - Math.floor(Math.pow(level, 3) * 0.8)
      )

      if (level_ups.length > 0) {
        await this.learnMovesOnLevelUp(pokemon.id, pokemon.species_id, level_ups)

        session.io.to(session.socket_room).emit('combat:level_up', {
          pokemon_id: pokemon.id,
          new_level: level_ups[level_ups.length - 1],
          levels_gained: level_ups.length,
          xp: current_xp,
          xp_to_next,
        })
      } else {
        // Émettre la mise à jour XP même sans level-up
        session.io.to(session.socket_room).emit('combat:xp_update', {
          pokemon_id: pokemon.id,
          xp: current_xp,
          xp_to_next,
        })
      }
    }
  }

  /**
   * Auto-apprend les moves débloqués lors de la montée de niveau
   * si le Pokémon a encore des slots libres (< 4 moves).
   */
  private async learnMovesOnLevelUp(
    pokemon_id: string,
    species_id: number,
    new_levels: number[]
  ): Promise<void> {
    const current_moves = await db
      .from('player_pokemon_moves')
      .where('player_pokemon_id', pokemon_id)
      .select('move_id', 'slot')

    if (current_moves.length >= 4) return

    const learnable = await db
      .from('pokemon_learnset')
      .whereIn('level_learned_at', new_levels)
      .where('species_id', species_id)
      .where('learn_method', 'level')
      .join('moves', 'moves.id', 'pokemon_learnset.move_id')
      .select('pokemon_learnset.move_id', 'moves.pp as pp')

    const existing_ids = new Set(current_moves.map((m: any) => Number(m.move_id)))
    let next_slot = current_moves.length + 1

    for (const move of learnable) {
      if (next_slot > 4) break
      if (existing_ids.has(Number(move.move_id))) continue

      await db.table('player_pokemon_moves').insert({
        id: crypto.randomUUID(),
        player_pokemon_id: pokemon_id,
        slot: next_slot,
        move_id: move.move_id,
        pp_current: move.pp ?? 10,
        pp_max: move.pp ?? 10,
      })
      existing_ids.add(Number(move.move_id))
      next_slot++
    }
  }

  // ─── Récompenses boss ────────────────────────────────────────────────────

  async applyBossRewards(player_id: string, floor_number: number): Promise<BossRewards> {
    const existing = await db
      .from('player_floor_progress')
      .where('player_id', player_id)
      .where('floor_number', floor_number)
      .first()

    const first_time = !existing || !existing.boss_defeated_at

    if (!existing) {
      await db.table('player_floor_progress').insert({
        player_id,
        floor_number,
        boss_defeated_at: new Date(),
        gems_claimed: false,
      })
    } else {
      await db
        .from('player_floor_progress')
        .where('player_id', player_id)
        .where('floor_number', floor_number)
        .update({ boss_defeated_at: new Date() })
    }

    let gems_earned = 0

    if (first_time) {
      const floor = await Floor.findBy('floor_number', floor_number)
      const base_gems = floor?.isMilestone ? 5 : 2

      // Bonus prestige
      const player_row = await db.from('players').where('id', player_id).select('prestige_gem_bonus').first()
      gems_earned = calcBossGems(base_gems, Number(player_row?.prestige_gem_bonus ?? 0))

      // Toutes les attributions gems via GemsService
      await gemsService.awardGems(
        player_id,
        gems_earned,
        `Boss étage ${floor_number} (première victoire)`,
        'boss_first_clear'
      )

      await db
        .from('player_floor_progress')
        .where('player_id', player_id)
        .where('floor_number', floor_number)
        .update({ gems_claimed: true })

      // Émettre gems:earned via Socket.io
      const session = this.sessions.get(player_id)
      if (session) {
        const total = await gemsService.getBalance(player_id)
        session.io.to(session.socket_room).emit('gems:earned', {
          amount: gems_earned,
          reason: `Boss étage ${floor_number}`,
          source: 'boss_first_clear',
          total_gems: total,
        })
      }

      // Vérifier si la région est maintenant complète
      if (floor) await this.checkRegionComplete(player_id, floor_number, floor.region)
    }

    return { gems_earned, first_time }
  }

  // ─── Vérification région complète ────────────────────────────────────────

  private async checkRegionComplete(
    player_id: string,
    floor_number: number,
    region: string
  ): Promise<void> {
    const region_boss_floors = await Floor.query()
      .where('region', region)
      .whereNotNull('boss_trainer_name')
      .select('floor_number')

    const cleared = await db
      .from('player_floor_progress')
      .where('player_id', player_id)
      .whereIn(
        'floor_number',
        region_boss_floors.map((f) => f.floorNumber)
      )
      .where('gems_claimed', true)

    if (cleared.length === region_boss_floors.length && region_boss_floors.length > 0) {
      // Vérifier si les gems de région n'ont pas déjà été attribuées
      const already = await db
        .from('gems_audit')
        .where('player_id', player_id)
        .where('source', 'region_complete')
        .where('reason', `like`, `%${region}%`)
        .first()
      if (already) return

      await gemsService.awardGems(
        player_id,
        10,
        `Région complétée : ${region}`,
        'region_complete'
      )

      const session = this.sessions.get(player_id)
      if (session) {
        const total = await gemsService.getBalance(player_id)
        session.io.to(session.socket_room).emit('gems:earned', {
          amount: 10,
          reason: `Région ${region} complétée !`,
          source: 'region_complete',
          total_gems: total,
        })
        session.io.to(session.socket_room).emit('combat:region_complete', { region })
      }
    }
  }

  // ─── Calcul offline ───────────────────────────────────────────────────────

  async calculateOfflineGains(player_id: string, last_seen_at: Date): Promise<OfflineReport> {
    const player = await Player.findOrFail(player_id)
    const floor = await Floor.findByOrFail('floor_number', player.currentFloor)

    const absence_seconds = Math.min(
      (Date.now() - last_seen_at.getTime()) / 1000,
      86_400 // cap 24h
    )

    // Ne pas calculer si absence < 5 minutes
    if (absence_seconds < 300) {
      return {
        gold_earned: 0,
        xp_earned: 0,
        kills: 0,
        hatches: 0,
        drops_json: {},
        absence_seconds: Math.floor(absence_seconds),
        floor_farmed: player.currentFloor,
        player_id,
      }
    }

    // Construire l'équipe joueur pour estimer le DPS
    const playerTeam = await this.buildPlayerTeam(player_id)

    // Stats moyennes des ennemis de l'étage
    const enemy_level = Math.round((floor.minLevel + floor.maxLevel) / 2)
    const enemy_def = Math.floor((Math.floor(((2 * (35 + enemy_level * 0.7) + 15) * enemy_level) / 100) + 5))
    const enemy_hp = Math.floor(((2 * (45 + enemy_level) + 15) * enemy_level) / 100) + enemy_level + 10

    // DPS total de l'équipe
    let total_dps = 0
    for (const pokemon of playerTeam) {
      total_dps += estimatePokemonDPS(pokemon, enemy_def, enemy_def)
    }

    // Kills estimés
    const kills = Math.floor((total_dps * absence_seconds) / enemy_hp)

    // Or et XP avec multiplicateurs prestige
    const gold_mult = Number(player.prestige_gold_mult ?? 1)
    const xp_mult = Number(player.prestige_xp_mult ?? 1)
    const gold_earned = applyPrestigeGoldMult(
      Math.floor(kills * floor.goldBase * (0.9 + Math.random() * 0.2)),
      gold_mult
    )
    const xp_earned = applyPrestigeXpMult(Math.floor(kills * floor.xpBase), xp_mult)

    // Sauvegarder dans offline_reports
    const report_id = crypto.randomUUID()
    await db.table('offline_reports').insert({
      id: report_id,
      player_id,
      gold_earned,
      xp_earned,
      kills,
      hatches: 0,
      drops_json: JSON.stringify({}),
      absence_seconds: Math.floor(absence_seconds),
      floor_farmed: player.currentFloor,
      created_at: new Date(),
    })

    return {
      gold_earned,
      xp_earned,
      kills,
      hatches: 0,
      drops_json: {},
      absence_seconds: Math.floor(absence_seconds),
      floor_farmed: player.currentFloor,
      player_id,
    }
  }

  // ─── Appliquer les gains offline ─────────────────────────────────────────

  async applyOfflineGains(player_id: string, report: OfflineReport): Promise<void> {
    await db
      .from('players')
      .where('id', player_id)
      .increment('gold', report.gold_earned)
      .increment('total_gold_earned', report.gold_earned)
      .increment('total_kills', report.kills)

    // Mettre à jour last_seen_at
    await Player.query().where('id', player_id).update({ last_seen_at: new Date() })
  }
}

// Singleton
const combatProgressionService = new CombatProgressionService()
export default combatProgressionService
