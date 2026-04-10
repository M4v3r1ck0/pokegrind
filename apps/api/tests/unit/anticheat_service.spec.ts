/**
 * Tests unitaires — AnticheatService & EventService (pure functions)
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'

import {
  calcTheoreticalMaxDPS,
  calcTheoreticalMaxKills,
  isDpsAnomaly,
  isKillRateAnomaly,
  isGemsAnomaly,
} from '../../app/services/AnticheatFormulas.js'

import {
  applyGemBoost,
  applyXpBoost,
  calcShinyRate,
  isMaintenanceActive,
  type EventConfig,
} from '../../app/services/EventFormulas.js'

// ─── AnticheatService — pure functions ────────────────────────────────────────

test.group('calcTheoreticalMaxDPS', () => {
  test('returns a positive DPS for level 50', ({ assert }) => {
    const dps = calcTheoreticalMaxDPS(50)
    assert.isAbove(dps, 0)
  })

  test('DPS scales with level', ({ assert }) => {
    const dps_10 = calcTheoreticalMaxDPS(10)
    const dps_100 = calcTheoreticalMaxDPS(100)
    assert.isAbove(dps_100, dps_10)
  })

  test('DPS at level 50 is reasonable (between 1000 and 500000/s)', ({ assert }) => {
    const dps = calcTheoreticalMaxDPS(50)
    assert.isAbove(dps, 1000)
    assert.isBelow(dps, 500000)
  })
})

test.group('isDpsAnomaly', () => {
  test('DPS 4× max théorique → anomalie', ({ assert }) => {
    const level = 50
    const max = calcTheoreticalMaxDPS(level)
    assert.isTrue(isDpsAnomaly(max * 4, level))
  })

  test('DPS 2× max théorique → pas d\'anomalie', ({ assert }) => {
    const level = 50
    const max = calcTheoreticalMaxDPS(level)
    assert.isFalse(isDpsAnomaly(max * 2, level))
  })

  test('DPS exactement 3× max → anomalie (seuil strict)', ({ assert }) => {
    const level = 50
    const max = calcTheoreticalMaxDPS(level)
    assert.isFalse(isDpsAnomaly(max * 3, level)) // pas > strictement
    assert.isTrue(isDpsAnomaly(max * 3.01, level))
  })
})

test.group('isKillRateAnomaly', () => {
  test('kills × 3 max théorique → anomalie critical', ({ assert }) => {
    // 1000s d'absence sur étage 50
    const declared = calcTheoreticalMaxKills(50, 1000) * 3
    assert.isTrue(isKillRateAnomaly(declared, 50, 1000))
  })

  test('kills dans les limites → pas d\'anomalie', ({ assert }) => {
    const max = calcTheoreticalMaxKills(50, 1000)
    assert.isFalse(isKillRateAnomaly(Math.floor(max * 0.5), 50, 1000))
  })

  test('0 kills → jamais une anomalie', ({ assert }) => {
    assert.isFalse(isKillRateAnomaly(0, 50, 3600))
  })
})

test.group('isGemsAnomaly', () => {
  test('+60 gems non-admin en 4h → anomalie', ({ assert }) => {
    assert.isTrue(isGemsAnomaly(60))
  })

  test('+50 gems exactement → pas d\'anomalie (seuil strict)', ({ assert }) => {
    assert.isFalse(isGemsAnomaly(50))
  })

  test('+0 gems → jamais anomalie', ({ assert }) => {
    assert.isFalse(isGemsAnomaly(0))
  })
})

// ─── EventService — pure functions ───────────────────────────────────────────

test.group('applyGemBoost', () => {
  test('gem_boost event actif → gems × multiplicateur', ({ assert }) => {
    const config: EventConfig = { multiplier: 2 }
    assert.equal(applyGemBoost(2, 'boss_first_clear', config), 4)
  })

  test('gem_boost avec sources filtrées → seuls boss concernés', ({ assert }) => {
    const config: EventConfig = { multiplier: 2, sources: ['boss_first_clear'] }
    assert.equal(applyGemBoost(2, 'boss_first_clear', config), 4)
    assert.equal(applyGemBoost(10, 'region_complete', config), 10) // non concerné
  })

  test('admin_grant toujours exempt du gem_boost', ({ assert }) => {
    const config: EventConfig = { multiplier: 2 }
    assert.equal(applyGemBoost(10, 'admin_grant', config), 10)
  })

  test('pas d\'event actif → montant inchangé', ({ assert }) => {
    assert.equal(applyGemBoost(5, 'boss_first_clear', null), 5)
  })

  test('multiplicateur 1.5 → arrondi à l\'entier inférieur', ({ assert }) => {
    const config: EventConfig = { multiplier: 1.5 }
    assert.equal(applyGemBoost(3, 'boss_first_clear', config), 4) // floor(3*1.5)=4
  })
})

test.group('applyXpBoost', () => {
  test('xp_boost event actif → XP × multiplicateur en combat', ({ assert }) => {
    const config: EventConfig = { multiplier: 1.5 }
    assert.equal(applyXpBoost(100, config), 150)
  })

  test('event désactivé → XP inchangé', ({ assert }) => {
    assert.equal(applyXpBoost(100, null), 100)
  })

  test('multiplicateur 2.0 → XP doublé', ({ assert }) => {
    const config: EventConfig = { multiplier: 2 }
    assert.equal(applyXpBoost(50, config), 100)
  })
})

test.group('calcShinyRate', () => {
  test('shiny_boost × 2 → taux shiny doublé', ({ assert }) => {
    const config: EventConfig = { multiplier: 2 }
    const rate = calcShinyRate(config)
    assert.approximately(rate, 2 / 8192, 0.0001)
  })

  test('pas de boost → taux de base 1/8192', ({ assert }) => {
    const rate = calcShinyRate(null)
    assert.approximately(rate, 1 / 8192, 0.00001)
  })

  test('shiny_boost × 4 → taux multiplié × 4', ({ assert }) => {
    const config: EventConfig = { multiplier: 4 }
    const rate = calcShinyRate(config)
    assert.approximately(rate, 4 / 8192, 0.0001)
  })
})

test.group('isMaintenanceActive', () => {
  test('maintenance active sans end date → retourne true', ({ assert }) => {
    assert.isTrue(isMaintenanceActive({ active: true }))
  })

  test('maintenance inactive → retourne false', ({ assert }) => {
    assert.isFalse(isMaintenanceActive({ active: false }))
  })

  test('config null → retourne false', ({ assert }) => {
    assert.isFalse(isMaintenanceActive(null))
  })

  test('ends_at dans le passé → retourne false', ({ assert }) => {
    const past = new Date(Date.now() - 1000).toISOString()
    assert.isFalse(isMaintenanceActive({ active: true, ends_at: past }))
  })

  test('ends_at dans le futur → retourne true', ({ assert }) => {
    const future = new Date(Date.now() + 60000).toISOString()
    assert.isTrue(isMaintenanceActive({ active: true, ends_at: future }))
  })
})
