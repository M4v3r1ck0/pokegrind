/**
 * PvpController — Routes HTTP PvP
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import pvpService from '#services/PvpService'

export default class PvpController {

  // ─── Saison active + mes stats ───────────────────────────────────────────

  async season({ player }: HttpContext) {
    const season = await pvpService.getActiveSeason()
    if (!season) return { season: null, my_ranking: null }

    const my_ranking = await pvpService.getOrCreateRanking(player.id, season.id)

    const wins   = Number(my_ranking.wins)
    const losses = Number(my_ranking.losses)

    return {
      season: {
        id: season.id,
        name_fr: season.name_fr,
        start_at: season.start_at,
        end_at: season.end_at,
      },
      my_ranking: {
        elo:        Number(my_ranking.elo),
        tier:       my_ranking.tier,
        wins,
        losses,
        win_streak: Number(my_ranking.win_streak),
        best_elo:   Number(my_ranking.best_elo),
        rank:       my_ranking.rank,
        win_rate:   wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      },
    }
  }

  // ─── Matchmaking : trouver un adversaire ────────────────────────────────

  async opponent({ player }: HttpContext) {
    const season = await pvpService.getActiveSeason()
    if (!season) return { error: 'Aucune saison PvP active.' }

    try {
      const opponent = await pvpService.findOpponent(player.id, season.id)
      return { opponent }
    } catch (e: any) {
      return { opponent: null, message: e.message }
    }
  }

  // ─── Attaquer ────────────────────────────────────────────────────────────

  async attack({ request, player, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({ defender_id: vine.string().uuid() })
    )

    const { defender_id } = await schema.validate(request.body())

    if (defender_id === player.id) {
      return response.badRequest({ message: 'Tu ne peux pas t\'attaquer toi-même.' })
    }

    try {
      const result = await pvpService.attackPlayer(player.id, defender_id)
      return { result }
    } catch (e: any) {
      return response.unprocessableEntity({ message: e.message })
    }
  }

  // ─── Replay ──────────────────────────────────────────────────────────────

  async replay({ params, player, response }: HttpContext) {
    try {
      const replay = await pvpService.getReplay(params.battle_id, player.id)
      return { replay }
    } catch (e: any) {
      return response.notFound({ message: e.message })
    }
  }

  // ─── Historique ──────────────────────────────────────────────────────────

  async history({ player }: HttpContext) {
    const season = await pvpService.getActiveSeason()
    if (!season) return { battles: [] }

    const battles = await pvpService.getHistory(player.id, season.id)
    return { battles }
  }

  // ─── Classement ──────────────────────────────────────────────────────────

  async leaderboard({ request, player }: HttpContext) {
    const season = await pvpService.getActiveSeason()
    if (!season) return { season: null, data: [], my_rank: null, meta: { total: 0, page: 1, last_page: 1 } }

    const { page = 1, tier } = request.qs()

    const result = await pvpService.getLeaderboard(season.id, Number(page), tier)
    const my_ranking = await pvpService.getOrCreateRanking(player.id, season.id)

    const wins   = Number(my_ranking.wins)
    const losses = Number(my_ranking.losses)

    return {
      season: {
        id: season.id,
        name_fr: season.name_fr,
        end_at: season.end_at,
      },
      ...result,
      my_rank: {
        rank:     my_ranking.rank,
        elo:      Number(my_ranking.elo),
        tier:     my_ranking.tier,
        wins,
        losses,
        win_rate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
      },
    }
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  async notifications({ player }: HttpContext) {
    const notifications = await pvpService.getNotifications(player.id)
    const unread = notifications.filter((n: any) => !n.is_read).length
    return { notifications, unread_count: unread }
  }

  async markRead({ player }: HttpContext) {
    await pvpService.markNotificationsRead(player.id)
    return { ok: true }
  }

  // ─── Équipe de défense ────────────────────────────────────────────────────

  async setDefenseTeam({ request, player, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        pokemon_ids: vine.array(vine.string().uuid()).minLength(1).maxLength(6),
      })
    )

    const { pokemon_ids } = await schema.validate(request.body())

    try {
      await pvpService.setDefenseTeam(player.id, pokemon_ids)
      return { ok: true }
    } catch (e: any) {
      return response.unprocessableEntity({ message: e.message })
    }
  }

  async getDefenseTeam({ player }: HttpContext) {
    const team = await pvpService.getDefenseTeam(player.id)
    return { defense_team: team }
  }

  async getOpponentDefenseTeam({ params, response }: HttpContext) {
    const team = await pvpService.getDefenseTeam(params.player_id)
    if (!team) return response.notFound({ message: 'Équipe de défense introuvable.' })

    // Masquer les IVs pour les équipes adverses
    const masked = {
      pokemon: team.pokemon.map((p) => ({
        ...p,
        ivs: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
      })),
    }
    return { defense_team: masked }
  }
}
