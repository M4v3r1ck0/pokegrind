/**
 * ShopFormulas — Logique pure boutique/gems (sans dépendances Lucid/AdonisJS).
 * Importé par les tests unitaires.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type GemSource =
  | 'boss_first_clear'
  | 'region_complete'
  | 'pokedex_gen_complete'
  | 'bf_top10'
  | 'bf_top100'
  | 'pvp_elo_tier'
  | 'achievement'
  | 'event'
  | 'kills_milestone'
  | 'admin_grant'
  | 'shop_purchase'
  | 'prestige_reward'
  | 'tower_milestone'
  | 'tower_boss'
  | 'raid_reward'

export interface UpgradeSnapshot {
  id: number
  cost_gems: number
  name_fr: string
  effect_type: string
  requires_upgrade_id: number | null
  category: string
}

export interface PurchaseValidation {
  valid: boolean
  error?: string
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Milestones de kills donnant des gems. */
export const KILL_MILESTONES = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000, 50_000_000]

/** Gems attribuées par source. */
export const GEM_AMOUNTS: Partial<Record<GemSource, number>> = {
  boss_first_clear: 2,
  region_complete: 10,
  pokedex_gen_complete: 15,
  bf_top10: 5,
  bf_top100: 2,
  kills_milestone: 5,
}

/** Nombre de slots pension par défaut. */
export const DEFAULT_DAYCARE_SLOTS = 5

/** Seuil de pity légendaire par défaut. */
export const DEFAULT_LEGENDARY_PITY = 200

/** Seuil de pity légendaire avec upgrade. */
export const REDUCED_LEGENDARY_PITY = 180

// ─── Fonctions pures ─────────────────────────────────────────────────────────

/**
 * Valide l'achat d'une upgrade.
 * Retourne { valid: true } ou { valid: false, error: string }.
 */
export function validatePurchase(
  upgrade: UpgradeSnapshot,
  player_gems: number,
  already_purchased: boolean,
  has_prerequisite: boolean
): PurchaseValidation {
  if (already_purchased) {
    return { valid: false, error: 'Vous possédez déjà cette amélioration' }
  }
  if (upgrade.requires_upgrade_id !== null && !has_prerequisite) {
    return { valid: false, error: 'Prérequis non satisfait' }
  }
  if (player_gems < upgrade.cost_gems) {
    return {
      valid: false,
      error: `Gems insuffisants (${player_gems} disponibles, ${upgrade.cost_gems} requis)`,
    }
  }
  return { valid: true }
}

/**
 * Calcule si un milestone kill a été franchi.
 * Retourne le milestone franchi, ou null si aucun.
 */
export function checkKillMilestone(
  total_kills_before: number,
  kills_just_earned: number
): number | null {
  const total_after = total_kills_before + kills_just_earned
  for (const milestone of KILL_MILESTONES) {
    if (total_kills_before < milestone && total_after >= milestone) {
      return milestone
    }
  }
  return null
}

/**
 * Retourne les slots de pension max selon les upgrades possédées.
 */
export function calcMaxDaycareSlots(owned_upgrade_ids: number[]): number {
  // Upgrades daycare_slot par id connu : id 1→6, id 2→7, id 4→8, id 6→9, id 7→10
  const SLOT_UPGRADES: Record<number, number> = { 1: 6, 2: 7, 4: 8, 6: 9, 7: 10 }
  let max = DEFAULT_DAYCARE_SLOTS
  for (const id of owned_upgrade_ids) {
    const slot = SLOT_UPGRADES[id]
    if (slot && slot > max) max = slot
  }
  return max
}

/**
 * Retourne le seuil de pity légendaire selon les upgrades.
 */
export function calcLegendaryPity(owned_effect_types: string[]): number {
  return owned_effect_types.includes('pity_legendary')
    ? REDUCED_LEGENDARY_PITY
    : DEFAULT_LEGENDARY_PITY
}

/**
 * Vérifie si une source de gems est valide.
 */
export function isValidGemSource(source: string): source is GemSource {
  const VALID: GemSource[] = [
    'boss_first_clear', 'region_complete', 'pokedex_gen_complete',
    'bf_top10', 'bf_top100', 'pvp_elo_tier', 'achievement',
    'event', 'kills_milestone', 'admin_grant', 'shop_purchase', 'prestige_reward',
    'tower_milestone', 'tower_boss',
  ]
  return VALID.includes(source as GemSource)
}
