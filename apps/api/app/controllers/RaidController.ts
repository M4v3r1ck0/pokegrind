/**
 * RaidController — Routes HTTP des Raids Mondiaux.
 */

import type { HttpContext } from '@adonisjs/core/http'
import raidService from '#services/RaidService'

export default class RaidController {
  /**
   * GET /api/raids/active
   * Raid(s) actif(s) en ce moment avec ma contribution.
   */
  async active({ player, response }: HttpContext) {
    const raids = await raidService.getActiveRaids(player.id)
    return response.ok(raids)
  }

  /**
   * GET /api/raids/history
   * Historique des 10 derniers raids.
   */
  async history({ response }: HttpContext) {
    const history = await raidService.getHistory()
    return response.ok(history)
  }

  /**
   * GET /api/raids/rewards
   * Mes récompenses à collecter.
   */
  async rewards({ player, response }: HttpContext) {
    const rewards = await raidService.getPendingRewards(player.id)
    return response.ok(rewards)
  }

  /**
   * GET /api/raids/:id
   * Détail d'un raid.
   */
  async show({ params, player, response }: HttpContext) {
    const raid = await raidService.getRaidDetail(params.id, player.id)
    if (!raid) return response.notFound({ message: 'Raid introuvable.' })
    return response.ok(raid)
  }

  /**
   * POST /api/raids/:id/attack
   * Attaquer le raid (cooldown 4h).
   */
  async attack({ params, player, response }: HttpContext) {
    try {
      const result = await raidService.attackRaid(player.id, params.id)
      return response.ok(result)
    } catch (err: any) {
      if (err.code === 'COOLDOWN') {
        return response.unprocessableEntity({
          message: err.message,
          next_attack_at: err.next_attack_at,
        })
      }
      return response.unprocessableEntity({ message: err.message })
    }
  }

  /**
   * GET /api/raids/:id/leaderboard
   * Classement des contributions du raid.
   */
  async leaderboard({ params, player, response }: HttpContext) {
    try {
      const data = await raidService.getLeaderboard(params.id, player.id)
      return response.ok(data)
    } catch (err: any) {
      return response.notFound({ message: err.message })
    }
  }

  /**
   * GET /api/raids/my-contribution/:id
   * Ma contribution dans un raid spécifique.
   */
  async myContribution({ params, player, response }: HttpContext) {
    const contrib = await raidService.getMyContribution(player.id, params.id)
    if (!contrib) return response.notFound({ message: 'Aucune contribution trouvée.' })
    return response.ok(contrib)
  }

  /**
   * POST /api/raids/rewards/:id/collect
   * Collecter une récompense Raid.
   */
  async collectReward({ params, player, response }: HttpContext) {
    try {
      const result = await raidService.collectReward(player.id, params.id)
      return response.ok(result)
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }
}
