import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import combatProgressionService from '#services/CombatProgressionService'
import Floor from '#models/floor'
import db from '@adonisjs/lucid/services/db'

export default class CombatController {
  /**
   * GET /api/combat/state
   * Retourne l'état complet du combat actif du joueur.
   */
  async state({ player }: HttpContext) {
    let session = combatProgressionService.getSession(player.id)

    if (!session) {
      // Démarrer une session si le joueur a une équipe
      try {
        session = await combatProgressionService.startSession(player.id)
      } catch {
        return {
          session_active: false,
          floor_number: player.currentFloor,
          floor_name_fr: null,
          battle_number: 0,
          is_boss: false,
          boss_timer_remaining_ms: null,
          player_team: [],
          enemy_team: [],
        }
      }
    }

    return session.toSnapshot()
  }

  /**
   * POST /api/combat/move-to-floor
   * Déplace la session au floor demandé (farming manuel).
   */
  async moveToFloor({ request, response, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        floor_number: vine.number().min(1),
      })
    )
    const { floor_number } = await schema.validate(request.body())

    // Vérifier que le joueur a débloqué cet étage
    if (floor_number > player.maxFloorReached) {
      return response.forbidden({
        message: `Vous n'avez pas encore atteint l'étage ${floor_number}.`,
      })
    }

    const floor = await Floor.findBy('floor_number', floor_number)
    if (!floor) {
      return response.notFound({ message: `Étage ${floor_number} introuvable.` })
    }

    // Mettre à jour current_floor
    player.currentFloor = floor_number
    await player.save()

    // Redémarrer la session sur ce floor
    const session = await combatProgressionService.startSession(player.id)
    return session.toSnapshot()
  }

  /**
   * GET /api/combat/floors
   * Retourne les étages débloqués par le joueur.
   */
  async floors({ player }: HttpContext) {
    const allFloors = await Floor.query()
      .where('floor_number', '<=', player.maxFloorReached)
      .orderBy('floor_number', 'asc')

    // Récupérer les boss vaincus
    const progress = await db
      .from('player_floor_progress')
      .where('player_id', player.id)
      .whereNotNull('boss_defeated_at')
      .select('floor_number')

    const defeatedFloors = new Set(progress.map((p: any) => p.floor_number))

    return {
      floors: allFloors.map((f) => ({
        floor_number: f.floorNumber,
        name_fr: f.nameFr,
        region: f.region,
        boss_defeated: defeatedFloors.has(f.floorNumber),
        is_milestone: f.isMilestone,
        has_boss: !!f.bossTrainerName,
      })),
    }
  }

  /**
   * POST /api/combat/start
   * Démarre une session de combat (appelé à l'ouverture de la page).
   */
  async start({ player }: HttpContext) {
    const session = await combatProgressionService.startSession(player.id)
    return session.toSnapshot()
  }

  /**
   * POST /api/combat/offline/apply
   * Applique les gains offline après confirmation du joueur.
   */
  async applyOfflineGains({ request, player, response }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        report_id: vine.string().uuid(),
      })
    )
    const { report_id } = await schema.validate(request.body())

    const report = await db
      .from('offline_reports')
      .where('id', report_id)
      .where('player_id', player.id)
      .first()

    if (!report) {
      return response.notFound({ message: 'Rapport introuvable.' })
    }

    await combatProgressionService.applyOfflineGains(player.id, {
      gold_earned: report.gold_earned,
      xp_earned: report.xp_earned,
      kills: report.kills,
      hatches: report.hatches,
      drops_json: report.drops_json ?? {},
      absence_seconds: report.absence_seconds,
      floor_farmed: report.floor_farmed,
      player_id: player.id,
    })

    return { success: true, gold_earned: report.gold_earned, xp_earned: report.xp_earned }
  }

  /**
   * GET /api/combat/offline/check
   * Vérifie et calcule les gains offline si nécessaire.
   */
  async checkOffline({ player }: HttpContext) {
    if (!player.lastSeenAt) {
      return { has_report: false }
    }

    const absence_seconds = (Date.now() - player.lastSeenAt.toMillis()) / 1000

    if (absence_seconds < 300) {
      return { has_report: false }
    }

    const report = await combatProgressionService.calculateOfflineGains(
      player.id,
      player.lastSeenAt.toJSDate()
    )

    return {
      has_report: report.kills > 0,
      report,
    }
  }
}
