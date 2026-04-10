/**
 * PlayerController — Heartbeat, rapport offline, préférences push.
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import OfflineReport from '#models/offline_report'
import Floor from '#models/floor'
import { formatAbsence } from '#services/OfflineFormulas'

export default class PlayerController {
  // ─── Heartbeat ──────────────────────────────────────────────────────────

  /**
   * POST /api/player/heartbeat
   * Met à jour last_seen_at (appelé toutes les 2 minutes par le frontend).
   */
  async heartbeat({ player }: HttpContext) {
    await db.from('players').where('id', player.id).update({
      last_seen_at: new Date(),
    })
    return { ok: true }
  }

  // ─── Rapport offline ────────────────────────────────────────────────────

  /**
   * GET /api/player/offline-report/pending
   * Retourne le rapport non lu le plus récent si disponible.
   */
  async pendingReport({ player }: HttpContext) {
    const pending = await redis.get(`offline_report_pending:${player.id}`)
    if (!pending) return { has_report: false }

    const report = await OfflineReport.query()
      .where('player_id', player.id)
      .orderBy('created_at', 'desc')
      .first()

    if (!report) {
      // Flag périmé — nettoyer
      await redis.del(`offline_report_pending:${player.id}`)
      return { has_report: false }
    }

    // Charger le nom de l'étage
    const floor = await Floor.query().where('floor_number', report.floorFarmed).first()

    return {
      has_report: true,
      report: {
        id: report.id,
        gold_earned: report.goldEarned,
        xp_earned: report.xpEarned,
        kills: report.kills,
        hatches: report.hatches,
        drops: report.dropsJson ?? [],
        absence_seconds: report.absenceSeconds,
        absence_formatted: formatAbsence(report.absenceSeconds),
        floor_farmed: report.floorFarmed,
        floor_name_fr: floor?.nameFr ?? `Étage ${report.floorFarmed}`,
        created_at: report.createdAt.toISO(),
      },
    }
  }

  /**
   * POST /api/player/offline-report/collect
   * Confirme la lecture du rapport et supprime le flag Redis.
   */
  async collectReport({ request, response, player }: HttpContext) {
    const schema = vine.compile(vine.object({ report_id: vine.string().uuid() }))
    const { report_id } = await schema.validate(request.body())

    const report = await OfflineReport.query()
      .where('id', report_id)
      .where('player_id', player.id)
      .first()

    if (!report) {
      return response.notFound({ message: 'Rapport introuvable' })
    }

    await redis.del(`offline_report_pending:${player.id}`)

    const player_row = await db.from('players').where('id', player.id).select('gold').first()

    return { success: true, gold_total: Number(player_row?.gold ?? 0) }
  }

  /**
   * GET /api/player/offline-reports
   * Historique des 10 derniers rapports.
   */
  async reportHistory({ player }: HttpContext) {
    const page = 1
    const per_page = 10

    const reports = await OfflineReport.query()
      .where('player_id', player.id)
      .orderBy('created_at', 'desc')
      .limit(per_page)
      .offset((page - 1) * per_page)

    const total = await OfflineReport.query()
      .where('player_id', player.id)
      .count('* as total')
      .first()

    const floors = await Floor.query().whereIn(
      'floor_number',
      reports.map((r) => r.floorFarmed)
    )
    const floor_map = new Map(floors.map((f) => [f.floorNumber, f.nameFr]))

    return {
      reports: reports.map((r) => ({
        id: r.id,
        gold_earned: r.goldEarned,
        xp_earned: r.xpEarned,
        kills: r.kills,
        hatches: r.hatches,
        drops: r.dropsJson ?? [],
        absence_seconds: r.absenceSeconds,
        absence_formatted: formatAbsence(r.absenceSeconds),
        floor_farmed: r.floorFarmed,
        floor_name_fr: floor_map.get(r.floorFarmed) ?? `Étage ${r.floorFarmed}`,
        created_at: r.createdAt.toISO(),
      })),
      total: Number((total as any)?.total ?? 0),
    }
  }

  // ─── Push notifications ─────────────────────────────────────────────────

  /**
   * GET /api/player/push/vapid-key
   */
  async vapidKey() {
    return { public_key: process.env.VAPID_PUBLIC_KEY ?? '' }
  }

  /**
   * POST /api/player/push/subscribe
   */
  async pushSubscribe({ request, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        endpoint: vine.string().url(),
        keys: vine.object({
          p256dh: vine.string(),
          auth: vine.string(),
        }),
      })
    )
    const { endpoint, keys } = await schema.validate(request.body())

    const default_prefs = {
      hatch_ready: true,
      boss_milestone: true,
      event_active: true,
      bf_rotation: true,
      pvp_result: false,
      raid: false,
    }

    // Upsert par (player_id, endpoint)
    const existing = await db
      .from('push_subscriptions')
      .where('player_id', player.id)
      .where('endpoint', endpoint)
      .first()

    if (existing) {
      await db
        .from('push_subscriptions')
        .where('id', existing.id)
        .update({ keys: JSON.stringify(keys) })
    } else {
      await db.table('push_subscriptions').insert({
        id: crypto.randomUUID(),
        player_id: player.id,
        endpoint,
        keys: JSON.stringify(keys),
        notification_prefs_json: JSON.stringify(default_prefs),
        created_at: new Date(),
      })
    }

    return { success: true }
  }

  /**
   * POST /api/player/push/unsubscribe
   */
  async pushUnsubscribe({ player }: HttpContext) {
    await db.from('push_subscriptions').where('player_id', player.id).delete()
    return { success: true }
  }

  /**
   * GET /api/player/push/preferences
   */
  async pushPreferences({ player }: HttpContext) {
    const sub = await db
      .from('push_subscriptions')
      .where('player_id', player.id)
      .select('notification_prefs_json')
      .first()

    const prefs = sub
      ? (typeof sub.notification_prefs_json === 'string'
          ? JSON.parse(sub.notification_prefs_json)
          : sub.notification_prefs_json)
      : {}

    return {
      is_subscribed: !!sub,
      notification_prefs: prefs,
    }
  }

  /**
   * PUT /api/player/push/preferences
   */
  async updatePushPreferences({ request, response, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        hatch_ready: vine.boolean().optional(),
        boss_milestone: vine.boolean().optional(),
        event_active: vine.boolean().optional(),
        bf_rotation: vine.boolean().optional(),
        pvp_result: vine.boolean().optional(),
        raid: vine.boolean().optional(),
      })
    )
    const updates = await schema.validate(request.body())

    const sub = await db
      .from('push_subscriptions')
      .where('player_id', player.id)
      .select('id', 'notification_prefs_json')
      .first()

    if (!sub) {
      return response.notFound({ message: 'Aucune subscription push active' })
    }

    const current_prefs =
      typeof sub.notification_prefs_json === 'string'
        ? JSON.parse(sub.notification_prefs_json)
        : (sub.notification_prefs_json ?? {})

    const new_prefs = { ...current_prefs, ...updates }

    await db
      .from('push_subscriptions')
      .where('id', sub.id)
      .update({ notification_prefs_json: JSON.stringify(new_prefs) })

    return { notification_prefs: new_prefs }
  }
}
