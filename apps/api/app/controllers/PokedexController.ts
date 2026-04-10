import type { HttpContext } from '@adonisjs/core/http'
import pokedexService from '#services/PokedexService'

export default class PokedexController {
  async index({ request, player }: HttpContext) {
    const { generation, rarity, owned_only } = request.qs()
    return pokedexService.getPokedex(player.id, {
      generation: generation ? Number(generation) : undefined,
      rarity: rarity || undefined,
      owned: owned_only === '1' ? true : undefined,
    })
  }

  async show({ params, response, player }: HttpContext) {
    const species_id = Number(params.species_id)
    const entry = await pokedexService.getEntry(player.id, species_id)
    if (!entry) return response.notFound({ message: 'Espèce introuvable' })
    return entry
  }
}
