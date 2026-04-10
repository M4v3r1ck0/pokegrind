/**
 * DungeonController — Routes HTTP des Donjons Ancestraux.
 */

import type { HttpContext } from '@adonisjs/core/http'
import dungeonService from '#services/DungeonService'

async function getIo() {
  const { default: io } = await import('../../start/socket.js')
  return io
}

export default class DungeonController {
  /**
   * GET /api/dungeons
   * Liste des 9 donjons avec statut du joueur cette semaine.
   */
  async index({ player, response }: HttpContext) {
    const list = await dungeonService.listDungeons(player.id)
    return response.ok(list)
  }

  /**
   * GET /api/dungeons/:id
   * Détail d'un donjon (pool de récompenses inclus).
   */
  async show({ params, response }: HttpContext) {
    const dungeon = await (await import('@adonisjs/lucid/services/db')).default
      .from('dungeons')
      .where({ id: Number(params.id), is_active: true })
      .first()

    if (!dungeon) return response.notFound({ message: 'Donjon introuvable.' })
    return response.ok(dungeon)
  }

  /**
   * POST /api/dungeons/:id/start
   * Démarrer un run.
   */
  async start({ params, player, response }: HttpContext) {
    const io = await getIo()
    dungeonService.setIO(io)

    try {
      const run = await dungeonService.startRun(player.id, Number(params.id))
      return response.created(run)
    } catch (err: any) {
      const msg: string = err.message ?? 'Erreur lors du démarrage du run.'
      if (msg.includes('déjà') || msg.includes('semaine')) {
        return response.unprocessableEntity({ message: msg })
      }
      if (msg.includes('prestige')) {
        return response.forbidden({ message: msg })
      }
      return response.badRequest({ message: msg })
    }
  }

  /**
   * GET /api/dungeons/run/current
   * Run actif du joueur (s'il en a un).
   */
  async currentRun({ player, response }: HttpContext) {
    const run = await dungeonService.getActiveRun(player.id)
    if (!run) return response.ok({ active: false, run: null })
    return response.ok({ active: true, run })
  }

  /**
   * POST /api/dungeons/run/:id/room/:number
   * Résoudre une salle.
   */
  async resolveRoom({ params, player, response }: HttpContext) {
    const io = await getIo()
    dungeonService.setIO(io)

    try {
      const result = await dungeonService.resolveRoom(
        player.id,
        params.id,
        Number(params.number)
      )
      return response.ok(result)
    } catch (err: any) {
      return response.badRequest({ message: err.message ?? 'Erreur lors de la résolution de la salle.' })
    }
  }

  /**
   * POST /api/dungeons/run/:id/shop/buy
   * Acheter un item dans la salle marchande.
   */
  async shopBuy({ params, request, player, response }: HttpContext) {
    const { item_name } = request.body()
    if (!item_name) return response.badRequest({ message: 'item_name requis.' })

    try {
      const result = await dungeonService.buyFromShop(player.id, params.id, item_name)
      return response.ok(result)
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * POST /api/dungeons/run/:id/abandon
   * Abandonner un run (compte comme échec).
   */
  async abandon({ params, player, response }: HttpContext) {
    try {
      await dungeonService.abandonRun(player.id, params.id)
      return response.ok({ message: 'Run abandonné. Ce donjon est verrouillé jusqu\'à la semaine prochaine.' })
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * GET /api/dungeons/rewards
   * Récompenses en attente de collecte.
   */
  async rewards({ player, response }: HttpContext) {
    const pending = await dungeonService.getPendingRewards(player.id)
    return response.ok(pending)
  }

  /**
   * POST /api/dungeons/rewards/:id/collect
   * Collecter une récompense.
   */
  async collectReward({ params, player, response }: HttpContext) {
    try {
      await dungeonService.collectReward(player.id, params.id)
      return response.ok({ message: 'Récompense collectée avec succès.' })
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * GET /api/dungeons/history
   * 10 derniers runs du joueur.
   */
  async history({ player, response }: HttpContext) {
    const runs = await dungeonService.getHistory(player.id)
    return response.ok(runs)
  }
}
