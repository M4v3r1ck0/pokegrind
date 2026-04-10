/**
 * AdminRaidController — Gestion des Raids côté admin.
 */

import type { HttpContext } from '@adonisjs/core/http'
import raidService from '#services/RaidService'

export default class AdminRaidController {
  /**
   * GET /api/admin/raids
   * Liste tous les raids (actifs + historique).
   */
  async index({ response }: HttpContext) {
    const raids = await raidService.listAllRaids()
    return response.ok(raids)
  }

  /**
   * POST /api/admin/raids/start
   * Démarrer un raid manuellement.
   * Body: { boss_id: number }
   */
  async start({ request, response }: HttpContext) {
    const { boss_id } = request.only(['boss_id'])
    if (!boss_id) {
      return response.badRequest({ message: 'boss_id requis.' })
    }
    try {
      const raid = await raidService.startRaid(Number(boss_id))
      return response.created(raid)
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  /**
   * POST /api/admin/raids/:id/end
   * Forcer la fin d'un raid (distribue les récompenses immédiatement).
   * Body: { reason: 'defeated' | 'expired' }
   */
  async end({ params, request, response }: HttpContext) {
    const { reason } = request.only(['reason'])
    const valid_reasons = ['defeated', 'expired']
    if (!valid_reasons.includes(reason)) {
      return response.badRequest({ message: 'reason doit être "defeated" ou "expired".' })
    }
    try {
      await raidService.endRaid(params.id, reason as 'defeated' | 'expired')
      return response.ok({ message: 'Raid terminé avec succès.', raid_id: params.id, reason })
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  /**
   * GET /api/admin/raids/:id/stats
   * Stats détaillées d'un raid.
   */
  async stats({ params, response }: HttpContext) {
    try {
      const stats = await raidService.getAdminRaidStats(params.id)
      return response.ok(stats)
    } catch (err: any) {
      return response.notFound({ message: err.message })
    }
  }
}
