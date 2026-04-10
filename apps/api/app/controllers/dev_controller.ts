import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'

export default class DevController {
  async stats({ response }: HttpContext) {
    if (app.inProduction) {
      return response.notFound({ error: 'Not found' })
    }

    const [speciesCount, movesCount, learnsetsCount, samplePokemon] = await Promise.all([
      db.from('pokemon_species').count('* as total').first(),
      db.from('moves').count('* as total').first(),
      db.from('pokemon_learnset').count('* as total').first(),
      db
        .from('pokemon_species')
        .select('id', 'name_fr', 'type1', 'type2', 'rarity', 'base_hp', 'base_speed')
        .orderByRaw('RANDOM()')
        .limit(5),
    ])

    return response.ok({
      species_count: Number((speciesCount as { total: string }).total),
      moves_count: Number((movesCount as { total: string }).total),
      learnsets_count: Number((learnsetsCount as { total: string }).total),
      sample_pokemon: samplePokemon,
    })
  }
}
