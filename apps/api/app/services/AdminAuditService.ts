/**
 * AdminAuditService — Toutes les actions admin loggées sans exception.
 */

import db from '@adonisjs/lucid/services/db'

// Actions disponibles pour l'audit
export type AdminAction =
  | 'player.view_details'
  | 'player.ban'
  | 'player.unban'
  | 'player.gems_grant'
  | 'player.gems_remove'
  | 'player.gold_grant'
  | 'player.gold_remove'
  | 'player.reset_password'
  | 'player.force_disconnect'
  | 'player.role_change'
  | 'content.floor_edit'
  | 'content.event_create'
  | 'content.banner_create'
  | 'system.broadcast'
  | 'system.maintenance_toggle'

class AdminAuditService {
  async logAction(
    admin_id: string,
    action: AdminAction,
    target_type: string | null,
    target_id: string | null,
    payload: Record<string, unknown> = {}
  ): Promise<void> {
    await db.table('admin_audit_log').insert({
      id: crypto.randomUUID(),
      admin_id,
      action,
      target_type,
      target_id,
      payload: JSON.stringify(payload),
      created_at: new Date(),
    })
  }

  async getLog(opts: {
    admin_id?: string
    action?: string
    from?: string
    page?: number
    limit?: number
  }): Promise<{ entries: any[]; total: number; page: number; last_page: number }> {
    const limit = Math.min(opts.limit ?? 50, 100)
    const page = opts.page ?? 1
    const offset = (page - 1) * limit

    const applyFilters = (q: any) => {
      if (opts.admin_id) q = q.where('admin_audit_log.admin_id', opts.admin_id)
      if (opts.action) q = q.where('admin_audit_log.action', opts.action)
      if (opts.from) q = q.where('admin_audit_log.created_at', '>=', opts.from)
      return q
    }

    const count_row = await applyFilters(
      db.from('admin_audit_log').join('players', 'players.id', 'admin_audit_log.admin_id')
    ).count('* as total').first()
    const total = Number(count_row?.total ?? 0)

    const entries = await applyFilters(
      db
        .from('admin_audit_log')
        .join('players', 'players.id', 'admin_audit_log.admin_id')
        .select(
          'admin_audit_log.id',
          'admin_audit_log.admin_id',
          'players.username as admin_username',
          'admin_audit_log.action',
          'admin_audit_log.target_type',
          'admin_audit_log.target_id',
          'admin_audit_log.payload',
          'admin_audit_log.created_at'
        )
    ).orderBy('admin_audit_log.created_at', 'desc').limit(limit).offset(offset)

    return {
      entries,
      total,
      page,
      last_page: Math.ceil(total / limit),
    }
  }
}

const adminAuditService = new AdminAuditService()
export default adminAuditService
