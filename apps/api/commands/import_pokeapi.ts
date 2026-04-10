import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import type { PokemonRarity } from '@pokegrind/shared'

// ─── PokéAPI types ────────────────────────────────────────────────────────────

interface NamedAPIResource {
  name: string
  url: string
}

interface APIName {
  name: string
  language: NamedAPIResource
}

interface APIStat {
  base_stat: number
  stat: NamedAPIResource
}

interface APIType {
  slot: number
  type: NamedAPIResource
}

interface APIMoveLearnMethod {
  name: string
}

interface APIVersionGroupDetail {
  level_learned_at: number
  move_learn_method: APIMoveLearnMethod
}

interface APIPokemonMove {
  move: NamedAPIResource
  version_group_details: APIVersionGroupDetail[]
}

interface APIPokemon {
  id: number
  name: string
  stats: APIStat[]
  types: APIType[]
  moves: APIPokemonMove[]
}

interface APIPokemonSpecies {
  id: number
  name: string
  is_legendary: boolean
  is_mythical: boolean
  capture_rate: number
  generation: NamedAPIResource
  names: APIName[]
  egg_groups: Array<{ name: string }>
  evolves_from_species: NamedAPIResource | null
}

interface APIMove {
  id: number
  name: string
  names: APIName[]
  type: NamedAPIResource
  damage_class: NamedAPIResource | null
  power: number | null
  accuracy: number | null
  pp: number | null
  priority: number
  effect_chance: number | null
  meta: {
    ailment: NamedAPIResource
    ailment_chance: number
    stat_changes: Array<{ change: number; stat: NamedAPIResource }>
    min_turns: number | null
    max_turns: number | null
  } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POKEAPI_BASE = 'https://pokeapi.co/api/v2'
const TOTAL_SPECIES = 1025
const CONCURRENCY = 3
const MAX_RETRIES = 3

const LEARN_METHOD_MAP: Record<string, string> = {
  'level-up': 'level',
  machine: 'tm',
  egg: 'egg',
  tutor: 'tutor',
}

const GENERATION_MAP: Record<string, number> = {
  'generation-i': 1,
  'generation-ii': 2,
  'generation-iii': 3,
  'generation-iv': 4,
  'generation-v': 5,
  'generation-vi': 6,
  'generation-vii': 7,
  'generation-viii': 8,
  'generation-ix': 9,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<unknown> {
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
      const delay = Math.pow(2, attempt) * 500
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return null
}

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let idx = 0

  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker)
  await Promise.all(workers)
  return results
}

function getFrenchName(names: APIName[], fallback: string): string {
  return names.find((n) => n.language.name === 'fr')?.name ?? fallback
}

function getRarity(species: APIPokemonSpecies, baseStatTotal: number): PokemonRarity {
  if (species.is_mythical) return 'mythic'
  if (species.is_legendary) return 'legendary'
  if (baseStatTotal >= 550) return 'epic'
  if (baseStatTotal >= 450) return 'rare'
  return 'common'
}

function getStatValue(stats: APIStat[], statName: string): number {
  return stats.find((s) => s.stat.name === statName)?.base_stat ?? 0
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default class ImportPokeapi extends BaseCommand {
  static commandName = 'import:pokeapi'
  static description = 'Import all Pokémon species, moves, and learnsets from PokéAPI (idempotent)'

  static options: CommandOptions = {
    startApp: true,
  }

  private stats = {
    movesImported: 0,
    moveEffectsImported: 0,
    speciesImported: 0,
    learnsetsImported: 0,
    errors: [] as string[],
    noFrenchName: [] as string[],
  }

  async run() {
    this.logger.info('=== PokeGrind — Import PokéAPI ===')
    this.logger.info(`Cible : ${TOTAL_SPECIES} espèces, concurrence : ${CONCURRENCY}`)

    const startTime = Date.now()

    await this.importMoves()
    await this.importSpecies()

    const elapsed = Math.round((Date.now() - startTime) / 1000)

    this.logger.success('\n=== Import terminé ===')
    this.logger.info(`Moves importés      : ${this.stats.movesImported}`)
    this.logger.info(`Effets importés     : ${this.stats.moveEffectsImported}`)
    this.logger.info(`Espèces importées   : ${this.stats.speciesImported}`)
    this.logger.info(`Learnsets importés  : ${this.stats.learnsetsImported}`)
    this.logger.info(`Temps écoulé        : ${elapsed}s`)

    if (this.stats.noFrenchName.length > 0) {
      this.logger.warning(
        `Sans nom FR (fallback EN) : ${this.stats.noFrenchName.slice(0, 20).join(', ')}` +
          (this.stats.noFrenchName.length > 20
            ? ` … +${this.stats.noFrenchName.length - 20}`
            : '')
      )
    }

    if (this.stats.errors.length > 0) {
      this.logger.error(`Erreurs (${this.stats.errors.length}) :`)
      this.stats.errors.slice(0, 10).forEach((e) => this.logger.error(`  ${e}`))
    }
  }

  // ─── Step 1 : Moves ─────────────────────────────────────────────────────────

  private async importMoves() {
    this.logger.info('\n[1/2] Chargement de la liste des moves...')

    const listData = (await fetchWithRetry(
      `${POKEAPI_BASE}/move?limit=2000`
    )) as { results: NamedAPIResource[] } | null

    if (!listData) {
      this.logger.error('Impossible de récupérer la liste des moves')
      return
    }

    const moveUrls = listData.results
    this.logger.info(`${moveUrls.length} moves trouvés`)

    let done = 0

    await runConcurrent(moveUrls, CONCURRENCY, async ({ url, name }) => {
      try {
        const move = (await fetchWithRetry(url)) as APIMove | null
        if (!move) return

        await this.upsertMove(move)
        done++

        if (done % 50 === 0 || done === moveUrls.length) {
          process.stdout.write(`\r  Moves : [${done}/${moveUrls.length}] ${name}        `)
        }
      } catch (err) {
        this.stats.errors.push(`Move ${name}: ${err}`)
      }
    })

    process.stdout.write('\n')
  }

  private async upsertMove(move: APIMove) {
    const nameFr = getFrenchName(move.names, move.name)
    if (!move.names.find((n) => n.language.name === 'fr')) {
      if (!this.stats.noFrenchName.includes(move.name)) {
        this.stats.noFrenchName.push(move.name)
      }
    }

    let effectId: number | null = null

    // Upsert move_effect if there is meta data with ailment or stat changes
    if (move.meta) {
      const { meta } = move
      const ailment = meta.ailment?.name
      const statChanges = meta.stat_changes ?? []
      const hasEffect = (ailment && ailment !== 'none') || statChanges.length > 0

      if (hasEffect) {
        const effectType = ailment && ailment !== 'none' ? ailment : 'stat_change'
        const firstStatChange = statChanges[0]

        const effectData = {
          id: move.id,
          effect_type: effectType,
          stat_target: firstStatChange?.stat?.name ?? null,
          stat_change: firstStatChange?.change ?? null,
          target: 'opponent',
          duration_min: meta.min_turns ?? null,
          duration_max: meta.max_turns ?? null,
          chance_percent: meta.ailment_chance || 100,
          created_at: new Date(),
        }

        await db
          .knexQuery()
          .table('move_effects')
          .insert(effectData)
          .onConflict('id')
          .merge()

        effectId = move.id
        this.stats.moveEffectsImported++
      }
    }

    await db
      .knexQuery()
      .table('moves')
      .insert({
        id: move.id,
        name_fr: nameFr,
        name_en: move.name,
        type: move.type.name,
        category: move.damage_class?.name ?? 'status',
        power: move.power,
        accuracy: move.accuracy,
        pp: move.pp,
        priority: move.priority,
        effect_id: effectId,
        created_at: new Date(),
      })
      .onConflict('id')
      .merge()

    this.stats.movesImported++
  }

  // ─── Step 2 : Species ───────────────────────────────────────────────────────

  private async importSpecies() {
    this.logger.info('\n[2/2] Import des espèces Pokémon...')

    const ids = Array.from({ length: TOTAL_SPECIES }, (_, i) => i + 1)

    // First pass: upsert all species (without evolves_from_id to avoid FK issues)
    let done = 0
    await runConcurrent(ids, CONCURRENCY, async (id) => {
      try {
        await this.upsertSpecies(id)
        done++
        if (done % 25 === 0 || done === TOTAL_SPECIES) {
          process.stdout.write(`\r  Espèces : [${done}/${TOTAL_SPECIES}]        `)
        }
      } catch (err) {
        this.stats.errors.push(`Species ${id}: ${err}`)
      }
    })

    process.stdout.write('\n')

    // Second pass: update evolves_from_id now that all species exist
    this.logger.info("  Mise à jour des chaînes d'évolution...")
    done = 0
    await runConcurrent(ids, CONCURRENCY, async (id) => {
      try {
        await this.updateEvolvesFrom(id)
        done++
      } catch {
        // non-critical
      }
    })
    this.logger.info(`  ${done} évolutions traitées`)
  }

  private async upsertSpecies(id: number) {
    const [pokemon, species] = await Promise.all([
      fetchWithRetry(`${POKEAPI_BASE}/pokemon/${id}`) as Promise<APIPokemon | null>,
      fetchWithRetry(`${POKEAPI_BASE}/pokemon-species/${id}`) as Promise<APIPokemonSpecies | null>,
    ])

    if (!pokemon || !species) {
      this.stats.errors.push(`Species ${id}: données manquantes`)
      return
    }

    const nameFr = getFrenchName(species.names, pokemon.name)
    if (!species.names.find((n) => n.language.name === 'fr')) {
      if (!this.stats.noFrenchName.includes(pokemon.name)) {
        this.stats.noFrenchName.push(pokemon.name)
      }
    }

    const stats = {
      base_hp: getStatValue(pokemon.stats, 'hp'),
      base_atk: getStatValue(pokemon.stats, 'attack'),
      base_def: getStatValue(pokemon.stats, 'defense'),
      base_spatk: getStatValue(pokemon.stats, 'special-attack'),
      base_spdef: getStatValue(pokemon.stats, 'special-defense'),
      base_speed: getStatValue(pokemon.stats, 'speed'),
    }

    const baseStatTotal = Object.values(stats).reduce((a, b) => a + b, 0)
    const rarity = getRarity(species, baseStatTotal)
    const types = pokemon.types.sort((a, b) => a.slot - b.slot)
    const generation = GENERATION_MAP[species.generation.name] ?? 1
    const nameEn = pokemon.name
    const spriteBase = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon`
    const nameForShowdown = nameEn.toLowerCase().replace(/-/g, '')

    await db
      .knexQuery()
      .table('pokemon_species')
      .insert({
        id,
        name_fr: nameFr,
        name_en: nameEn,
        type1: types[0]?.type.name ?? 'normal',
        type2: types[1]?.type.name ?? null,
        ...stats,
        rarity,
        generation,
        capture_rate: species.capture_rate,
        egg_groups: JSON.stringify(species.egg_groups.map((g) => g.name)),
        evolves_from_id: null, // set in second pass
        sprite_url: `${spriteBase}/${id}.png`,
        sprite_shiny_url: `${spriteBase}/shiny/${id}.png`,
        sprite_fallback_url: `https://play.pokemonshowdown.com/sprites/gen5/${nameForShowdown}.png`,
        created_at: new Date(),
      })
      .onConflict('id')
      .merge()

    this.stats.speciesImported++

    // Import learnsets for this species
    await this.upsertLearnsets(id, pokemon)
  }

  private async updateEvolvesFrom(id: number) {
    const species = (await fetchWithRetry(
      `${POKEAPI_BASE}/pokemon-species/${id}`
    )) as APIPokemonSpecies | null

    if (!species?.evolves_from_species) return

    const evoUrl = species.evolves_from_species.url
    const evoIdMatch = evoUrl.match(/\/(\d+)\/$/)
    if (!evoIdMatch) return

    const evolvesFromId = Number(evoIdMatch[1])

    await db
      .knexQuery()
      .table('pokemon_species')
      .where('id', id)
      .update({ evolves_from_id: evolvesFromId })
  }

  private async upsertLearnsets(speciesId: number, pokemon: APIPokemon) {
    const rows: Array<{
      species_id: number
      move_id: number
      learn_method: string
      level_learned_at: number | null
    }> = []

    const seen = new Set<string>()

    for (const pokemonMove of pokemon.moves) {
      const moveUrl = pokemonMove.move.url
      const moveIdMatch = moveUrl.match(/\/(\d+)\/$/)
      if (!moveIdMatch) continue

      const moveId = Number(moveIdMatch[1])

      for (const vgd of pokemonMove.version_group_details) {
        const rawMethod = vgd.move_learn_method.name
        const method = LEARN_METHOD_MAP[rawMethod]
        if (!method) continue

        const key = `${speciesId}-${moveId}-${method}`
        if (seen.has(key)) continue
        seen.add(key)

        rows.push({
          species_id: speciesId,
          move_id: moveId,
          learn_method: method,
          level_learned_at: method === 'level' ? vgd.level_learned_at : null,
        })
      }
    }

    if (rows.length === 0) return

    // Insert in batches of 100 to avoid query size limits
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100)
      await db
        .knexQuery()
        .table('pokemon_learnset')
        .insert(batch)
        .onConflict(['species_id', 'move_id', 'learn_method'])
        .merge()
    }

    this.stats.learnsetsImported += rows.length
  }
}
