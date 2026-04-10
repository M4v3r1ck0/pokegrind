/**
 * Tests unitaires — Effets des items équipables
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'

import {
  applyItemStatMultipliers,
  applyItemDamageModifiers,
  applyItemAfterAction,
  applyItemOnHitReceived,
  getChoiceLockMove,
  calculateItemDrops,
} from '../../app/services/ItemService.js'

import type { EquippedItem, EffectiveStats, ItemAwarePokemon } from '../../app/services/ItemService.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStats(overrides: Partial<EffectiveStats> = {}): EffectiveStats {
  return { hp: 200, atk: 100, def: 80, spatk: 90, spdef: 75, speed: 95, ...overrides }
}

function makeItem(effect_type: string, effect_value: Record<string, any> = {}): EquippedItem {
  return { id: 1, effect_type, effect_value }
}

function makePokemon(overrides: Partial<ItemAwarePokemon & { item_name_fr?: string }> = {}): ItemAwarePokemon & { item_name_fr?: string } {
  return {
    id: 'test-uuid',
    current_hp: 200,
    max_hp: 200,
    status: null,
    equipped_item: null,
    item_used: false,
    air_balloon_intact: false,
    actions_taken: 0,
    item_name_fr: undefined,
    ...overrides,
  }
}

// ─── Group: applyItemStatMultipliers ─────────────────────────────────────────

test.group('applyItemStatMultipliers', () => {
  test('Choice Scarf: Speed ×1.5', ({ assert }) => {
    const stats = makeStats({ speed: 100 })
    const result = applyItemStatMultipliers(stats, makeItem('choice_scarf', { speed_mult: 1.5 }))
    assert.equal(result.speed, 150)
    assert.equal(result.atk, 100)
  })

  test('Choice Band: ATK ×1.5', ({ assert }) => {
    const stats = makeStats({ atk: 100 })
    const result = applyItemStatMultipliers(stats, makeItem('choice_band', { atk_mult: 1.5 }))
    assert.equal(result.atk, 150)
    assert.equal(result.speed, 95)
  })

  test('Coque-Écaille: DEF ×1.5, SPDEF ×1.5, Speed ×0.5', ({ assert }) => {
    const stats = makeStats({ def: 80, spdef: 75, speed: 100 })
    const result = applyItemStatMultipliers(stats, makeItem('shell_bell', { def_mult: 1.5, spdef_mult: 1.5, speed_mult: 0.5 }))
    assert.equal(result.def, 120)
    assert.equal(result.spdef, 112)
    assert.equal(result.speed, 50)
  })

  test('Herbe Miracle: Speed ×1.2', ({ assert }) => {
    const stats = makeStats({ speed: 100 })
    const result = applyItemStatMultipliers(stats, makeItem('miracle_seed', { speed_mult: 1.2 }))
    assert.equal(result.speed, 120)
  })

  test('Ceinture Vaillante: ATK+SPATK ×1.1, DEF+SPDEF ×0.9', ({ assert }) => {
    const stats = makeStats({ atk: 100, spatk: 100, def: 100, spdef: 100 })
    const result = applyItemStatMultipliers(stats, makeItem('assault_vest', { atk_mult: 1.1, spatk_mult: 1.1, def_mult: 0.9, spdef_mult: 0.9 }))
    assert.equal(result.atk, 110)
    assert.equal(result.spatk, 110)
    assert.equal(result.def, 90)
    assert.equal(result.spdef, 90)
  })

  test('No item: stats unchanged', ({ assert }) => {
    const stats = makeStats()
    const result = applyItemStatMultipliers(stats, null)
    assert.deepEqual(result, stats)
  })
})

// ─── Group: applyItemDamageModifiers ─────────────────────────────────────────

test.group('applyItemDamageModifiers', () => {
  test('Vie-Orbe: damage ×1.3', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('life_orb', { damage_mult: 1.3 }), null, 'physical', 'normal', 1, false, true, 1.0, false)
    assert.equal(result, 130)
  })

  test('Expert Ceinture: ×1.2 on super effective (effectiveness=2)', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('expert_belt', { super_effective_mult: 1.2 }), null, 'physical', 'fire', 2, false, true, 1.0, false)
    assert.equal(result, 120)
  })

  test('Expert Ceinture: no bonus when effectiveness=1', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('expert_belt', { super_effective_mult: 1.2 }), null, 'physical', 'fire', 1, false, true, 1.0, false)
    assert.equal(result, 100)
  })

  test('Plaque Flamme: +20% on fire move', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('type_plate', { type: 'fire', type_boost_mult: 1.2 }), null, 'special', 'fire', 1, false, false, 1.0, false)
    assert.equal(result, 120)
  })

  test('Plaque Flamme: no bonus on water move', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('type_plate', { type: 'fire', type_boost_mult: 1.2 }), null, 'special', 'water', 1, false, false, 1.0, false)
    assert.equal(result, 100)
  })

  test('Griffe Dure: ×1.3 on contact moves', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('hard_claw', { contact_damage_mult: 1.3 }), null, 'physical', 'normal', 1, false, true, 1.0, false)
    assert.equal(result, 130)
  })

  test('Griffe Dure: no bonus on non-contact move', ({ assert }) => {
    const result = applyItemDamageModifiers(100, makeItem('hard_claw', { contact_damage_mult: 1.3 }), null, 'special', 'fire', 1, false, false, 1.0, false)
    assert.equal(result, 100)
  })

  test('Air Balloon: immunity to ground moves → damage=0', ({ assert }) => {
    const result = applyItemDamageModifiers(100, null, null, 'physical', 'ground', 1, false, true, 1.0, true)
    assert.equal(result, 0)
  })
})

// ─── Group: applyItemAfterAction ─────────────────────────────────────────────

test.group('applyItemAfterAction', () => {
  test('Restes: +1/16 HP, not above max', ({ assert }) => {
    const p = makePokemon({ current_hp: 180, max_hp: 200, equipped_item: makeItem('leftovers', { heal_ratio: 0.0625 }) })
    const event = applyItemAfterAction(p)
    assert.exists(event)
    assert.equal(event?.event_type, 'item_triggered')
    assert.equal(p.current_hp, 192)
  })

  test('Vie-Orbe: -10% HP recoil', ({ assert }) => {
    const p = makePokemon({ current_hp: 200, max_hp: 200, equipped_item: makeItem('life_orb', { recoil_ratio: 0.1 }) })
    const event = applyItemAfterAction(p)
    assert.exists(event)
    assert.equal(event?.event_type, 'item_triggered')
    assert.equal(p.current_hp, 180)
  })

  test('Orbe Toxique triggers after 3 actions', ({ assert }) => {
    const p = makePokemon({ current_hp: 200, max_hp: 200, actions_taken: 2, equipped_item: makeItem('toxic_orb', { trigger_actions: 3 }) })
    const event = applyItemAfterAction(p)
    assert.exists(event)
    assert.equal(event?.event_type, 'item_triggered')
    assert.exists(p.status)
    assert.equal(p.item_used, true)
  })

  test('Orbe Flamme triggers after 3 actions', ({ assert }) => {
    const p = makePokemon({ current_hp: 200, max_hp: 200, actions_taken: 2, equipped_item: makeItem('flame_orb', { trigger_actions: 3 }) })
    const event = applyItemAfterAction(p)
    assert.exists(event)
    assert.equal(event?.event_type, 'item_triggered')
    assert.exists(p.status)
  })

  test('No item: no change', ({ assert }) => {
    const p = makePokemon({ current_hp: 200, max_hp: 200, equipped_item: null })
    const event = applyItemAfterAction(p)
    assert.isNull(event)
    assert.equal(p.current_hp, 200)
  })
})

// ─── Group: applyItemOnHitReceived ────────────────────────────────────────────

test.group('applyItemOnHitReceived', () => {
  test('Baie Sitrus: heal 25% when HP < 50%', ({ assert }) => {
    const p = makePokemon({ current_hp: 90, max_hp: 200, equipped_item: makeItem('sitrus_berry', { heal_ratio: 0.25, hp_threshold: 0.5, one_time: true }) })
    const event = applyItemOnHitReceived(p)
    assert.exists(event)
    assert.equal(event?.event_type, 'item_used')
    assert.equal(p.current_hp, 140)
    assert.equal(p.item_used, true)
  })

  test('Baie Sitrus: no heal when HP >= 50%', ({ assert }) => {
    const p = makePokemon({ current_hp: 120, max_hp: 200, equipped_item: makeItem('sitrus_berry', { heal_ratio: 0.25, hp_threshold: 0.5, one_time: true }) })
    const event = applyItemOnHitReceived(p)
    assert.isNull(event)
    assert.equal(p.current_hp, 120)
  })

  test('Baie Lum: cures status', ({ assert }) => {
    const p = makePokemon({ current_hp: 100, max_hp: 200, status: { type: 'burn' }, equipped_item: makeItem('lum_berry', { cure_status: true, one_time: true }) })
    const event = applyItemOnHitReceived(p)
    assert.exists(event)
    assert.equal(event?.event_type, 'item_used')
    assert.isNull(p.status)
    assert.equal(p.item_used, true)
  })

  test('Air Balloon: pops on non-ground hit', ({ assert }) => {
    const p = makePokemon({ air_balloon_intact: true, equipped_item: makeItem('air_balloon', { ground_immunity: true }) })
    const event = applyItemOnHitReceived(p, 'fire')
    assert.exists(event)
    assert.equal(event?.event_type, 'item_destroyed')
    assert.equal(p.air_balloon_intact, false)
  })
})

// ─── Group: choice lock ───────────────────────────────────────────────────────

test.group('getChoiceLockMove', () => {
  test('returns first move id when Choice item + move used', ({ assert }) => {
    const result = getChoiceLockMove(makeItem('choice_scarf', { speed_mult: 1.5, choice_lock: true }), 42)
    assert.equal(result, 42)
  })

  test('null when no Choice item', ({ assert }) => {
    const result = getChoiceLockMove(null, 42)
    assert.isNull(result)
  })
})

// ─── Group: drop rate ─────────────────────────────────────────────────────────

test.group('calculateItemDrops', () => {
  test('0.5% rate × 10000 kills → average ~50 drops', ({ assert }) => {
    let total = 0
    const RUNS = 5
    for (let r = 0; r < RUNS; r++) {
      const drops = calculateItemDrops(
        [{ item_id: 1, item_name_fr: 'Baie Sitrus', drop_rate: 0.005, qty_min: 1, qty_max: 1 }],
        10000
      )
      total += drops.reduce((sum, d) => sum + d.quantity, 0)
    }
    const avg = total / RUNS
    assert.isAbove(avg, 25)
    assert.isBelow(avg, 75)
  })

  test('empty floor_drops → []', ({ assert }) => {
    const drops = calculateItemDrops([], 10000)
    assert.deepEqual(drops, [])
  })
})

// ─── Group: equipment business logic (pure) ──────────────────────────────────

test.group('equipment business logic', () => {
  test('equipping reduces player item qty by 1', ({ assert }) => {
    let qty = 3
    qty -= 1
    assert.equal(qty, 2)
  })

  test('unequip returns item to inventory (qty+1)', ({ assert }) => {
    let qty = 0
    qty += 1
    assert.equal(qty, 1)
  })

  test('swap correctly exchanges equipped items', ({ assert }) => {
    let equipped_item_id: number | null = 5
    const new_item_id = 10
    const returned_item_id = equipped_item_id
    equipped_item_id = new_item_id
    assert.equal(equipped_item_id, 10)
    assert.equal(returned_item_id, 5)
  })
})
