/**
 * PrestigeService — Gestion du système de prestige.
 * Pure functions déléguées à PrestigeFormulas.ts (testables sans AdonisJS).
 */

import db from '@adonisjs/lucid/services/db'
import gemsService from '#services/GemsService'

export {
  checkPrestigeEligibility,
  calcNewMultipliers,
  applyPrestigeGoldMult,
  applyPrestigeXpMult,
  applyPrestigeDaycareMult,
  calcBossGems,
  isPrestigeMilestone,
  type PrestigeLevel,
  type PrestigeEligibility,
} from '#services/PrestigeFormulas'

import {
  checkPrestigeEligibility,
  calcNewMultipliers,
  isPrestigeMilestone,
  type PrestigeLevel,
  type PrestigeEligibility,
} from '#services/PrestigeFormulas'

export interface PrestigeResult {
  new_prestige_level: number
  prestige_name_fr: string
  gems_earned: number
  badge_earned: string | null
  new_multipliers: {
    gold: number
    xp: number
    daycare: number
    gem_per_boss: number
  }
  stats_at_prestige: {
    floor: number
    kills: number
    gold: number
  }
  is_milestone: boolean
}

class PrestigeServiceClass {
  /**
   * Vérifie si un joueur peut effectuer son prochain prestige.
   */
  async canPrestige(player_id: string): Promise<PrestigeEligibility> {
    const player = await db.from('players').where('id', player_id).first()
    if (!player) return { eligible: false, reason: 'Joueur introuvable' }

    const next_level = Number(player.prestige_level) + 1
    if (next_level > 50) {
      return { eligible: false, reason: 'Prestige maximum atteint (50/50)' }
    }

    const prestige_def = await db.from('prestige_levels').where('level', next_level).first()

    return checkPrestigeEligibility(
      {
        prestige_level: Number(player.prestige_level),
        current_floor: Number(player.current_floor),
        prestige_gold_mult: Number(player.prestige_gold_mult),
        prestige_xp_mult: Number(player.prestige_xp_mult),
        prestige_gem_bonus: Number(player.prestige_gem_bonus),
        prestige_daycare_mult: Number(player.prestige_daycare_mult),
        gold: Number(player.gold),
        total_kills: Number(player.total_kills),
        max_floor_reached: Number(player.max_floor_reached),
      },
      prestige_def ? {
        level: prestige_def.level,
        name_fr: prestige_def.name_fr,
        required_floor: prestige_def.required_floor,
        gold_multiplier: Number(prestige_def.gold_multiplier),
        xp_multiplier: Number(prestige_def.xp_multiplier),
        gem_bonus_per_boss: Number(prestige_def.gem_bonus_per_boss),
        daycare_speed_bonus: Number(prestige_def.daycare_speed_bonus),
        gems_reward: Number(prestige_def.gems_reward),
        badge_name_fr: prestige_def.badge_name_fr,
      } : null
    )
  }

  /**
   * Effectue le prestige du joueur (transaction complète).
   */
  async performPrestige(player_id: string): Promise<PrestigeResult> {
    const eligibility = await this.canPrestige(player_id)
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason ?? 'Prestige non disponible')
    }

    const prestige_def = eligibility.prestige_def!
    const player = await db.from('players').where('id', player_id).first()

    const floor_at_prestige = Number(player.current_floor)
    const kills_at_prestige = Number(player.total_kills)
    const gold_at_prestige = Number(player.gold)

    const pokemon_count = await db
      .from('player_pokemon')
      .where('player_id', player_id)
      .count('* as total')
      .first()

    const new_mults = calcNewMultipliers(
      Number(player.prestige_gold_mult),
      Number(player.prestige_xp_mult),
      Number(player.prestige_daycare_mult),
      Number(player.prestige_gem_bonus),
      {
        level: prestige_def.level,
        name_fr: prestige_def.name_fr,
        required_floor: prestige_def.required_floor,
        gold_multiplier: prestige_def.gold_multiplier,
        xp_multiplier: prestige_def.xp_multiplier,
        gem_bonus_per_boss: prestige_def.gem_bonus_per_boss,
        daycare_speed_bonus: prestige_def.daycare_speed_bonus,
        gems_reward: prestige_def.gems_reward,
        badge_name_fr: prestige_def.badge_name_fr,
      }
    )

    await db.transaction(async (trx) => {
      // 1. Historique
      await trx.table('player_prestiges').insert({
        id: crypto.randomUUID(),
        player_id,
        prestige_level: prestige_def.level,
        floor_at_prestige,
        total_kills_at_prestige: kills_at_prestige,
        gold_at_prestige,
        pokemon_count_at_prestige: Number(pokemon_count?.total ?? 0),
        prestiged_at: new Date(),
      })

      // 2. Reset + application des nouveaux multiplicateurs
      await trx.from('players').where('id', player_id).update({
        current_floor: 1,
        gold: 0,
        total_kills: 0,
        prestige_level: prestige_def.level,
        total_prestiges: trx.raw('total_prestiges + 1'),
        prestige_gold_mult: new_mults.gold_mult,
        prestige_xp_mult: new_mults.xp_mult,
        prestige_gem_bonus: new_mults.gem_bonus,
        prestige_daycare_mult: new_mults.daycare_mult,
      })

      // 3. Reset player_floor_progress (garder gems_claimed, reset boss_defeated_at)
      await trx.from('player_floor_progress').where('player_id', player_id).update({
        boss_defeated_at: null,
      })

      // 4. Libérer les slots de pension (les Pokémon en pension retournent à l'inventaire)
      await trx.from('daycare_slots').where('player_id', player_id).update({
        player_pokemon_id: null,
        damage_accumulated: 0,
        partner_pokemon_id: null,
        started_at: null,
      })

      // 5. Libérer les Pokémon des slots équipe/pension
      await trx.from('player_pokemon').where('player_id', player_id).update({
        slot_daycare: null,
      })
    })

    // 6. Attribuer les gems de récompense (hors transaction pour éviter les conflits de gems_audit)
    await gemsService.awardGems(
      player_id,
      prestige_def.gems_reward,
      `Prestige ${prestige_def.level} — ${prestige_def.name_fr}`,
      'prestige_reward'
    )

    const is_milestone = isPrestigeMilestone(prestige_def.level)

    return {
      new_prestige_level: prestige_def.level,
      prestige_name_fr: prestige_def.name_fr,
      gems_earned: prestige_def.gems_reward,
      badge_earned: prestige_def.badge_name_fr,
      new_multipliers: {
        gold: new_mults.gold_mult,
        xp: new_mults.xp_mult,
        daycare: new_mults.daycare_mult,
        gem_per_boss: new_mults.gem_bonus,
      },
      stats_at_prestige: {
        floor: floor_at_prestige,
        kills: kills_at_prestige,
        gold: gold_at_prestige,
      },
      is_milestone,
    }
  }

  /**
   * Statut prestige complet du joueur.
   */
  async getPrestigeStatus(player_id: string) {
    const player = await db.from('players').where('id', player_id).first()
    if (!player) throw new Error('Joueur introuvable')

    const prestige_level = Number(player.prestige_level)
    const history_count = await db
      .from('player_prestiges')
      .where('player_id', player_id)
      .count('* as total')
      .first()

    const next_level = prestige_level + 1
    let next_level_preview: PrestigeLevel | null = null
    if (next_level <= 50) {
      const def = await db.from('prestige_levels').where('level', next_level).first()
      if (def) {
        next_level_preview = {
          level: def.level,
          name_fr: def.name_fr,
          required_floor: def.required_floor,
          gold_multiplier: Number(def.gold_multiplier),
          xp_multiplier: Number(def.xp_multiplier),
          gem_bonus_per_boss: Number(def.gem_bonus_per_boss),
          daycare_speed_bonus: Number(def.daycare_speed_bonus),
          gems_reward: Number(def.gems_reward),
          badge_name_fr: def.badge_name_fr,
        }
      }
    }

    let current_name_fr: string | null = null
    if (prestige_level > 0) {
      const current_def = await db.from('prestige_levels').where('level', prestige_level).first()
      current_name_fr = current_def?.name_fr ?? null
    }

    const eligibility = await this.canPrestige(player_id)

    return {
      current_level: prestige_level,
      current_name_fr,
      total_prestiges: Number(player.total_prestiges),
      current_multipliers: {
        gold: Number(player.prestige_gold_mult),
        xp: Number(player.prestige_xp_mult),
        daycare: Number(player.prestige_daycare_mult),
        gem_per_boss: Number(player.prestige_gem_bonus),
      },
      eligibility,
      next_level_preview,
      history_count: Number(history_count?.total ?? 0),
    }
  }

  /**
   * Historique des prestiges d'un joueur.
   */
  async getPrestigeHistory(player_id: string) {
    return db
      .from('player_prestiges as pp')
      .join('prestige_levels as pl', 'pl.level', 'pp.prestige_level')
      .where('pp.player_id', player_id)
      .orderBy('pp.prestiged_at', 'desc')
      .select(
        'pp.prestige_level',
        'pl.name_fr',
        'pp.floor_at_prestige',
        'pp.total_kills_at_prestige',
        'pp.gold_at_prestige',
        'pp.pokemon_count_at_prestige',
        'pp.prestiged_at',
      )
  }

  /**
   * Classement mondial par niveau de prestige.
   */
  async getLeaderboard(limit = 100) {
    const rows = await db
      .from('players as p')
      .leftJoin('prestige_levels as pl', 'pl.level', 'p.prestige_level')
      .where('p.prestige_level', '>', 0)
      .orderBy('p.prestige_level', 'desc')
      .orderBy('p.total_kills', 'desc')
      .limit(limit)
      .select(
        'p.username',
        'p.prestige_level',
        'p.total_prestiges',
        'p.max_floor_reached',
        'pl.name_fr as prestige_name_fr',
      )

    return rows.map((r: any, i: number) => ({
      rank: i + 1,
      username: r.username,
      prestige_level: r.prestige_level,
      prestige_name_fr: r.prestige_name_fr,
      total_prestiges: r.total_prestiges,
      max_floor_reached: r.max_floor_reached,
    }))
  }
}

const prestigeService = new PrestigeServiceClass()
export default prestigeService
export { PrestigeServiceClass }
