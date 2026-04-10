/**
 * TowerController — Routes HTTP de la Tour Infinie.
 */

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import towerService from '#services/TowerService'
import { calcTowerFloorConfig } from '#services/TowerGeneratorService'

async function getIo() {
  const { default: io } = await import('../../start/socket.js')
  return io
}

export default class TowerController {
  /**
   * GET /api/tower/status
   * Statut courant du joueur dans la Tour (saison, étage, progression).
   */
  async status({ player, response }: HttpContext) {
    const status = await towerService.getTowerStatus(player.id)
    if (!status) {
      return response.ok({
        message: 'Aucune saison Tour active pour le moment.',
        active: false,
      })
    }
    return response.ok({ active: true, ...status })
  }

  /**
   * POST /api/tower/start
   * Démarre ou reprend une session de combat Tour Infinie.
   */
  async start({ player, response }: HttpContext) {
    const io = await getIo()
    towerService.setIO(io)

    const session = await towerService.startSession(player.id)
    if (!session) {
      return response.badRequest({
        message: 'Impossible de démarrer une session Tour. Vérifiez votre équipe et la saison active.',
      })
    }

    return response.ok({
      message: 'Session Tour démarrée.',
      floor_number: session.floor_number,
      is_boss: session.is_boss,
      boss_mechanic_type: session.boss_mechanic?.type ?? null,
      snapshot: session.toSnapshot(),
    })
  }

  /**
   * POST /api/tower/stop
   * Stoppe la session Tour active.
   */
  async stop({ player, response }: HttpContext) {
    towerService.stopSession(player.id)
    return response.ok({ message: 'Session Tour arrêtée.' })
  }

  /**
   * GET /api/tower/state
   * Snapshot de la session Tour active (pour reconnexion).
   */
  async state({ player, response }: HttpContext) {
    const session = towerService.getSession(player.id)
    if (!session) {
      return response.ok({ active: false, snapshot: null })
    }
    return response.ok({ active: true, snapshot: session.toSnapshot() })
  }

  /**
   * GET /api/tower/leaderboard
   * Classement de la saison courante (public).
   */
  async leaderboard({ request, response }: HttpContext) {
    const season = await towerService.getActiveSeason()
    if (!season) {
      return response.ok({ season: null, leaderboard: [] })
    }

    const limit = Math.min(Number(request.qs().limit ?? 100), 200)
    const board = await towerService.getLeaderboard(season.id, limit)
    return response.ok({ season, leaderboard: board })
  }

  /**
   * GET /api/tower/milestones
   * Liste des paliers (publique).
   */
  async milestones({ response }: HttpContext) {
    const rows = await db
      .from('tower_milestones')
      .orderBy('floor_number', 'asc')
      .select('floor_number', 'gems_reward', 'name_fr')

    return response.ok(rows)
  }

  /**
   * GET /api/tower/bosses
   * Liste des boss (publique).
   */
  async bosses({ response }: HttpContext) {
    const rows = await db
      .from('tower_bosses')
      .orderBy('floor_number', 'asc')
      .select('floor_number', 'name_fr', 'description_fr', 'mechanic_type', 'gems_reward')

    return response.ok(rows)
  }

  /**
   * GET /api/tower/boss/:floor
   * Détails d'un boss spécifique.
   */
  async boss({ params, response }: HttpContext) {
    const floor = Number(params.floor)
    const boss = await db
      .from('tower_bosses')
      .where('floor_number', floor)
      .first()

    if (!boss) {
      return response.notFound({ message: `Aucun boss à l'étage ${floor}.` })
    }

    return response.ok(boss)
  }

  /**
   * GET /api/tower/seasons
   * Historique des saisons (public).
   */
  async seasons({ response }: HttpContext) {
    const rows = await db
      .from('tower_seasons')
      .orderBy('id', 'desc')
      .select('id', 'name_fr', 'start_at', 'end_at', 'is_active')

    return response.ok(rows)
  }

  /**
   * GET /api/tower/season
   * Saison active courante (public).
   */
  async index({ response }: HttpContext) {
    const season = await towerService.getActiveSeason()
    if (!season) {
      return response.ok({ active: false, season: null })
    }
    return response.ok({ active: true, season })
  }

  /**
   * GET /api/tower/floor/:number
   * Configuration d'un étage (public, déterministe).
   * Critères :
   *   - floor 25  → is_boss = true, boss_mechanic présent
   *   - floor 26  → is_boss = false
   */
  async floor({ params, response }: HttpContext) {
    const floor_number = Number(params.number)
    if (!Number.isInteger(floor_number) || floor_number < 1) {
      return response.badRequest({ message: 'Numéro d\'étage invalide.' })
    }

    const season = await towerService.getActiveSeason()
    const season_id = season?.id ?? 1

    const config = calcTowerFloorConfig(floor_number, season_id)

    let boss_mechanic = null
    if (config.is_boss) {
      const boss_row = await db
        .from('tower_bosses')
        .where('floor_number', floor_number)
        .first()
      if (boss_row) {
        boss_mechanic = {
          type: boss_row.mechanic_type,
          name_fr: boss_row.name_fr,
          description_fr: boss_row.description_fr,
          gems_reward: boss_row.gems_reward,
          ...boss_row.mechanic_config,
        }
      }
    }

    return response.ok({
      floor_number: config.floor_number,
      enemy_count: config.enemy_count,
      enemy_level: config.enemy_level,
      tier: config.tier,
      gold_base: config.gold_base,
      xp_base: config.xp_base,
      is_boss: config.is_boss,
      iv_min: config.iv_min,
      iv_max: config.iv_max,
      boss_mechanic,
    })
  }

  /**
   * POST /api/tower/abandon
   * Abandonne la session active et remet le joueur à l'étage 1.
   */
  async abandon({ player, response }: HttpContext) {
    towerService.stopSession(player.id)

    const season = await towerService.getActiveSeason()
    if (season) {
      await db
        .from('tower_progress')
        .where({ player_id: player.id, season_id: season.id })
        .update({ current_floor: 1, last_active_at: new Date() })
    }

    return response.ok({ message: 'Abandon confirmé. Retour à l\'étage 1.' })
  }
}
