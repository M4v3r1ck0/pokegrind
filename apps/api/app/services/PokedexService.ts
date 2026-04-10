/**
 * PokedexService — Gestion du Pokédex joueur.
 * Mis à jour après chaque obtention (gacha, éclosion).
 */

import db from '@adonisjs/lucid/services/db'
import PokemonSpecies from '#models/pokemon_species'
import gemsService from '#services/GemsService'

export interface PokedexUpdateParams {
  player_id: string
  species_id: number
  iv_total: number
  is_shiny: boolean
  is_hatched?: boolean
}

class PokedexService {
  /**
   * Met à jour ou crée l'entrée Pokédex après obtention d'un Pokémon.
   * Vérifie si la génération est complète après chaque mise à jour.
   */
  async updateEntry(params: PokedexUpdateParams): Promise<void> {
    const { player_id, species_id, iv_total, is_shiny, is_hatched = false } = params

    const existing = await db
      .from('player_pokedex')
      .where('player_id', player_id)
      .where('species_id', species_id)
      .first()

    if (!existing) {
      // Première obtention
      await db.table('player_pokedex').insert({
        player_id,
        species_id,
        first_obtained_at: new Date(),
        total_obtained: 1,
        best_iv_total: iv_total,
        total_hatched: is_hatched ? 1 : 0,
        has_shiny: is_shiny,
      })
    } else {
      const updates: Record<string, any> = {}
      updates.total_obtained = db.raw('total_obtained + 1')
      if (iv_total > Number(existing.best_iv_total)) {
        updates.best_iv_total = iv_total
      }
      if (is_hatched) {
        updates.total_hatched = db.raw('total_hatched + 1')
      }
      if (is_shiny && !existing.has_shiny) {
        updates.has_shiny = true
      }
      await db.from('player_pokedex')
        .where('player_id', player_id)
        .where('species_id', species_id)
        .update(updates)
    }

    // Vérifier génération complète (en arrière-plan)
    this.checkPokedexGenComplete(player_id, species_id).catch(() => {})
  }

  /**
   * Vérifie si la génération est complète et attribue les gems si oui.
   */
  async checkPokedexGenComplete(player_id: string, species_id: number): Promise<void> {
    const species = await PokemonSpecies.find(species_id)
    if (!species) return
    const gen = species.generation

    const gen_count_row = await db
      .from('pokemon_species')
      .where('generation', gen)
      .count('* as total')
      .first()
    const gen_total = Number(gen_count_row?.total ?? 0)
    if (gen_total === 0) return

    const gen_species_ids = await db
      .from('pokemon_species')
      .where('generation', gen)
      .select('id')
    const gen_ids = gen_species_ids.map((r: any) => Number(r.id))

    const player_count_row = await db
      .from('player_pokedex')
      .where('player_id', player_id)
      .whereIn('species_id', gen_ids)
      .count('* as total')
      .first()
    const player_total = Number(player_count_row?.total ?? 0)

    if (player_total < gen_total) return

    // Vérifier si gems déjà attribuées pour cette génération
    const already = await db
      .from('gems_audit')
      .where('player_id', player_id)
      .where('source', 'pokedex_gen_complete')
      .whereRaw(`reason LIKE '%Gen ${gen}%'`)
      .first()
    if (already) return

    await gemsService.awardGems(
      player_id,
      15,
      `Pokédex Gen ${gen} complété`,
      'pokedex_gen_complete'
    )
  }

  /**
   * GET /api/player/pokedex — liste complète avec stats.
   */
  async getPokedex(
    player_id: string,
    opts: { generation?: number; rarity?: string; owned?: boolean }
  ): Promise<any> {
    // Stats globales
    const total_species = await db.from('pokemon_species').count('* as total').first()
    const owned_count = await db.from('player_pokedex').where('player_id', player_id).count('* as total').first()
    const shiny_count = await db.from('player_pokedex').where('player_id', player_id).where('has_shiny', true).count('* as total').first()

    // Stats par génération
    const gens = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const by_generation = await Promise.all(
      gens.map(async (gen) => {
        const total_row = await db.from('pokemon_species').where('generation', gen).count('* as total').first()
        const gen_ids = await db.from('pokemon_species').where('generation', gen).select('id')
        const owned_row = await db
          .from('player_pokedex')
          .where('player_id', player_id)
          .whereIn('species_id', gen_ids.map((r: any) => r.id))
          .count('* as total')
          .first()
        const gen_total = Number(total_row?.total ?? 0)
        const gen_owned = Number(owned_row?.total ?? 0)
        return {
          generation: gen,
          total: gen_total,
          owned: gen_owned,
          completed: gen_total > 0 && gen_owned >= gen_total,
        }
      })
    )

    // Entrées filtrées
    let species_query = db
      .from('pokemon_species')
      .leftJoin('player_pokedex as pdex', (join) => {
        join.on('pdex.species_id', '=', 'pokemon_species.id')
            .andOnVal('pdex.player_id', '=', player_id)
      })
      .select(
        'pokemon_species.id as species_id',
        'pokemon_species.name_fr',
        'pokemon_species.type1',
        'pokemon_species.type2',
        'pokemon_species.rarity',
        'pokemon_species.sprite_url',
        'pokemon_species.sprite_shiny_url',
        'pokemon_species.generation',
        'pdex.total_obtained',
        'pdex.best_iv_total',
        'pdex.has_shiny',
      )
      .orderBy('pokemon_species.id', 'asc')

    if (opts.generation) species_query = species_query.where('pokemon_species.generation', opts.generation)
    if (opts.rarity) species_query = species_query.where('pokemon_species.rarity', opts.rarity)
    if (opts.owned === true) species_query = species_query.whereNotNull('pdex.species_id')
    if (opts.owned === false) species_query = species_query.whereNull('pdex.species_id')

    const entries = await species_query

    const owned_total = Number(owned_count?.total ?? 0)
    const total = Number(total_species?.total ?? 0)

    // Stats éclosions
    const hatched_count = await db
      .from('player_pokedex')
      .where('player_id', player_id)
      .where('total_hatched', '>', 0)
      .count('* as total')
      .first()

    return {
      stats: {
        total: total,
        owned: owned_total,
        shiny: Number(shiny_count?.total ?? 0),
        hatched: Number(hatched_count?.total ?? 0),
      },
      by_generation: by_generation.filter((g) => g.total > 0),
      entries: entries.map((e: any) => ({
        species_id: e.species_id,
        name_fr: e.name_fr,
        type1: e.type1,
        type2: e.type2,
        rarity: e.rarity,
        sprite_url: e.sprite_url,
        sprite_shiny_url: e.sprite_shiny_url,
        generation: e.generation,
        is_owned: e.total_obtained != null,
        is_shiny: e.has_shiny ?? false,
        best_iv_total: e.best_iv_total ?? null,
        times_obtained: Number(e.total_obtained ?? 0),
      })),
    }
  }

  /**
   * GET /api/player/pokedex/:species_id — détail d'une espèce.
   */
  async getEntry(player_id: string, species_id: number): Promise<any> {
    const species = await PokemonSpecies.find(species_id)
    if (!species) return null

    const entry = await db
      .from('player_pokedex')
      .where('player_id', player_id)
      .where('species_id', species_id)
      .first()

    const learnset = await db
      .from('pokemon_learnset')
      .join('moves', 'moves.id', 'pokemon_learnset.move_id')
      .where('pokemon_learnset.species_id', species_id)
      .orderBy('pokemon_learnset.level_learned_at', 'asc')
      .select(
        'moves.id as move_id',
        'moves.name_fr',
        'moves.type',
        'moves.category',
        'moves.power',
        'moves.accuracy',
        'moves.pp',
        'pokemon_learnset.learn_method',
        'pokemon_learnset.level_learned_at'
      )
      .limit(50)

    return {
      species_id: species.id,
      name_fr: species.nameFr,
      type1: species.type1,
      type2: species.type2,
      rarity: species.rarity,
      generation: species.generation,
      sprite_url: species.spriteUrl,
      sprite_shiny_url: species.spriteShinyUrl,
      base_hp: species.baseHp,
      base_atk: species.baseAtk,
      base_def: species.baseDef,
      base_spatk: species.baseSpatk,
      base_spdef: species.baseSpdef,
      base_speed: species.baseSpeed,
      is_owned: !!entry,
      is_shiny: entry?.has_shiny ?? false,
      best_iv_total: entry?.best_iv_total ?? null,
      times_obtained: Number(entry?.total_obtained ?? 0),
      learnset: learnset.map((m: any) => ({
        move_id: m.move_id,
        name_fr: m.name_fr,
        type: m.type,
        category: m.category,
        power: m.power,
        learn_method: m.learn_method,
      })),
    }
  }
}

const pokedexService = new PokedexService()
export default pokedexService
