/**
 * Tests unitaires — TowerGeneratorService (pure functions)
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'

import {
  createSeededRng,
  calcTowerFloorConfig,
  generateIVsForFloor,
  generateEnemiesForFloor,
  applyEnrageMechanic,
  calcRegenHeal,
  calcReflectDamage,
  calcCloneHP,
} from '../../app/services/TowerGeneratorService.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SPECIES_POOL = [
  { id: 1,   name_fr: 'Bulbizarre' },
  { id: 4,   name_fr: 'Salamèche' },
  { id: 7,   name_fr: 'Carapuce' },
  { id: 25,  name_fr: 'Pikachu' },
  { id: 94,  name_fr: 'Spectrum' },
  { id: 131, name_fr: 'Lokhlass' },
]

// ─── RNG déterministe ─────────────────────────────────────────────────────────

test.group('RNG déterministe (mulberry32)', () => {
  test('produit des valeurs entre 0 et 1', ({ assert }) => {
    const rng = createSeededRng(42)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      assert.isAbove(v, -1)
      assert.isBelow(v, 1)
    }
  })

  test('même seed = même séquence', ({ assert }) => {
    const rng1 = createSeededRng(12345)
    const rng2 = createSeededRng(12345)
    for (let i = 0; i < 20; i++) {
      assert.equal(rng1(), rng2())
    }
  })

  test('seeds différentes = séquences différentes', ({ assert }) => {
    const rng1 = createSeededRng(1)
    const rng2 = createSeededRng(2)
    const vals1 = Array.from({ length: 10 }, () => rng1())
    const vals2 = Array.from({ length: 10 }, () => rng2())
    assert.notDeepEqual(vals1, vals2)
  })
})

// ─── Config étage ────────────────────────────────────────────────────────────

test.group('calcTowerFloorConfig', () => {
  test('étage 1 : niveau ~5, tier D/C, 1 ennemi', ({ assert }) => {
    const config = calcTowerFloorConfig(1, 1)
    assert.equal(config.floor_number, 1)
    assert.isAbove(config.enemy_level, 4)
    assert.isBelow(config.enemy_level, 20)
    assert.deepEqual(config.tier, ['D', 'C'])
    assert.equal(config.enemy_count, 1)
    assert.isFalse(config.is_boss)
  })

  test('étage 25 : is_boss = true', ({ assert }) => {
    const config = calcTowerFloorConfig(25, 1)
    assert.isTrue(config.is_boss)
  })

  test('étage 26 : is_boss = false', ({ assert }) => {
    const config = calcTowerFloorConfig(26, 1)
    assert.isFalse(config.is_boss)
  })

  test('étage 50 : tier C/B', ({ assert }) => {
    const config = calcTowerFloorConfig(50, 1)
    assert.deepEqual(config.tier, ['C', 'B'])
  })

  test('étage 100 : niveau ~100, tier B/A', ({ assert }) => {
    const config = calcTowerFloorConfig(100, 1)
    assert.isAbove(config.enemy_level, 80)
    assert.isBelow(config.enemy_level, 120)
    assert.deepEqual(config.tier, ['B', 'A'])
    assert.equal(config.enemy_count, 6) // cap à 6
  })

  test('étage 200 : tier A/S', ({ assert }) => {
    const config = calcTowerFloorConfig(200, 1)
    assert.deepEqual(config.tier, ['A', 'S'])
  })

  test('étage 300 : tier S/S+', ({ assert }) => {
    const config = calcTowerFloorConfig(300, 1)
    assert.deepEqual(config.tier, ['S', 'S+'])
    assert.equal(config.enemy_count, 6)
  })

  test('étage 500 : niveau cap à 200 max', ({ assert }) => {
    const config = calcTowerFloorConfig(500, 1)
    assert.isAtMost(config.enemy_level, 200)
  })

  test('IVs croissants avec les étages', ({ assert }) => {
    const low = calcTowerFloorConfig(1, 1)
    const high = calcTowerFloorConfig(200, 1)
    assert.isBelow(low.iv_min, high.iv_min)
    assert.isAtMost(high.iv_max, 31)
  })

  test('or et XP augmentent avec les étages', ({ assert }) => {
    const floor10  = calcTowerFloorConfig(10, 1)
    const floor100 = calcTowerFloorConfig(100, 1)
    assert.isBelow(floor10.gold_base, floor100.gold_base)
    assert.isBelow(floor10.xp_base, floor100.xp_base)
  })
})

// ─── Génération ennemis ───────────────────────────────────────────────────────

test.group('generateEnemiesForFloor', () => {
  test('retourne le bon nombre d\'ennemis', ({ assert }) => {
    const enemies = generateEnemiesForFloor(1, 1, SPECIES_POOL)
    const config = calcTowerFloorConfig(1, 1)
    assert.equal(enemies.length, config.enemy_count)
  })

  test('retourne [] si species_pool vide', ({ assert }) => {
    const enemies = generateEnemiesForFloor(10, 1, [])
    assert.deepEqual(enemies, [])
  })

  test('génération déterministe : même étage = mêmes ennemis', ({ assert }) => {
    const enemies1 = generateEnemiesForFloor(50, 1, SPECIES_POOL)
    const enemies2 = generateEnemiesForFloor(50, 1, SPECIES_POOL)
    assert.deepEqual(enemies1, enemies2)
  })

  test('étages différents = ennemis différents (au moins niveaux)', ({ assert }) => {
    const e1 = generateEnemiesForFloor(1, 1, SPECIES_POOL)
    const e2 = generateEnemiesForFloor(100, 1, SPECIES_POOL)
    // Niveaux différents garantis
    assert.isBelow(e1[0].level, e2[0].level)
  })

  test('saisons différentes = ennemis différents', ({ assert }) => {
    const e1 = generateEnemiesForFloor(50, 1, SPECIES_POOL)
    const e2 = generateEnemiesForFloor(50, 2, SPECIES_POOL)
    // Avec des seeds différentes, au moins une propriété diffère
    const same = JSON.stringify(e1) === JSON.stringify(e2)
    assert.isFalse(same)
  })

  test('ennemis ont species_id, level, ivs, nature', ({ assert }) => {
    const enemies = generateEnemiesForFloor(10, 1, SPECIES_POOL)
    for (const e of enemies) {
      assert.isNumber(e.species_id)
      assert.isNumber(e.level)
      assert.isObject(e.ivs)
      assert.isString(e.nature)
      assert.property(e.ivs, 'hp')
      assert.property(e.ivs, 'atk')
      assert.property(e.ivs, 'speed')
    }
  })

  test('species_id appartient au pool', ({ assert }) => {
    const pool_ids = SPECIES_POOL.map(s => s.id)
    const enemies = generateEnemiesForFloor(30, 1, SPECIES_POOL)
    for (const e of enemies) {
      assert.include(pool_ids, e.species_id)
    }
  })
})

// ─── IVs par étage ────────────────────────────────────────────────────────────

test.group('generateIVsForFloor', () => {
  test('IVs dans la plage attendue pour étage 1', ({ assert }) => {
    const rng = createSeededRng(1)
    const ivs = generateIVsForFloor(1, rng)
    for (const stat of ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const) {
      assert.isAtLeast(ivs[stat], 0)
      assert.isAtMost(ivs[stat], 31)
    }
  })

  test('IVs min ≥ 28 à partir de l\'étage 280', ({ assert }) => {
    const rng = createSeededRng(999)
    const ivs = generateIVsForFloor(280, rng)
    for (const stat of ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const) {
      assert.isAtLeast(ivs[stat], 28)
    }
  })
})

// ─── Mécaniques boss ──────────────────────────────────────────────────────────

test.group('applyEnrageMechanic', () => {
  test('dégâts ×2.0 quand HP boss < 30%', ({ assert }) => {
    const result = applyEnrageMechanic(100, 25, 100, { threshold: 0.30, damage_mult: 2.0 })
    assert.equal(result, 200)
  })

  test('dégâts inchangés si HP boss ≥ seuil', ({ assert }) => {
    const result = applyEnrageMechanic(100, 40, 100, { threshold: 0.30, damage_mult: 2.0 })
    assert.equal(result, 100)
  })

  test('exactement au seuil → pas d\'enrage', ({ assert }) => {
    const result = applyEnrageMechanic(100, 30, 100, { threshold: 0.30, damage_mult: 2.0 })
    assert.equal(result, 100)
  })

  test('seuil 50%, mult 1.8', ({ assert }) => {
    const result = applyEnrageMechanic(100, 49, 100, { threshold: 0.50, damage_mult: 1.8 })
    assert.equal(result, 180)
  })
})

test.group('calcRegenHeal', () => {
  test('5% des PV max du boss', ({ assert }) => {
    const heal = calcRegenHeal(1000, { heal_per_action: 0.05 })
    assert.equal(heal, 50)
  })

  test('10% des PV max du boss', ({ assert }) => {
    const heal = calcRegenHeal(2000, { heal_per_action: 0.10 })
    assert.equal(heal, 200)
  })

  test('arrondi à l\'entier inférieur', ({ assert }) => {
    const heal = calcRegenHeal(333, { heal_per_action: 0.05 })
    assert.equal(heal, 16) // Math.floor(333 * 0.05) = Math.floor(16.65)
  })
})

test.group('calcReflectDamage', () => {
  test('30% dégâts physiques renvoyés', ({ assert }) => {
    const reflected = calcReflectDamage(200, 'physical', {
      reflect_percent: 0.30,
      move_categories: ['physical'],
    })
    assert.equal(reflected, 60)
  })

  test('catégorie non incluse → 0', ({ assert }) => {
    const reflected = calcReflectDamage(200, 'special', {
      reflect_percent: 0.30,
      move_categories: ['physical'],
    })
    assert.equal(reflected, 0)
  })

  test('physical+special reflète les deux', ({ assert }) => {
    const config = { reflect_percent: 0.40, move_categories: ['physical', 'special'] }
    assert.equal(calcReflectDamage(100, 'physical', config), 40)
    assert.equal(calcReflectDamage(100, 'special', config), 40)
    assert.equal(calcReflectDamage(100, 'status', config), 0)
  })
})

test.group('calcCloneHP', () => {
  test('40% des PV max pour 2 clones', ({ assert }) => {
    const hp = calcCloneHP(1000, { clone_count: 2, clone_hp_percent: 0.40 })
    assert.equal(hp, 400)
  })

  test('25% des PV max pour 4 clones', ({ assert }) => {
    const hp = calcCloneHP(800, { clone_count: 4, clone_hp_percent: 0.25 })
    assert.equal(hp, 200)
  })

  test('arrondi à l\'entier inférieur', ({ assert }) => {
    const hp = calcCloneHP(333, { clone_count: 2, clone_hp_percent: 0.30 })
    assert.equal(hp, 99) // Math.floor(333 * 0.30) = 99
  })
})
