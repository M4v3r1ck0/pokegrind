/**
 * ShopController — Boutique gems.
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import shopService from '#services/ShopService'
import gemsService from '#services/GemsService'

export default class ShopController {
  /**
   * GET /api/player/shop
   * État complet de la boutique pour ce joueur.
   */
  async index({ player }: HttpContext) {
    const state = await shopService.getShopState(player.id)
    // Aplatir les catégories en un tableau unique
    const upgrades = [
      ...state.categories.pension,
      ...state.categories.gacha,
      ...state.categories.combat,
      ...(state.categories.cosmetic ?? []),
    ]
    return { upgrades, player_gems: state.player_gems }
  }

  /**
   * POST /api/player/shop/purchase
   * Acheter une amélioration.
   */
  async purchase({ request, response, player }: HttpContext) {
    const schema = vine.compile(vine.object({ upgrade_id: vine.number().positive() }))
    const { upgrade_id } = await schema.validate(request.body())

    try {
      const result = await shopService.purchaseUpgrade(player.id, upgrade_id)
      return {
        success: true,
        upgrade: {
          id: result.upgrade.id,
          name_fr: result.upgrade.nameFr,
          effect_type: result.upgrade.effectType,
        },
        gems_remaining: result.gems_remaining,
      }
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message })
    }
  }

  /**
   * GET /api/admin/gems-audit
   * Audit des transactions gems (admin uniquement — à sécuriser en Sprint 7).
   */
  async gemsAudit({ request }: HttpContext) {
    const { player_id, source, from, to, page } = request.qs()
    const result = await gemsService.getAuditLog(player_id ?? null, {
      source,
      from,
      to,
      page: page ? Number(page) : 1,
    })
    return result
  }
}
