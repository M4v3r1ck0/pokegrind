/**
 * EventFormulas — Pure functions for event effects.
 * No AdonisJS imports — fully testable without framework boot.
 */

export interface EventConfig {
  multiplier?: number
  sources?: string[]
  banner_id?: string
  description_fr?: string
}

/**
 * Applique le multiplicateur gem_boost à un montant de gems.
 * admin_grant est toujours exempt.
 */
export function applyGemBoost(
  amount: number,
  source: string,
  config: EventConfig | null
): number {
  if (!config || source === 'admin_grant') return amount
  if (config.sources && config.sources.length > 0 && !config.sources.includes(source)) {
    return amount
  }
  return Math.floor(amount * (config.multiplier ?? 1))
}

/**
 * Applique le multiplicateur xp_boost.
 */
export function applyXpBoost(xp: number, config: EventConfig | null): number {
  if (!config) return xp
  return Math.floor(xp * (config.multiplier ?? 1))
}

/**
 * Calcule le taux shiny avec boost éventuel.
 */
export function calcShinyRate(config: EventConfig | null): number {
  const base = 1 / 8192
  if (!config) return base
  return base * (config.multiplier ?? 1)
}

/**
 * Vérifie si le mode maintenance est actif depuis un objet de config.
 */
export function isMaintenanceActive(
  config: { active: boolean; ends_at?: string } | null
): boolean {
  if (!config || !config.active) return false
  if (config.ends_at && new Date(config.ends_at) < new Date()) return false
  return true
}
