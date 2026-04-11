/**
 * AdminController — Panel admin : dashboard, joueurs, gems, stats.
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import redis from '@adonisjs/redis/services/main'
import gemsService from '#services/GemsService'
import adminAuditService from '#services/AdminAuditService'
import JwtService from '#services/JwtService'

export default class AdminController {
  // ─── Dashboard ────────────────────────────────────────────────────────────

  async dashboard({ }: HttpContext) {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Joueurs
    const [total_players, active_24h, active_7d, new_today, new_week] = await Promise.all([
      db.from('players').count('* as c').first(),
      db.from('players').where('last_seen_at', '>', yesterday).count('* as c').first(),
      db.from('players').where('last_seen_at', '>', last7d).count('* as c').first(),
      db.from('players').where('created_at', '>', startOfToday).count('* as c').first(),
      db.from('players').where('created_at', '>', startOfWeek).count('* as c').first(),
    ])

    // Économie
    const [gems_circ, gold_circ, gems_awarded_today, gems_spent_today] = await Promise.all([
      db.from('players').sum('gems as s').first(),
      db.from('players').sum('gold as s').first(),
      db.from('gems_audit').where('amount', '>', 0).where('created_at', '>', startOfToday).sum('amount as s').first(),
      db.from('gems_audit').where('amount', '<', 0).where('created_at', '>', startOfToday).sum('amount as s').first(),
    ])

    // Combat
    const [avg_floor, max_floor_row, total_kills] = await Promise.all([
      db.from('players').avg('current_floor as a').first(),
      db.from('players').max('max_floor_reached as m').first(),
      db.from('players').sum('total_kills as s').first(),
    ])

    // Pension
    const [active_daycare, hatches_today] = await Promise.all([
      db.from('daycare_slots').whereNotNull('player_pokemon_id').count('* as c').first(),
      db.from('player_pokemon').where('created_at', '>', startOfToday).where('stars', '>', 0).count('* as c').first(),
    ])

    // Serveur
    const redis_info = await redis.info('memory').catch(() => '')
    const redis_memory_line = redis_info.split('\n').find((l) => l.startsWith('used_memory:'))
    const redis_memory_mb = redis_memory_line
      ? Math.round(Number(redis_memory_line.split(':')[1]) / 1024 / 1024)
      : 0

    // Sessions combat actives (via CombatProgressionService)
    let active_sessions = 0
    try {
      const { default: combatProgressionService } = await import('#services/CombatProgressionService')
      active_sessions = combatProgressionService.getActiveSessionCount()
    } catch { /* ignore */ }

    return {
      players: {
        total: Number(total_players?.c ?? 0),
        active_last_24h: Number(active_24h?.c ?? 0),
        active_last_7d: Number(active_7d?.c ?? 0),
        new_today: Number(new_today?.c ?? 0),
        new_this_week: Number(new_week?.c ?? 0),
      },
      economy: {
        total_gems_in_circulation: Number(gems_circ?.s ?? 0),
        gems_awarded_today: Number(gems_awarded_today?.s ?? 0),
        gems_spent_today: Math.abs(Number(gems_spent_today?.s ?? 0)),
        total_gold_in_circulation: Number(gold_circ?.s ?? 0),
      },
      combat: {
        avg_floor_all_players: Math.round(Number(avg_floor?.a ?? 0) * 10) / 10,
        max_floor_reached: Number(max_floor_row?.m ?? 0),
        total_kills_all_time: Number(total_kills?.s ?? 0),
      },
      daycare: {
        active_slots: Number(active_daycare?.c ?? 0),
        hatches_today: Number(hatches_today?.c ?? 0),
      },
      server: {
        uptime_seconds: Math.floor(process.uptime()),
        node_version: process.version,
        redis_memory_mb,
        active_combat_sessions: active_sessions,
      },
    }
  }

  // ─── Listing joueurs ──────────────────────────────────────────────────────

  async players({ request }: HttpContext) {
    const { page = 1, limit = 20, search, role, banned, sort = 'created_at' } = request.qs()
    const safe_limit = Math.min(Number(limit), 50)
    const offset = (Number(page) - 1) * safe_limit

    const ALLOWED_SORTS = ['created_at', 'last_seen_at', 'gems', 'gold', 'current_floor'] as const
    const sort_col = ALLOWED_SORTS.includes(sort) ? sort : 'created_at'

    const applyFilters = (q: any) => {
      if (search) {
        q = q.where((inner: any) => {
          inner.whereILike('username', `%${search}%`).orWhereILike('email', `%${search}%`)
        })
      }
      if (role) q = q.where('role', role)
      if (banned === 'true' || banned === true) q = q.where('is_banned', true)
      if (banned === 'false' || banned === false) q = q.where('is_banned', false)
      return q
    }

    const count_row = await applyFilters(db.from('players')).count('* as total').first()
    const total = Number(count_row?.total ?? 0)

    const data = await applyFilters(
      db.from('players').select(
        'id', 'username', 'email', 'role',
        'gems', 'gold', 'frontier_points', 'current_floor',
        'total_kills', 'total_pulls', 'is_banned',
        'created_at', 'last_seen_at'
      )
    ).orderBy(sort_col, 'desc').limit(safe_limit).offset(offset)

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: safe_limit,
        last_page: Math.ceil(total / safe_limit),
      },
    }
  }

  // ─── Fiche joueur ─────────────────────────────────────────────────────────

  async playerDetail({ params, player: admin }: HttpContext) {
    const target_id = params.id

    const player = await db.from('players').where('id', target_id)
      .select(
        'id', 'username', 'email', 'role', 'gems', 'gold',
        'frontier_points', 'current_floor', 'total_kills', 'total_pulls',
        'is_banned', 'ban_reason', 'banned_at', 'ban_until',
        'created_at', 'last_seen_at', 'updated_at',
        'pity_epic', 'pity_legendary', 'max_floor_reached'
      )
      .first()
    if (!player) return { error: 'Joueur introuvable' }

    // Lancer tout en parallèle
    const [team, recent_gems, recent_reports, upgrades, pokemon_count, pokedex_count, daycare_active] =
      await Promise.all([
        db.from('player_pokemon')
          .join('pokemon_species', 'pokemon_species.id', 'player_pokemon.species_id')
          .where('player_pokemon.player_id', target_id)
          .whereNotNull('player_pokemon.slot_team')
          .orderBy('player_pokemon.slot_team', 'asc')
          .select(
            'player_pokemon.id',
            'player_pokemon.slot_team',
            'player_pokemon.level',
            'player_pokemon.is_shiny',
            'player_pokemon.stars',
            'pokemon_species.name_fr',
            'pokemon_species.sprite_url',
            'pokemon_species.rarity'
          ),
        db.from('gems_audit').where('player_id', target_id).orderBy('created_at', 'desc').limit(20),
        db.from('offline_reports').where('player_id', target_id).orderBy('created_at', 'desc').limit(5),
        db.from('player_upgrades')
          .join('shop_upgrades', 'shop_upgrades.id', 'player_upgrades.upgrade_id')
          .where('player_upgrades.player_id', target_id)
          .select('shop_upgrades.id', 'shop_upgrades.name_fr', 'shop_upgrades.effect_type', 'player_upgrades.purchased_at'),
        db.from('player_pokemon').where('player_id', target_id).count('* as c').first(),
        db.from('player_pokedex').where('player_id', target_id).count('* as c').first(),
        db.from('daycare_slots').where('player_id', target_id).whereNotNull('player_pokemon_id').count('* as c').first(),
      ])

    // Log audit
    adminAuditService.logAction(admin.id, 'player.view_details', 'player', target_id, {}).catch(() => {})

    return {
      player,
      team,
      recent_gems_audit: recent_gems,
      recent_offline_reports: recent_reports,
      upgrades_purchased: upgrades,
      stats: {
        pokemon_count: Number(pokemon_count?.c ?? 0),
        pokedex_owned: Number(pokedex_count?.c ?? 0),
        daycare_slots_active: Number(daycare_active?.c ?? 0),
      },
    }
  }

  // ─── Ban joueur ───────────────────────────────────────────────────────────

  async banPlayer({ params, request, player: admin, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      reason: vine.string().maxLength(500),
      duration_hours: vine.number().positive().optional(),
    }))
    const { reason, duration_hours } = await schema.validate(request.body())

    const target = await db.from('players').where('id', params.id).first()
    if (!target) return response.notFound({ message: 'Joueur introuvable' })
    if (target.role === 'admin') return response.forbidden({ message: 'Impossible de bannir un admin' })

    const ban_until = duration_hours
      ? DateTime.now().plus({ hours: duration_hours }).toJSDate()
      : null

    await db.from('players').where('id', params.id).update({
      is_banned: true,
      banned_at: new Date(),
      ban_reason: reason,
      ban_until,
    })

    // Invalider les tokens Redis du joueur
    await this.invalidatePlayerTokens(params.id)

    await adminAuditService.logAction(admin.id, 'player.ban', 'player', params.id, {
      reason,
      duration_hours: duration_hours ?? null,
      ban_until: ban_until?.toISOString() ?? null,
    })

    return { success: true }
  }

  async unbanPlayer({ params, player: admin, response }: HttpContext) {
    const target = await db.from('players').where('id', params.id).first()
    if (!target) return response.notFound({ message: 'Joueur introuvable' })

    await db.from('players').where('id', params.id).update({
      is_banned: false,
      banned_at: null,
      ban_reason: null,
      ban_until: null,
    })

    await adminAuditService.logAction(admin.id, 'player.unban', 'player', params.id, {})

    return { success: true }
  }

  // ─── Gems admin ───────────────────────────────────────────────────────────

  async grantGems({ params, request, player: admin, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      amount: vine.number(),
      reason: vine.string().maxLength(256),
    }))
    const { amount, reason } = await schema.validate(request.body())

    const target = await db.from('players').where('id', params.id).first()
    if (!target) return response.notFound({ message: 'Joueur introuvable' })

    if (amount > 0) {
      await gemsService.awardGems(params.id, amount, `[Admin] ${reason}`, 'admin_grant')
    } else if (amount < 0) {
      await gemsService.spendGems(params.id, Math.abs(amount), `[Admin] ${reason}`)
    }

    const action = amount > 0 ? 'player.gems_grant' : 'player.gems_remove'
    await adminAuditService.logAction(admin.id, action as any, 'player', params.id, { amount, reason })

    return { success: true, amount }
  }

  // ─── Or admin ─────────────────────────────────────────────────────────────

  async grantGold({ params, request, player: admin, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      amount: vine.number(),
      reason: vine.string().maxLength(256),
    }))
    const { amount, reason } = await schema.validate(request.body())

    const target = await db.from('players').where('id', params.id).first()
    if (!target) return response.notFound({ message: 'Joueur introuvable' })

    if (amount > 0) {
      await db.from('players').where('id', params.id).increment('gold', amount)
    } else if (amount < 0) {
      await db.from('players').where('id', params.id).decrement('gold', Math.abs(amount))
    }

    const action = amount > 0 ? 'player.gold_grant' : 'player.gold_remove'
    await adminAuditService.logAction(admin.id, action as any, 'player', params.id, { amount, reason })

    return { success: true, amount }
  }

  // ─── Force disconnect ─────────────────────────────────────────────────────

  async forceDisconnect({ params, player: admin, response }: HttpContext) {
    const target = await db.from('players').where('id', params.id).first()
    if (!target) return response.notFound({ message: 'Joueur introuvable' })

    await this.invalidatePlayerTokens(params.id)
    await adminAuditService.logAction(admin.id, 'player.force_disconnect', 'player', params.id, {})

    return { success: true }
  }

  // ─── Audit gems ───────────────────────────────────────────────────────────

  async gemsAudit({ request }: HttpContext) {
    const { player, player_id, source, from, to, page = 1, limit = 50 } = request.qs()
    const per_page = Math.min(Number(limit), 100)
    const current_page = Number(page)

    // Résoudre player_id depuis username si fourni
    let resolved_player_id = player_id ?? null
    if (player && !player_id) {
      const p = await db.from('players')
        .whereILike('username', `%${player}%`)
        .orWhereILike('email', `%${player}%`)
        .select('id')
        .first()
      resolved_player_id = p?.id ?? null
    }

    const applyFilters = (q: any) => {
      if (resolved_player_id) q = q.where('gems_audit.player_id', resolved_player_id)
      if (source) q = q.where('gems_audit.source', source)
      if (from) q = q.where('gems_audit.created_at', '>=', from)
      if (to) q = q.where('gems_audit.created_at', '<=', to)
      return q
    }

    const count_row = await applyFilters(
      db.from('gems_audit').join('players', 'players.id', 'gems_audit.player_id')
    ).count('* as total').first()
    const total = Number(count_row?.total ?? 0)

    const data = await applyFilters(
      db.from('gems_audit')
        .join('players', 'players.id', 'gems_audit.player_id')
        .select(
          'gems_audit.id',
          'gems_audit.amount',
          'gems_audit.reason',
          'gems_audit.source',
          'gems_audit.created_at',
          'players.username'
        )
    ).orderBy('gems_audit.created_at', 'desc').limit(per_page).offset((current_page - 1) * per_page)

    return {
      data,
      meta: {
        total,
        page: current_page,
        limit: per_page,
        last_page: Math.ceil(total / per_page),
      },
    }
  }

  async gemsAuditStats({ }: HttpContext) {
    const since_30d = DateTime.now().minus({ days: 30 }).toJSDate()

    const [by_source, top_earners, daily_totals] = await Promise.all([
      // Par source (30 jours)
      db.from('gems_audit')
        .where('created_at', '>', since_30d)
        .groupBy('source')
        .select('source')
        .sum('amount as total_gems')
        .count('* as transaction_count')
        .orderBy('total_gems', 'desc'),

      // Top 10 gagneurs
      db.from('gems_audit')
        .join('players', 'players.id', 'gems_audit.player_id')
        .where('gems_audit.amount', '>', 0)
        .where('gems_audit.created_at', '>', since_30d)
        .groupBy('gems_audit.player_id', 'players.username')
        .select('gems_audit.player_id', 'players.username')
        .sum('gems_audit.amount as total_gems_earned')
        .orderBy('total_gems_earned', 'desc')
        .limit(10),

      // Totaux quotidiens
      db.raw(`
        SELECT
          DATE(created_at) as date,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as gems_awarded,
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as gems_spent
        FROM gems_audit
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ])

    return {
      by_source,
      top_earners,
      daily_totals: daily_totals.rows,
    }
  }

  // ─── Audit admin ─────────────────────────────────────────────────────────

  async auditLog({ request }: HttpContext) {
    const { admin_id, action, from, page = 1, limit = 50 } = request.qs()
    const result = await adminAuditService.getLog({
      admin_id,
      action,
      from,
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    })
    return {
      data: result.entries,
      meta: {
        total: result.total,
        page: result.page,
        limit: Math.min(Number(limit), 100),
        last_page: result.last_page,
      },
    }
  }

  // ─── Stats combat ─────────────────────────────────────────────────────────

  async statsCombat({ }: HttpContext) {
    const [floor_dist, boss_clears] = await Promise.all([
      db.from('players')
        .groupBy('current_floor')
        .select('current_floor as floor_number')
        .count('* as player_count')
        .orderBy('current_floor', 'asc'),

      db.from('player_floor_progress')
        .select('floor_number')
        .count('* as clears')
        .groupBy('floor_number')
        .orderBy('floor_number', 'asc'),
    ])

    return {
      floor_distribution: floor_dist,
      boss_clear_rates: boss_clears,
    }
  }

  // ─── Stats gacha ─────────────────────────────────────────────────────────

  async statsGacha({ }: HttpContext) {
    const since_today = DateTime.now().startOf('day').toJSDate()

    const [total_pulls, pulls_today, rarity_dist, shiny_count] = await Promise.all([
      db.from('players').sum('total_pulls as s').first(),
      // pulls aujourd'hui via count des pokemon créés aujourd'hui (hors éclosion)
      db.from('player_pokemon').where('created_at', '>', since_today).where('stars', 0).count('* as c').first(),
      db.from('player_pokemon')
        .join('pokemon_species', 'pokemon_species.id', 'player_pokemon.species_id')
        .where('player_pokemon.stars', 0)
        .groupBy('pokemon_species.rarity')
        .select('pokemon_species.rarity')
        .count('* as count'),
      db.from('player_pokemon').where('is_shiny', true).where('stars', 0).count('* as c').first(),
    ])

    const total = Number(total_pulls?.s ?? 0)
    const shiny_total = Number(shiny_count?.c ?? 0)

    const rarity_total = (rarity_dist as any[]).reduce((sum, r) => sum + Number(r.count), 0)

    return {
      total_pulls_all_time: total,
      pulls_today: Number(pulls_today?.c ?? 0),
      rarity_distribution: (rarity_dist as any[]).map((r) => ({
        rarity: r.rarity,
        count: Number(r.count),
        percent: rarity_total > 0 ? Math.round((Number(r.count) / rarity_total) * 1000) / 10 : 0,
      })),
      shiny_rate_observed: total > 0 ? Math.round((shiny_total / total) * 100000) / 1000 : 0,
    }
  }

  // ─── Stats économie ───────────────────────────────────────────────────────

  async statsEconomy({ }: HttpContext) {
    const since_30d = DateTime.now().minus({ days: 30 }).toJSDate()

    const [upgrade_pop, gold_stats, gems_flow] = await Promise.all([
      db.from('player_upgrades')
        .join('shop_upgrades', 'shop_upgrades.id', 'player_upgrades.upgrade_id')
        .groupBy('shop_upgrades.id', 'shop_upgrades.name_fr')
        .select('shop_upgrades.name_fr as upgrade_name_fr')
        .count('* as purchase_count')
        .orderBy('purchase_count', 'desc'),

      db.from('players').select(
        db.raw('SUM(gold) as total_in_circulation'),
        db.raw('AVG(gold)::bigint as avg_per_player')
      ).first(),

      db.raw(`
        SELECT
          DATE(created_at) as date,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as awarded,
          SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as spent
        FROM gems_audit
        WHERE created_at > $1
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [since_30d]),
    ])

    return {
      upgrade_popularity: upgrade_pop,
      gold_economy: {
        total_in_circulation: Number((gold_stats as any)?.total_in_circulation ?? 0),
        avg_per_player: Number((gold_stats as any)?.avg_per_player ?? 0),
      },
      gems_flow_30d: gems_flow.rows,
    }
  }

  // ─── Pokémon joueur ───────────────────────────────────────────────────────

  async playerPokemon({ params, response }: HttpContext) {
    const rows = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'ps.id', 'pp.species_id')
      .where('pp.player_id', params.id)
      .select(
        'pp.id', 'pp.level', 'pp.xp', 'pp.is_shiny', 'pp.stars',
        'pp.slot_team', 'pp.slot_daycare', 'pp.nature',
        'pp.iv_hp', 'pp.iv_atk', 'pp.iv_def',
        'pp.iv_spatk', 'pp.iv_spdef', 'pp.iv_speed',
        'ps.name_fr', 'ps.sprite_url', 'ps.type1', 'ps.type2', 'ps.rarity'
      )
      .orderBy('pp.slot_team', 'asc')
    return response.ok({ pokemon: rows })
  }

  async editPokemon({ params, request, response }: HttpContext) {
    const { level, xp } = request.body()
    const updates: Record<string, any> = {}
    if (level !== undefined) updates.level = Math.max(1, Math.min(100, Number(level)))
    if (xp !== undefined) updates.xp = Math.max(0, Number(xp))
    if (Object.keys(updates).length === 0) return response.badRequest({ message: 'Rien à modifier' })
    await db.from('player_pokemon').where('id', params.pokemon_id).update(updates)
    return response.ok({ message: 'Pokémon modifié' })
  }

  // ─── Items joueur ─────────────────────────────────────────────────────────

  async playerItems({ params, response }: HttpContext) {
    const rows = await db
      .from('player_items as pi')
      .join('items as i', 'i.id', 'pi.item_id')
      .where('pi.player_id', params.id)
      .select('pi.item_id', 'i.name_fr', 'i.effect_type', 'pi.quantity')
      .orderBy('i.name_fr', 'asc')
    return response.ok({ items: rows })
  }

  async grantItems({ params, request, player: admin, response }: HttpContext) {
    const { item_id, quantity } = request.body()
    if (!item_id || !quantity || quantity <= 0) {
      return response.badRequest({ message: 'item_id et quantity requis' })
    }
    await db.rawQuery(`
      INSERT INTO player_items (id, player_id, item_id, quantity, obtained_at)
      VALUES (gen_random_uuid(), ?, ?, ?, NOW())
      ON CONFLICT (player_id, item_id)
      DO UPDATE SET quantity = player_items.quantity + EXCLUDED.quantity
    `, [params.id, item_id, quantity])

    await db.table('admin_audit_log').insert({
      id: crypto.randomUUID(),
      admin_id: admin.id,
      action: 'grant_items',
      target_type: 'player',
      target_id: params.id,
      payload: JSON.stringify({ item_id, quantity }),
      created_at: new Date(),
    })
    return response.ok({ message: `${quantity}x item #${item_id} accordé` })
  }

  async itemsList({ response }: HttpContext) {
    const rows = await db
      .from('items')
      .select('id', 'name_fr', 'effect_type')
      .orderBy('name_fr', 'asc')
      .limit(200)
    return response.ok({ items: rows })
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────

  private async invalidatePlayerTokens(player_id: string): Promise<void> {
    // Scanner les refresh tokens Redis pour ce joueur et les supprimer
    // Pattern : refresh:{uuid} → player_id
    const keys = await redis.keys('refresh:*')
    for (const key of keys) {
      const val = await redis.get(key)
      if (val === player_id) {
        await redis.del(key)
      }
    }
  }
}
