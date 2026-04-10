/**
 * PrestigeFormulas — Pure functions for prestige calculations.
 * No AdonisJS imports — fully testable without framework boot.
 */

export interface PrestigeLevel {
  level: number
  name_fr: string
  required_floor: number
  gold_multiplier: number
  xp_multiplier: number
  gem_bonus_per_boss: number
  daycare_speed_bonus: number
  gems_reward: number
  badge_name_fr: string | null
}

export interface PlayerPrestigeState {
  prestige_level: number
  current_floor: number
  prestige_gold_mult: number
  prestige_xp_mult: number
  prestige_gem_bonus: number
  prestige_daycare_mult: number
  gold: number
  total_kills: number
  max_floor_reached: number
}

export interface PrestigeEligibility {
  eligible: boolean
  reason?: string
  current_floor?: number
  required_floor?: number
  next_level?: number
  prestige_def?: PrestigeLevel
  will_lose?: {
    current_floor: number
    gold: number
    total_kills: number
  }
  will_keep?: {
    pokemon_inventory: boolean
    daycare_slots: boolean
    gems: boolean
    upgrades: boolean
    pokedex: boolean
    pvp_ranking: boolean
    bf_points: boolean
  }
  new_bonuses?: {
    gold_multiplier: number
    xp_multiplier: number
    gem_bonus_per_boss: number
    daycare_speed_bonus: number
    gems_reward: number
  }
}

const MAX_PRESTIGE = 50

/**
 * Vérifie si un joueur peut effectuer son prochain prestige.
 */
export function checkPrestigeEligibility(
  player: PlayerPrestigeState,
  prestige_def: PrestigeLevel | null,
): PrestigeEligibility {
  const next_level = player.prestige_level + 1

  if (next_level > MAX_PRESTIGE) {
    return { eligible: false, reason: 'Prestige maximum atteint (50/50)' }
  }

  if (!prestige_def) {
    return { eligible: false, reason: 'Définition du niveau de prestige introuvable' }
  }

  if (player.current_floor < prestige_def.required_floor) {
    return {
      eligible: false,
      reason: `Atteins l'étage ${prestige_def.required_floor} avant de prestigier`,
      current_floor: player.current_floor,
      required_floor: prestige_def.required_floor,
    }
  }

  return {
    eligible: true,
    next_level,
    prestige_def,
    will_lose: {
      current_floor: player.current_floor,
      gold: player.gold,
      total_kills: player.total_kills,
    },
    will_keep: {
      pokemon_inventory: true,
      daycare_slots: true,
      gems: true,
      upgrades: true,
      pokedex: true,
      pvp_ranking: true,
      bf_points: true,
    },
    new_bonuses: {
      gold_multiplier: prestige_def.gold_multiplier,
      xp_multiplier: prestige_def.xp_multiplier,
      gem_bonus_per_boss: prestige_def.gem_bonus_per_boss,
      daycare_speed_bonus: prestige_def.daycare_speed_bonus,
      gems_reward: prestige_def.gems_reward,
    },
  }
}

/**
 * Calcule les nouveaux multiplicateurs cumulatifs après un prestige.
 * Les multiplicateurs se multiplient entre eux.
 */
export function calcNewMultipliers(
  current_gold_mult: number,
  current_xp_mult: number,
  current_daycare_mult: number,
  current_gem_bonus: number,
  prestige_def: PrestigeLevel
): {
  gold_mult: number
  xp_mult: number
  daycare_mult: number
  gem_bonus: number
} {
  return {
    gold_mult: parseFloat((current_gold_mult * prestige_def.gold_multiplier).toFixed(4)),
    xp_mult: parseFloat((current_xp_mult * prestige_def.xp_multiplier).toFixed(4)),
    daycare_mult: parseFloat((current_daycare_mult * prestige_def.daycare_speed_bonus).toFixed(4)),
    gem_bonus: current_gem_bonus + prestige_def.gem_bonus_per_boss,
  }
}

/**
 * Applique le multiplicateur prestige à l'or gagné en combat.
 */
export function applyPrestigeGoldMult(gold: number, prestige_gold_mult: number): number {
  return Math.floor(gold * prestige_gold_mult)
}

/**
 * Applique le multiplicateur prestige à l'XP gagnée en combat.
 */
export function applyPrestigeXpMult(xp: number, prestige_xp_mult: number): number {
  return Math.floor(xp * prestige_xp_mult)
}

/**
 * Applique le multiplicateur prestige aux dégâts de pension.
 */
export function applyPrestigeDaycareMult(damage: number, prestige_daycare_mult: number): number {
  return Math.floor(damage * prestige_daycare_mult)
}

/**
 * Calcule les gems gagnées sur un boss 1ère fois avec bonus prestige.
 */
export function calcBossGems(base_gems: number, prestige_gem_bonus: number): number {
  return base_gems + prestige_gem_bonus
}

/**
 * Vérifie si le niveau de prestige atteint est un milestone (annonce globale).
 */
export function isPrestigeMilestone(level: number): boolean {
  return level === 10 || level === 25 || level === 50
}
