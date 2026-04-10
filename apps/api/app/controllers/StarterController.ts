import type { HttpContext } from '@adonisjs/core/http'
import StarterService from '#services/StarterService'

export default class StarterController {
  /**
   * GET /api/starters
   */
  async index(ctx: HttpContext) {
    const grouped = await StarterService.getAllStartersGrouped()

    // Sérialiser proprement
    const result: Record<string, unknown[]> = {}
    for (const [region, species] of Object.entries(grouped)) {
      result[region] = species.map((s) => ({
        id: s.id,
        name_fr: s.nameFr,
        name_en: s.nameEn,
        type1: s.type1,
        type2: s.type2 ?? null,
        sprite_url: s.spriteUrl,
        base_hp: s.baseHp,
        base_speed: s.baseSpeed,
      }))
    }

    return ctx.response.ok(result)
  }
}
