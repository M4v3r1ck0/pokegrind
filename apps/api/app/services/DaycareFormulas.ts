/**
 * DaycareFormulas — Fonctions pures de la pension (sans dépendances Lucid/AdonisJS).
 * Importé par les tests unitaires et re-exporté depuis DaycareService.
 */

import type { Nature, PokemonRarity } from '@pokegrind/shared'

// ─── Constantes ──────────────────────────────────────────────────────────────

export const HATCH_THRESHOLDS: Record<PokemonRarity, number> = {
  common:    500_000,
  rare:    1_000_000,
  epic:    2_000_000,
  legendary: 5_000_000,
  mythic:  5_000_000,
}

export const DEFAULT_SLOT_COUNT = 5
export const MAX_SLOT_COUNT = 10

export const DITTO_SPECIES_ID = 132

export const NATURES: Nature[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
]

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IVSet {
  hp: number
  atk: number
  def: number
  spatk: number
  spdef: number
  speed: number
}

export interface BreedingSpecies {
  id: number
  eggGroups: string[]
}

// ─── Fonctions pures ─────────────────────────────────────────────────────────

export function randomNature(): Nature {
  return NATURES[Math.floor(Math.random() * NATURES.length)]
}

export function randomIV(): number {
  return Math.floor(Math.random() * 32)
}

/**
 * Calcule les IVs hérités via dressage.
 * Les 3 stats avec les meilleurs IVs combinés sont héritées ; les 3 autres sont aléatoires.
 */
export function calcBreedingIVs(parent1_ivs: IVSet, parent2_ivs: IVSet): IVSet {
  const stats: (keyof IVSet)[] = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed']

  const best_by_stat = stats.map((stat) => ({
    stat,
    iv: Math.max(parent1_ivs[stat], parent2_ivs[stat]),
  }))

  best_by_stat.sort((a, b) => b.iv - a.iv)
  const inherited_stats = new Set(best_by_stat.slice(0, 3).map((x) => x.stat))

  const result = {} as IVSet
  for (const stat of stats) {
    result[stat] = inherited_stats.has(stat)
      ? Math.max(parent1_ivs[stat], parent2_ivs[stat])
      : randomIV()
  }
  return result
}

/**
 * Vérifie la compatibilité dressage entre deux espèces.
 */
export function areBreedingCompatible(species1: BreedingSpecies, species2: BreedingSpecies): boolean {
  if (species1.id === species2.id) return false
  if (species1.id === DITTO_SPECIES_ID || species2.id === DITTO_SPECIES_ID) return true

  const groups1: string[] = Array.isArray(species1.eggGroups) ? species1.eggGroups : []
  const groups2: string[] = Array.isArray(species2.eggGroups) ? species2.eggGroups : []

  if (groups1.includes('no-eggs') || groups2.includes('no-eggs')) return false

  return groups1.some((g) => groups2.includes(g))
}
