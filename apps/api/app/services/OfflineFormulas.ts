/**
 * OfflineFormulas — Fonctions pures de calcul offline (sans dépendances Lucid/AdonisJS).
 * Importé par les tests unitaires et par OfflineCalculationJob.
 */

import { calcHP, calcStat, calcActionDelay, getNatureModifier } from '#services/CombatService'
import type { Nature, MoveCategory, PokemonType } from '@pokegrind/shared'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OfflineMoveSnapshot {
  move_id: number
  power: number | null
  category: MoveCategory
  type: PokemonType
}

export interface OfflinePokemonSnapshot {
  species_id: number
  level: number
  nature: Nature
  ivs: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }
  moves: OfflineMoveSnapshot[]
  type1: PokemonType
  type2: PokemonType | null
  base_atk: number
  base_spatk: number
  base_speed: number
}

export interface TeamSnapshot {
  pokemon: OfflinePokemonSnapshot[]
}

export interface FloorSnapshot {
  floor_number: number
  min_level: number
  max_level: number
  gold_base: number
  xp_base: number
}

export interface DropItem {
  item_name_fr: string
  quantity: number
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Absence minimale pour générer un rapport (5 minutes). */
export const MIN_ABSENCE_SECONDS = 300

/** Cap offline à 24 heures. */
export const MAX_ABSENCE_SECONDS = 86_400

/** HP moyen d'un ennemi = niveau × 18 (approximation conservatrice). */
export const ENEMY_HP_FACTOR = 18

/** Taux de drop CT : 0.1% par kill. */
export const CT_DROP_RATE = 0.001

// ─── Fonctions pures ─────────────────────────────────────────────────────────

/**
 * Formate une durée en secondes en chaîne lisible : "1h 03min", "42min", "3h 00min".
 */
export function formatAbsence(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}min`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

/**
 * Estime le DPS d'un seul Pokémon sur un ennemi neutre.
 * Utilise la formule de combat complète (même niveau, IVs, nature).
 */
export function estimatePokemonDPSOffline(pokemon: OfflinePokemonSnapshot): number {
  const nature_mod_atk = getNatureModifier(pokemon.nature, 'atk')
  const nature_mod_spatk = getNatureModifier(pokemon.nature, 'spatk')
  const nature_mod_speed = getNatureModifier(pokemon.nature, 'speed')

  const effective_atk = calcStat(pokemon.base_atk, pokemon.ivs.atk, pokemon.level, nature_mod_atk)
  const effective_spatk = calcStat(pokemon.base_spatk, pokemon.ivs.spatk, pokemon.level, nature_mod_spatk)
  const effective_speed = calcStat(pokemon.base_speed, pokemon.ivs.speed, pokemon.level, nature_mod_speed)

  // Ennemi "neutre" : def/spdef = 50 (stat de base neutre approx.)
  const enemy_def = 50
  const enemy_spdef = 50

  let total_dps = 0
  let move_count = 0

  for (const move of pokemon.moves) {
    if (!move.power || move.category === 'status') continue

    const stat_off = move.category === 'physical' ? effective_atk : effective_spatk
    const stat_def = move.category === 'physical' ? enemy_def : enemy_spdef
    const stab = move.type === pokemon.type1 || move.type === pokemon.type2 ? 1.5 : 1

    const avg_damage =
      ((((2 * pokemon.level) / 5 + 2) * move.power * (stat_off / stat_def)) / 50 + 2) *
      stab *
      0.925 // multiplicateur aléatoire moyen

    const delay_ms = 3000 / (effective_speed / 100)
    const actions_per_sec = 1000 / delay_ms

    total_dps += avg_damage * actions_per_sec
    move_count++
  }

  return move_count > 0 ? total_dps / move_count : 0
}

/**
 * Estime le DPS total de l'équipe.
 */
export function estimateTeamDPS(team: TeamSnapshot): number {
  return team.pokemon.reduce((sum, p) => sum + estimatePokemonDPSOffline(p), 0)
}

/**
 * Calcule les drops à partir du nombre de kills sur un étage.
 * Retourne un tableau d'objets { item_name_fr, quantity }.
 */
export function calculateDrops(floor: FloorSnapshot, kills: number): DropItem[] {
  const drops: DropItem[] = []

  // CTs disponibles par palier d'étage
  const ct_pool = getCTPool(floor.floor_number)
  if (ct_pool.length > 0) {
    const ct_drops = Math.floor(kills * CT_DROP_RATE)
    if (ct_drops > 0) {
      // Distribuer les CTs aléatoirement dans le pool
      for (let i = 0; i < ct_drops; i++) {
        const ct = ct_pool[Math.floor(Math.random() * ct_pool.length)]
        const existing = drops.find((d) => d.item_name_fr === ct)
        if (existing) {
          existing.quantity++
        } else {
          drops.push({ item_name_fr: ct, quantity: 1 })
        }
      }
    }
  }

  return drops
}

/**
 * Retourne le pool de CTs disponibles pour un étage donné.
 */
export function getCTPool(floor_number: number): string[] {
  if (floor_number <= 10) return ['CT 01 (Griffe)', 'CT 45 (Tranche)', 'CT 70 (Flash)']
  if (floor_number <= 20) return ['CT 24 (Tonnerre)', 'CT 13 (Laser Glace)', 'CT 35 (Flammèche)']
  if (floor_number <= 40) return ['CT 22 (Rayon Soleil)', 'CT 25 (Tonnerre)', 'CT 15 (Blizzard)']
  if (floor_number <= 60) return ['CT 38 (Lance-Flamme)', 'CT 53 (Pistolet à O)', 'CT 58 (Cascade)']
  if (floor_number <= 80) return ['CT 26 (Séisme)', 'CT 27 (Retour)', 'CT 50 (Lilliput)']
  return ['CT 51 (Surf)', 'CT 82 (Tranche', 'CT 71 (Tonnerre', 'CT 76 (Blizzard']
}

/**
 * Calcule le nombre de secondes d'absence plafonnées à 24h.
 * Retourne null si absence < MIN_ABSENCE_SECONDS.
 */
export function calcAbsenceSeconds(last_seen_at: string | null): number | null {
  if (!last_seen_at) return null
  const absence = (Date.now() - new Date(last_seen_at).getTime()) / 1000
  if (absence < MIN_ABSENCE_SECONDS) return null
  return Math.min(absence, MAX_ABSENCE_SECONDS)
}

// ─── Item drops offline ──────────────────────────────────────────────────────

export interface OfflineFloorDropConfig {
  item_id: number
  item_name_fr: string
  drop_rate: number
  qty_min: number
  qty_max: number
}

export interface OfflineItemDrop {
  item_id: number
  item_name_fr: string
  quantity: number
}

/**
 * Calcule les item drops pour N kills offline.
 * Pure function — no DB calls.
 */
export function calculateItemDropsOffline(
  floor_drops: OfflineFloorDropConfig[],
  kills: number
): OfflineItemDrop[] {
  if (!floor_drops.length || kills <= 0) return []

  const result: OfflineItemDrop[] = []

  for (const config of floor_drops) {
    // Expected drops = kills × drop_rate (probabilistic approximation for offline)
    const expected = kills * config.drop_rate
    // Use Poisson approximation: floor(expected) + 1 if random < fractional part
    const base_qty = Math.floor(expected)
    const extra = Math.random() < (expected - base_qty) ? 1 : 0
    const total_qty = (base_qty + extra) * (config.qty_min === config.qty_max
      ? config.qty_min
      : config.qty_min + Math.floor(Math.random() * (config.qty_max - config.qty_min + 1)))
    if (total_qty > 0) {
      result.push({ item_id: config.item_id, item_name_fr: config.item_name_fr, quantity: total_qty })
    }
  }

  return result
}
