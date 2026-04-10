/**
 * BfController — Routes HTTP Battle Frontier
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import battleFrontierService from '#services/BattleFrontierService'
import db from '@adonisjs/lucid/services/db'

export default class BfController {

  // ─── Rotation courante ──────────────────────────────────────────────────

  async current({ }: HttpContext) {
    const rotation = await battleFrontierService.getCurrentRotation()
    if (!rotation) return { rotation: null, timer_seconds: 0 }

    const now = new Date()
    const seconds_remaining = Math.max(0, Math.floor((rotation.endAt.toJSDate().getTime() - now.getTime()) / 1000))

    return {
      rotation: {
        id: rotation.id,
        mode: rotation.mode,
        name_fr: rotation.nameFr,
        description_fr: rotation.descriptionFr,
        challenge_type: rotation.challengeType,
        tier_restriction: rotation.tierRestriction,
        rules_json: rotation.rulesJson,
        start_at: rotation.startAt.toISO(),
        end_at: rotation.endAt.toISO(),
      },
      timer_seconds: seconds_remaining,
    }
  }

  async rotations({ }: HttpContext) {
    const rotations = await db.from('bf_rotations').orderBy('start_at', 'desc').limit(10)
    return { rotations }
  }

  // ─── Classement ─────────────────────────────────────────────────────────

  async leaderboard({ params, request, player }: HttpContext) {
    const { page = 1 } = request.qs()
    const result = await battleFrontierService.getLeaderboard(params.rotation_id, Number(page))

    // Rang du joueur courant
    const my_rank = await battleFrontierService.getMyRank(player.id, params.rotation_id)

    return { ...result, my_rank }
  }

  // ─── Session joueur ──────────────────────────────────────────────────────

  async mySession({ player }: HttpContext) {
    const rotation = await battleFrontierService.getCurrentRotation()
    if (!rotation) return { session: null }

    const session = await db.from('bf_sessions')
      .where('player_id', player.id)
      .where('rotation_id', rotation.id)
      .first()

    if (!session) return { session: null }

    const my_rank = await battleFrontierService.getMyRank(player.id, rotation.id)

    return {
      session: {
        id: session.id,
        mode: session.mode,
        current_streak: session.current_streak,
        best_streak: session.best_streak,
        frontier_points_earned: session.frontier_points_earned,
        status: session.status,
        started_at: session.started_at,
      },
      my_rank,
    }
  }

  // ─── Rejoindre ───────────────────────────────────────────────────────────

  async join({ request, player, response }: HttpContext) {
    const rotation = await battleFrontierService.getCurrentRotation()
    if (!rotation) return response.badRequest({ message: 'Aucune rotation active' })

    const schema = vine.compile(vine.object({
      mode: vine.string().in(['tower', 'factory', 'arena']),
    }))
    const { mode } = await schema.validate(request.body())

    const result = await battleFrontierService.joinRotation(player.id, rotation.id, mode)
    if (result.errors) {
      return response.unprocessableEntity({ errors: result.errors })
    }

    return { session: result.session }
  }

  // ─── Combat ──────────────────────────────────────────────────────────────

  async battle({ player, response }: HttpContext) {
    try {
      const result = await battleFrontierService.resolveBattle(player.id)
      return result
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  // ─── Abandon ─────────────────────────────────────────────────────────────

  async abandon({ player }: HttpContext) {
    await battleFrontierService.abandonSession(player.id)
    return { success: true }
  }

  // ─── Shop ────────────────────────────────────────────────────────────────

  async shop({ player }: HttpContext) {
    const [items, player_row] = await Promise.all([
      battleFrontierService.getShop(),
      db.from('players').where('id', player.id).select('frontier_points').first(),
    ])

    // Achats non utilisés du joueur
    const my_purchases = await db.from('bf_shop_purchases')
      .join('bf_shop_items', 'bf_shop_items.id', 'bf_shop_purchases.item_id')
      .where('bf_shop_purchases.player_id', player.id)
      .where('bf_shop_purchases.used', false)
      .select('bf_shop_items.id', 'bf_shop_items.name_fr', 'bf_shop_items.item_type', 'bf_shop_items.item_data')
      .count('bf_shop_purchases.id as qty')
      .groupBy('bf_shop_items.id', 'bf_shop_items.name_fr', 'bf_shop_items.item_type', 'bf_shop_items.item_data')

    return {
      items,
      my_pf: Number(player_row?.frontier_points ?? 0),
      my_purchases: my_purchases.map((p: any) => ({ ...p, qty: Number(p.qty) })),
    }
  }

  async shopPurchase({ request, player, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      item_id: vine.number().positive(),
      quantity: vine.number().positive().optional(),
    }))
    const { item_id, quantity = 1 } = await schema.validate(request.body())

    const result = await battleFrontierService.purchaseItem(player.id, item_id, quantity)
    if (!result.success) return response.badRequest({ message: result.error })

    return { success: true }
  }

  async useCapsule({ request, player, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      pokemon_id: vine.string().uuid(),
      stat: vine.string().in(['hp', 'atk', 'def', 'spatk', 'spdef', 'speed']),
    }))
    const { pokemon_id, stat } = await schema.validate(request.body())

    const result = await battleFrontierService.useIvCapsule(player.id, pokemon_id, stat)
    if (!result.success) return response.badRequest({ message: result.error })

    return { success: true }
  }

  async useMint({ request, player, response }: HttpContext) {
    const schema = vine.compile(vine.object({
      pokemon_id: vine.string().uuid(),
      nature: vine.string(),
    }))
    const { pokemon_id, nature } = await schema.validate(request.body())

    const result = await battleFrontierService.useNatureMint(player.id, pokemon_id, nature as any)
    if (!result.success) return response.badRequest({ message: result.error })

    return { success: true }
  }

  // ─── Succès ──────────────────────────────────────────────────────────────

  async achievements({ player }: HttpContext) {
    const all = await db.from('bf_achievements').orderBy('id')
    const unlocked = await db.from('bf_player_achievements')
      .where('player_id', player.id)
      .select('achievement_id', 'unlocked_at')

    const unlocked_map = new Map(unlocked.map((u: any) => [u.achievement_id, u.unlocked_at]))

    return {
      achievements: all.map((a: any) => ({
        ...a,
        unlocked: unlocked_map.has(a.id),
        unlocked_at: unlocked_map.get(a.id) ?? null,
      })),
    }
  }
}
