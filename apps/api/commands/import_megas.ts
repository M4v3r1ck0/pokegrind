/**
 * import:megas — Importe les Méga-Évolutions + Méga-Stones depuis PokéAPI.
 * Idempotent : upsert sur mega_evolutions et items (category='mega_stone').
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

interface APIPokemon {
  id: number
  name: string
  stats: APIStat[]
  types: APIType[]
  sprites: { front_default: string | null; front_shiny: string | null }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POKEAPI_BASE = 'https://pokeapi.co/api/v2'

// Mega Evolution data: [pokemon_id, name_fr, pokeapi_form_id, stone_name_fr | null]
// pokeapi_form_id = the pokemon endpoint ID for the mega form
const MEGA_EVOLUTIONS: Array<{
  species_id: number
  name_fr: string
  form_id: number       // PokéAPI pokemon ID for the mega form
  stone_name_fr: string | null  // null for Méga X/Y with shared stone or Rayquaza
}> = [
  // Form IDs verified against PokéAPI pokemon-species/{id}/varieties
  { species_id: 3,   name_fr: 'Méga-Florizarre',    form_id: 10033, stone_name_fr: 'Florizarrite' },
  { species_id: 6,   name_fr: 'Méga-Dracaufeu X',   form_id: 10034, stone_name_fr: 'Dracaufeite X' },
  { species_id: 6,   name_fr: 'Méga-Dracaufeu Y',   form_id: 10035, stone_name_fr: 'Dracaufeite Y' },
  { species_id: 9,   name_fr: 'Méga-Tortank',       form_id: 10036, stone_name_fr: 'Tortankite' },
  { species_id: 65,  name_fr: 'Méga-Alakazam',      form_id: 10037, stone_name_fr: 'Alakazamite' },
  { species_id: 94,  name_fr: 'Méga-Ectoplasma',    form_id: 10038, stone_name_fr: 'Ectoplasmite' },
  { species_id: 115, name_fr: 'Méga-Kangaskhan',    form_id: 10039, stone_name_fr: 'Kangaskhanite' },
  { species_id: 127, name_fr: 'Méga-Scarabrute',    form_id: 10040, stone_name_fr: 'Scarabrutite' },
  { species_id: 130, name_fr: 'Méga-Leviator',      form_id: 10041, stone_name_fr: 'Leviatite' },
  { species_id: 142, name_fr: 'Méga-Ptéra',         form_id: 10042, stone_name_fr: 'Ptérite' },
  { species_id: 150, name_fr: 'Méga-Mewtwo X',      form_id: 10043, stone_name_fr: 'Mewtwonite X' },
  { species_id: 150, name_fr: 'Méga-Mewtwo Y',      form_id: 10044, stone_name_fr: 'Mewtwonite Y' },
  { species_id: 181, name_fr: 'Méga-Ampharos',      form_id: 10045, stone_name_fr: 'Ampharosite' },
  { species_id: 212, name_fr: 'Méga-Cizayox',       form_id: 10046, stone_name_fr: 'Cizayoxite' },
  { species_id: 214, name_fr: 'Méga-Scarhino',      form_id: 10047, stone_name_fr: 'Scarhinite' },
  { species_id: 229, name_fr: 'Méga-Démolosse',     form_id: 10048, stone_name_fr: 'Démolossite' },
  { species_id: 248, name_fr: 'Méga-Tyranocif',     form_id: 10049, stone_name_fr: 'Tyranocifite' },
  { species_id: 257, name_fr: 'Méga-Braségali',     form_id: 10050, stone_name_fr: 'Braségalite' },
  { species_id: 282, name_fr: 'Méga-Gardevoir',     form_id: 10051, stone_name_fr: 'Gardevoirite' },
  { species_id: 303, name_fr: 'Méga-Mysdibule',     form_id: 10052, stone_name_fr: 'Mysdibulite' },
  { species_id: 306, name_fr: 'Méga-Galeking',      form_id: 10053, stone_name_fr: 'Galekingite' },
  { species_id: 308, name_fr: 'Méga-Méditikka',     form_id: 10054, stone_name_fr: 'Méditikkite' },
  { species_id: 310, name_fr: 'Méga-Élekible',      form_id: 10055, stone_name_fr: 'Élekibleite' },
  { species_id: 354, name_fr: 'Méga-Branette',      form_id: 10056, stone_name_fr: 'Branettite' },
  { species_id: 359, name_fr: 'Méga-Absol',         form_id: 10057, stone_name_fr: 'Absolite' },
  { species_id: 445, name_fr: 'Méga-Carchacrok',    form_id: 10058, stone_name_fr: 'Carchacroite' },
  { species_id: 448, name_fr: 'Méga-Lucario',       form_id: 10059, stone_name_fr: 'Lucarionite' },
  { species_id: 460, name_fr: 'Méga-Blizzaroi',     form_id: 10060, stone_name_fr: 'Blizzaroite' },
  { species_id: 380, name_fr: 'Méga-Latias',        form_id: 10062, stone_name_fr: 'Latiasite' },
  { species_id: 381, name_fr: 'Méga-Latios',        form_id: 10063, stone_name_fr: 'Latiosite' },
  { species_id: 475, name_fr: 'Méga-Gallame',       form_id: 10068, stone_name_fr: 'Gallamite' },
  { species_id: 531, name_fr: 'Méga-Leuphorie',     form_id: 10069, stone_name_fr: 'Leuphoriite' },
  { species_id: 719, name_fr: 'Méga-Diancie',       form_id: 10075, stone_name_fr: 'Diancite' },
  { species_id: 428, name_fr: 'Méga-Lockpin',       form_id: 10088, stone_name_fr: 'Lockpinite' },
  { species_id: 384, name_fr: 'Méga-Rayquaza',      form_id: 10079, stone_name_fr: null },
]

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

function getStatValue(stats: APIStat[], name: string): number {
  return stats.find(s => s.stat.name === name)?.base_stat ?? 0
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default class ImportMegas extends BaseCommand {
  static commandName = 'import:megas'
  static description = 'Import Mega Evolutions + Mega Stones from PokéAPI (idempotent)'

  static options: CommandOptions = {
    startApp: true,
  }

  private stats = {
    megas_imported: 0,
    stones_imported: 0,
    skipped: 0,
    errors: [] as string[],
  }

  async run() {
    this.logger.info('Starting Mega Evolution import...')

    // First pass: create all unique Mega Stones as items
    await this.importMegaStones()

    // Second pass: import mega evolution stats from PokéAPI
    for (const mega of MEGA_EVOLUTIONS) {
      try {
        await this.importMega(mega)
        await new Promise(r => setTimeout(r, 150))
      } catch (err: any) {
        this.stats.errors.push(`${mega.name_fr}: ${err.message}`)
        this.logger.warning(`Error importing ${mega.name_fr}: ${err.message}`)
      }
    }

    this.logger.info(
      `Import complete: ${this.stats.megas_imported} megas, ${this.stats.stones_imported} stones, ` +
      `${this.stats.skipped} skipped, ${this.stats.errors.length} errors`
    )
    if (this.stats.errors.length > 0) {
      this.logger.warning('Errors: ' + this.stats.errors.slice(0, 10).join('; '))
    }
  }

  private async importMegaStones() {
    // Collect unique stone names (skip null = Rayquaza)
    const stone_names = [...new Set(
      MEGA_EVOLUTIONS
        .map(m => m.stone_name_fr)
        .filter((s): s is string => s !== null)
    )]

    this.logger.info(`Importing ${stone_names.length} Mega Stones as items...`)

    for (const stone_name of stone_names) {
      await db.rawQuery(`
        INSERT INTO items (
          name_fr, description_fr, category, effect_type, effect_value,
          sprite_url, obtain_method, rarity
        )
        SELECT ?, ?, 'mega_stone', 'mega_stone', '{}', NULL, '{"source": "bf_shop"}', 'epic'
        WHERE NOT EXISTS (
          SELECT 1 FROM items WHERE name_fr = ? AND category = 'mega_stone'
        )
      `, [
        stone_name,
        `Permet la Méga-Évolution de ${stone_name.replace(/ite( [XY])?$/, '$1').trim()}.`,
        stone_name,
      ])
      this.stats.stones_imported++
    }

    this.logger.info(`  ✓ ${this.stats.stones_imported} Méga-Stones upserted`)
  }

  private async importMega(mega: typeof MEGA_EVOLUTIONS[0]) {
    const form_data: APIPokemon | null = await fetchWithRetry(`${POKEAPI_BASE}/pokemon/${mega.form_id}`)
    if (!form_data) {
      this.stats.skipped++
      this.logger.warning(`  ! Skipped ${mega.name_fr} (form_id ${mega.form_id} not found)`)
      return
    }

    const hp = getStatValue(form_data.stats, 'hp')
    const atk = getStatValue(form_data.stats, 'attack')
    const def = getStatValue(form_data.stats, 'defense')
    const spatk = getStatValue(form_data.stats, 'special-attack')
    const spdef = getStatValue(form_data.stats, 'special-defense')
    const speed = getStatValue(form_data.stats, 'speed')

    const type1 = form_data.types[0]?.type.name ?? 'normal'
    const type2 = form_data.types[1]?.type.name ?? null

    const sprite_url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${mega.form_id}.png`
    const sprite_shiny_url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${mega.form_id}.png`

    // Resolve mega_stone_item_id
    let mega_stone_item_id: number | null = null
    if (mega.stone_name_fr !== null) {
      const stone_row = await db.from('items')
        .where('name_fr', mega.stone_name_fr)
        .where('category', 'mega_stone')
        .select('id')
        .first()
      if (stone_row) {
        mega_stone_item_id = stone_row.id
      }
    }

    await db.rawQuery(`
      INSERT INTO mega_evolutions (
        species_id, mega_stone_item_id, mega_name_fr,
        mega_type1, mega_type2,
        mega_hp, mega_atk, mega_def, mega_spatk, mega_spdef, mega_speed,
        sprite_url, sprite_shiny_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (species_id, mega_name_fr) DO UPDATE SET
        mega_stone_item_id = EXCLUDED.mega_stone_item_id,
        mega_type1 = EXCLUDED.mega_type1,
        mega_type2 = EXCLUDED.mega_type2,
        mega_hp = EXCLUDED.mega_hp,
        mega_atk = EXCLUDED.mega_atk,
        mega_def = EXCLUDED.mega_def,
        mega_spatk = EXCLUDED.mega_spatk,
        mega_spdef = EXCLUDED.mega_spdef,
        mega_speed = EXCLUDED.mega_speed,
        sprite_url = EXCLUDED.sprite_url,
        sprite_shiny_url = EXCLUDED.sprite_shiny_url
    `, [
      mega.species_id,
      mega_stone_item_id,
      mega.name_fr,
      type1, type2,
      hp, atk, def, spatk, spdef, speed,
      sprite_url,
      sprite_shiny_url,
    ])

    this.stats.megas_imported++
    this.logger.info(`  ✓ ${mega.name_fr} (${type1}${type2 ? '/' + type2 : ''} — ${hp+atk+def+spatk+spdef+speed} BST)`)
  }
}
