/**
 * import:forms — Importe les formes régionales depuis PokéAPI.
 * Idempotent : upsert sur species_id et pokemon_forms.
 */

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'

// ─── Types ────────────────────────────────────────────────────────────────────

interface APIStat {
  base_stat: number
  stat: { name: string }
}

interface APIType {
  slot: number
  type: { name: string }
}

interface APIName {
  name: string
  language: { name: string }
}

interface APIPokemon {
  id: number
  name: string
  stats: APIStat[]
  types: APIType[]
  species: { url: string }
  sprites: { front_default: string | null; front_shiny: string | null }
}

interface APIPokemonSpecies {
  id: number
  names: APIName[]
  is_legendary: boolean
  is_mythical: boolean
  generation: { name: string }
  evolves_from_species: { url: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

// Regional form IDs from PokéAPI (pokemon endpoint, not species)
const REGIONAL_FORM_IDS: Record<string, number[]> = {
  alola: [
    10091, 10092, 10093, 10094, 10095, 10096, 10097, 10098,
    10099, 10100, 10101, 10102, 10103, 10104, 10105, 10106,
    10107, 10108, 10109, 10110, 10111, 10112, 10113, 10114, 10115,
  ],
  galar: [
    10161, 10162, 10163, 10164, 10165, 10166, 10167, 10168,
    10169, 10170, 10171, 10172, 10173, 10174, 10175, 10176,
    10177, 10178, 10179, 10180,
  ],
  hisui: [
    10221, 10222, 10223, 10224, 10225, 10226, 10227, 10228,
    10229, 10230, 10231, 10232, 10233, 10234, 10235,
  ],
  paldea: [
    10251, 10252, 10253, 10254,
  ],
}

const GENERATION_MAP: Record<string, number> = {
  'generation-i': 1, 'generation-ii': 2, 'generation-iii': 3,
  'generation-iv': 4, 'generation-v': 5, 'generation-vi': 6,
  'generation-vii': 7, 'generation-viii': 8, 'generation-ix': 9,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error(`HTTP ${res.status} for ${url}`)
      }
      return await res.json()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500))
    }
  }
  return null
}

function getFrenchName(names: APIName[], fallback: string): string {
  return names.find(n => n.language.name === 'fr')?.name ?? fallback
}

function getStatValue(stats: APIStat[], name: string): number {
  return stats.find(s => s.stat.name === name)?.base_stat ?? 0
}

function getRarity(species: APIPokemonSpecies, bst: number): string {
  if (species.is_mythical) return 'mythic'
  if (species.is_legendary) return 'legendary'
  if (bst >= 550) return 'epic'
  if (bst >= 450) return 'rare'
  return 'common'
}

function getBaseSpeciesIdFromUrl(url: string): number {
  const parts = url.replace(/\/$/, '').split('/')
  return parseInt(parts[parts.length - 1], 10)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default class ImportForms extends BaseCommand {
  static commandName = 'import:forms'
  static description = 'Import regional Pokémon forms from PokéAPI (idempotent)'

  static options: CommandOptions = {
    startApp: true,
  }

  private stats = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  }

  async run() {
    this.logger.info('Starting regional forms import...')

    for (const [region, ids] of Object.entries(REGIONAL_FORM_IDS)) {
      this.logger.info(`Processing ${region} forms (${ids.length} IDs)...`)

      for (const pokemon_id of ids) {
        try {
          await this.importForm(pokemon_id, region)
          // Rate limiting
          await new Promise(r => setTimeout(r, 150))
        } catch (err: any) {
          this.stats.errors.push(`${region}#${pokemon_id}: ${err.message}`)
          this.logger.warning(`Error importing ${region}#${pokemon_id}: ${err.message}`)
        }
      }
    }

    this.logger.info(`Import complete: ${this.stats.imported} imported, ${this.stats.skipped} skipped, ${this.stats.errors.length} errors`)
    if (this.stats.errors.length > 0) {
      this.logger.warning('Errors: ' + this.stats.errors.slice(0, 10).join('; '))
    }
  }

  private async importForm(pokemon_id: number, region: string): Promise<void> {
    const pokemon_data: APIPokemon | null = await fetchWithRetry(`${POKEAPI_BASE}/pokemon/${pokemon_id}`)
    if (!pokemon_data) {
      this.stats.skipped++
      return
    }

    const species_url = pokemon_data.species.url
    const species_data: APIPokemonSpecies | null = await fetchWithRetry(species_url)
    if (!species_data) {
      this.stats.skipped++
      return
    }

    // Calculate BST
    const hp = getStatValue(pokemon_data.stats, 'hp')
    const atk = getStatValue(pokemon_data.stats, 'attack')
    const def = getStatValue(pokemon_data.stats, 'defense')
    const spatk = getStatValue(pokemon_data.stats, 'special-attack')
    const spdef = getStatValue(pokemon_data.stats, 'special-defense')
    const speed = getStatValue(pokemon_data.stats, 'speed')
    const bst = hp + atk + def + spatk + spdef + speed

    const rarity = getRarity(species_data, bst)
    const generation = GENERATION_MAP[species_data.generation?.name] ?? 7

    const name_fr = getFrenchName(species_data.names, pokemon_data.name)
    const name_en = pokemon_data.name

    // Find base species ID (the "original" species in national dex)
    const base_species_id = getBaseSpeciesIdFromUrl(species_url)

    // Upsert in pokemon_species
    await db.rawQuery(`
      INSERT INTO pokemon_species (
        id, name_fr, name_en, type1, type2,
        base_hp, base_atk, base_def, base_spatk, base_spdef, base_speed,
        rarity, generation, sprite_url, sprite_shiny_url, sprite_fallback_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name_fr = EXCLUDED.name_fr,
        type1 = EXCLUDED.type1,
        type2 = EXCLUDED.type2,
        base_hp = EXCLUDED.base_hp,
        base_atk = EXCLUDED.base_atk,
        base_def = EXCLUDED.base_def,
        base_spatk = EXCLUDED.base_spatk,
        base_spdef = EXCLUDED.base_spdef,
        base_speed = EXCLUDED.base_speed,
        sprite_url = EXCLUDED.sprite_url,
        sprite_shiny_url = EXCLUDED.sprite_shiny_url
    `, [
      pokemon_id,
      name_fr,
      name_en,
      pokemon_data.types[0]?.type.name ?? 'normal',
      pokemon_data.types[1]?.type.name ?? null,
      hp, atk, def, spatk, spdef, speed,
      rarity,
      generation,
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon_id}.png`,
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemon_id}.png`,
      `https://play.pokemonshowdown.com/sprites/gen5/${name_en.toLowerCase()}.png`,
    ])

    // Upsert in pokemon_forms
    const form_name_fr = `Forme de ${capitalize(region)}`

    await db.rawQuery(`
      INSERT INTO pokemon_forms (base_species_id, form_species_id, form_type, region, form_name_fr)
      VALUES (?, ?, 'regional', ?, ?)
      ON CONFLICT (base_species_id, form_species_id, form_type) DO UPDATE SET
        region = EXCLUDED.region,
        form_name_fr = EXCLUDED.form_name_fr
    `, [base_species_id, pokemon_id, region, form_name_fr])

    this.stats.imported++
    this.logger.info(`  ✓ ${region} #${pokemon_id} ${name_fr}`)
  }
}
