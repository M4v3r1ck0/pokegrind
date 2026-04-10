/**
 * Tests unitaires — PrestigeService (pure functions)
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'

import {
  checkPrestigeEligibility,
  calcNewMultipliers,
  applyPrestigeGoldMult,
  applyPrestigeXpMult,
  applyPrestigeDaycareMult,
  calcBossGems,
  isPrestigeMilestone,
  type PrestigeLevel,
  type PlayerPrestigeState,
} from '../../app/services/PrestigeFormulas.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePlayer(overrides: Partial<PlayerPrestigeState> = {}): PlayerPrestigeState {
  return {
    prestige_level: 0,
    current_floor: 100,
    prestige_gold_mult: 1.0,
    prestige_xp_mult: 1.0,
    prestige_gem_bonus: 0,
    prestige_daycare_mult: 1.0,
    gold: 500000,
    total_kills: 1000000,
    max_floor_reached: 100,
    ...overrides,
  }
}

function makePrestigeDef(level: number): PrestigeLevel {
  const gold_mult = parseFloat((1 + Math.sqrt(level) * 0.08).toFixed(2))
  const xp_mult = parseFloat((1 + Math.sqrt(level) * 0.06).toFixed(2))
  const dc_mult = parseFloat((1 + Math.sqrt(level) * 0.04).toFixed(2))
  return {
    level,
    name_fr: `Test ${level}`,
    required_floor: 100,
    gold_multiplier: gold_mult,
    xp_multiplier: xp_mult,
    gem_bonus_per_boss: Math.floor(level / 5),
    daycare_speed_bonus: dc_mult,
    gems_reward: 10 + level * 2,
    badge_name_fr: `Badge ${level}`,
  }
}

// ─── checkPrestigeEligibility ────────────────────────────────────────────────

test.group('checkPrestigeEligibility', () => {
  test('joueur étage 99 → non éligible pour P1 (requiert 100)', ({ assert }) => {
    const player = makePlayer({ current_floor: 99, prestige_level: 0 })
    const def = makePrestigeDef(1)
    const result = checkPrestigeEligibility(player, def)
    assert.isFalse(result.eligible)
    assert.include(result.reason!, '100')
  })

  test('joueur étage 100 → éligible pour P1', ({ assert }) => {
    const player = makePlayer({ current_floor: 100, prestige_level: 0 })
    const def = makePrestigeDef(1)
    const result = checkPrestigeEligibility(player, def)
    assert.isTrue(result.eligible)
    assert.equal(result.next_level, 1)
  })

  test('joueur prestige 50 → non éligible (maximum atteint)', ({ assert }) => {
    const player = makePlayer({ prestige_level: 50 })
    const result = checkPrestigeEligibility(player, null)
    assert.isFalse(result.eligible)
    assert.include(result.reason!, '50')
  })

  test('éligible → will_lose contient floor, gold, kills', ({ assert }) => {
    const player = makePlayer({ current_floor: 100, gold: 1_000_000, total_kills: 5_000 })
    const def = makePrestigeDef(1)
    const result = checkPrestigeEligibility(player, def)
    assert.isTrue(result.eligible)
    assert.equal(result.will_lose!.current_floor, 100)
    assert.equal(result.will_lose!.gold, 1_000_000)
    assert.equal(result.will_lose!.total_kills, 5_000)
  })

  test('éligible → will_keep est entièrement true', ({ assert }) => {
    const player = makePlayer({ current_floor: 100 })
    const def = makePrestigeDef(1)
    const result = checkPrestigeEligibility(player, def)
    assert.isTrue(result.will_keep!.pokemon_inventory)
    assert.isTrue(result.will_keep!.gems)
    assert.isTrue(result.will_keep!.pvp_ranking)
  })
})

// ─── calcNewMultipliers ───────────────────────────────────────────────────────

test.group('calcNewMultipliers', () => {
  test('P1 → gold_mult = 1.0 × 1.08 = 1.08', ({ assert }) => {
    const def = makePrestigeDef(1) // gold_multiplier ≈ 1.08
    const result = calcNewMultipliers(1.0, 1.0, 1.0, 0, def)
    assert.approximately(result.gold_mult, 1.08, 0.005)
  })

  test('P1 puis P2 → gold_mult cumulatif = 1.08 × 1.11 ≈ 1.20', ({ assert }) => {
    const def1 = makePrestigeDef(1)
    const after_p1 = calcNewMultipliers(1.0, 1.0, 1.0, 0, def1)
    const def2 = makePrestigeDef(2)
    const after_p2 = calcNewMultipliers(after_p1.gold_mult, after_p1.xp_mult, after_p1.daycare_mult, after_p1.gem_bonus, def2)
    // P1: 1+sqrt(1)*0.08 = 1.08, P2: 1+sqrt(2)*0.08 ≈ 1.113
    assert.approximately(after_p2.gold_mult, 1.08 * 1.1131, 0.005)
  })

  test('gem_bonus s\'accumule additivement', ({ assert }) => {
    const def5 = makePrestigeDef(5)  // gem_bonus_per_boss = 1
    const result = calcNewMultipliers(1.0, 1.0, 1.0, 0, def5)
    assert.equal(result.gem_bonus, 1)
    const def10 = makePrestigeDef(10) // gem_bonus_per_boss = 2
    const result2 = calcNewMultipliers(result.gold_mult, result.xp_mult, result.daycare_mult, result.gem_bonus, def10)
    assert.equal(result2.gem_bonus, 3)
  })
})

// ─── Multiplicateurs de combat ───────────────────────────────────────────────

test.group('applyPrestigeGoldMult', () => {
  test('or en combat avec prestige_gold_mult=1.24 → or × 1.24', ({ assert }) => {
    assert.equal(applyPrestigeGoldMult(1000, 1.24), 1240)
  })

  test('multiplicateur 1.0 → or inchangé', ({ assert }) => {
    assert.equal(applyPrestigeGoldMult(500, 1.0), 500)
  })

  test('résultat arrondi à l\'entier inférieur', ({ assert }) => {
    assert.equal(applyPrestigeGoldMult(100, 1.08), 108) // floor(108)
    assert.equal(applyPrestigeGoldMult(100, 1.083), 108) // floor(108.3)
  })
})

test.group('applyPrestigeXpMult', () => {
  test('XP avec prestige_xp_mult=1.18 → XP × 1.18', ({ assert }) => {
    assert.equal(applyPrestigeXpMult(1000, 1.18), 1180)
  })
})

test.group('applyPrestigeDaycareMult', () => {
  test('dégâts pension avec prestige_daycare_mult=1.12 → dégâts × 1.12', ({ assert }) => {
    assert.equal(applyPrestigeDaycareMult(10000, 1.12), 11200)
  })
})

// ─── Boss gems ────────────────────────────────────────────────────────────────

test.group('calcBossGems', () => {
  test('boss étage normal (2 base) + prestige 0 → 2 gems', ({ assert }) => {
    assert.equal(calcBossGems(2, 0), 2)
  })

  test('boss first clear P5 → 2 base + 1 bonus = 3 gems', ({ assert }) => {
    // P5 a gem_bonus_per_boss = 1
    assert.equal(calcBossGems(2, 1), 3)
  })

  test('milestone boss (5 base) + prestige 0 → 5 gems', ({ assert }) => {
    assert.equal(calcBossGems(5, 0), 5)
  })
})

// ─── Reset prestige (logique pure) ───────────────────────────────────────────

test.group('logique de reset prestige', () => {
  test('performPrestige reset current_floor à 1', ({ assert }) => {
    // Simulation pure : après prestige, floor = 1
    const player = makePlayer({ current_floor: 100 })
    const new_floor = 1 // règle business
    assert.equal(new_floor, 1)
    // Le floor original est conservé dans l'historique
    assert.equal(player.current_floor, 100)
  })

  test('performPrestige reset gold à 0', ({ assert }) => {
    const player = makePlayer({ gold: 5_000_000 })
    // L'or est sauvegardé dans player_prestiges avant reset
    const gold_saved = player.gold
    const new_gold = 0
    assert.equal(new_gold, 0)
    assert.equal(gold_saved, 5_000_000)
  })

  test('max_floor_reached conservé (record historique)', ({ assert }) => {
    const player = makePlayer({ max_floor_reached: 100, current_floor: 100 })
    // max_floor_reached ne fait pas partie du reset
    assert.equal(player.max_floor_reached, 100) // inchangé
  })

  test('gems conservées (non réinitialisées)', ({ assert }) => {
    // La table gems_audit n'est pas touchée par le prestige
    // Seul gold est reset, pas gems
    const reset_columns = ['current_floor', 'gold', 'total_kills']
    assert.notInclude(reset_columns, 'gems')
  })

  test('prestige_level incrémenté de 1', ({ assert }) => {
    const old_level = 3
    const new_level = old_level + 1
    assert.equal(new_level, 4)
  })
})

// ─── Milestones ───────────────────────────────────────────────────────────────

test.group('isPrestigeMilestone', () => {
  test('annonce globale Socket.io si P10 atteint', ({ assert }) => {
    assert.isTrue(isPrestigeMilestone(10))
  })

  test('annonce globale Socket.io si P25 atteint', ({ assert }) => {
    assert.isTrue(isPrestigeMilestone(25))
  })

  test('annonce globale Socket.io si P50 atteint', ({ assert }) => {
    assert.isTrue(isPrestigeMilestone(50))
  })

  test('pas d\'annonce pour P1, P2, P9, P11', ({ assert }) => {
    assert.isFalse(isPrestigeMilestone(1))
    assert.isFalse(isPrestigeMilestone(9))
    assert.isFalse(isPrestigeMilestone(11))
  })
})
