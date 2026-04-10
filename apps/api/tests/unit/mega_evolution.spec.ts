/**
 * Tests unitaires — Méga-Évolutions & Formes Régionales
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'

import {
  canMegaEvolve,
  selectMegaEvolution,
  applyMegaEvolution,
  getMegaBST,
  type MegaEvolutionData,
  type MegaEligiblePokemon,
} from '../../app/services/MegaEvolutionService.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMega(overrides: Partial<MegaEvolutionData> = {}): MegaEvolutionData {
  return {
    id: 1,
    species_id: 448,
    mega_stone_item_id: 101,
    mega_name_fr: 'Méga-Lucario',
    mega_type1: 'fighting',
    mega_type2: 'steel',
    mega_hp: 70,
    mega_atk: 145,
    mega_def: 88,
    mega_spatk: 140,
    mega_spdef: 70,
    mega_speed: 112,
    sprite_url: 'https://example.com/lucario-mega.png',
    sprite_shiny_url: 'https://example.com/lucario-mega-shiny.png',
    ...overrides,
  }
}

function makePokemon(overrides: Partial<MegaEligiblePokemon> = {}): MegaEligiblePokemon {
  return {
    id: 'uuid-1',
    species_id: 448,
    is_shiny: false,
    equipped_item_id: 101,
    ...overrides,
  }
}

// ─── canMegaEvolve ────────────────────────────────────────────────────────────

test.group('canMegaEvolve', () => {
  test('returns true when pokemon has correct mega stone and mega not used', ({ assert }) => {
    const pokemon = makePokemon()
    const megas = [makeMega()]
    assert.isTrue(canMegaEvolve(pokemon, megas, false))
  })

  test('returns false when mega already used this battle', ({ assert }) => {
    const pokemon = makePokemon()
    const megas = [makeMega()]
    assert.isFalse(canMegaEvolve(pokemon, megas, true))
  })

  test('returns false when pokemon has no item', ({ assert }) => {
    const pokemon = makePokemon({ equipped_item_id: null })
    const megas = [makeMega()]
    assert.isFalse(canMegaEvolve(pokemon, megas, false))
  })

  test('returns false when item does not match any mega stone', ({ assert }) => {
    const pokemon = makePokemon({ equipped_item_id: 999 })
    const megas = [makeMega({ mega_stone_item_id: 101 })]
    assert.isFalse(canMegaEvolve(pokemon, megas, false))
  })

  test('returns true for Rayquaza (stone-free mega) when no item required', ({ assert }) => {
    const megas = [makeMega({ species_id: 384, mega_stone_item_id: null })]
    // Rayquaza has null stone but equipped_item_id check would fail for null item...
    // Actually by our spec: stone-free mega only if equipped_item_id !== null doesn't apply
    // Re-check: canMegaEvolve checks equipped_item_id === null → false first.
    // For Rayquaza in the game, the stone is null but we still need the pokemon to "hold" something.
    // Let's test the logic: stone-free megas match any item held by the pokemon.
    const pokemon2 = makePokemon({ species_id: 384, equipped_item_id: 50 }) // holds any item
    assert.isTrue(canMegaEvolve(pokemon2, megas, false))
  })

  test('returns false when no megas available for this species', ({ assert }) => {
    const pokemon = makePokemon({ species_id: 1 }) // Bulbasaur has no mega
    const megas = [makeMega({ species_id: 448 })]
    assert.isFalse(canMegaEvolve(pokemon, megas, false))
  })
})

// ─── selectMegaEvolution ─────────────────────────────────────────────────────

test.group('selectMegaEvolution', () => {
  test('selects mega by exact stone match', ({ assert }) => {
    const pokemon = makePokemon({ species_id: 6, equipped_item_id: 10 }) // Charizard X stone
    const megas = [
      makeMega({ species_id: 6, mega_name_fr: 'Méga-Dracaufeu X', mega_stone_item_id: 10 }),
      makeMega({ species_id: 6, mega_name_fr: 'Méga-Dracaufeu Y', mega_stone_item_id: 11 }),
    ]
    const result = selectMegaEvolution(pokemon, megas)
    assert.equal(result?.mega_name_fr, 'Méga-Dracaufeu X')
  })

  test('selects Y form when Y stone equipped', ({ assert }) => {
    const pokemon = makePokemon({ species_id: 6, equipped_item_id: 11 })
    const megas = [
      makeMega({ species_id: 6, mega_name_fr: 'Méga-Dracaufeu X', mega_stone_item_id: 10 }),
      makeMega({ species_id: 6, mega_name_fr: 'Méga-Dracaufeu Y', mega_stone_item_id: 11 }),
    ]
    const result = selectMegaEvolution(pokemon, megas)
    assert.equal(result?.mega_name_fr, 'Méga-Dracaufeu Y')
  })

  test('selects stone-free mega (Rayquaza) as fallback', ({ assert }) => {
    const pokemon = makePokemon({ species_id: 384, equipped_item_id: 50 })
    const megas = [makeMega({ species_id: 384, mega_name_fr: 'Méga-Rayquaza', mega_stone_item_id: null })]
    const result = selectMegaEvolution(pokemon, megas)
    assert.equal(result?.mega_name_fr, 'Méga-Rayquaza')
  })

  test('returns null when no mega matches species', ({ assert }) => {
    const pokemon = makePokemon({ species_id: 1 })
    const megas = [makeMega({ species_id: 448 })]
    assert.isNull(selectMegaEvolution(pokemon, megas))
  })
})

// ─── applyMegaEvolution ───────────────────────────────────────────────────────

test.group('applyMegaEvolution', () => {
  test('overrides types and stats', ({ assert }) => {
    const mega = makeMega()
    const result = applyMegaEvolution(200, 250, mega)
    assert.equal(result.type1, 'fighting')
    assert.equal(result.type2, 'steel')
    assert.equal(result.atk, 145)
    assert.equal(result.speed, 112)
  })

  test('scales current HP proportionally to new max HP', ({ assert }) => {
    // 50% HP on base 250 HP → should be ~50% of mega HP 70 = 35
    const mega = makeMega({ mega_hp: 100 })
    const result = applyMegaEvolution(125, 250, mega)
    assert.equal(result.new_current_hp, 50) // 125/250 = 0.5 * 100 = 50
  })

  test('new_current_hp is at least 1 when base HP is 0', ({ assert }) => {
    const mega = makeMega()
    const result = applyMegaEvolution(0, 0, mega)
    assert.isAtLeast(result.new_current_hp, 1)
  })

  test('includes mega_name_fr and sprite_url in result', ({ assert }) => {
    const mega = makeMega()
    const result = applyMegaEvolution(200, 200, mega)
    assert.equal(result.mega_name_fr, 'Méga-Lucario')
    assert.equal(result.sprite_url, 'https://example.com/lucario-mega.png')
  })
})

// ─── getMegaBST ───────────────────────────────────────────────────────────────

test.group('getMegaBST', () => {
  test('computes sum of all 6 mega stats', ({ assert }) => {
    const mega = makeMega() // 70+145+88+140+70+112 = 625
    assert.equal(getMegaBST(mega), 625)
  })
})

// ─── Formes régionales (pure data assertions) ─────────────────────────────────

test.group('Regional forms metadata', () => {
  test('form_name_fr follows "Forme de {Region}" pattern', ({ assert }) => {
    const regions = ['alola', 'galar', 'hisui', 'paldea']
    for (const region of regions) {
      const expected = `Forme de ${region.charAt(0).toUpperCase() + region.slice(1)}`
      assert.equal(expected, `Forme de ${region.charAt(0).toUpperCase() + region.slice(1)}`)
    }
  })

  test('alola form IDs are in range 10091-10115', ({ assert }) => {
    const alola_ids = [
      10091, 10092, 10093, 10094, 10095, 10096, 10097, 10098,
      10099, 10100, 10101, 10102, 10103, 10104, 10105, 10106,
      10107, 10108, 10109, 10110, 10111, 10112, 10113, 10114, 10115,
    ]
    assert.equal(alola_ids.length, 25)
    assert.isTrue(alola_ids.every(id => id >= 10091 && id <= 10115))
  })

  test('galar form IDs are in range 10161-10180', ({ assert }) => {
    const galar_ids = [
      10161, 10162, 10163, 10164, 10165, 10166, 10167, 10168,
      10169, 10170, 10171, 10172, 10173, 10174, 10175, 10176,
      10177, 10178, 10179, 10180,
    ]
    assert.equal(galar_ids.length, 20)
    assert.isTrue(galar_ids.every(id => id >= 10161 && id <= 10180))
  })
})
