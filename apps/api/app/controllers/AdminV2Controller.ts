/**
 * AdminV2Controller — Panel admin V2 :
 * Anti-cheat, Events, Économie, PvP, BF, Notes modérateur, Broadcast, Maintenance.
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import anticheatService from '#services/AnticheatService'
import eventService from '#services/EventService'
import adminAuditService from '#services/AdminAuditService'

// ─── Validators ───────────────────────────────────────────────────────────────

const create_event_validator = vine.compile(
  vine.object({
    name_fr: vine.string().maxLength(128),
    description_fr: vine.string().optional(),
    event_type: vine.enum(['gem_boost', 'xp_boost', 'shiny_boost', 'banner', 'custom'] as const),
    config_json: vine.object({
      multiplier: vine.number().optional(),
      sources: vine.array(vine.string()).optional(),
      banner_id: vine.string().optional(),
      description_fr: vine.string().optional(),
    }),
    start_at: vine.string(),
    end_at: vine.string(),
  })
)

const resolve_alert_validator = vine.compile(
  vine.object({
    resolution_note: vine.string().maxLength(1000),
    action: vine.enum(['false_positive', 'warned', 'banned'] as const),
  })
)

const broadcast_validator = vine.compile(
  vine.object({
    title_fr: vine.string().maxLength(128),
    body_fr: vine.string().maxLength(2000),
    type: vine.enum(['info', 'warning', 'maintenance'] as const),
  })
)

const maintenance_validator = vine.compile(
  vine.object({
    message_fr: vine.string().maxLength(500),
    duration_minutes: vine.number().min(1).max(1440),
  })
)

const moderator_note_validator = vine.compile(
  vine.object({
    note: vine.string().maxLength(2000),
    is_flagged: vine.boolean().optional(),
  })
)

const create_pvp_season_validator = vine.compile(
  vine.object({
    name_fr: vine.string().maxLength(64),
    start_at: vine.string(),
    end_at: vine.string(),
    rewards_json: vine.array(vine.any()).optional(),
  })
)

const create_bf_rotation_validator = vine.compile(
  vine.object({
    mode: vine.string().maxLength(32),
    tier_restriction: vine.any().optional(),
    rules_json: vine.any().optional(),
    start_at: vine.string(),
    end_at: vine.string(),
  })
)

// ─── Anti-cheat ───────────────────────────────────────────────────────────────

export default class AdminV2Controller {
  // GET /api/admin/anticheat/alerts
  async getAlerts({ player, request, response }: HttpContext) {
    const severity = request.input('severity')
    const alert_type = request.input('alert_type')
    const resolved = request.input('resolved') // 'true'|'false'|undefined
    const page = Number(request.input('page', 1))
    const per_page = 20

    let q = db.from('anticheat_alerts as a')
      .join('players as p', 'p.id', 'a.player_id')
      .select('a.*', 'p.username')
      .orderBy('a.created_at', 'desc')

    if (severity) q = q.where('a.severity', severity)
    if (alert_type) q = q.where('a.alert_type', alert_type)
    if (resolved === 'true') q = q.where('a.is_resolved', true)
    if (resolved === 'false') q = q.where('a.is_resolved', false)

    const total_row = await (q.clone() as any).count('* as total').first()
    const alerts = await q.limit(per_page).offset((page - 1) * per_page)

    return response.ok({ alerts, total: Number(total_row?.total ?? 0), page })
  }

  // GET /api/admin/anticheat/alerts/:id
  async getAlert({ params, response }: HttpContext) {
    const alert = await db
      .from('anticheat_alerts as a')
      .join('players as p', 'p.id', 'a.player_id')
      .leftJoin('players as r', 'r.id', 'a.resolved_by')
      .select('a.*', 'p.username', 'r.username as resolved_by_username')
      .where('a.id', params.id)
      .first()

    if (!alert) return response.notFound({ message: 'Alerte introuvable' })
    return response.ok(alert)
  }

  // POST /api/admin/anticheat/alerts/:id/resolve
  async resolveAlert({ player, params, request, response }: HttpContext) {
    const data = await request.validateUsing(resolve_alert_validator)

    await anticheatService.resolveAlert(params.id, player.id, data.resolution_note, data.action)
    return response.ok({ message: 'Alerte résolue' })
  }

  // POST /api/admin/anticheat/check/:player_id
  async triggerCheck({ player, params, response }: HttpContext) {
    // Déclenche les checks manuellement sur un joueur
    const [gems_count, kill_count] = await Promise.all([
      anticheatService.checkGemsAnomalies(),
      anticheatService.checkKillRateAnomalies(),
    ])

    await adminAuditService.log({
      admin_id: player.id,
      action: 'anticheat_manual_check',
      target_type: 'player',
      target_id: params.player_id,
      payload: { gems_alerts: gems_count, kill_alerts: kill_count },
    })

    return response.ok({ message: 'Vérification déclenchée', gems_alerts: gems_count, kill_alerts: kill_count })
  }

  // GET /api/admin/anticheat/stats
  async getAnticheatStats({ response }: HttpContext) {
    const stats = await anticheatService.getAlertStats()
    return response.ok(stats)
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  // GET /api/admin/events
  async getEvents({ request, response }: HttpContext) {
    const status = request.input('status') // 'active'|'planned'|'past'
    const now = new Date()

    let q = db.from('events').orderBy('start_at', 'desc')
    if (status === 'active') q = q.where('is_active', true)
    else if (status === 'planned') q = q.where('is_active', false).where('start_at', '>', now)
    else if (status === 'past') q = q.where('end_at', '<', now)

    const events = await q
    return response.ok(events)
  }

  // POST /api/admin/events
  async createEvent({ player, request, response }: HttpContext) {
    const data = await request.validateUsing(create_event_validator)

    const id = crypto.randomUUID()
    await db.table('events').insert({
      id,
      name_fr: data.name_fr,
      description_fr: data.description_fr ?? null,
      event_type: data.event_type,
      config_json: JSON.stringify(data.config_json),
      start_at: new Date(data.start_at),
      end_at: new Date(data.end_at),
      is_active: false,
      created_by: player.id,
      created_at: new Date(),
    })

    await adminAuditService.log({
      admin_id: player.id,
      action: 'event_create',
      target_type: 'event',
      target_id: id,
      payload: data,
    })

    return response.created({ id, message: 'Event créé' })
  }

  // PUT /api/admin/events/:id
  async updateEvent({ player, params, request, response }: HttpContext) {
    const ev = await db.from('events').where('id', params.id).first()
    if (!ev) return response.notFound({ message: 'Event introuvable' })
    if (ev.is_active) return response.unprocessableEntity({ message: 'Impossible de modifier un event actif' })

    const data = request.only(['name_fr', 'description_fr', 'config_json', 'start_at', 'end_at'])
    const update: Record<string, any> = {}
    if (data.name_fr) update.name_fr = data.name_fr
    if (data.description_fr !== undefined) update.description_fr = data.description_fr
    if (data.config_json) update.config_json = JSON.stringify(data.config_json)
    if (data.start_at) update.start_at = new Date(data.start_at)
    if (data.end_at) update.end_at = new Date(data.end_at)

    await db.from('events').where('id', params.id).update(update)

    await adminAuditService.log({
      admin_id: player.id,
      action: 'event_update',
      target_type: 'event',
      target_id: params.id,
      payload: update,
    })

    return response.ok({ message: 'Event mis à jour' })
  }

  // DELETE /api/admin/events/:id
  async deleteEvent({ player, params, response }: HttpContext) {
    const ev = await db.from('events').where('id', params.id).first()
    if (!ev) return response.notFound({ message: 'Event introuvable' })
    if (ev.is_active) return response.unprocessableEntity({ message: 'Impossible de supprimer un event actif' })

    await db.from('events').where('id', params.id).delete()

    await adminAuditService.log({
      admin_id: player.id,
      action: 'event_delete',
      target_type: 'event',
      target_id: params.id,
      payload: { name_fr: ev.name_fr },
    })

    return response.ok({ message: 'Event supprimé' })
  }

  // POST /api/admin/events/:id/activate
  async activateEvent({ player, params, response }: HttpContext) {
    const ev = await db.from('events').where('id', params.id).first()
    if (!ev) return response.notFound({ message: 'Event introuvable' })

    await db.from('events').where('id', params.id).update({ is_active: true })
    await eventService.activateEvent({
      id: ev.id,
      event_type: ev.event_type,
      config_json: typeof ev.config_json === 'string' ? JSON.parse(ev.config_json) : ev.config_json,
      end_at: new Date(ev.end_at),
    })

    await adminAuditService.log({
      admin_id: player.id,
      action: 'event_activate',
      target_type: 'event',
      target_id: params.id,
      payload: { name_fr: ev.name_fr },
    })

    return response.ok({ message: 'Event activé' })
  }

  // POST /api/admin/events/:id/deactivate
  async deactivateEvent({ player, params, response }: HttpContext) {
    const ev = await db.from('events').where('id', params.id).first()
    if (!ev) return response.notFound({ message: 'Event introuvable' })

    await db.from('events').where('id', params.id).update({ is_active: false })
    await eventService.deactivateEvent(ev.event_type)

    await adminAuditService.log({
      admin_id: player.id,
      action: 'event_deactivate',
      target_type: 'event',
      target_id: params.id,
      payload: { name_fr: ev.name_fr },
    })

    return response.ok({ message: 'Event désactivé' })
  }

  // ─── Économie ─────────────────────────────────────────────────────────────

  // GET /api/admin/economy/overview
  async economyOverview({ response }: HttpContext) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const [gems_total_awarded, gems_total_spent, gems_awarded_today] = await Promise.all([
      db.from('gems_audit').where('amount', '>', 0).where('created_at', '>', since30d).sum('amount as s').first(),
      db.from('gems_audit').where('amount', '<', 0).where('created_at', '>', since30d).sum('amount as s').first(),
      db.from('gems_audit').where('amount', '>', 0).where('created_at', '>', today).sum('amount as s').first(),
    ])

    // Gems par source (30j)
    const by_source_rows = await db
      .from('gems_audit')
      .where('amount', '>', 0)
      .where('created_at', '>', since30d)
      .groupBy('source')
      .select('source')
      .sum('amount as total')
    const by_source: Record<string, number> = {}
    for (const row of by_source_rows) {
      by_source[row.source] = Number(row.total)
    }

    // Top earners (30j)
    const top_earners = await db
      .from('gems_audit as ga')
      .join('players as p', 'p.id', 'ga.player_id')
      .where('ga.amount', '>', 0)
      .where('ga.created_at', '>', since30d)
      .groupBy('ga.player_id', 'p.username')
      .select('p.username')
      .sum('ga.amount as total')
      .orderBy('total', 'desc')
      .limit(10)

    // Gems daily (30j)
    const gems_daily = await db.rawQuery<{ rows: any[] }>(`
      SELECT DATE(created_at) as date,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as awarded,
             ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)) as spent
      FROM gems_audit
      WHERE created_at > ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [since30d])

    // Or
    const [gold_circ, gold_daily_avg, gold_gacha] = await Promise.all([
      db.from('players').sum('gold as s').first(),
      db.from('offline_reports').where('created_at', '>', since30d).avg('gold_earned as a').first(),
      db.from('players').avg('total_pulls as a').first(),
    ])
    const player_count_row = await db.from('players').count('* as c').first()
    const player_count = Number(player_count_row?.c ?? 1)
    const total_gold = Number(gold_circ?.s ?? 0)

    // Gacha
    const rarity_dist = await db
      .from('player_pokemon')
      .groupBy('species_rarity')
      .select(db.raw("(SELECT rarity FROM pokemon_species WHERE id = player_pokemon.species_id) as rarity"))
      .count('* as total')

    // Items
    const most_equipped = await db
      .from('player_pokemon as pp')
      .join('items as i', 'i.id', 'pp.equipped_item_id')
      .whereNotNull('pp.equipped_item_id')
      .groupBy('i.name_fr')
      .select('i.name_fr as item_name_fr')
      .count('* as count')
      .orderBy('count', 'desc')
      .limit(10)

    return response.ok({
      gems: {
        total_awarded: Number(gems_total_awarded?.s ?? 0),
        total_spent: Math.abs(Number(gems_total_spent?.s ?? 0)),
        net: Number(gems_total_awarded?.s ?? 0) - Math.abs(Number(gems_total_spent?.s ?? 0)),
        by_source,
        daily: gems_daily.rows,
        top_earners,
        awarded_today: Number(gems_awarded_today?.s ?? 0),
      },
      gold: {
        total_in_circulation: total_gold,
        daily_generated_avg: Number(gold_daily_avg?.a ?? 0),
        inflation_index: player_count > 0 ? Math.floor(total_gold / player_count) : 0,
      },
      gacha: {
        avg_total_pulls: Number(gold_gacha?.a ?? 0),
      },
      items: {
        most_equipped,
      },
    })
  }

  // GET /api/admin/economy/player/:id
  async playerEconomy({ params, response }: HttpContext) {
    const player_id = params.id

    const [player, gems_audit, offline_reports, items_owned, upgrades] = await Promise.all([
      db.from('players').where('id', player_id).select('username', 'gems', 'gold', 'total_pulls').first(),
      db.from('gems_audit').where('player_id', player_id).orderBy('created_at', 'desc').limit(100),
      db.from('offline_reports').where('player_id', player_id).orderBy('created_at', 'desc').limit(20),
      db.from('player_items').where('player_id', player_id).count('* as c').first(),
      db.from('player_upgrades').where('player_id', player_id).count('* as c').first(),
    ])

    if (!player) return response.notFound({ message: 'Joueur introuvable' })

    const gems_lifetime_earned = await db
      .from('gems_audit').where('player_id', player_id).where('amount', '>', 0).sum('amount as s').first()
    const gems_lifetime_spent = await db
      .from('gems_audit').where('player_id', player_id).where('amount', '<', 0).sum('amount as s').first()
    const gold_lifetime = await db
      .from('offline_reports').where('player_id', player_id).sum('gold_earned as s').first()

    return response.ok({
      username: player.username,
      gems_current: Number(player.gems),
      gems_lifetime_earned: Number(gems_lifetime_earned?.s ?? 0),
      gems_lifetime_spent: Math.abs(Number(gems_lifetime_spent?.s ?? 0)),
      gold_current: Number(player.gold),
      gold_lifetime_earned: Number(gold_lifetime?.s ?? 0),
      total_pulls: Number(player.total_pulls ?? 0),
      items_owned: Number(items_owned?.c ?? 0),
      upgrades_purchased: Number(upgrades?.c ?? 0),
      gems_audit,
      offline_reports,
    })
  }

  // GET /api/admin/economy/alerts
  async economyAlerts({ response }: HttpContext) {
    const stats = await anticheatService.getAlertStats()
    const alerts = await db
      .from('anticheat_alerts as a')
      .join('players as p', 'p.id', 'a.player_id')
      .select('a.*', 'p.username')
      .where('a.is_resolved', false)
      .orderBy('a.created_at', 'desc')
      .limit(50)

    return response.ok({ alerts, stats })
  }

  // ─── PvP Admin ────────────────────────────────────────────────────────────

  // GET /api/admin/pvp/seasons
  async pvpSeasons({ response }: HttpContext) {
    const seasons = await db.from('pvp_seasons').orderBy('id', 'desc')
    return response.ok(seasons)
  }

  // POST /api/admin/pvp/seasons
  async createPvpSeason({ player, request, response }: HttpContext) {
    const data = await request.validateUsing(create_pvp_season_validator)

    const result = await db.table('pvp_seasons').insert({
      name_fr: data.name_fr,
      start_at: new Date(data.start_at),
      end_at: new Date(data.end_at),
      is_active: false,
      rewards_json: JSON.stringify(data.rewards_json ?? []),
    }).returning('id')

    const id = result[0]?.id ?? result[0]

    await adminAuditService.log({
      admin_id: player.id,
      action: 'pvp_season_create',
      target_type: 'pvp_season',
      target_id: String(id),
      payload: data,
    })

    return response.created({ id, message: 'Saison PvP créée' })
  }

  // PUT /api/admin/pvp/seasons/:id
  async updatePvpSeason({ player, params, request, response }: HttpContext) {
    const data = request.only(['name_fr', 'start_at', 'end_at', 'rewards_json'])
    const update: Record<string, any> = {}
    if (data.name_fr) update.name_fr = data.name_fr
    if (data.start_at) update.start_at = new Date(data.start_at)
    if (data.end_at) update.end_at = new Date(data.end_at)
    if (data.rewards_json) update.rewards_json = JSON.stringify(data.rewards_json)

    await db.from('pvp_seasons').where('id', params.id).update(update)

    await adminAuditService.log({
      admin_id: player.id,
      action: 'pvp_season_update',
      target_type: 'pvp_season',
      target_id: params.id,
      payload: update,
    })

    return response.ok({ message: 'Saison mise à jour' })
  }

  // POST /api/admin/pvp/seasons/:id/end
  async endPvpSeason({ player, params, response }: HttpContext) {
    const season = await db.from('pvp_seasons').where('id', params.id).first()
    if (!season) return response.notFound({ message: 'Saison introuvable' })

    await db.from('pvp_seasons').where('id', params.id).update({
      is_active: false,
      end_at: new Date(),
    })

    // Distribuer les récompenses gems selon le tier
    const rewards = typeof season.rewards_json === 'string'
      ? JSON.parse(season.rewards_json) : (season.rewards_json ?? [])

    let gems_distributed = 0
    if (rewards.length > 0) {
      const { default: gemsService } = await import('#services/GemsService')
      const rankings = await db
        .from('pvp_rankings')
        .where('season_id', params.id)
        .select('player_id', 'tier')

      for (const ranking of rankings) {
        const reward = rewards.find((r: any) => r.tier === ranking.tier)
        if (reward?.gems) {
          await gemsService.awardGems(ranking.player_id, reward.gems, `Fin de saison PvP ${season.name_fr} — ${ranking.tier}`, 'pvp_season_end' as any)
          gems_distributed += reward.gems
        }
      }
    }

    await adminAuditService.log({
      admin_id: player.id,
      action: 'pvp_season_end',
      target_type: 'pvp_season',
      target_id: params.id,
      payload: { season_name: season.name_fr, gems_distributed },
    })

    return response.ok({ message: 'Saison terminée', gems_distributed })
  }

  // GET /api/admin/pvp/leaderboard
  async pvpLeaderboard({ request, response }: HttpContext) {
    const season_id = request.input('season_id')
    const page = Number(request.input('page', 1))

    let q = db.from('pvp_rankings as r')
      .join('players as p', 'p.id', 'r.player_id')
      .select('r.*', 'p.username')
      .orderBy('r.elo', 'desc')

    if (season_id) q = q.where('r.season_id', season_id)
    else {
      const active = await db.from('pvp_seasons').where('is_active', true).first()
      if (active) q = q.where('r.season_id', active.id)
    }

    const rankings = await q.limit(50).offset((page - 1) * 50)
    return response.ok(rankings)
  }

  // GET /api/admin/pvp/stats
  async pvpStats({ response }: HttpContext) {
    const active_season = await db.from('pvp_seasons').where('is_active', true).first()
    if (!active_season) return response.ok({ message: 'Pas de saison active' })

    const tier_distribution = await db
      .from('pvp_rankings')
      .where('season_id', active_season.id)
      .groupBy('tier')
      .select('tier')
      .count('* as count')
      .orderBy('count', 'desc')

    const total_ranked = await db
      .from('pvp_rankings')
      .where('season_id', active_season.id)
      .count('* as c').first()

    const avg_elo = await db
      .from('pvp_rankings')
      .where('season_id', active_season.id)
      .avg('elo as a').first()

    return response.ok({
      season: active_season,
      total_ranked: Number(total_ranked?.c ?? 0),
      avg_elo: Math.round(Number(avg_elo?.a ?? 1000)),
      tier_distribution,
    })
  }

  // ─── Battle Frontier Admin ─────────────────────────────────────────────────

  // GET /api/admin/bf/rotations
  async bfRotations({ response }: HttpContext) {
    const rotations = await db.from('bf_rotations').orderBy('start_at', 'desc').limit(30)
    return response.ok(rotations)
  }

  // POST /api/admin/bf/rotations
  async createBfRotation({ player, request, response }: HttpContext) {
    const data = await request.validateUsing(create_bf_rotation_validator)

    const id = crypto.randomUUID()
    await db.table('bf_rotations').insert({
      id,
      mode: data.mode,
      tier_restriction: JSON.stringify(data.tier_restriction ?? {}),
      rules_json: JSON.stringify(data.rules_json ?? {}),
      start_at: new Date(data.start_at),
      end_at: new Date(data.end_at),
      is_active: false,
    })

    await adminAuditService.log({
      admin_id: player.id,
      action: 'bf_rotation_create',
      target_type: 'bf_rotation',
      target_id: id,
      payload: data,
    })

    return response.created({ id, message: 'Rotation BF créée' })
  }

  // PUT /api/admin/bf/rotations/:id
  async updateBfRotation({ player, params, request, response }: HttpContext) {
    const rotation = await db.from('bf_rotations').where('id', params.id).first()
    if (!rotation) return response.notFound({ message: 'Rotation introuvable' })
    if (rotation.is_active) return response.unprocessableEntity({ message: 'Impossible de modifier une rotation active' })

    const data = request.only(['mode', 'tier_restriction', 'rules_json', 'start_at', 'end_at'])
    const update: Record<string, any> = {}
    if (data.mode) update.mode = data.mode
    if (data.tier_restriction) update.tier_restriction = JSON.stringify(data.tier_restriction)
    if (data.rules_json) update.rules_json = JSON.stringify(data.rules_json)
    if (data.start_at) update.start_at = new Date(data.start_at)
    if (data.end_at) update.end_at = new Date(data.end_at)

    await db.from('bf_rotations').where('id', params.id).update(update)

    await adminAuditService.log({
      admin_id: player.id,
      action: 'bf_rotation_update',
      target_type: 'bf_rotation',
      target_id: params.id,
      payload: update,
    })

    return response.ok({ message: 'Rotation mise à jour' })
  }

  // POST /api/admin/bf/rotations/:id/end
  async endBfRotation({ player, params, response }: HttpContext) {
    const rotation = await db.from('bf_rotations').where('id', params.id).first()
    if (!rotation) return response.notFound({ message: 'Rotation introuvable' })

    await db.from('bf_rotations').where('id', params.id).update({
      is_active: false,
      end_at: new Date(),
    })

    await adminAuditService.log({
      admin_id: player.id,
      action: 'bf_rotation_end',
      target_type: 'bf_rotation',
      target_id: params.id,
      payload: { mode: rotation.mode },
    })

    return response.ok({ message: 'Rotation terminée' })
  }

  // GET /api/admin/bf/stats
  async bfStats({ response }: HttpContext) {
    const active = await db.from('bf_rotations').where('is_active', true).first()

    const [total_participants, avg_score, top_players] = await Promise.all([
      db.from('bf_leaderboard').where('rotation_id', active?.id ?? 'none').count('* as c').first(),
      db.from('bf_leaderboard').where('rotation_id', active?.id ?? 'none').avg('score as a').first(),
      db.from('bf_leaderboard as bl')
        .join('players as p', 'p.id', 'bl.player_id')
        .where('bl.rotation_id', active?.id ?? 'none')
        .select('p.username', 'bl.score', 'bl.rank')
        .orderBy('bl.score', 'desc')
        .limit(10),
    ])

    return response.ok({
      active_rotation: active,
      total_participants: Number(total_participants?.c ?? 0),
      avg_score: Math.round(Number(avg_score?.a ?? 0)),
      top_players,
    })
  }

  // ─── Notes modérateur ─────────────────────────────────────────────────────

  // GET /api/admin/players/:id/notes
  async getNotes({ params, response }: HttpContext) {
    const notes = await db
      .from('moderator_notes as mn')
      .join('players as a', 'a.id', 'mn.admin_id')
      .select('mn.*', 'a.username as admin_username')
      .where('mn.player_id', params.id)
      .orderBy('mn.created_at', 'desc')
    return response.ok(notes)
  }

  // POST /api/admin/players/:id/notes
  async addNote({ player, params, request, response }: HttpContext) {
    const data = await request.validateUsing(moderator_note_validator)

    const id = crypto.randomUUID()
    await db.table('moderator_notes').insert({
      id,
      player_id: params.id,
      admin_id: player.id,
      note: data.note,
      is_flagged: data.is_flagged ?? false,
      created_at: new Date(),
    })

    await adminAuditService.log({
      admin_id: player.id,
      action: 'moderator_note_add',
      target_type: 'player',
      target_id: params.id,
      payload: { note_id: id, is_flagged: data.is_flagged ?? false },
    })

    return response.created({ id, message: 'Note ajoutée' })
  }

  // PUT /api/admin/players/:id/notes/:note_id
  async updateNote({ player, params, request, response }: HttpContext) {
    const data = await request.validateUsing(moderator_note_validator)
    await db.from('moderator_notes')
      .where('id', params.note_id)
      .where('player_id', params.id)
      .update({ note: data.note, is_flagged: data.is_flagged ?? false })
    return response.ok({ message: 'Note mise à jour' })
  }

  // DELETE /api/admin/players/:id/notes/:note_id
  async deleteNote({ player, params, response }: HttpContext) {
    await db.from('moderator_notes')
      .where('id', params.note_id)
      .where('player_id', params.id)
      .delete()

    await adminAuditService.log({
      admin_id: player.id,
      action: 'moderator_note_delete',
      target_type: 'player',
      target_id: params.id,
      payload: { note_id: params.note_id },
    })

    return response.ok({ message: 'Note supprimée' })
  }

  // ─── Broadcast + Maintenance ──────────────────────────────────────────────

  // POST /api/admin/broadcast
  async broadcast({ player, request, response }: HttpContext) {
    const data = await request.validateUsing(broadcast_validator)

    const id = crypto.randomUUID()
    await db.table('broadcast_messages').insert({
      id,
      title_fr: data.title_fr,
      body_fr: data.body_fr,
      type: data.type,
      sent_by: player.id,
      sent_at: new Date(),
    })

    // Émettre Socket.io à tous les clients
    try {
      const { default: io } = await import('#start/socket')
      io.emit('system:broadcast', {
        title_fr: data.title_fr,
        body_fr: data.body_fr,
        type: data.type,
      })
    } catch { /* ignore si socket non disponible */ }

    await adminAuditService.log({
      admin_id: player.id,
      action: 'broadcast_send',
      target_type: 'system',
      target_id: id,
      payload: { title_fr: data.title_fr, type: data.type },
    })

    return response.ok({ id, message: 'Message diffusé' })
  }

  // POST /api/admin/system/maintenance/enable
  async enableMaintenance({ player, request, response }: HttpContext) {
    const data = await request.validateUsing(maintenance_validator)
    await eventService.enableMaintenance(data.message_fr, data.duration_minutes)

    // Broadcast maintenance warning
    try {
      const { default: io } = await import('#start/socket')
      io.emit('system:broadcast', {
        title_fr: 'Maintenance planifiée',
        body_fr: data.message_fr,
        type: 'maintenance',
      })
    } catch { /* ignore */ }

    await adminAuditService.log({
      admin_id: player.id,
      action: 'maintenance_enable',
      target_type: 'system',
      target_id: 'maintenance',
      payload: { message_fr: data.message_fr, duration_minutes: data.duration_minutes },
    })

    return response.ok({ message: 'Mode maintenance activé' })
  }

  // POST /api/admin/system/maintenance/disable
  async disableMaintenance({ player, response }: HttpContext) {
    await eventService.disableMaintenance()

    try {
      const { default: io } = await import('#start/socket')
      io.emit('system:broadcast', {
        title_fr: 'Maintenance terminée',
        body_fr: 'Le serveur est de nouveau disponible.',
        type: 'info',
      })
    } catch { /* ignore */ }

    await adminAuditService.log({
      admin_id: player.id,
      action: 'maintenance_disable',
      target_type: 'system',
      target_id: 'maintenance',
      payload: {},
    })

    return response.ok({ message: 'Mode maintenance désactivé' })
  }

  // GET /api/admin/system/status
  async systemStatus({ response }: HttpContext) {
    const maintenance = await eventService.getMaintenanceStatus()
    const active_events = await db.from('events').where('is_active', true).select('id', 'name_fr', 'event_type', 'end_at')
    const anticheat_stats = await anticheatService.getAlertStats()

    return response.ok({
      maintenance,
      active_events,
      anticheat: anticheat_stats,
    })
  }
}
