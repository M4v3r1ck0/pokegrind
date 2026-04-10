import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import daycareService from '#services/DaycareService'
import DaycareQueueService from '#services/DaycareQueueService'

export default class DaycareController {
  /**
   * GET /api/player/daycare
   * État complet de la pension du joueur.
   */
  async index({ player }: HttpContext) {
    return daycareService.getDaycareState(player.id)
  }

  /**
   * POST /api/player/daycare/deposit
   * Dépose un Pokémon en pension.
   */
  async deposit({ request, response, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        slot_number: vine.number().min(1).max(10),
        pokemon_id: vine.string().uuid(),
        partner_id: vine.string().uuid().optional(),
      })
    )
    const { slot_number, pokemon_id, partner_id } = await schema.validate(request.body())

    try {
      await daycareService.depositPokemon(player.id, pokemon_id, slot_number, partner_id)
      return daycareService.getDaycareState(player.id)
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * POST /api/player/daycare/withdraw
   * Retire un Pokémon de la pension.
   */
  async withdraw({ request, response, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        slot_number: vine.number().min(1).max(10),
      })
    )
    const { slot_number } = await schema.validate(request.body())

    try {
      await daycareService.withdrawPokemon(player.id, slot_number)
      return daycareService.getDaycareState(player.id)
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * POST /api/player/daycare/hatch
   * Déclenche manuellement une éclosion.
   */
  async hatch({ request, response, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        slot_number: vine.number().min(1).max(10),
      })
    )
    const { slot_number } = await schema.validate(request.body())

    try {
      const result = await daycareService.hatchEgg(player.id, slot_number)
      return result
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * GET /api/player/daycare/compatible/:pokemon_id
   * Pokémon du joueur compatibles pour le dressage avec ce Pokémon.
   */
  async compatible({ params, player }: HttpContext) {
    const pokemon_id = params.pokemon_id
    const compatible = await daycareService.getCompatiblePokemon(player.id, pokemon_id)

    return {
      pokemon: compatible.map((pp) => ({
        id: pp.id,
        name_fr: pp.nickname ?? pp.species.nameFr,
        species_id: pp.speciesId,
        rarity: pp.species.rarity,
        stars: pp.stars,
        level: pp.level,
        sprite_url: pp.species.spriteUrl,
        is_shiny: pp.isShiny,
        ivs: {
          hp: pp.ivHp,
          atk: pp.ivAtk,
          def: pp.ivDef,
          spatk: pp.ivSpatk,
          spdef: pp.ivSpdef,
          speed: pp.ivSpeed,
        },
      })),
    }
  }

  // ─── File d'attente ───────────────────────────────────────────────────────

  /**
   * GET /api/player/daycare/queue
   * Retourne la file d'attente.
   */
  async queue({ player }: HttpContext) {
    const items = await DaycareQueueService.getQueue(player.id)
    return { queue: items }
  }

  /**
   * POST /api/player/daycare/queue/add
   * Ajoute un Pokémon à la file.
   */
  async queueAdd({ request, response, player }: HttpContext) {
    const schema = vine.compile(
      vine.object({
        pokemon_id: vine.string().uuid(),
        partner_id: vine.string().uuid().optional(),
        target_slot: vine.number().min(1).max(10).optional(),
      })
    )
    const { pokemon_id, partner_id, target_slot } = await schema.validate(request.body())

    try {
      await DaycareQueueService.addToQueue(player.id, pokemon_id, partner_id, target_slot)
      const items = await DaycareQueueService.getQueue(player.id)
      return { queue: items }
    } catch (err: any) {
      return response.badRequest({ message: err.message })
    }
  }

  /**
   * DELETE /api/player/daycare/queue/:position
   * Retire un élément de la file.
   */
  async queueRemove({ params, player }: HttpContext) {
    const position = parseInt(params.position, 10)
    await DaycareQueueService.removeFromQueue(player.id, position)
    const items = await DaycareQueueService.getQueue(player.id)
    return { queue: items }
  }
}
