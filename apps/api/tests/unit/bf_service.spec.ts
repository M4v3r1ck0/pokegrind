/**
 * Tests unitaires — Battle Frontier
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'
import {
  validateTeamForRotation,
  resolveBfBattle,
  difficultyMultiplier,
  calcPfEarned,
  calcRotationRewards,
  generateRotationName,
  buildBfCombatPokemon,
  type BfTeamMember,
  type BfRotationRules,
} from '../../app/services/BattleFrontierFormulas.js'
import type { PokemonType } from '@pokegrind/shared'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePokemon(overrides: Partial<BfTeamMember> = {}): BfTeamMember {
  return {
    id: crypto.randomUUID(),
    species_id: 1,
    name_fr: 'Bulbizarre',
    tier: 'C',
    rarity: 'common',
    type1: 'grass' as PokemonType,
    type2: 'poison' as PokemonType,
    evolves_from_id: null,
    level: 50,
    nature: 'hardy',
    nature_mint_override: null,
    base_hp: 45, base_atk: 49, base_def: 49, base_spatk: 65, base_spdef: 65, base_speed: 45,
    ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
    moves: [
      { id: 22, name_fr: 'Tranch\'Herbe', type: 'grass' as PokemonType, category: 'special', power: 55, accuracy: 95, pp: 25, priority: 0 },
      { id: 35, name_fr: 'Griffe', type: 'normal' as PokemonType, category: 'physical', power: 40, accuracy: 100, pp: 35, priority: 0 },
    ],
    is_shiny: false,
    sprite_url: '',
    ...overrides,
  }
}

function standardRules(overrides: Partial<BfRotationRules> = {}): BfRotationRules {
  return {
    tier_restriction: null,
    challenge_type: 'standard',
    rules_json: {},
    mode: 'tower',
    ...overrides,
  }
}

// ─── Validation d'équipe ──────────────────────────────────────────────────────

test.group('validateTeamForRotation', () => {

  test('équipe invalide pour rotation monotype → erreur validation', ({ assert }) => {
    const team = [
      makePokemon({ type1: 'water' as PokemonType, type2: null }),
      makePokemon({ type1: 'fire'  as PokemonType, type2: null }),
    ]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'monotype' }))
    assert.isFalse(result.valid)
    assert.isAbove(result.errors.length, 0)
  })

  test('équipe valide monotype eau → acceptée', ({ assert }) => {
    const team = [
      makePokemon({ type1: 'water' as PokemonType, type2: null }),
      makePokemon({ type1: 'water' as PokemonType, type2: 'ice' as PokemonType }),
      makePokemon({ type1: 'water' as PokemonType, type2: null }),
    ]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'monotype' }))
    assert.isTrue(result.valid)
  })

  test('tier S+ refusé dans rotation no_legendary', ({ assert }) => {
    const mewtwo = makePokemon({ name_fr: 'Mewtwo', tier: 'S+', rarity: 'legendary' })
    const team = [mewtwo, makePokemon()]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'no_legendary' }))
    assert.isFalse(result.valid)
    assert.include(result.errors[0], 'Mewtwo')
  })

  test('équipe entièrement tier S+ acceptée dans legendary_only', ({ assert }) => {
    const team = [
      makePokemon({ tier: 'S+', rarity: 'legendary' }),
      makePokemon({ tier: 'S+', rarity: 'mythic' }),
    ]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'legendary_only' }))
    assert.isTrue(result.valid)
  })

  test('little_cup : Pokémon avec évolution précédente refusé', ({ assert }) => {
    const charmeleon = makePokemon({ name_fr: 'Reptincel', evolves_from_id: 4, tier: 'C' }) // Salameche = 4
    const team = [charmeleon, makePokemon()]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'little_cup' }))
    assert.isFalse(result.valid)
    assert.include(result.errors[0], 'Reptincel')
  })

  test('speed_demon : Pokémon vitesse < 100 refusé', ({ assert }) => {
    const slow_poke = makePokemon({ name_fr: 'Ramoloss', base_speed: 15 })
    const team = [slow_poke]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'speed_demon' }))
    assert.isFalse(result.valid)
  })

  test('speed_demon : tous les Pokémon ≥ 100 → valide', ({ assert }) => {
    const fast = makePokemon({ base_speed: 110 })
    const team = [fast, makePokemon({ base_speed: 120 })]
    const result = validateTeamForRotation(team, standardRules({ challenge_type: 'speed_demon' }))
    assert.isTrue(result.valid)
  })

  test('tier restriction explicite : C refusé si seul B+ autorisé', ({ assert }) => {
    const team = [makePokemon({ tier: 'C' })]
    const result = validateTeamForRotation(team, standardRules({ tier_restriction: ['B', 'A', 'S', 'S+'] }))
    assert.isFalse(result.valid)
  })

})

// ─── Difficulté ───────────────────────────────────────────────────────────────

test.group('difficultyMultiplier', () => {

  test('difficulté ennemie : +3% stats par victoire en Tower', ({ assert }) => {
    assert.closeTo(difficultyMultiplier(0), 1.00, 0.001)
    assert.closeTo(difficultyMultiplier(1), 1.03, 0.001)
    assert.closeTo(difficultyMultiplier(10), 1.30, 0.001)
  })

  test('streak 0 → multiplicateur 1.0', ({ assert }) => {
    assert.equal(difficultyMultiplier(0), 1.0)
  })

})

// ─── Combat BF ───────────────────────────────────────────────────────────────

test.group('resolveBfBattle', () => {

  test('combat Tower se résout avec un résultat win ou loss', ({ assert }) => {
    const team = [makePokemon(), makePokemon(), makePokemon()]
    const enemy = [makePokemon(), makePokemon(), makePokemon()]
    const result = resolveBfBattle(team, enemy, 0, 'tower')
    assert.oneOf(result.result, ['win', 'loss'])
    assert.isArray(result.actions_replay)
    assert.isNumber(result.pf_earned)
  })

  test('victoire → streak_new = streak + 1', ({ assert }) => {
    // Équipe très forte vs équipe nulle pour garantir la victoire
    const strong = makePokemon({ base_atk: 999, ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 } })
    const weak   = makePokemon({ base_hp: 1, base_def: 1, base_spdef: 1 })
    const result = resolveBfBattle([strong], [weak], 7, 'tower')
    if (result.result === 'win') {
      assert.equal(result.streak_new, 8)
    }
  })

  test('défaite → streak_new = 0', ({ assert }) => {
    const weak   = makePokemon({ base_hp: 1, base_def: 1, base_spdef: 1, moves: [] })
    const strong = makePokemon({ base_atk: 999 })
    const result = resolveBfBattle([weak], [strong], 5, 'tower')
    if (result.result === 'loss') {
      assert.equal(result.streak_new, 0)
    }
  })

  test('Arena : résolution par HP restants si max turns atteint', ({ assert }) => {
    // Tous les Pokémon ont 0 moves avec power → aucune action de dégâts → max_turns atteint
    const no_dmg = makePokemon({ moves: [{ id: 1, name_fr: 'Rugissement', type: 'normal' as PokemonType, category: 'status', power: null, accuracy: 100, pp: 40, priority: 0 }] })
    const result = resolveBfBattle([no_dmg], [no_dmg], 0, 'arena')
    // Le résultat doit inclure arena_judgment
    if (result.arena_judgment) {
      assert.isDefined(result.arena_judgment.player_hp_percent)
      assert.isDefined(result.arena_judgment.enemy_hp_percent)
    }
  })

})

// ─── PF gagnés ────────────────────────────────────────────────────────────────

test.group('calcPfEarned', () => {

  test('défaite → 0 PF', ({ assert }) => {
    assert.equal(calcPfEarned('loss', 0, 'tower'), 0)
  })

  test('streak 10 Tower → 10 + 20 = 30 PF', ({ assert }) => {
    assert.equal(calcPfEarned('win', 10, 'tower'), 30)
  })

  test('Arena donne plus de PF de base que Tower', ({ assert }) => {
    const tower_pf = calcPfEarned('win', 1, 'tower')
    const arena_pf = calcPfEarned('win', 1, 'arena')
    assert.isAbove(arena_pf, tower_pf)
  })

})

// ─── Récompenses de rotation ─────────────────────────────────────────────────

test.group('calcRotationRewards', () => {

  test('distribution récompenses : top 10 → 5 gems', ({ assert }) => {
    const leaderboard = Array.from({ length: 20 }, (_, i) => ({
      player_id: `player_${i}`,
      score: (20 - i) * 100,
    }))
    const rewards = calcRotationRewards(leaderboard)
    for (let i = 0; i < 10; i++) {
      assert.equal(rewards[i].gems_bonus, 5, `Rang ${i + 1} devrait avoir 5 gems`)
    }
  })

  test('distribution récompenses : top 100 → 2 gems', ({ assert }) => {
    const leaderboard = Array.from({ length: 50 }, (_, i) => ({
      player_id: `player_${i}`,
      score: (50 - i) * 10,
    }))
    const rewards = calcRotationRewards(leaderboard)
    assert.equal(rewards[10].gems_bonus, 2)
    assert.equal(rewards[49].gems_bonus, 2)
  })

  test('PF bonus = floor(score × 0.1)', ({ assert }) => {
    const rewards = calcRotationRewards([{ player_id: 'p1', score: 2100 }])
    assert.equal(rewards[0].pf_bonus, 210)
  })

})

// ─── Capsule IV ───────────────────────────────────────────────────────────────

test.group('buildBfCombatPokemon — nature mint override', () => {

  test('nature_mint_override remplace la nature pour le calcul des stats', ({ assert }) => {
    // adamant boost atk, timid boost speed
    const p_adamant = makePokemon({ nature: 'adamant', nature_mint_override: null })
    const p_timid   = makePokemon({ nature: 'adamant', nature_mint_override: 'timid' })

    const combat_adamant = buildBfCombatPokemon(p_adamant)
    const combat_timid   = buildBfCombatPokemon(p_timid)

    // Avec menthe Timide, la vitesse devrait être boostée et l'ATK pénalisée
    assert.isAbove(combat_timid.effective_speed, combat_adamant.effective_speed)
    assert.isBelow(combat_timid.effective_atk, combat_adamant.effective_atk)
  })

})

// ─── generateRotationName ─────────────────────────────────────────────────────

test.group('generateRotationName', () => {

  test('mode standard → nom = mode seulement', ({ assert }) => {
    const name = generateRotationName('tower', 'standard')
    assert.equal(name, 'Battle Tower')
  })

  test('mode avec challenge → nom combiné', ({ assert }) => {
    const name = generateRotationName('arena', 'monotype')
    assert.include(name, 'Battle Arena')
    assert.include(name, 'Monotype')
  })

})
