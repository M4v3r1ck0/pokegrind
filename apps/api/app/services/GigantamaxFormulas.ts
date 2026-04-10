/**
 * GigantamaxFormulas — Fonctions pures pour le Gigantamax.
 * Pas de dépendances AdonisJS — importable dans les tests unitaires.
 *
 * Le Gigantamax est disponible uniquement en mode Raid et Tour Infinie.
 * Il multiplie les stats du Pokémon et ajoute un move G-Max temporaire.
 * Un seul Gigantamax par combat. Full heal à la transformation.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GigantamaxData {
  id: number
  species_id: number
  gmax_name_fr: string
  gmax_move_id: number | null
  gmax_hp_mult: number
  gmax_atk_mult: number
  gmax_def_mult: number
  gmax_spatk_mult: number
  gmax_spdef_mult: number
  gmax_speed_mult: number
  sprite_url: string | null
  sprite_shiny_url: string | null
  obtain_method: string
}

export interface GmaxEligiblePokemon {
  id: string
  species_id: number
  is_shiny: boolean
  current_hp: number
  max_hp: number
  effective_atk: number
  effective_def: number
  effective_spatk: number
  effective_spdef: number
  effective_speed: number
}

export interface GmaxAppliedStats {
  max_hp: number
  current_hp: number   // full heal = new max_hp
  effective_atk: number
  effective_def: number
  effective_spatk: number
  effective_spdef: number
  effective_speed: number
  gmax_name_fr: string
  sprite_url: string | null
  sprite_shiny_url: string | null
}

export type CombatMode = 'idle' | 'raid' | 'tower' | 'dungeon' | 'pvp' | 'bf'

// ─── Fonctions pures ─────────────────────────────────────────────────────────

/**
 * Détermine si un Pokémon peut Gigantamaxer.
 *
 * Règles :
 * - Mode combat autorisé (raid ou tower uniquement)
 * - Une forme Gigantamax existe pour cette espèce
 * - Le joueur a débloqué ce Gigantamax
 * - Pas déjà Gigantamaxé dans ce combat
 */
export function canGigantamax(
  mode: CombatMode,
  species_id: number,
  available_gmax: GigantamaxData[],
  player_unlocked_species: number[],
  gmax_already_used: boolean
): boolean {
  if (mode !== 'raid' && mode !== 'tower') return false
  if (gmax_already_used) return false
  if (!available_gmax.some((g) => g.species_id === species_id)) return false
  if (!player_unlocked_species.includes(species_id)) return false
  return true
}

/**
 * Sélectionne les données Gigantamax pour une espèce donnée.
 */
export function selectGigantamax(
  species_id: number,
  available_gmax: GigantamaxData[]
): GigantamaxData | null {
  return available_gmax.find((g) => g.species_id === species_id) ?? null
}

/**
 * Applique les multiplicateurs Gigantamax à un Pokémon.
 * Full heal les HP à la transformation.
 * Retourne les nouvelles stats sans modifier l'objet original.
 */
export function applyGigantamax(
  pokemon: GmaxEligiblePokemon,
  gmax: GigantamaxData
): GmaxAppliedStats {
  const new_max_hp = Math.floor(pokemon.max_hp * gmax.gmax_hp_mult)

  return {
    max_hp: new_max_hp,
    current_hp: new_max_hp,  // full heal
    effective_atk:   Math.floor(pokemon.effective_atk   * gmax.gmax_atk_mult),
    effective_def:   Math.floor(pokemon.effective_def   * gmax.gmax_def_mult),
    effective_spatk: Math.floor(pokemon.effective_spatk * gmax.gmax_spatk_mult),
    effective_spdef: Math.floor(pokemon.effective_spdef * gmax.gmax_spdef_mult),
    effective_speed: Math.floor(pokemon.effective_speed * gmax.gmax_speed_mult),
    gmax_name_fr: gmax.gmax_name_fr,
    sprite_url: gmax.sprite_url,
    sprite_shiny_url: gmax.sprite_shiny_url,
  }
}

/**
 * Calcule les stats Gigantamax d'un Pokémon depuis ses stats de base.
 * Utile pour afficher les stats prévisionnelles avant transformation.
 */
export function calcGmaxStats(base_stats: {
  max_hp: number
  effective_atk: number
  effective_def: number
  effective_spatk: number
  effective_spdef: number
  effective_speed: number
}, gmax: GigantamaxData): {
  hp: number
  atk: number
  def: number
  spatk: number
  spdef: number
  speed: number
} {
  return {
    hp:     Math.floor(base_stats.max_hp        * gmax.gmax_hp_mult),
    atk:    Math.floor(base_stats.effective_atk   * gmax.gmax_atk_mult),
    def:    Math.floor(base_stats.effective_def   * gmax.gmax_def_mult),
    spatk:  Math.floor(base_stats.effective_spatk * gmax.gmax_spatk_mult),
    spdef:  Math.floor(base_stats.effective_spdef * gmax.gmax_spdef_mult),
    speed:  Math.floor(base_stats.effective_speed * gmax.gmax_speed_mult),
  }
}

// ─── XP et niveaux ───────────────────────────────────────────────────────────

/**
 * XP total requis pour atteindre un niveau donné.
 * Formule : medium-fast (n³) simplifiée, standard Pokémon.
 */
export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  return level * level * level  // n³ medium-fast
}

/**
 * Calcule le niveau correspondant à une quantité d'XP.
 */
export function levelFromXp(xp: number): number {
  // Binary search entre 1 et 100
  let low = 1, high = 100
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2)
    if (xpRequiredForLevel(mid) <= xp) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return Math.min(100, low)
}

/**
 * Calcule l'XP gagné par un Bonbon Exp. L ou XL.
 */
export function calcCandyXpGain(effect_type: string): number {
  if (effect_type === 'exp_candy_l')  return 30_000
  if (effect_type === 'exp_candy_xl') return 100_000
  return 0
}

/**
 * Calcule le résultat d'un Bonbon Rare sur un Pokémon.
 * Retourne le nouveau niveau et si une évolution est possible.
 */
export function applyRareCandyResult(
  current_level: number,
  evolution_level: number | null
): { new_level: number; can_evolve: boolean } {
  if (current_level >= 100) {
    return { new_level: 100, can_evolve: false }
  }
  const new_level = current_level + 1
  const can_evolve = evolution_level !== null && new_level >= evolution_level
  return { new_level, can_evolve }
}

/**
 * Calcule le résultat d'un Bonbon Exp. sur un Pokémon.
 */
export function applyExpCandyResult(
  current_level: number,
  current_xp: number,
  xp_gain: number,
  evolution_level: number | null
): { new_level: number; new_xp: number; levels_gained: number; can_evolve: boolean } {
  const new_xp = current_xp + xp_gain
  const new_level = Math.min(100, levelFromXp(new_xp))
  const levels_gained = new_level - current_level
  const can_evolve = evolution_level !== null && new_level >= evolution_level && current_level < evolution_level

  return { new_level, new_xp, levels_gained, can_evolve }
}
