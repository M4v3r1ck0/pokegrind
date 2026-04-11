import PokemonSpecies from '#models/pokemon_species'
import PlayerPokemon from '#models/player_pokemon'
import type Player from '#models/player'
import type { PokemonRarity } from '@pokegrind/shared'
import pokedexService from '#services/PokedexService'
import {
  NATURES,
  PITY_EPIC_THRESHOLD,
  PITY_LEGENDARY_DEFAULT,
  PITY_LEGENDARY_UPGRADED,
  GOLD_COST_1,
  GOLD_COST_10,
  drawRarity,
  generateIVs,
} from '#services/GachaFormulas'

export { PITY_EPIC_THRESHOLD, PITY_LEGENDARY_DEFAULT, PITY_LEGENDARY_UPGRADED, GOLD_COST_1, GOLD_COST_10 }

// IDs des évolutions mythiques (events uniquement, exclus du pool gacha normal)
const MYTHIC_IDS = [
  144, 145, 146, 150, 151, // Gen 1 legendaries / mythics
  243, 244, 245, 249, 250, 251, // Gen 2
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386, // Gen 3
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, // Gen 4
  638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, // Gen 5
  716, 717, 718, 719, 720, 721, // Gen 6
  785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 807, 808, 809, // Gen 7
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, // Gen 8
  1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, // Gen 9
]

export interface GachaResult {
  pokemon: {
    id: string
    species_id: number
    name_fr: string
    rarity: PokemonRarity
    is_shiny: boolean
    nature: string
    ivs: {
      hp: number
      atk: number
      def: number
      spatk: number
      spdef: number
      speed: number
    }
    sprite_url: string | null
    sprite_shiny_url: string | null
  }
  is_new_species: boolean
  pity_epic_current: number
  pity_legendary_current: number
}

export default class GachaService {
  /**
   * Vérifie si le joueur a l'amélioration pity légendaire réduit
   */
  static async hasLegendaryPityUpgrade(playerId: string): Promise<boolean> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const upgrade = await db
      .from('player_upgrades')
      .join('shop_upgrades', 'player_upgrades.upgrade_id', 'shop_upgrades.id')
      .where('player_upgrades.player_id', playerId)
      .where('shop_upgrades.effect_type', 'pity_legendary_reduced')
      .first()
    return !!upgrade
  }

  /**
   * Détermine la rareté du tirage selon les pity counters et les taux.
   */
  static drawRarity(
    pityEpic: number,
    pityLegendary: number,
    legendaryThreshold: number
  ): PokemonRarity {
    return drawRarity(pityEpic, pityLegendary, legendaryThreshold)
  }

  /**
   * Génère les IVs selon la rareté.
   */
  static generateIVs(rarity: PokemonRarity, isShiny: boolean): {
    hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number
  } {
    return generateIVs(rarity, isShiny)
  }

  /**
   * Sélectionne une espèce aléatoire de la rareté donnée via Lucid ORM
   */
  static async pickSpecies(
    rarity: PokemonRarity,
    species_pool?: number[],
    rate_up_species?: number[]
  ): Promise<PokemonSpecies> {
    // If banner with species_pool: restrict to that pool
    if (species_pool && species_pool.length > 0) {
      // Rate-up: 50% chance to pick a rate-up species if available in this rarity
      if (rate_up_species && rate_up_species.length > 0 && Math.random() < 0.5) {
        const rate_up_in_pool = rate_up_species.filter(id => species_pool.includes(id))
        if (rate_up_in_pool.length > 0) {
          const species = await PokemonSpecies.query()
            .whereIn('id', rate_up_in_pool)
            .where('rarity', rarity)
            .orderByRaw('RANDOM()')
            .limit(1)
            .first()
          if (species) return species
        }
      }
      // Normal pool restricted to banner species
      const species = await PokemonSpecies.query()
        .whereIn('id', species_pool)
        .where('rarity', rarity)
        .orderByRaw('RANDOM()')
        .limit(1)
        .first()
      if (species) {
        return species
      }
      // Fallback to unrestricted if banner has no species for this rarity
    }

    const query = PokemonSpecies.query()
      .where('rarity', rarity)
      .orderByRaw('RANDOM()')
      .limit(1)

    // Exclure les mythiques du pool normal (events uniquement)
    if (rarity !== 'mythic') {
      query.whereNotIn('id', MYTHIC_IDS)
    }

    const species = await query.first()

    if (!species) {
      throw new Error(`Aucune espèce trouvée pour la rareté : ${rarity}`)
    }
    return species
  }

  /**
   * Effectue N tirages pour un joueur (dans une transaction extérieure)
   */
  static async performPulls(
    player: Player,
    count: 1 | 10 | 25 | 50 | 100,
    banner_id?: string
  ): Promise<GachaResult[]> {
    const legendaryThreshold = (await this.hasLegendaryPityUpgrade(player.id))
      ? PITY_LEGENDARY_UPGRADED
      : PITY_LEGENDARY_DEFAULT

    const goldCostMap: Record<number, number> = {
      1:   GOLD_COST_1,
      10:  GOLD_COST_10,
      25:  22500,
      50:  42500,
      100: 80000,
    }
    const goldCost = goldCostMap[count] ?? count * GOLD_COST_1

    if (Number(player.gold) < goldCost) {
      throw new Error(`Or insuffisant (requis: ${goldCost}, disponible: ${player.gold})`)
    }

    const { default: db } = await import('@adonisjs/lucid/services/db')

    // Charger le banner si fourni
    let banner_species_pool: number[] | undefined
    let banner_rate_up: number[] | undefined
    if (banner_id) {
      const banner = await db
        .from('gacha_banners')
        .where('id', banner_id)
        .where('is_active', true)
        .first()
      if (banner) {
        banner_species_pool = Array.isArray(banner.species_pool) ? banner.species_pool : JSON.parse(banner.species_pool ?? '[]')
        banner_rate_up = Array.isArray(banner.rate_up_species) ? banner.rate_up_species : JSON.parse(banner.rate_up_species ?? '[]')
      }
    }

    // Récupérer les espèces déjà possédées par le joueur
    const ownedSpeciesRows = await db
      .from('player_pokemon')
      .where('player_id', player.id)
      .select('species_id')
    const ownedSpeciesIds = new Set<number>(ownedSpeciesRows.map((r: { species_id: number }) => r.species_id))

    // Charger shiny_boost event
    let shiny_rate = 1 / 8192
    try {
      const { default: eventService } = await import('#services/EventService')
      const { calcShinyRate } = await import('#services/EventService')
      const shiny_config = await eventService.getActiveEventConfig('shiny_boost')
      shiny_rate = calcShinyRate(shiny_config)
    } catch { /* ignore */ }

    const results: GachaResult[] = []
    let currentPityEpic = player.pityEpic
    let currentPityLegendary = player.pityLegendary
    let currentTotalPulls = player.totalPulls

    for (let i = 0; i < count; i++) {
      const isShiny = Math.random() < shiny_rate

      const rarity = this.drawRarity(currentPityEpic, currentPityLegendary, legendaryThreshold)
      const ivs = this.generateIVs(rarity, isShiny)
      const nature = NATURES[Math.floor(Math.random() * NATURES.length)]
      const species = await this.pickSpecies(rarity, banner_species_pool, banner_rate_up)

      // Créer le PlayerPokemon
      const pokemon = await PlayerPokemon.create({
        playerId: player.id,
        speciesId: species.id,
        level: 1,
        isShiny,
        stars: 0,
        nature,
        ivHp: ivs.hp,
        ivAtk: ivs.atk,
        ivDef: ivs.def,
        ivSpatk: ivs.spatk,
        ivSpdef: ivs.spdef,
        ivSpeed: ivs.speed,
        slotTeam: null,
        slotDaycare: null,
        equippedItemId: null,
        hiddenTalentMoveId: null,
      })

      // Assigner les 4 premiers moves level-up
      try {
        let moveRows = await db
          .from('pokemon_learnset')
          .where('species_id', species.id)
          .where('learn_method', 'level')
          .where('level_learned_at', '<=', 1)
          .join('moves', 'moves.id', 'pokemon_learnset.move_id')
          .select('pokemon_learnset.move_id', 'moves.pp as pp')
          .orderBy('pokemon_learnset.level_learned_at', 'asc')
          .limit(4)

        if (moveRows.length === 0) {
          moveRows = await db
            .from('pokemon_learnset')
            .where('species_id', species.id)
            .where('learn_method', 'level')
            .join('moves', 'moves.id', 'pokemon_learnset.move_id')
            .select('pokemon_learnset.move_id', 'moves.pp as pp')
            .orderBy('pokemon_learnset.level_learned_at', 'asc')
            .limit(4)
        }

        if (moveRows.length > 0) {
          await db.table('player_pokemon_moves').insert(
            moveRows.map((row: any, i: number) => ({
              id: crypto.randomUUID(),
              player_pokemon_id: pokemon.id,
              slot: i + 1,
              move_id: row.move_id,
              pp_current: row.pp,
              pp_max: row.pp,
            }))
          )
        }
      } catch { /* non-bloquant */ }

      // Mise à jour Pokédex (arrière-plan)
      const iv_total = ivs.hp + ivs.atk + ivs.def + ivs.spatk + ivs.spdef + ivs.speed
      pokedexService.updateEntry({
        player_id: player.id,
        species_id: species.id,
        iv_total,
        is_shiny: isShiny,
        is_hatched: false,
      }).catch(() => {})

      // Mise à jour pity
      if (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
        currentPityEpic = 0
      } else {
        currentPityEpic++
      }

      if (rarity === 'legendary' || rarity === 'mythic') {
        currentPityLegendary = 0
      } else {
        currentPityLegendary++
      }

      currentTotalPulls++

      const isNewSpecies = !ownedSpeciesIds.has(species.id)
      ownedSpeciesIds.add(species.id)

      results.push({
        pokemon: {
          id: pokemon.id,
          species_id: species.id,
          name_fr: species.nameFr,
          rarity: species.rarity,
          is_shiny: isShiny,
          nature,
          ivs,
          sprite_url: species.spriteUrl ?? null,
          sprite_shiny_url: species.spriteShinyUrl ?? null,
        },
        is_new_species: isNewSpecies,
        pity_epic_current: currentPityEpic,
        pity_legendary_current: currentPityLegendary,
      })
    }

    // Mettre à jour le joueur en une seule requête
    await player
      .merge({
        gold: Number(player.gold) - goldCost,
        pityEpic: currentPityEpic,
        pityLegendary: currentPityLegendary,
        totalPulls: currentTotalPulls,
      })
      .save()

    return results
  }
}
