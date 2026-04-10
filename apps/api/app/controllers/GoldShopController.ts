/**
 * GoldShopController — Boutique or.
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import goldShopService from '#services/GoldShopService'

const purchase_validator = vine.compile(
  vine.object({
    item_id: vine.number().min(1),
    quantity: vine.number().min(1).max(99),
  })
)

export default class GoldShopController {
  // GET /api/shop/gold
  async getShop({ response }: HttpContext) {
    const shop = await goldShopService.getShop()
    return response.ok(shop)
  }

  // POST /api/shop/gold/purchase
  async purchase({ player, request, response }: HttpContext) {
    const { item_id, quantity } = await request.validateUsing(purchase_validator)

    try {
      const result = await goldShopService.purchaseItem(player.id, item_id, quantity)
      return response.ok(result)
    } catch (err: any) {
      return response.unprocessableEntity({ message: err.message ?? 'Erreur lors de l\'achat' })
    }
  }
}
