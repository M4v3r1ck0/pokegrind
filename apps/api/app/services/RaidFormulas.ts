/**
 * RaidFormulas — Fonctions pures pour les Raids Mondiaux.
 * Pas de dépendances AdonisJS — importable dans les tests unitaires.
 */

import { estimatePokemonDPSOffline } from '#services/OfflineFormulas'
import type { OfflinePokemonSnapshot } from '#services/OfflineFormulas'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardTierDef {
  min_percent: number
  rewards: string[]
}

export interface RewardTiers {
  legend: RewardTierDef
  champion: RewardTierDef
  hero: RewardTierDef
  fighter: RewardTierDef
  support: RewardTierDef
}

export type RaidTier = 'legend' | 'champion' | 'hero' | 'fighter' | 'support' | 'none'

export interface RaidDamageInput {
  team: OfflinePokemonSnapshot[]
  prestige_gold_mult: number
  seed?: number // pour les tests déterministes
}

export interface RaidDamageResult {
  damage: number
  base_dps: number
  simulated_seconds: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Durée simulée d'un cycle d'attaque Raid (30 secondes de combat). */
export const RAID_SIMULATE_SECONDS = 30

/** Cooldown entre deux attaques Raid (4 heures en ms). */
export const RAID_COOLDOWN_MS = 4 * 60 * 60 * 1000

/** Variance ±15% sur les dégâts de raid. */
export const RAID_VARIANCE_MIN = 0.85
export const RAID_VARIANCE_RANGE = 0.30

// ─── Fonctions pures ─────────────────────────────────────────────────────────

/**
 * Calcule les dégâts infligés par l'équipe du joueur lors d'une attaque Raid.
 * Simule RAID_SIMULATE_SECONDS secondes de combat.
 * Applique le multiplicateur de prestige et une variance ±15%.
 *
 * @param input - équipe, multiplicateur prestige, seed optionnel (pour tests)
 */
export function calcRaidDamage(input: RaidDamageInput): RaidDamageResult {
  const { team, prestige_gold_mult, seed } = input

  // DPS total de l'équipe contre des ennemis niveau ~100 (def neutre 100)
  const base_dps = team.reduce((sum, p) => sum + estimateRaidDPS(p), 0)

  // Simuler RAID_SIMULATE_SECONDS secondes
  const base_damage = base_dps * RAID_SIMULATE_SECONDS

  // Multiplicateur prestige (réutilise le gold_mult comme proxy du niveau du joueur)
  const prestige_damage = base_damage * prestige_gold_mult

  // Variance ±15% — déterministe si seed fourni (pour tests), sinon Math.random
  const variance_rand = seed !== undefined ? pseudoRandom(seed) : Math.random()
  const variance = RAID_VARIANCE_MIN + variance_rand * RAID_VARIANCE_RANGE

  const final_damage = Math.max(1, Math.floor(prestige_damage * variance))

  return {
    damage: final_damage,
    base_dps,
    simulated_seconds: RAID_SIMULATE_SECONDS,
  }
}

/**
 * Estime le DPS d'un Pokémon pour un combat de Raid (ennemi niveau 100, def 100).
 * Adapté de estimatePokemonDPSOffline mais avec des stats défense ennemie plus élevées.
 */
export function estimateRaidDPS(pokemon: OfflinePokemonSnapshot): number {
  // On réutilise la formule offline mais les stats ennemies sont plus élevées (raid boss)
  return estimatePokemonDPSOffline(pokemon) * 0.85 // léger réducteur vs boss endgame
}

/**
 * Détermine le tier de récompense d'un joueur selon son % de contribution.
 */
export function calcRewardTier(contribution_percent: number, tiers: RewardTiers): RaidTier {
  if (contribution_percent >= tiers.legend.min_percent)   return 'legend'
  if (contribution_percent >= tiers.champion.min_percent) return 'champion'
  if (contribution_percent >= tiers.hero.min_percent)     return 'hero'
  if (contribution_percent >= tiers.fighter.min_percent)  return 'fighter'
  if (contribution_percent >= tiers.support.min_percent)  return 'support'
  return 'none'
}

/**
 * Calcule le pourcentage de contribution d'un joueur.
 */
export function calcContributionPercent(
  player_damage: bigint | number,
  total_damage: bigint | number
): number {
  const pd = Number(player_damage)
  const td = Number(total_damage)
  if (td <= 0) return 0
  return (pd / td) * 100
}

/**
 * Vérifie si le cooldown de 4h est respecté.
 * @param last_attack_at - timestamp ISO de la dernière attaque (ou null)
 * @param now_ms - timestamp actuel en ms (pour les tests)
 */
export function isCooldownExpired(last_attack_at: string | null, now_ms?: number): boolean {
  if (!last_attack_at) return true
  const now = now_ms ?? Date.now()
  const last = new Date(last_attack_at).getTime()
  return now - last >= RAID_COOLDOWN_MS
}

/**
 * Calcule le timestamp du prochain attaque autorisée.
 */
export function calcNextAttackAt(last_attack_at: string | null): string | null {
  if (!last_attack_at) return null
  const next = new Date(new Date(last_attack_at).getTime() + RAID_COOLDOWN_MS)
  return next.toISOString()
}

/**
 * Calcule le % de HP restants (progress vaincu).
 */
export function calcProgressPercent(hp_remaining: number | bigint, hp_total: number | bigint): number {
  const remaining = Number(hp_remaining)
  const total = Number(hp_total)
  if (total <= 0) return 100
  const defeated_pct = ((total - remaining) / total) * 100
  return Math.min(100, Math.max(0, defeated_pct))
}

/**
 * Calcule le temps restant en secondes jusqu'à ends_at.
 */
export function calcTimeRemainingSeconds(ends_at: string, now_ms?: number): number {
  const now = now_ms ?? Date.now()
  const end = new Date(ends_at).getTime()
  return Math.max(0, Math.floor((end - now) / 1000))
}

/**
 * Génère les récompenses pour un tier donné selon la config du boss.
 * Retourne un tableau d'objets { reward_type, reward_data }.
 */
export function buildRewardEntries(
  tier: RaidTier,
  tiers: RewardTiers,
  boss_species_id: number,
  boss_name_fr: string
): Array<{ reward_type: string; reward_data: object }> {
  if (tier === 'none') return []

  const tier_def = tiers[tier]
  const results: Array<{ reward_type: string; reward_data: object }> = []

  for (const reward_str of tier_def.rewards) {
    if (reward_str.startsWith('gems_')) {
      const amount = parseInt(reward_str.replace('gems_', ''), 10)
      results.push({ reward_type: 'gems', reward_data: { amount } })
    } else if (reward_str === 'legendary_pokemon' || reward_str.endsWith('_guaranteed') || reward_str.endsWith('_rare')) {
      results.push({
        reward_type: 'pokemon',
        reward_data: { species_id: boss_species_id, name_fr: boss_name_fr, guaranteed_legendary: true },
      })
    } else if (reward_str.startsWith('rare_pokemon')) {
      results.push({
        reward_type: 'pokemon',
        reward_data: { rarity: 'rare', random: true },
      })
    } else if (reward_str.startsWith('mega_stone_')) {
      const stone_target = reward_str.replace('mega_stone_', '')
      results.push({
        reward_type: 'item',
        reward_data: { item_type: 'mega_stone', target: stone_target },
      })
    } else if (reward_str === 'gmax_unlock') {
      results.push({
        reward_type: 'gmax_unlock',
        reward_data: { species_id: boss_species_id, name_fr: boss_name_fr },
      })
    }
  }

  return results
}

/**
 * Pour le raid expiré : tout le monde reçoit uniquement les récompenses support.
 */
export function buildExpiredRewardEntries(
  tiers: RewardTiers,
  boss_species_id: number,
  boss_name_fr: string
): Array<{ reward_type: string; reward_data: object }> {
  return buildRewardEntries('support', tiers, boss_species_id, boss_name_fr)
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

/** Pseudo-random déterministe pour les tests. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

/**
 * Estime le nombre de joueurs nécessaires pour vaincre un raid en temps imparti.
 * Basé sur un DPS moyen endgame estimé.
 *
 * @param total_hp - HP total du raid
 * @param duration_hours - durée du raid en heures
 * @param avg_team_dps - DPS moyen d'une équipe endgame (défaut: 150 000/s)
 * @param cooldown_hours - cooldown entre attaques (défaut: 4h)
 */
export function estimatePlayersNeeded(
  total_hp: number,
  duration_hours: number,
  avg_team_dps: number = 150_000,
  cooldown_hours: number = 4
): number {
  const attacks_per_player = Math.floor(duration_hours / cooldown_hours)
  const damage_per_attack = avg_team_dps * RAID_SIMULATE_SECONDS
  const damage_per_player = damage_per_attack * attacks_per_player
  return Math.ceil(total_hp / damage_per_player)
}
