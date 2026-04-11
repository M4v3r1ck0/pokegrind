/**
 * AdminV3Controller — Panel admin V3.
 * Routes : config, diagnostics système, export CSV, sessions actives.
 */

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import gameConfigService from '#services/GameConfigService'
import adminAuditService from '#services/AdminAuditService'
import os from 'node:os'
import process from 'node:process'

// ── CSV helper ───────────────────────────────────────────────────────────────
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ]
  return lines.join('\n')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ── Config ───────────────────────────────────────────────────────────────────

export default class AdminV3Controller {
  /**
   * GET /api/admin/config — Toutes les clés de configuration
   */
  async getConfig({ response }: HttpContext) {
    const config = await gameConfigService.getAll()
    return response.ok({ data: config })
  }

  /**
   * PUT /api/admin/config/:key — Modifier une valeur
   */
  async setConfig({ params, request, response, player }: HttpContext) {
    const { key } = params
    const { value } = request.only(['value'])

    if (value === undefined) {
      return response.badRequest({ message: 'Champ value requis' })
    }

    await gameConfigService.set(key, value, player!.id)

    await adminAuditService.log({
      admin_id: player!.id,
      action: 'config.update',
      target_type: 'game_config',
      target_id: key,
      payload: { value },
    })

    return response.ok({ message: 'Configuration mise à jour', key, value })
  }

  /**
   * POST /api/admin/config/reset/:key — Remettre la valeur par défaut
   */
  async resetConfig({ params, response, player }: HttpContext) {
    const { key } = params

    try {
      await gameConfigService.reset(key, player!.id)
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }

    await adminAuditService.log({
      admin_id: player!.id,
      action: 'config.reset',
      target_type: 'game_config',
      target_id: key,
      payload: {},
    })

    return response.ok({ message: 'Configuration réinitialisée', key })
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────

  /**
   * GET /api/admin/system/health — Rapport santé complet
   */
  async systemHealth({ response }: HttpContext) {
    const mem = process.memoryUsage()
    const total_mem_mb = Math.round(os.totalmem() / 1024 / 1024)
    const used_mem_mb = Math.round(mem.rss / 1024 / 1024)
    const uptime_seconds = Math.round(process.uptime())

    // ── Database ─────────────────────────────────────────────────────────────
    let db_status: 'healthy' | 'degraded' | 'down' = 'down'
    let db_pool = { active: 0, idle: 0, waiting: 0 }
    let avg_query_time = 0
    let largest_tables: Array<{ table_name: string; row_count: number; size_mb: number }> = []

    try {
      const before = Date.now()
      await db.rawQuery('SELECT 1')
      avg_query_time = Date.now() - before
      db_status = avg_query_time < 100 ? 'healthy' : 'degraded'

      const tables_result = await db.rawQuery(`
        SELECT
          relname AS table_name,
          n_live_tup AS row_count,
          ROUND(pg_total_relation_size(quote_ident(relname)) / 1024.0 / 1024.0, 2) AS size_mb
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(quote_ident(relname)) DESC
        LIMIT 10
      `)
      largest_tables = (tables_result.rows ?? []).map((r: any) => ({
        table_name: r.table_name,
        row_count: Number(r.row_count),
        size_mb: Number(r.size_mb),
      }))
    } catch { /* ignore */ }

    // ── Redis ─────────────────────────────────────────────────────────────────
    let redis_status: 'healthy' | 'degraded' | 'down' = 'down'
    let redis_memory_used = 0
    let redis_memory_peak = 0
    let redis_hit_rate = 0
    let redis_clients = 0
    let active_raid_keys = 0

    try {
      const info = await redis.info('all')
      redis_status = 'healthy'

      const parse_info = (field: string): string => {
        const m = info.match(new RegExp(`${field}:(\\S+)`))
        return m ? m[1] : '0'
      }

      redis_memory_used = Math.round(Number(parse_info('used_memory')) / 1024 / 1024)
      redis_memory_peak = Math.round(Number(parse_info('used_memory_peak')) / 1024 / 1024)
      redis_clients = Number(parse_info('connected_clients'))

      const hits = Number(parse_info('keyspace_hits'))
      const misses = Number(parse_info('keyspace_misses'))
      redis_hit_rate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0

      // Compter les clés raid actives
      const raid_keys = await redis.keys('raid:hp:*')
      active_raid_keys = raid_keys.length
    } catch { /* ignore */ }

    // ── BullMQ queues ─────────────────────────────────────────────────────────
    const bullmq_queues: Array<{ name: string; waiting: number; active: number; completed: number; failed: number }> = []
    try {
      const { OfflineQueue } = await import('#jobs/OfflineQueue')
      const [waiting, active, completed, failed] = await Promise.all([
        OfflineQueue.getWaitingCount(),
        OfflineQueue.getActiveCount(),
        OfflineQueue.getCompletedCount(),
        OfflineQueue.getFailedCount(),
      ])
      bullmq_queues.push({ name: 'offline', waiting, active, completed, failed })
    } catch { /* ignore */ }

    // ── WebSocket ─────────────────────────────────────────────────────────────
    let ws_clients = 0
    let ws_rooms = 0
    let ws_combat = 0
    let ws_tower = 0
    try {
      const { getIO } = await import('#start/socket')
      const io = getIO()
      ws_clients = (await io.fetchSockets()).length
      ws_rooms = io.sockets.adapter.rooms.size
      for (const [room_name] of io.sockets.adapter.rooms) {
        if (room_name.startsWith('combat:')) ws_combat++
        else if (room_name.startsWith('tower:')) ws_tower++
      }
    } catch { /* ignore */ }

    // ── Game state ────────────────────────────────────────────────────────────
    let players_online = 0
    let active_raids = 0
    let active_dungeon_runs = 0
    let maintenance_mode = false

    try {
      const online_keys = await redis.keys('heartbeat:*')
      players_online = online_keys.length
    } catch { /* ignore */ }

    try {
      const raids_q = await db.rawQuery<{ rows: any[] }>(
        "SELECT COUNT(*) as cnt FROM raid_instances WHERE status = 'active'"
      )
      active_raids = Number(raids_q.rows?.[0]?.cnt ?? 0)
    } catch { /* ignore */ }

    try {
      const dungeon_q = await db.rawQuery<{ rows: any[] }>(
        "SELECT COUNT(*) as cnt FROM dungeon_runs WHERE status = 'in_progress'"
      )
      active_dungeon_runs = Number(dungeon_q.rows?.[0]?.cnt ?? 0)
    } catch { /* ignore */ }

    try {
      maintenance_mode = await gameConfigService.get('system.maintenance_mode', false)
    } catch { /* ignore */ }

    return response.ok({
      data: {
        api: {
          uptime_seconds,
          node_version: process.version,
          memory_used_mb: used_mem_mb,
          memory_total_mb: total_mem_mb,
          cpu_usage_percent: Math.round(os.loadavg()[0] * 100) / 100,
        },
        database: {
          status: db_status,
          pool_active: db_pool.active,
          pool_idle: db_pool.idle,
          pool_waiting: db_pool.waiting,
          avg_query_time_ms: avg_query_time,
          largest_tables,
        },
        redis: {
          status: redis_status,
          memory_used_mb: redis_memory_used,
          memory_peak_mb: redis_memory_peak,
          hit_rate_percent: redis_hit_rate,
          connected_clients: redis_clients,
          active_raid_keys,
        },
        jobs: {
          bullmq_queues,
          scheduler_jobs: [
            'heartbeat (1h)',
            'bf_rotation (1h)',
            'pvp_season (1h)',
            'gold_shop (1h)',
            'events (5min)',
            'anticheat_gems (4h)',
            'anticheat_kills (2h)',
            'economy_report (daily 3h)',
          ],
        },
        websocket: {
          connected_clients: ws_clients,
          active_rooms: ws_rooms,
          active_combat_sessions: ws_combat,
          active_tower_sessions: ws_tower,
        },
        game: {
          players_online_now: players_online,
          active_raids,
          active_dungeon_runs,
          maintenance_mode,
        },
      },
    })
  }

  /**
   * GET /api/admin/system/active-sessions — Sessions de jeu actives par type
   */
  async activeSessions({ response }: HttpContext) {
    // Sessions combat idle — joueurs avec heartbeat actif
    let combat_sessions: Array<{ player_id: string; username: string; floor: number; started_at: string }> = []
    let tower_sessions: Array<{ player_id: string; username: string; floor: number; started_at: string }> = []
    let dungeon_sessions: Array<{ player_id: string; username: string; dungeon_name: string; room: number; started_at: string }> = []

    try {
      const heartbeat_keys = await redis.keys('heartbeat:*')
      const player_ids = heartbeat_keys.map((k) => k.split(':')[1]).filter(Boolean)

      if (player_ids.length > 0) {
        const players = await db
          .from('players')
          .whereIn('id', player_ids.slice(0, 100))
          .select('id', 'username', 'current_floor', 'last_seen_at')

        combat_sessions = players.map((p) => ({
          player_id: p.id,
          username: p.username,
          floor: p.current_floor,
          started_at: p.last_seen_at,
        }))
      }
    } catch { /* ignore */ }

    try {
      const dungeon_runs = await db
        .from('dungeon_runs')
        .join('players', 'players.id', 'dungeon_runs.player_id')
        .join('dungeons', 'dungeons.id', 'dungeon_runs.dungeon_id')
        .where('dungeon_runs.status', 'in_progress')
        .select(
          'players.id as player_id',
          'players.username',
          'dungeons.name_fr as dungeon_name',
          'dungeon_runs.current_room as room',
          'dungeon_runs.started_at'
        )
        .limit(50)

      dungeon_sessions = dungeon_runs.map((r) => ({
        player_id: r.player_id,
        username: r.username,
        dungeon_name: r.dungeon_name,
        room: r.room,
        started_at: r.started_at,
      }))
    } catch { /* ignore */ }

    return response.ok({
      data: {
        combat_idle: combat_sessions,
        tower: tower_sessions,
        dungeon_runs: dungeon_sessions,
      },
    })
  }

  /**
   * POST /api/admin/system/cache-flush/:pattern — Vider une partie du cache Redis
   */
  async cacheFlush({ params, request, response, player }: HttpContext) {
    const { pattern } = params
    const { confirm } = request.only(['confirm'])

    if (!confirm) {
      return response.badRequest({ message: 'confirm: true requis pour cette opération' })
    }

    const ALLOWED_PATTERNS = ['raid:*', 'bf_leaderboard:*', 'upgrade:*', 'game_config:*', 'all']
    if (!ALLOWED_PATTERNS.includes(pattern)) {
      return response.badRequest({
        message: `Pattern non autorisé. Valeurs permises : ${ALLOWED_PATTERNS.join(', ')}`,
      })
    }

    let deleted_count = 0

    try {
      if (pattern === 'all') {
        await redis.flushdb()
        deleted_count = -1 // flush total
      } else {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          deleted_count = await redis.del(...keys)
        }
      }
    } catch (err: any) {
      return response.internalServerError({ message: `Erreur flush Redis: ${err.message}` })
    }

    await adminAuditService.log({
      admin_id: player!.id,
      action: 'system.cache_flush',
      target_type: 'redis',
      target_id: pattern,
      payload: { deleted_count },
    })

    return response.ok({ message: 'Cache vidé', pattern, deleted_count })
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/export/players — Export CSV joueurs
   */
  async exportPlayers({ request, response }: HttpContext) {
    const { fields } = request.qs() as { fields?: string }
    const allowed_fields = [
      'username', 'email', 'role', 'gems', 'gold', 'prestige_level',
      'current_floor', 'pvp_elo', 'created_at', 'last_seen_at', 'is_banned',
    ]
    const requested = fields
      ? fields.split(',').filter((f) => allowed_fields.includes(f))
      : allowed_fields

    if (requested.length === 0) {
      return response.badRequest({ message: 'Aucun champ valide demandé' })
    }

    const db_fields_map: Record<string, string> = {
      username: 'players.username',
      email: 'players.email',
      role: 'players.role',
      gems: 'players.gems',
      gold: 'players.gold',
      prestige_level: 'players.prestige_level',
      current_floor: 'players.current_floor',
      pvp_elo: 'pvp_rankings.elo as pvp_elo',
      created_at: 'players.created_at',
      last_seen_at: 'players.last_seen_at',
      is_banned: 'players.is_banned',
    }

    const select_fields = requested.map((f) => db_fields_map[f] ?? `players.${f}`)

    let players: any[]
    try {
      const query = db.from('players').select(select_fields)
      if (requested.includes('pvp_elo')) {
        query.leftJoin('pvp_rankings', function (q) {
          q.on('pvp_rankings.player_id', 'players.id')
            .andOnVal('pvp_rankings.season_id', db.raw('(SELECT id FROM pvp_seasons WHERE is_active = true LIMIT 1)') as any)
        })
      }
      players = await query.orderBy('players.created_at', 'desc')
    } catch (err: any) {
      return response.internalServerError({ message: `Erreur BDD: ${err.message}` })
    }

    const csv = toCsv(players)
    const filename = `players_${new Date().toISOString().split('T')[0]}.csv`

    response.header('Content-Type', 'text/csv')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.ok(csv)
  }

  /**
   * GET /api/admin/export/gems-audit — Export CSV audit gems
   */
  async exportGemsAudit({ request, response }: HttpContext) {
    const { from, to } = request.qs() as { from?: string; to?: string }
    const from_date = toDate(from) ?? new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const to_date = toDate(to) ?? new Date()

    const rows = await db
      .from('gems_audit')
      .join('players', 'players.id', 'gems_audit.player_id')
      .where('gems_audit.created_at', '>=', from_date)
      .where('gems_audit.created_at', '<=', to_date)
      .select(
        'players.username',
        'gems_audit.amount',
        'gems_audit.reason',
        'gems_audit.source',
        'gems_audit.created_at'
      )
      .orderBy('gems_audit.created_at', 'desc')
      .limit(50000)

    const csv = toCsv(rows)
    const filename = `gems_audit_${from_date.toISOString().split('T')[0]}_${to_date.toISOString().split('T')[0]}.csv`

    response.header('Content-Type', 'text/csv')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.ok(csv)
  }

  /**
   * GET /api/admin/export/economy-report — Export CSV rapports économiques
   */
  async exportEconomyReport({ request, response }: HttpContext) {
    const { from, to } = request.qs() as { from?: string; to?: string }
    const from_date = (toDate(from) ?? new Date(Date.now() - 30 * 24 * 3600 * 1000)).toISOString().split('T')[0]
    const to_date = (toDate(to) ?? new Date()).toISOString().split('T')[0]

    const rows = await db
      .from('economy_reports')
      .where('report_date', '>=', from_date)
      .where('report_date', '<=', to_date)
      .orderBy('report_date', 'asc')

    // Aplatir le JSON en colonnes CSV
    const flat_rows = rows.map((r) => {
      const data = typeof r.data_json === 'string' ? JSON.parse(r.data_json) : r.data_json
      return {
        date: r.report_date,
        players_total: data.players?.total ?? 0,
        players_new: data.players?.new_today ?? 0,
        players_active: data.players?.active_today ?? 0,
        gems_awarded: data.economy?.gems_awarded ?? 0,
        gems_spent: data.economy?.gems_spent ?? 0,
        gold_circulation: data.economy?.gold_in_circulation ?? 0,
        total_pulls: data.economy?.total_pulls ?? 0,
        raids_completed: data.raids?.completed_today ?? 0,
        raids_gems: data.raids?.gems_distributed ?? 0,
        dungeon_runs_completed: data.dungeons?.runs_completed_today ?? 0,
        dungeon_gems: data.dungeons?.gems_distributed ?? 0,
        pvp_battles: data.pvp?.battles_today ?? 0,
        pvp_avg_elo: data.pvp?.avg_elo ?? 0,
        anticheat_alerts: data.anticheat?.new_alerts ?? 0,
      }
    })

    const csv = toCsv(flat_rows)
    const filename = `economy_report_${from_date}_${to_date}.csv`

    response.header('Content-Type', 'text/csv')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.ok(csv)
  }

  // ── Rapports économiques ─────────────────────────────────────────────────

  /**
   * GET /api/admin/economy/reports — Historique des rapports quotidiens
   */
  async economyReports({ request, response }: HttpContext) {
    const { limit = 30 } = request.qs()

    const reports = await db
      .from('economy_reports')
      .orderBy('report_date', 'desc')
      .limit(Math.min(Number(limit), 90))

    return response.ok({
      data: reports.map((r) => ({
        date: r.report_date,
        generated_at: r.generated_at,
        data: typeof r.data_json === 'string' ? JSON.parse(r.data_json) : r.data_json,
      })),
    })
  }

  // ── Donjons admin ─────────────────────────────────────────────────────────

  /**
   * GET /api/admin/dungeons — Liste des donjons avec stats
   */
  async getDungeons({ response }: HttpContext) {
    const dungeons = await db
      .from('dungeons')
      .orderBy('region', 'asc')
      .orderBy('difficulty', 'asc')

    // Stats de la semaine pour chaque donjon
    const week_ago = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const runs_stats = await db
      .from('dungeon_runs')
      .where('started_at', '>=', week_ago)
      .groupBy('dungeon_id')
      .select(
        'dungeon_id',
        db.raw('COUNT(*) as total_runs'),
        db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed")
      )

    const stats_map = new Map(runs_stats.map((r) => [r.dungeon_id, r]))

    return response.ok({
      data: dungeons.map((d) => {
        const stats = stats_map.get(d.id)
        const total = Number(stats?.total_runs ?? 0)
        const completed = Number(stats?.completed ?? 0)
        return {
          ...d,
          runs_this_week: total,
          completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        }
      }),
    })
  }

  /**
   * POST /api/admin/dungeons/:id/toggle — Activer/désactiver un donjon
   */
  async toggleDungeon({ params, response, player }: HttpContext) {
    const dungeon = await db.from('dungeons').where('id', params.id).first()
    if (!dungeon) return response.notFound({ message: 'Donjon introuvable' })

    const new_status = !dungeon.is_active
    await db.from('dungeons').where('id', params.id).update({ is_active: new_status })

    await adminAuditService.log({
      admin_id: player!.id,
      action: new_status ? 'dungeon.activate' : 'dungeon.deactivate',
      target_type: 'dungeon',
      target_id: params.id,
      payload: { name_fr: dungeon.name_fr },
    })

    return response.ok({ message: `Donjon ${new_status ? 'activé' : 'désactivé'}`, is_active: new_status })
  }

  /**
   * GET /api/admin/dungeons/stats — Stats globales donjons
   */
  async dungeonStats({ response }: HttpContext) {
    const week_ago = new Date(Date.now() - 7 * 24 * 3600 * 1000)

    const runs_q = await db.rawQuery<{ rows: any[] }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM dungeon_runs WHERE started_at >= $1`,
      [week_ago]
    )
    const runs_result = runs_q.rows?.[0]

    const hardest = await db
      .from('dungeon_runs')
      .join('dungeons', 'dungeons.id', 'dungeon_runs.dungeon_id')
      .where('dungeon_runs.started_at', '>=', week_ago)
      .groupBy('dungeon_runs.dungeon_id', 'dungeons.name_fr')
      .select(
        'dungeons.name_fr',
        db.raw('COUNT(*) as total'),
        db.raw("COUNT(*) FILTER (WHERE dungeon_runs.status = 'completed') as completed")
      )
      .orderByRaw("(COUNT(*) FILTER (WHERE dungeon_runs.status = 'completed'))::float / NULLIF(COUNT(*), 0) ASC")
      .first()

    const total = Number(runs_result?.total ?? 0)
    const completed = Number(runs_result?.completed ?? 0)

    return response.ok({
      data: {
        runs_this_week: total,
        completed_this_week: completed,
        failed_this_week: Number(runs_result?.failed ?? 0),
        completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        hardest_dungeon: hardest
          ? {
              name_fr: hardest.name_fr,
              completion_rate: Number(hardest.total) > 0
                ? Math.round((Number(hardest.completed) / Number(hardest.total)) * 100)
                : 0,
            }
          : null,
      },
    })
  }

  // ── Tour Infinie admin ────────────────────────────────────────────────────

  /**
   * GET /api/admin/tower — Infos saison Tour Infinie + classement
   */
  async getTower({ response }: HttpContext) {
    const season = await db.from('tower_seasons').where('is_active', true).first()

    let leaderboard: any[] = []
    let floor_distribution: Record<string, number> = {}
    let active_count = 0

    if (season) {
      leaderboard = await db
        .from('tower_rankings')
        .join('players', 'players.id', 'tower_rankings.player_id')
        .where('tower_rankings.season_id', season.id)
        .select('players.id', 'players.username', 'tower_rankings.max_floor', 'tower_rankings.updated_at')
        .orderBy('tower_rankings.max_floor', 'desc')
        .limit(20)

      active_count = leaderboard.length

      // Distribution des étages
      const dist_result = await db.rawQuery<{ rows: any[] }>(`
        SELECT
          CASE
            WHEN max_floor <= 100 THEN '1-100'
            WHEN max_floor <= 200 THEN '101-200'
            WHEN max_floor <= 300 THEN '201-300'
            ELSE '300+'
          END as bucket,
          COUNT(*) as cnt
        FROM tower_rankings
        WHERE season_id = $1
        GROUP BY bucket
        ORDER BY bucket
      `, [season.id])

      for (const row of dist_result.rows ?? []) {
        floor_distribution[row.bucket] = Number(row.cnt)
      }
    }

    return response.ok({
      data: {
        season,
        leaderboard,
        active_players: active_count,
        floor_distribution,
      },
    })
  }

  /**
   * POST /api/admin/tower/season/end — Forcer la fin de saison Tour
   */
  async endTowerSeason({ response, player }: HttpContext) {
    const season = await db.from('tower_seasons').where('is_active', true).first()
    if (!season) return response.notFound({ message: 'Aucune saison Tour active' })

    await db.from('tower_seasons').where('id', season.id).update({
      is_active: false,
      end_at: new Date(),
    })

    await adminAuditService.log({
      admin_id: player!.id,
      action: 'tower.end_season',
      target_type: 'tower_season',
      target_id: season.id,
      payload: { name_fr: season.name_fr },
    })

    return response.ok({ message: 'Saison Tour Infinie terminée', season_id: season.id })
  }

  // ── Migrations one-shot ───────────────────────────────────────────────────

  /**
   * POST /api/admin/migrate-starter-moves
   * Attribue les 4 premiers moves level-up aux Pokémon joueurs qui n'en ont aucun.
   * Migration one-shot pour les comptes créés avant le fix StarterService.
   */
  async migrateStarterMoves({ response, player }: HttpContext) {
    // 1. Récupérer tous les player_pokemon sans aucun move
    const pokemon_without_moves = await db
      .from('player_pokemon as pp')
      .whereNotExists(
        db.from('player_pokemon_moves').whereColumn('player_pokemon_id', 'pp.id')
      )
      .select('pp.id', 'pp.species_id', 'pp.level')

    let migrated_count = 0
    let skipped_count = 0
    const errors: string[] = []

    for (const poke of pokemon_without_moves) {
      try {
        // 2. Chercher les 4 premiers moves level-up appris avant le niveau actuel
        let learnset = await db
          .from('pokemon_learnset as pl')
          .join('moves as m', 'm.id', 'pl.move_id')
          .where('pl.species_id', poke.species_id)
          .where('pl.learn_method', 'level')
          .where('pl.level_learned_at', '<=', poke.level)
          .orderBy('pl.level_learned_at', 'asc')
          .select('m.id as move_id', 'm.pp')
          .limit(4)

        // 3. Fallback : 4 premiers moves du learnset sans filtre niveau
        if (learnset.length === 0) {
          learnset = await db
            .from('pokemon_learnset as pl')
            .join('moves as m', 'm.id', 'pl.move_id')
            .where('pl.species_id', poke.species_id)
            .where('pl.learn_method', 'level')
            .orderBy('pl.level_learned_at', 'asc')
            .select('m.id as move_id', 'm.pp')
            .limit(4)
        }

        if (learnset.length === 0) {
          skipped_count++
          continue
        }

        // 4. Insérer les moves slots 1-4
        const moves_to_insert = learnset.map((m, idx) => ({
          id: crypto.randomUUID(),
          player_pokemon_id: poke.id,
          slot: idx + 1,
          move_id: m.move_id,
          pp_current: m.pp ?? 10,
          pp_max: m.pp ?? 10,
        }))

        await db.table('player_pokemon_moves').multiInsert(moves_to_insert)
        migrated_count++
      } catch (err: any) {
        errors.push(`pokemon ${poke.id}: ${err.message}`)
      }
    }

    await adminAuditService.log({
      admin_id: player!.id,
      action: 'migrate.starter_moves',
      target_type: 'player_pokemon',
      target_id: 'all',
      payload: { migrated_count, skipped_count, errors_count: errors.length },
    })

    return response.ok({
      message: 'Migration terminée',
      migrated_count,
      skipped_count,
      errors,
    })
  }
}
