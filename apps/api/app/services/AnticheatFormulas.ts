/**
 * AnticheatFormulas — Pure functions for anticheat detection.
 * No AdonisJS imports — fully testable without framework boot.
 */

/**
 * Calcule le DPS max théorique absolu pour un niveau donné.
 */
export function calcTheoreticalMaxDPS(level: number): number {
  const BASE_STAT = 180       // base stat max (Deoxys-A spatk)
  const MAX_IV = 31
  const NATURE = 1.1
  const MOVE_POWER = 150
  const STAB = 1.5
  const LIFE_ORB = 1.3
  const TYPE_EFF = 2.0
  const TEAM_SIZE = 6

  const stat = Math.floor((((2 * BASE_STAT + MAX_IV) * level) / 100 + 5) * NATURE)
  const damage = Math.floor(
    ((((2 * level) / 5 + 2) * MOVE_POWER * (stat / 50)) / 50 + 2)
    * TYPE_EFF * STAB * LIFE_ORB
  )

  const min_timing_ms = 1500
  const single_dps = (damage / min_timing_ms) * 1000
  return single_dps * TEAM_SIZE
}

/**
 * Calcule le nombre max théorique de kills pour un étage donné.
 */
export function calcTheoreticalMaxKills(
  level: number,
  absence_seconds: number,
  enemy_hp_per_level: number = 18
): number {
  const max_dps = calcTheoreticalMaxDPS(level)
  const enemy_hp = level * enemy_hp_per_level
  if (enemy_hp <= 0) return 0
  const kill_time_s = Math.max(0.1, enemy_hp / max_dps)
  return Math.floor(absence_seconds / kill_time_s)
}

/**
 * Vérifie si un DPS observé est suspect.
 */
export function isDpsAnomaly(
  observed_dps: number,
  level: number,
  threshold: number = 3
): boolean {
  const max_dps = calcTheoreticalMaxDPS(level)
  return observed_dps > max_dps * threshold
}

/**
 * Vérifie si un nombre de kills est suspect vs. théorique.
 */
export function isKillRateAnomaly(
  declared_kills: number,
  level: number,
  absence_seconds: number,
  threshold: number = 2
): boolean {
  const max_kills = calcTheoreticalMaxKills(level, absence_seconds)
  return declared_kills > max_kills * threshold
}

/**
 * Vérifie si les gems gagnées sont suspectes.
 */
export function isGemsAnomaly(
  non_admin_gems_gained: number,
  threshold_gems: number = 50
): boolean {
  return non_admin_gems_gained > threshold_gems
}
