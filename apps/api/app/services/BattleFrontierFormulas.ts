/**
 * BattleFrontierFormulas — Fonctions pures testables sans AdonisJS.
 * Toutes les règles de gameplay Battle Frontier sont ici.
 */

import { calcHP, calcStat, calcDamage, getNatureModifier, getTypeEffectiveness } from '#services/CombatService'
import type { CombatPokemon, CombatMove, StatBlock } from '#services/CombatService'
import type { Nature, PokemonType } from '@pokegrind/shared'

// ─── Types BF ───────────────────────────────────────────────────────────────

export type BfMode = 'tower' | 'factory' | 'arena'
export type ChallengeType =
  | 'standard'
  | 'monotype'
  | 'no_legendary'
  | 'legendary_only'
  | 'starters_only'
  | 'little_cup'
  | 'speed_demon'
  | 'no_items'

export interface BfRotationRules {
  tier_restriction: string[] | null
  challenge_type: ChallengeType
  rules_json: Record<string, unknown>
  mode: BfMode
}

export interface BfTeamMember {
  id: string
  species_id: number
  name_fr: string
  tier: string
  type1: PokemonType
  type2: PokemonType | null
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  level: number
  nature: Nature
  nature_mint_override?: Nature | null
  evolves_from_id: number | null   // null = stade 1
  base_speed: number
  base_hp: number
  base_atk: number
  base_def: number
  base_spatk: number
  base_spdef: number
  ivs: StatBlock
  moves: CombatMove[]
  is_shiny: boolean
  sprite_url: string
}

export interface BfValidationResult {
  valid: boolean
  errors: string[]
}

export interface CombatAction {
  attacker_id: string
  attacker_name: string
  move_name: string
  target_id: string
  target_name: string
  damage: number
  is_critical: boolean
  effectiveness: number
  remaining_hp: number
  max_hp: number
  ko: boolean
}

export interface BfBattleResult {
  result: 'win' | 'loss'
  streak_new: number
  pf_earned: number
  score_delta: number
  actions_replay: CombatAction[]
  factory_replacement?: BfTeamMember
  arena_judgment?: { player_hp_percent: number; enemy_hp_percent: number }
  duration_seconds: number
}

// ─── Starters (pour starters_only challenge) ────────────────────────────────

const STARTER_SPECIES_IDS = new Set([
  1, 4, 7,       // Gen 1
  152, 155, 158, // Gen 2
  252, 255, 258, // Gen 3
  387, 390, 393, // Gen 4
  495, 498, 501, // Gen 5
  650, 653, 656, // Gen 6
  722, 725, 728, // Gen 7
  810, 813, 816, // Gen 8
  906, 909, 912, // Gen 9
])

// ─── Validation d'équipe ─────────────────────────────────────────────────────

/**
 * Valide une équipe contre les règles d'une rotation BF.
 * Fonction pure — zéro effet de bord.
 */
export function validateTeamForRotation(
  team: BfTeamMember[],
  rules: BfRotationRules
): BfValidationResult {
  const errors: string[] = []

  if (team.length === 0) {
    errors.push("L'équipe est vide.")
    return { valid: false, errors }
  }

  // ── Tier restriction ────────────────────────────────────────────────────────
  if (rules.tier_restriction && rules.tier_restriction.length > 0) {
    for (const p of team) {
      if (!rules.tier_restriction.includes(p.tier)) {
        errors.push(
          `${p.name_fr} (tier ${p.tier}) n'est pas autorisé dans cette rotation (tiers : ${rules.tier_restriction.join(', ')}).`
        )
      }
    }
  }

  // ── Challenges spécifiques ──────────────────────────────────────────────────
  switch (rules.challenge_type) {
    case 'monotype': {
      const forced_type = rules.rules_json?.type_constraint as string | undefined
      if (forced_type && forced_type !== 'random') {
        // Type imposé
        const type = forced_type as PokemonType
        for (const p of team) {
          if (p.type1 !== type && p.type2 !== type) {
            errors.push(`${p.name_fr} n'est pas de type ${type} (requis pour ce challenge).`)
          }
        }
      } else {
        // Tous doivent partager au moins un type commun
        const type_sets = team.map(p => new Set([p.type1, p.type2].filter(Boolean) as PokemonType[]))
        const common = [...type_sets[0]].filter(t =>
          type_sets.every(s => s.has(t))
        )
        if (common.length === 0) {
          errors.push('Challenge Monotype : tous les Pokémon doivent partager au moins un type commun.')
        }
      }
      break
    }

    case 'no_legendary': {
      for (const p of team) {
        if (p.tier === 'S+') {
          errors.push(`${p.name_fr} est légendaire/mythique et interdit dans ce challenge.`)
        }
      }
      break
    }

    case 'legendary_only': {
      for (const p of team) {
        if (p.tier !== 'S+') {
          errors.push(`${p.name_fr} n'est pas légendaire/mythique (tier S+ requis).`)
        }
      }
      break
    }

    case 'starters_only': {
      for (const p of team) {
        // Accepter aussi les évolutions des starters (species_id > base mais evolves_from chain)
        if (!STARTER_SPECIES_IDS.has(p.species_id)) {
          errors.push(`${p.name_fr} n'est pas un starter (ni une évolution de starter reconnue).`)
        }
      }
      break
    }

    case 'little_cup': {
      for (const p of team) {
        if (p.evolves_from_id !== null) {
          errors.push(`${p.name_fr} est une évolution — seul le stade 1 est autorisé.`)
        }
      }
      break
    }

    case 'speed_demon': {
      for (const p of team) {
        if (p.base_speed < 100) {
          errors.push(`${p.name_fr} a une Vitesse de base de ${p.base_speed} (minimum 100 requis).`)
        }
      }
      break
    }
  }

  return { valid: errors.length === 0, errors }
}

// ─── Génération d'adversaires ─────────────────────────────────────────────────

/**
 * Crée un CombatPokemon BF depuis un BfTeamMember avec scaling de difficulté.
 */
export function buildBfCombatPokemon(
  member: BfTeamMember,
  difficulty_multiplier: number = 1
): CombatPokemon {
  const nature_used = member.nature_mint_override ?? member.nature

  const effective_hp    = calcHP(member.base_hp, member.ivs.hp, member.level)
  const effective_atk   = Math.floor(calcStat(member.base_atk,   member.ivs.atk,   member.level, getNatureModifier(nature_used, 'atk'))   * difficulty_multiplier)
  const effective_def   = Math.floor(calcStat(member.base_def,   member.ivs.def,   member.level, getNatureModifier(nature_used, 'def'))   * difficulty_multiplier)
  const effective_spatk = Math.floor(calcStat(member.base_spatk, member.ivs.spatk, member.level, getNatureModifier(nature_used, 'spatk')) * difficulty_multiplier)
  const effective_spdef = Math.floor(calcStat(member.base_spdef, member.ivs.spdef, member.level, getNatureModifier(nature_used, 'spdef')) * difficulty_multiplier)
  const effective_speed = Math.floor(calcStat(member.base_speed, member.ivs.speed, member.level, getNatureModifier(nature_used, 'speed')) * difficulty_multiplier)

  return {
    id: member.id,
    species_id: member.species_id,
    name_fr: member.name_fr,
    level: member.level,
    nature: nature_used,
    ivs: member.ivs,
    type1: member.type1,
    type2: member.type2,
    base_hp: member.base_hp,
    base_atk: member.base_atk,
    base_def: member.base_def,
    base_spatk: member.base_spatk,
    base_spdef: member.base_spdef,
    base_speed: member.base_speed,
    moves: member.moves,
    sprite_url: member.sprite_url,
    is_shiny: member.is_shiny,
    current_hp: effective_hp,
    max_hp: effective_hp,
    effective_atk,
    effective_def,
    effective_spatk,
    effective_spdef,
    effective_speed,
    status: null,
    confusion: null,
    stat_modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 },
    current_move_index: 0,
    pp_remaining: member.moves.map(m => m.pp),
    next_action_at: 0,
  }
}

/**
 * Calcule le multiplicateur de difficulté pour un streak donné en Tower.
 * +3% de stats par victoire.
 */
export function difficultyMultiplier(streak: number): number {
  return 1 + streak * 0.03
}

// ─── Moteur de combat BF (synchrone) ─────────────────────────────────────────

/**
 * Résout un combat BF instantanément côté serveur.
 * Retourne le résultat avec le replay des actions pour l'animation client.
 *
 * Le combat est résolu en tours — chaque tour le Pokémon avec la Vitesse
 * la plus élevée attaque en premier. Max 100 tours (si personne ne meurt).
 */
export function resolveBfBattle(
  player_team: BfTeamMember[],
  enemy_team: BfTeamMember[],
  current_streak: number,
  mode: BfMode
): BfBattleResult {
  const multiplier = difficultyMultiplier(current_streak)

  const player_combatants = player_team.map(m => buildBfCombatPokemon(m, 1))
  const enemy_combatants  = enemy_team.map(m => buildBfCombatPokemon(m, multiplier))

  const actions: CombatAction[] = []
  const start_time = Date.now()

  // Arena mode: max 3 actions per Pokémon
  const arena_action_counts: Map<string, number> = new Map()
  const MAX_ARENA_ACTIONS = mode === 'arena' ? 3 : Infinity

  let player_alive = player_combatants.filter(p => p.current_hp > 0)
  let enemy_alive  = enemy_combatants.filter(p => p.current_hp > 0)

  let turns = 0
  const MAX_TURNS = 100

  while (player_alive.length > 0 && enemy_alive.length > 0 && turns < MAX_TURNS) {
    turns++

    // Choisir l'attaquant actif (premier en vie de chaque équipe)
    const attacker_p = player_alive[0]
    const attacker_e = enemy_alive[0]

    // Trier par vitesse pour ce tour
    const acting_order: Array<{ pokemon: CombatPokemon; is_player: boolean }> =
      [
        { pokemon: attacker_p, is_player: true },
        { pokemon: attacker_e, is_player: false },
      ].sort((a, b) => b.pokemon.effective_speed - a.pokemon.effective_speed)

    for (const { pokemon: attacker, is_player } of acting_order) {
      if (attacker.current_hp <= 0) continue

      const defenders = is_player ? enemy_alive : player_alive
      const defender = defenders.find(d => d.current_hp > 0)
      if (!defender) break

      // Arena: limite d'actions
      const actions_count = arena_action_counts.get(attacker.id) ?? 0
      if (mode === 'arena' && actions_count >= MAX_ARENA_ACTIONS) continue
      arena_action_counts.set(attacker.id, actions_count + 1)

      // Choisir le move (rotatif, priorité au move avec PP)
      const move = pickMove(attacker)
      if (!move) continue

      const result = calcDamage(attacker, defender, move)
      const actual_damage = Math.min(result.damage, defender.current_hp)
      defender.current_hp = Math.max(0, defender.current_hp - actual_damage)

      actions.push({
        attacker_id: attacker.id,
        attacker_name: attacker.name_fr,
        move_name: move.name_fr,
        target_id: defender.id,
        target_name: defender.name_fr,
        damage: actual_damage,
        is_critical: result.is_critical,
        effectiveness: result.effectiveness,
        remaining_hp: defender.current_hp,
        max_hp: defender.max_hp,
        ko: defender.current_hp === 0,
      })

      if (defender.current_hp === 0) {
        player_alive = player_combatants.filter(p => p.current_hp > 0)
        enemy_alive  = enemy_combatants.filter(p => p.current_hp > 0)
        if (player_alive.length === 0 || enemy_alive.length === 0) break
      }
    }
  }

  // Déterminer le résultat
  let result: 'win' | 'loss'

  if (mode === 'arena' && turns >= MAX_TURNS) {
    // Jugement Arena : HP restants
    const player_total_hp = player_combatants.reduce((s, p) => s + p.current_hp, 0)
    const player_max_hp   = player_combatants.reduce((s, p) => s + p.max_hp, 0)
    const enemy_total_hp  = enemy_combatants.reduce((s, p) => s + p.current_hp, 0)
    const enemy_max_hp    = enemy_combatants.reduce((s, p) => s + p.max_hp, 0)
    const player_pct = player_max_hp > 0 ? player_total_hp / player_max_hp : 0
    const enemy_pct  = enemy_max_hp  > 0 ? enemy_total_hp  / enemy_max_hp  : 0
    result = player_pct >= enemy_pct ? 'win' : 'loss'

    const new_streak = result === 'win' ? current_streak + 1 : 0
    const pf = calcPfEarned(result, new_streak, mode)

    return {
      result,
      streak_new: new_streak,
      pf_earned: pf,
      score_delta: pf,
      actions_replay: actions,
      arena_judgment: {
        player_hp_percent: Math.round(player_pct * 100),
        enemy_hp_percent:  Math.round(enemy_pct  * 100),
      },
      duration_seconds: Math.round((Date.now() - start_time) / 1000),
    }
  }

  result = enemy_alive.length === 0 ? 'win' : 'loss'
  const new_streak = result === 'win' ? current_streak + 1 : 0
  const pf = calcPfEarned(result, new_streak, mode)

  return {
    result,
    streak_new: new_streak,
    pf_earned: pf,
    score_delta: pf,
    actions_replay: actions,
    duration_seconds: Math.round((Date.now() - start_time) / 1000),
  }
}

/**
 * Choisit le prochain move d'un Pokémon (rotatif, ignore les moves sans PP).
 */
function pickMove(pokemon: CombatPokemon): CombatMove | null {
  const moves = pokemon.moves
  if (moves.length === 0) return null

  for (let i = 0; i < moves.length; i++) {
    const idx = (pokemon.current_move_index + i) % moves.length
    if (pokemon.pp_remaining[idx] > 0 && moves[idx].power) {
      pokemon.current_move_index = (idx + 1) % moves.length
      pokemon.pp_remaining[idx]--
      return moves[idx]
    }
  }
  // Aucun move avec PP et power — retourner le premier quand même (Lutte)
  const first_idx = pokemon.current_move_index % moves.length
  pokemon.current_move_index = (first_idx + 1) % moves.length
  return moves[first_idx] ?? null
}

/**
 * Calcule les PF gagnés après un combat.
 */
export function calcPfEarned(result: 'win' | 'loss', new_streak: number, mode: BfMode): number {
  if (result === 'loss') return 0
  const base = mode === 'tower' ? 10 : mode === 'factory' ? 12 : 15
  return base + Math.floor(new_streak * 2)
}

// ─── Distribution de récompenses ─────────────────────────────────────────────

export interface RewardEntry {
  player_id: string
  rank: number
  score: number
  pf_bonus: number
  gems_bonus: number
}

/**
 * Calcule les récompenses de fin de rotation.
 * Retourne un tableau des entrées avec les bonus calculés.
 */
export function calcRotationRewards(
  leaderboard: Array<{ player_id: string; score: number }>
): RewardEntry[] {
  return leaderboard.map((entry, i) => {
    const rank = i + 1
    const pf_bonus = Math.floor(entry.score * 0.1)
    const gems_bonus = rank <= 10 ? 5 : rank <= 100 ? 2 : 0
    return { ...entry, rank, pf_bonus, gems_bonus }
  })
}

// ─── Noms de rotation ────────────────────────────────────────────────────────

const MODE_NAMES: Record<BfMode, string> = {
  tower:   'Battle Tower',
  factory: 'Battle Factory',
  arena:   'Battle Arena',
}

const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  standard:       'Standard',
  monotype:       'Monotype',
  no_legendary:   'Sans Légendaires',
  legendary_only: 'Légendaires Seulement',
  starters_only:  'Starters Uniquement',
  little_cup:     'Little Cup',
  speed_demon:    'Speed Demon',
  no_items:       'Sans Objets',
}

export function generateRotationName(mode: BfMode, challenge: ChallengeType): string {
  const m = MODE_NAMES[mode] ?? mode
  const c = CHALLENGE_NAMES[challenge] ?? challenge
  return c === 'Standard' ? m : `${m} — ${c}`
}

export const CHALLENGE_POOL: Array<{
  type: ChallengeType
  tier_restriction: string[] | null
  rules: Record<string, unknown>
}> = [
  { type: 'monotype',        tier_restriction: null,                        rules: { type_constraint: 'random' } },
  { type: 'no_legendary',    tier_restriction: ['D','C','B','A','S'],       rules: {} },
  { type: 'legendary_only',  tier_restriction: ['S+'],                      rules: {} },
  { type: 'starters_only',   tier_restriction: null,                        rules: { species_pool: 'starters' } },
  { type: 'little_cup',      tier_restriction: null,                        rules: { evolution_stage: 1 } },
  { type: 'speed_demon',     tier_restriction: null,                        rules: { min_speed: 100 } },
  { type: 'no_items',        tier_restriction: null,                        rules: { items_forbidden: true } },
  { type: 'standard',        tier_restriction: null,                        rules: {} },
]
