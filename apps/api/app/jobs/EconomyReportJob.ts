/**
 * EconomyReportJob — Génère un rapport économique quotidien.
 * Déclenché tous les jours à 3h du matin via le scheduler.
 */

import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

function startOfDay(date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateString(date = new Date()): string {
  return date.toISOString().split('T')[0]
}

async function queryVal(sql: string, bindings: unknown[] = []): Promise<number> {
  try {
    const result = await db.rawQuery<{ rows: Array<Record<string, string>> }>(sql, bindings)
    const row = result.rows?.[0]
    if (!row) return 0
    const val = Object.values(row)[0]
    return Number(val ?? 0)
  } catch {
    return 0
  }
}

export async function generateDailyEconomyReport(target_date?: Date): Promise<void> {
  const date = target_date ?? new Date()
  const report_date = toDateString(date)
  const day_start = startOfDay(date)

  logger.info(`[EconomyReportJob] Génération rapport pour ${report_date}`)

  try {
    const [
      players_total,
      players_new_today,
      players_active_today,
      gems_awarded,
      gems_spent_raw,
      gold_circulation,
      total_pulls,
      raids_active,
      raids_completed,
      raid_gems,
      raid_participants,
      dungeon_completed,
      dungeon_failed,
      dungeon_gems,
      pvp_battles,
      pvp_avg_elo,
      ac_new,
      ac_resolved,
    ] = await Promise.all([
      queryVal('SELECT COUNT(*) FROM players'),
      queryVal('SELECT COUNT(*) FROM players WHERE created_at >= $1', [day_start]),
      queryVal('SELECT COUNT(*) FROM players WHERE last_seen_at >= $1', [day_start]),
      queryVal('SELECT COALESCE(SUM(amount), 0) FROM gems_audit WHERE amount > 0 AND created_at >= $1', [day_start]),
      queryVal('SELECT COALESCE(SUM(amount), 0) FROM gems_audit WHERE amount < 0 AND created_at >= $1', [day_start]),
      queryVal('SELECT COALESCE(SUM(gold), 0) FROM players'),
      queryVal('SELECT COALESCE(SUM(total_pulls), 0) FROM players'),
      queryVal("SELECT COUNT(*) FROM raid_instances WHERE status = 'active'"),
      queryVal("SELECT COUNT(*) FROM raid_instances WHERE status = 'defeated' AND defeated_at >= $1", [day_start]),
      queryVal("SELECT COALESCE(SUM(amount), 0) FROM gems_audit WHERE source LIKE 'raid%' AND created_at >= $1", [day_start]),
      queryVal('SELECT COUNT(DISTINCT player_id) FROM raid_participants WHERE joined_at >= $1', [day_start]),
      queryVal("SELECT COUNT(*) FROM dungeon_runs WHERE status = 'completed' AND completed_at >= $1", [day_start]),
      queryVal("SELECT COUNT(*) FROM dungeon_runs WHERE status = 'failed' AND completed_at >= $1", [day_start]),
      queryVal("SELECT COALESCE(SUM(amount), 0) FROM gems_audit WHERE source LIKE 'dungeon%' AND created_at >= $1", [day_start]),
      queryVal('SELECT COUNT(*) FROM pvp_battles WHERE created_at >= $1', [day_start]),
      queryVal('SELECT COALESCE(AVG(elo), 0) FROM pvp_rankings WHERE season_id IN (SELECT id FROM pvp_seasons WHERE is_active = true)'),
      queryVal('SELECT COUNT(*) FROM anticheat_alerts WHERE created_at >= $1', [day_start]),
      queryVal('SELECT COUNT(*) FROM anticheat_alerts WHERE resolved_at >= $1', [day_start]),
    ])

    const report = {
      date: report_date,
      players: {
        total: players_total,
        new_today: players_new_today,
        active_today: players_active_today,
      },
      economy: {
        gems_awarded,
        gems_spent: Math.abs(gems_spent_raw),
        gold_in_circulation: gold_circulation,
        total_pulls,
      },
      raids: {
        active_count: raids_active,
        completed_today: raids_completed,
        gems_distributed: raid_gems,
        participants_today: raid_participants,
      },
      dungeons: {
        runs_completed_today: dungeon_completed,
        runs_failed_today: dungeon_failed,
        gems_distributed: dungeon_gems,
      },
      pvp: {
        battles_today: pvp_battles,
        avg_elo: Math.round(pvp_avg_elo),
      },
      anticheat: {
        new_alerts: ac_new,
        resolved_today: ac_resolved,
      },
      candies: {
        rare_candy_used: 0,
        exp_candy_xl_used: 0,
      },
    }

    // Upsert dans economy_reports
    await db.table('economy_reports').insert({
      report_date,
      data_json: JSON.stringify(report),
      generated_at: new Date(),
    }).onConflict('report_date').merge(['data_json', 'generated_at'])

    logger.info(`[EconomyReportJob] Rapport ${report_date} généré avec succès`)
  } catch (err: any) {
    logger.error(`[EconomyReportJob] Erreur lors de la génération du rapport: ${err.message}`)
    throw err
  }
}
