import db from '@adonisjs/lucid/services/db'
import PokemonSpecies from '#models/pokemon_species'
import PlayerPokemon from '#models/player_pokemon'
import type { Nature } from '@pokegrind/shared'

export const STARTERS_BY_REGION: Record<string, number[]> = {
  kanto: [1, 4, 7],
  johto: [152, 155, 158],
  hoenn: [252, 255, 258],
  sinnoh: [387, 390, 393],
  unova: [495, 498, 501],
  kalos: [650, 653, 656],
  alola: [722, 725, 728],
  galar: [810, 813, 816],
  paldea: [906, 909, 912],
}

export const ALL_STARTER_IDS: number[] = Object.values(STARTERS_BY_REGION).flat()

const NATURES: Nature[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
]

export default class StarterService {
  /**
   * Retourne les starters groupés par région avec leurs données de base
   */
  static async getAllStartersGrouped(): Promise<Record<string, PokemonSpecies[]>> {
    const species = await PokemonSpecies.query()
      .whereIn('id', ALL_STARTER_IDS)
      .select('id', 'name_fr', 'name_en', 'type1', 'type2', 'base_hp', 'base_speed', 'sprite_url', 'sprite_shiny_url', 'rarity')
      .orderBy('id')

    const byId = new Map(species.map((s) => [s.id, s]))

    const result: Record<string, PokemonSpecies[]> = {}
    for (const [region, ids] of Object.entries(STARTERS_BY_REGION)) {
      result[region] = ids
        .map((id) => byId.get(id))
        .filter((s): s is PokemonSpecies => s !== undefined)
    }
    return result
  }

  /**
   * Crée le Pokémon starter pour un joueur (niveau 5, IVs aléatoires, nature aléatoire)
   */
  static async createStarterForPlayer(
    playerId: string,
    starterId: number
  ): Promise<PlayerPokemon> {
    const randomIv = () => Math.floor(Math.random() * 32)
    const nature = NATURES[Math.floor(Math.random() * NATURES.length)]

    const pokemon = await PlayerPokemon.create({
      playerId,
      speciesId: starterId,
      level: 5,
      isShiny: false,
      stars: 0,
      nature,
      ivHp: randomIv(),
      ivAtk: randomIv(),
      ivDef: randomIv(),
      ivSpatk: randomIv(),
      ivSpdef: randomIv(),
      ivSpeed: randomIv(),
      slotTeam: 1,
      slotDaycare: null,
      equippedItemId: null,
      hiddenTalentMoveId: null,
    })

    // Récupérer les 4 premiers moves level-up du learnset ≤ level 5
    let learnsetRows = await db
      .from('pokemon_learnset')
      .where('species_id', starterId)
      .where('learn_method', 'level')
      .where('level_learned_at', '<=', 5)
      .join('moves', 'moves.id', 'pokemon_learnset.move_id')
      .select('pokemon_learnset.move_id', 'moves.pp as pp')
      .orderBy('pokemon_learnset.level_learned_at', 'asc')
      .limit(4)

    // Fallback : si aucun move ≤ 5, prendre les premiers du learnset
    if (learnsetRows.length === 0) {
      learnsetRows = await db
        .from('pokemon_learnset')
        .where('species_id', starterId)
        .where('learn_method', 'level')
        .join('moves', 'moves.id', 'pokemon_learnset.move_id')
        .select('pokemon_learnset.move_id', 'moves.pp as pp')
        .orderBy('pokemon_learnset.level_learned_at', 'asc')
        .limit(4)
    }

    if (learnsetRows.length > 0) {
      await db.table('player_pokemon_moves').insert(
        learnsetRows.map((row: any, i: number) => ({
          id: crypto.randomUUID(),
          player_pokemon_id: pokemon.id,
          slot: i + 1,
          move_id: row.move_id,
          pp_current: row.pp,
          pp_max: row.pp,
        }))
      )
    }

    return pokemon
  }

  /**
   * Crée les 5 slots daycare vides pour un nouveau joueur
   */
  static async createDaycareSlots(playerId: string): Promise<void> {
    const slots = Array.from({ length: 5 }, (_, i) => ({
      player_id: playerId,
      slot_number: i + 1,
      player_pokemon_id: null,
      partner_pokemon_id: null,
      damage_accumulated: 0,
      started_at: null,
    }))

    await db.table('daycare_slots').insert(slots)
  }
}
