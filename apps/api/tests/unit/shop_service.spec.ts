/**
 * Tests unitaires — ShopFormulas (fonctions pures boutique & gems)
 * Exécuter : node --import=tsx/esm tests/unit/run.ts
 */
import { test } from '@japa/runner'
import {
  validatePurchase,
  checkKillMilestone,
  calcMaxDaycareSlots,
  calcLegendaryPity,
  isValidGemSource,
  KILL_MILESTONES,
  GEM_AMOUNTS,
  DEFAULT_DAYCARE_SLOTS,
  DEFAULT_LEGENDARY_PITY,
  REDUCED_LEGENDARY_PITY,
  type UpgradeSnapshot,
} from '../../app/services/ShopFormulas.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeUpgrade(overrides: Partial<UpgradeSnapshot> = {}): UpgradeSnapshot {
  return {
    id: 1,
    cost_gems: 50,
    name_fr: 'Test upgrade',
    effect_type: 'daycare_slot',
    requires_upgrade_id: null,
    category: 'pension',
    ...overrides,
  }
}

// ─── validatePurchase ────────────────────────────────────────────────────────

test.group('validatePurchase', () => {
  test('achat valide si gems suffisants, pas de prérequis, pas déjà acheté', ({ assert }) => {
    const result = validatePurchase(makeUpgrade({ cost_gems: 50 }), 100, false, true)
    assert.isTrue(result.valid)
    assert.isUndefined(result.error)
  })

  test('achat impossible si gems insuffisants', ({ assert }) => {
    const result = validatePurchase(makeUpgrade({ cost_gems: 100 }), 50, false, true)
    assert.isFalse(result.valid)
    assert.include(result.error!, 'insuffisants')
    assert.include(result.error!, '50')
    assert.include(result.error!, '100')
  })

  test('achat impossible si déjà acheté', ({ assert }) => {
    const result = validatePurchase(makeUpgrade({ cost_gems: 10 }), 500, true, true)
    assert.isFalse(result.valid)
    assert.include(result.error!, 'déjà')
  })

  test('achat impossible si prérequis non satisfait', ({ assert }) => {
    const result = validatePurchase(
      makeUpgrade({ cost_gems: 50, requires_upgrade_id: 3 }),
      500,
      false,
      false
    )
    assert.isFalse(result.valid)
    assert.include(result.error!, 'Prérequis')
  })

  test('achat valide si prérequis null (pas de prérequis requis)', ({ assert }) => {
    const result = validatePurchase(
      makeUpgrade({ cost_gems: 50, requires_upgrade_id: null }),
      500,
      false,
      false // has_prerequisite false mais requires_upgrade_id est null → ignoré
    )
    assert.isTrue(result.valid)
  })

  test('already_purchased est vérifié avant gems insuffisants', ({ assert }) => {
    const result = validatePurchase(makeUpgrade({ cost_gems: 999 }), 0, true, true)
    assert.isFalse(result.valid)
    assert.include(result.error!, 'déjà')
  })

  test('achat exact (gems = cost) est valide', ({ assert }) => {
    const result = validatePurchase(makeUpgrade({ cost_gems: 50 }), 50, false, true)
    assert.isTrue(result.valid)
  })
})

// ─── checkKillMilestone ──────────────────────────────────────────────────────

test.group('checkKillMilestone', () => {
  test('milestone 100K kills détecté lors du franchissement', ({ assert }) => {
    const milestone = checkKillMilestone(99_999, 1)
    assert.equal(milestone, 100_000)
  })

  test('milestone 100K kills → 5 gems définis dans GEM_AMOUNTS', ({ assert }) => {
    assert.equal(GEM_AMOUNTS.kills_milestone, 5)
  })

  test('milestone 100K kills → pas attribué 2 fois (total déjà >= milestone)', ({ assert }) => {
    // Si on était déjà à 100K, on ne redéclenche pas
    const milestone = checkKillMilestone(100_000, 1)
    assert.isNull(milestone)
  })

  test('milestone 500K kills détecté', ({ assert }) => {
    const milestone = checkKillMilestone(499_990, 15)
    assert.equal(milestone, 500_000)
  })

  test('milestone 1M kills détecté', ({ assert }) => {
    const milestone = checkKillMilestone(999_999, 2)
    assert.equal(milestone, 1_000_000)
  })

  test('milestone 5M kills détecté', ({ assert }) => {
    const milestone = checkKillMilestone(4_999_990, 20)
    assert.equal(milestone, 5_000_000)
  })

  test('milestone 10M kills détecté', ({ assert }) => {
    const milestone = checkKillMilestone(9_999_990, 20)
    assert.equal(milestone, 10_000_000)
  })

  test('milestone 50M kills détecté', ({ assert }) => {
    const milestone = checkKillMilestone(49_999_990, 20)
    assert.equal(milestone, 50_000_000)
  })

  test('aucun milestone si kills loin du seuil', ({ assert }) => {
    const milestone = checkKillMilestone(50_000, 100)
    assert.isNull(milestone)
  })

  test('KILL_MILESTONES contient 6 paliers', ({ assert }) => {
    assert.lengthOf(KILL_MILESTONES, 6)
  })
})

// ─── calcMaxDaycareSlots ─────────────────────────────────────────────────────

test.group('calcMaxDaycareSlots', () => {
  test('sans upgrade = 5 slots par défaut', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([]), DEFAULT_DAYCARE_SLOTS)
    assert.equal(DEFAULT_DAYCARE_SLOTS, 5)
  })

  test('avec upgrade id:1 = 6 slots', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([1]), 6)
  })

  test('avec upgrade id:2 = 7 slots', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([1, 2]), 7)
  })

  test('avec upgrade id:4 = 8 slots', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([1, 2, 4]), 8)
  })

  test('avec upgrade id:6 = 9 slots', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([1, 2, 4, 6]), 9)
  })

  test('avec upgrade id:7 = 10 slots (maximum)', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([1, 2, 4, 6, 7]), 10)
  })

  test('upgrade inconnue est ignorée', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([999]), DEFAULT_DAYCARE_SLOTS)
  })

  test('ordre des upgrades ne change pas le résultat (max)', ({ assert }) => {
    assert.equal(calcMaxDaycareSlots([7, 1, 4]), 10)
  })
})

// ─── calcLegendaryPity ───────────────────────────────────────────────────────

test.group('calcLegendaryPity', () => {
  test('sans upgrade pity = 200 pulls par défaut', ({ assert }) => {
    assert.equal(calcLegendaryPity([]), DEFAULT_LEGENDARY_PITY)
    assert.equal(DEFAULT_LEGENDARY_PITY, 200)
  })

  test('avec upgrade pity_legendary = 180 pulls', ({ assert }) => {
    assert.equal(calcLegendaryPity(['pity_legendary']), REDUCED_LEGENDARY_PITY)
    assert.equal(REDUCED_LEGENDARY_PITY, 180)
  })

  test('autres effect_types n\'affectent pas le pity', ({ assert }) => {
    assert.equal(calcLegendaryPity(['daycare_slot', 'move_5_slot']), DEFAULT_LEGENDARY_PITY)
  })

  test('pity_legendary parmi d\'autres upgrades réduit le pity', ({ assert }) => {
    assert.equal(calcLegendaryPity(['daycare_slot', 'pity_legendary', 'move_5_slot']), REDUCED_LEGENDARY_PITY)
  })
})

// ─── Sources gems ────────────────────────────────────────────────────────────

test.group('Sources gems', () => {
  test('boss 1ère fois → 2 gems définis dans GEM_AMOUNTS', ({ assert }) => {
    assert.equal(GEM_AMOUNTS.boss_first_clear, 2)
  })

  test('région complète → 10 gems définis dans GEM_AMOUNTS', ({ assert }) => {
    assert.equal(GEM_AMOUNTS.region_complete, 10)
  })

  test('pokédex gen complet → 15 gems définis dans GEM_AMOUNTS', ({ assert }) => {
    assert.equal(GEM_AMOUNTS.pokedex_gen_complete, 15)
  })

  test('BF top10 → 5 gems définis dans GEM_AMOUNTS', ({ assert }) => {
    assert.equal(GEM_AMOUNTS.bf_top10, 5)
  })

  test('isValidGemSource accepte les sources connues', ({ assert }) => {
    assert.isTrue(isValidGemSource('boss_first_clear'))
    assert.isTrue(isValidGemSource('region_complete'))
    assert.isTrue(isValidGemSource('kills_milestone'))
    assert.isTrue(isValidGemSource('shop_purchase'))
  })

  test('isValidGemSource rejette les sources inconnues', ({ assert }) => {
    assert.isFalse(isValidGemSource('cheat_code'))
    assert.isFalse(isValidGemSource(''))
    assert.isFalse(isValidGemSource('BOSS_FIRST_CLEAR'))
  })
})
