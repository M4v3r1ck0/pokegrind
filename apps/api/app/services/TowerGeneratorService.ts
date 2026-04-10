/**
 * TowerGeneratorService — Génération procédurale des étages de la Tour Infinie.
 * Pure functions (sans AdonisJS) pour la logique de génération.
 * La génération est déterministe : même étage + même saison = mêmes ennemis.
 */

import type { PokemonType, Nature } from '@pokegrind/shared'

export interface TowerIVs {
  hp: number; atk: number; def: number
  spatk: number; spdef: number; speed: number
}

export interface GeneratedEnemy {
  species_id: number
  level: number
  ivs: TowerIVs
  nature: string
  moves: number[]
  name_fr?: string
  is_tower_boss?: boolean
}

export interface TowerFloorConfig {
  floor_number: number
  enemy_count: number
  enemy_level: number
  tier: string[]
  gold_base: number
  xp_base: number
  is_boss: boolean
  iv_min: number
  iv_max: number
}

export interface BossMechanic {
  type: 'enrage' | 'regen' | 'reflect' | 'clone' | 'berserk'
  threshold?: number
  damage_mult?: number
  heal_per_action?: number
  reflect_percent?: number
  move_categories?: string[]
  clone_count?: number
  clone_hp_percent?: number
  action_speed_mult?: number
  trigger_ms?: number
}

const NATURES: string[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
]

/**
 * Générateur de nombre pseudo-aléatoire déterministe (mulberry32).
 * Produit des valeurs entre 0 (inclus) et 1 (exclus).
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Calcule les caractéristiques d'un étage de Tour Infinie.
 * Déterministe : floor_number × 1000 + season_id comme seed.
 */
export function calcTowerFloorConfig(
  floor_number: number,
  season_id: number
): TowerFloorConfig {
  // Niveau des ennemis : croissance logarithmique
  const enemy_level = Math.min(
    Math.round(5 + Math.log(floor_number + 1) * 20),
    200
  )

  // Tier selon l'étage
  const tier =
    floor_number < 50  ? ['D', 'C'] :
    floor_number < 100 ? ['C', 'B'] :
    floor_number < 200 ? ['B', 'A'] :
    floor_number < 300 ? ['A', 'S'] :
                         ['S', 'S+']

  // Nombre d'ennemis (1 à 6)
  const enemy_count = Math.min(1 + Math.floor(floor_number / 10), 6)

  // Or et XP : croissance continue
  const gold_base = Math.floor(50 * Math.pow(floor_number, 1.15))
  const xp_base   = Math.floor(30 * Math.pow(floor_number, 1.10))

  // IVs des ennemis croissants
  const iv_min = Math.min(Math.floor(floor_number / 10), 28)
  const iv_max = Math.min(iv_min + 15, 31)

  return {
    floor_number,
    enemy_count,
    enemy_level,
    tier,
    gold_base,
    xp_base,
    is_boss: floor_number % 25 === 0,
    iv_min,
    iv_max,
  }
}

/**
 * Génère les IVs d'un ennemi pour un étage donné.
 */
export function generateIVsForFloor(floor_number: number, rng: () => number): TowerIVs {
  const iv_min = Math.min(Math.floor(floor_number / 10), 28)
  const iv_max = Math.min(iv_min + 15, 31)
  const range = iv_max - iv_min + 1

  return {
    hp:    iv_min + Math.floor(rng() * range),
    atk:   iv_min + Math.floor(rng() * range),
    def:   iv_min + Math.floor(rng() * range),
    spatk: iv_min + Math.floor(rng() * range),
    spdef: iv_min + Math.floor(rng() * range),
    speed: iv_min + Math.floor(rng() * range),
  }
}

/**
 * Génère une liste d'ennemis déterministe pour un étage.
 * species_pool doit être passé depuis la DB (en cache).
 */
export function generateEnemiesForFloor(
  floor_number: number,
  season_id: number,
  species_pool: Array<{ id: number; name_fr: string }>
): GeneratedEnemy[] {
  const config = calcTowerFloorConfig(floor_number, season_id)
  const seed = floor_number * 1000 + season_id
  const rng = createSeededRng(seed)

  if (species_pool.length === 0) return []

  return Array.from({ length: config.enemy_count }, () => {
    const species = species_pool[Math.floor(rng() * species_pool.length)]
    const level_variation = Math.floor(rng() * 5) // ±0-4 niveaux
    return {
      species_id: species.id,
      level: config.enemy_level + level_variation,
      ivs: generateIVsForFloor(floor_number, rng),
      nature: NATURES[Math.floor(rng() * NATURES.length)],
      moves: [],  // chargés séparément depuis la DB
      name_fr: species.name_fr,
    }
  })
}

/**
 * Applique la mécanique d'enrage sur les dégâts du boss.
 */
export function applyEnrageMechanic(
  damage: number,
  boss_hp: number,
  boss_max_hp: number,
  config: { threshold: number; damage_mult: number }
): number {
  const hp_pct = boss_hp / boss_max_hp
  if (hp_pct < config.threshold) {
    return Math.floor(damage * config.damage_mult)
  }
  return damage
}

/**
 * Calcule les PV régénérés par la mécanique regen.
 */
export function calcRegenHeal(
  boss_max_hp: number,
  config: { heal_per_action: number }
): number {
  return Math.floor(boss_max_hp * config.heal_per_action)
}

/**
 * Calcule les dégâts reflétés par la mécanique reflect.
 */
export function calcReflectDamage(
  damage: number,
  move_category: string,
  config: { reflect_percent: number; move_categories: string[] }
): number {
  if (!config.move_categories.includes(move_category)) return 0
  return Math.floor(damage * config.reflect_percent)
}

/**
 * Calcule les HP des clones pour la mécanique clone.
 */
export function calcCloneHP(
  boss_max_hp: number,
  config: { clone_count: number; clone_hp_percent: number }
): number {
  return Math.floor(boss_max_hp * config.clone_hp_percent)
}
