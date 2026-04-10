/**
 * MegaEvolutionService — Pure functions for Mega Evolution logic.
 * No AdonisJS imports — fully testable without framework boot.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MegaEvolutionData {
  id: number
  species_id: number
  mega_stone_item_id: number | null
  mega_name_fr: string
  mega_type1: string
  mega_type2: string | null
  mega_hp: number
  mega_atk: number
  mega_def: number
  mega_spatk: number
  mega_spdef: number
  mega_speed: number
  sprite_url: string | null
  sprite_shiny_url: string | null
}

export interface MegaCombatStats {
  type1: string
  type2: string | null
  hp: number
  atk: number
  def: number
  spatk: number
  spdef: number
  speed: number
  sprite_url: string | null
  sprite_shiny_url: string | null
  mega_name_fr: string
}

export interface MegaEligiblePokemon {
  id: string
  species_id: number
  is_shiny: boolean
  equipped_item_id: number | null
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Returns true if the pokemon can mega-evolve given:
 * - a list of available mega_evolutions for this session
 * - whether this combat already had a mega this battle
 */
export function canMegaEvolve(
  pokemon: MegaEligiblePokemon,
  available_megas: MegaEvolutionData[],
  mega_already_used: boolean
): boolean {
  if (mega_already_used) return false
  if (pokemon.equipped_item_id === null) return false

  return available_megas.some(
    m => m.species_id === pokemon.species_id &&
         (m.mega_stone_item_id === pokemon.equipped_item_id || m.mega_stone_item_id === null)
  )
}

/**
 * Returns which MegaEvolutionData to apply for a given pokemon.
 * For species with two megas (Charizard X/Y, Mewtwo X/Y), uses the stone to discriminate.
 * Returns null if no eligible mega found.
 */
export function selectMegaEvolution(
  pokemon: MegaEligiblePokemon,
  available_megas: MegaEvolutionData[]
): MegaEvolutionData | null {
  // Match by mega_stone_item_id first (exact match)
  const exact = available_megas.find(
    m => m.species_id === pokemon.species_id &&
         m.mega_stone_item_id !== null &&
         m.mega_stone_item_id === pokemon.equipped_item_id
  )
  if (exact) return exact

  // Fallback: stone-free mega (Rayquaza)
  const stoneless = available_megas.find(
    m => m.species_id === pokemon.species_id && m.mega_stone_item_id === null
  )
  return stoneless ?? null
}

/**
 * Applies mega evolution stats to a pokemon's combat stats.
 * Returns the overridden stats (types + all base stats).
 * The pokemon's current HP ratio is preserved (HP changes proportionally).
 */
export function applyMegaEvolution(
  current_hp: number,
  base_hp: number,
  mega: MegaEvolutionData
): MegaCombatStats & { new_current_hp: number } {
  // Scale current HP proportionally to new max HP
  const hp_ratio = base_hp > 0 ? current_hp / base_hp : 1
  const new_current_hp = Math.max(1, Math.floor(mega.mega_hp * hp_ratio))

  return {
    type1: mega.mega_type1,
    type2: mega.mega_type2,
    hp: mega.mega_hp,
    atk: mega.mega_atk,
    def: mega.mega_def,
    spatk: mega.mega_spatk,
    spdef: mega.mega_spdef,
    speed: mega.mega_speed,
    sprite_url: mega.sprite_url,
    sprite_shiny_url: mega.sprite_shiny_url,
    mega_name_fr: mega.mega_name_fr,
    new_current_hp,
  }
}

/**
 * Returns the BST (base stat total) of a mega evolution.
 */
export function getMegaBST(mega: MegaEvolutionData): number {
  return mega.mega_hp + mega.mega_atk + mega.mega_def +
         mega.mega_spatk + mega.mega_spdef + mega.mega_speed
}
