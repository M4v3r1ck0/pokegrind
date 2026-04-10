import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import GachaService, {
  PITY_EPIC_THRESHOLD,
  PITY_LEGENDARY_DEFAULT,
  PITY_LEGENDARY_UPGRADED,
} from '#services/GachaService'
import db from '@adonisjs/lucid/services/db'

const pullValidator = vine.compile(
  vine.object({
    count: vine.number().in([1, 10]),
    banner_id: vine.string().optional(),
  })
)

export default class GachaController {
  /**
   * POST /api/gacha/pull
   */
  async pull(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(pullValidator)
    const player = ctx.player
    const count = data.count as 1 | 10

    try {
      const results = await db.transaction(async () => {
        return GachaService.performPulls(player, count, data.banner_id)
      })

      // Reload player pour avoir les valeurs à jour
      await player.refresh()

      return ctx.response.ok({
        results,
        gold_remaining: player.gold,
        total_pulls: player.totalPulls,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur gacha'
      if (message.includes('Or insuffisant')) {
        return ctx.response.unprocessableEntity({ message })
      }
      throw err
    }
  }

  /**
   * GET /api/gacha/pity
   */
  async pity(ctx: HttpContext) {
    const player = ctx.player
    const hasUpgrade = await GachaService.hasLegendaryPityUpgrade(player.id)

    return ctx.response.ok({
      pity_epic: player.pityEpic,
      pity_legendary: player.pityLegendary,
      total_pulls: player.totalPulls,
      legendary_threshold: hasUpgrade ? PITY_LEGENDARY_UPGRADED : PITY_LEGENDARY_DEFAULT,
      epic_threshold: PITY_EPIC_THRESHOLD,
    })
  }
}
