/**
 * AnticheatService — Détection d'anomalies (DPS, gems, kill rate).
 * Pure functions déléguées à AnticheatFormulas.ts (testables sans AdonisJS).
 */

import db from '@adonisjs/lucid/services/db'

// Re-export pure functions
export {
  calcTheoreticalMaxDPS,
  calcTheoreticalMaxKills,
  isDpsAnomaly,
  isKillRateAnomaly,
  isGemsAnomaly,
} from '#services/AnticheatFormulas'

import {
  isKillRateAnomaly,
  calcTheoreticalMaxKills,
} from '#services/AnticheatFormulas'

// ─── Service DB (dépend d'AdonisJS) ──────────────────────────────────────────

class AnticheatServiceClass {
  /**
   * Crée une alerte (déduplique : pas deux alertes du même type dans les 24h).
   */
  async createAlert(
    player_id: string,
    alert_type: string,
    severity: string,
    details: Record<string, unknown>
  ): Promise<boolean> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const recent = await db
      .from('anticheat_alerts')
      .where('player_id', player_id)
      .where('alert_type', alert_type)
      .where('is_resolved', false)
      .where('created_at', '>', since)
      .first()

    if (recent) return false // déjà une alerte non résolue dans les 24h

    await db.table('anticheat_alerts').insert({
      id: crypto.randomUUID(),
      player_id,
      alert_type,
      severity,
      details: JSON.stringify(details),
      is_resolved: false,
      created_at: new Date(),
    })

    if (severity === 'critical') {
      await this.notifyAdmins(player_id, alert_type, details)
    }

    return true
  }

  /**
   * Résout une alerte avec note + action.
   */
  async resolveAlert(
    alert_id: string,
    admin_id: string,
    resolution_note: string,
    action: 'false_positive' | 'warned' | 'banned'
  ): Promise<void> {
    await db.from('anticheat_alerts').where('id', alert_id).update({
      is_resolved: true,
      resolved_by: admin_id,
      resolved_at: new Date(),
      resolution_note,
    })

    // Log admin action
    await db.table('admin_audit_log').insert({
      id: crypto.randomUUID(),
      admin_id,
      action: `anticheat_resolve_${action}`,
      target_type: 'anticheat_alert',
      target_id: alert_id,
      payload: JSON.stringify({ resolution_note, action }),
      created_at: new Date(),
    })

    // Ban automatique si action='banned'
    if (action === 'banned') {
      const alert = await db.from('anticheat_alerts').where('id', alert_id).first()
      if (alert) {
        await db.from('players').where('id', alert.player_id).update({
          is_banned: true,
          ban_reason: `Anticheat: ${alert.alert_type} — ${resolution_note}`,
          banned_at: new Date(),
        })
        await db.table('admin_audit_log').insert({
          id: crypto.randomUUID(),
          admin_id,
          action: 'ban',
          target_type: 'player',
          target_id: alert.player_id,
          payload: JSON.stringify({ reason: `Anticheat: ${alert.alert_type}`, resolution_note }),
          created_at: new Date(),
        })
      }
    }
  }

  /**
   * Vérifie les gems suspectes sur les dernières 4h pour tous les joueurs.
   * Retourne le nombre d'alertes créées.
   */
  async checkGemsAnomalies(): Promise<number> {
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000)

    const suspicious = await db.rawQuery<{ rows: any[] }>(`
      SELECT ga.player_id,
             SUM(CASE WHEN ga.source != 'admin_grant' AND ga.amount > 0 THEN ga.amount ELSE 0 END) as non_admin_gems
      FROM gems_audit ga
      WHERE ga.created_at > ? AND ga.amount > 0
      GROUP BY ga.player_id
      HAVING SUM(CASE WHEN ga.source != 'admin_grant' AND ga.amount > 0 THEN ga.amount ELSE 0 END) > 50
    `, [since])

    let count = 0
    for (const row of suspicious.rows) {
      const created = await this.createAlert(row.player_id, 'gems_anomaly', 'medium', {
        non_admin_gems_gained_4h: Number(row.non_admin_gems),
        period_start: since,
      })
      if (created) count++
    }
    return count
  }

  /**
   * Vérifie les kill rates suspects dans les rapports offline des dernières 2h.
   * Retourne le nombre d'alertes créées.
   */
  async checkKillRateAnomalies(): Promise<number> {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000)

    const reports = await db
      .from('offline_reports')
      .where('created_at', '>', since)
      .whereNotNull('kills')
      .select('player_id', 'kills', 'absence_seconds', 'floor_farmed')

    let count = 0
    for (const report of reports) {
      const level = report.floor_farmed ?? 1
      if (isKillRateAnomaly(Number(report.kills), level, Number(report.absence_seconds))) {
        const max_kills = calcTheoreticalMaxKills(level, Number(report.absence_seconds))
        const created = await this.createAlert(report.player_id, 'kill_rate_anomaly', 'critical', {
          declared_kills: report.kills,
          theoretical_max_kills: max_kills,
          ratio: Number(report.kills) / Math.max(1, max_kills),
          absence_seconds: report.absence_seconds,
          floor_farmed: report.floor_farmed,
        })
        if (created) count++
      }
    }
    return count
  }

  /**
   * Statistiques des alertes (total, par type, par sévérité).
   */
  async getAlertStats(): Promise<{
    total_unresolved: number
    by_severity: Record<string, number>
    by_type: Record<string, number>
  }> {
    const rows = await db
      .from('anticheat_alerts')
      .where('is_resolved', false)
      .select('alert_type', 'severity')

    const by_severity: Record<string, number> = {}
    const by_type: Record<string, number> = {}
    for (const row of rows) {
      by_severity[row.severity] = (by_severity[row.severity] ?? 0) + 1
      by_type[row.alert_type] = (by_type[row.alert_type] ?? 0) + 1
    }

    return {
      total_unresolved: rows.length,
      by_severity,
      by_type,
    }
  }

  private async notifyAdmins(
    player_id: string,
    alert_type: string,
    details: Record<string, unknown>
  ): Promise<void> {
    // Log en console — les admins verront dans leur dashboard
    console.warn(`[ANTICHEAT CRITICAL] player=${player_id} type=${alert_type}`, JSON.stringify(details))
    // TODO: Push notification aux admins connectés via Socket.io (future amélioration)
  }
}

const anticheatService = new AnticheatServiceClass()
export default anticheatService
export { AnticheatServiceClass }
