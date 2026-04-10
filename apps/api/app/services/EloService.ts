/**
 * EloService — Calculs ELO purs et gestion paliers PvP.
 * Fonctions exportées séparément pour les tests unitaires.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PvpTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master' | 'legend'

export interface EloDelta {
  attacker_delta: number
  defender_delta: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

export const K_FACTORS: Record<PvpTier, number> = {
  bronze:  32,
  silver:  28,
  gold:    24,
  diamond: 20,
  master:  16,
  legend:  12,
}

export const ELO_FLOOR = 100

// ELO seuils de passage de palier
const TIER_THRESHOLDS: Array<{ min: number; tier: PvpTier }> = [
  { min: 2200, tier: 'legend'  },
  { min: 1800, tier: 'master'  },
  { min: 1500, tier: 'diamond' },
  { min: 1200, tier: 'gold'    },
  { min: 1000, tier: 'silver'  },
  { min: 0,    tier: 'bronze'  },
]

export const TIER_GEMS: Record<PvpTier, number> = {
  bronze:  0,
  silver:  10,
  gold:    10,
  diamond: 10,
  master:  10,
  legend:  10,
}

// ─── Fonctions pures ──────────────────────────────────────────────────────────

/**
 * Calcule le delta ELO pour un combat entre attaquant et défenseur.
 * Le K-factor est basé sur le tier de l'attaquant.
 */
export function calcEloChange(
  attacker_elo: number,
  defender_elo: number,
  attacker_won: boolean,
  attacker_tier: PvpTier | string
): EloDelta {
  const K = K_FACTORS[attacker_tier as PvpTier] ?? 24

  // Probabilité de victoire attendue (formule ELO standard)
  const expected_attacker = 1 / (1 + Math.pow(10, (defender_elo - attacker_elo) / 400))
  const expected_defender = 1 - expected_attacker

  const actual_attacker = attacker_won ? 1 : 0
  const actual_defender = attacker_won ? 0 : 1

  const raw_attacker = Math.round(K * (actual_attacker - expected_attacker))
  const raw_defender = Math.round(K * (actual_defender - expected_defender))

  // Appliquer le plancher ELO : l'ELO résultant ne peut pas descendre sous ELO_FLOOR
  const attacker_new = Math.max(ELO_FLOOR, attacker_elo + raw_attacker)
  const defender_new = Math.max(ELO_FLOOR, defender_elo + raw_defender)

  return {
    attacker_delta: attacker_new - attacker_elo,
    defender_delta: defender_new - defender_elo,
  }
}

/**
 * Détermine le tier PvP selon l'ELO courant.
 */
export function calcTier(elo: number): PvpTier {
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (elo >= min) return tier
  }
  return 'bronze'
}

/**
 * Calcule la probabilité de victoire estimée pour l'attaquant (0-100).
 */
export function calcWinProbability(attacker_elo: number, defender_elo: number): number {
  const prob = 1 / (1 + Math.pow(10, (defender_elo - attacker_elo) / 400))
  return Math.round(prob * 100)
}

export default {
  calcEloChange,
  calcTier,
  calcWinProbability,
  TIER_GEMS,
}
