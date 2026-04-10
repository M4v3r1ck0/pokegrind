/**
 * PrestigeController — Routes HTTP du système de prestige.
 */

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import prestigeService from '#services/PrestigeService'

// Import io lazily to avoid circular dep
async function getIo() {
  const { default: io } = await import('../../start/socket.js')
  return io
}

export default class PrestigeController {
  /**
   * GET /api/player/prestige
   * Statut prestige du joueur authentifié + éligibilité.
   */
  async status({ player, response }: HttpContext) {
    const status = await prestigeService.getPrestigeStatus(player.id)
    return response.ok(status)
  }

  /**
   * GET /api/player/prestige/history
   * Historique des prestiges du joueur.
   */
  async history({ player, response }: HttpContext) {
    const history = await prestigeService.getPrestigeHistory(player.id)
    return response.ok(history)
  }

  /**
   * GET /api/player/prestige/levels
   * Tous les 50 niveaux de prestige (catalogue).
   */
  async levels({ response }: HttpContext) {
    const levels = await db.from('prestige_levels').orderBy('level', 'asc')
    return response.ok(levels.map((l: any) => ({
      level: l.level,
      name_fr: l.name_fr,
      description_fr: l.description_fr,
      required_floor: l.required_floor,
      gold_multiplier: Number(l.gold_multiplier),
      xp_multiplier: Number(l.xp_multiplier),
      gem_bonus_per_boss: Number(l.gem_bonus_per_boss),
      daycare_speed_bonus: Number(l.daycare_speed_bonus),
      gems_reward: l.gems_reward,
      badge_name_fr: l.badge_name_fr,
      badge_sprite_url: l.badge_sprite_url,
    })))
  }

  /**
   * POST /api/player/prestige/perform
   * Effectue le prestige (validation côté client déjà faite).
   */
  async perform({ player, response }: HttpContext) {
    let result
    try {
      result = await prestigeService.performPrestige(player.id)
    } catch (err: any) {
      return response.badRequest({ error: err.message })
    }

    // Émettre event Socket.io au joueur
    try {
      const io = await getIo()
      const socket_room = `player:${player.id}`
      io.to(socket_room).emit('prestige:complete', {
        new_level: result.new_prestige_level,
        prestige_name_fr: result.prestige_name_fr,
        gems_earned: result.gems_earned,
        badge_name_fr: result.badge_earned,
        multipliers: result.new_multipliers,
        stats: result.stats_at_prestige,
      })

      // Annonce globale pour les milestones (P10, P25, P50)
      if (result.is_milestone) {
        io.emit('prestige:milestone', {
          username: player.username,
          prestige_level: result.new_prestige_level,
          prestige_name_fr: result.prestige_name_fr,
        })
      }
    } catch { /* Socket.io optionnel */ }

    return response.ok(result)
  }

  /**
   * GET /api/prestige/leaderboard
   * Classement mondial par niveau de prestige (top 100).
   */
  async leaderboard({ request, response }: HttpContext) {
    const limit = Math.min(Number(request.input('limit', 100)), 100)
    const board = await prestigeService.getLeaderboard(limit)
    return response.ok(board)
  }
}
