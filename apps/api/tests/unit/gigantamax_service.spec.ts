/**
 * Tests unitaires — Gigantamax & Living Dex
 * Tests des formules pures : canGigantamax, applyGigantamax, calcGmaxStats,
 * xpRequiredForLevel, levelFromXp, applyRareCandyResult, applyExpCandyResult.
 */

import { test } from '@japa/runner'
import {
  canGigantamax,
  selectGigantamax,
  applyGigantamax,
  calcGmaxStats,
  xpRequiredForLevel,
  levelFromXp,
  calcCandyXpGain,
  applyRareCandyResult,
  applyExpCandyResult,
  type GigantamaxData,
  type GmaxEligiblePokemon,
  type CombatMode,
} from '../../app/services/GigantamaxFormulas.js'

// ─── Données de test ──────────────────────────────────────────────────────────

const GMAX_CHARIZARD: GigantamaxData = {
  id: 1,
  species_id: 6,
  gmax_name_fr: 'Dracaufeu-Gigantamax',
  gmax_move_id: 10001,
  gmax_hp_mult: 1.5,
  gmax_atk_mult: 1.3,
  gmax_def_mult: 1.2,
  gmax_spatk_mult: 1.4,
  gmax_spdef_mult: 1.2,
  gmax_speed_mult: 1.1,
  sprite_url: 'https://example.com/gmax-charizard.png',
  sprite_shiny_url: 'https://example.com/gmax-charizard-shiny.png',
  obtain_method: 'raid',
}

const GMAX_PIKACHU: GigantamaxData = {
  id: 2,
  species_id: 25,
  gmax_name_fr: 'Pikachu-Gigantamax',
  gmax_move_id: 10002,
  gmax_hp_mult: 1.3,
  gmax_atk_mult: 1.2,
  gmax_def_mult: 1.1,
  gmax_spatk_mult: 1.2,
  gmax_spdef_mult: 1.1,
  gmax_speed_mult: 1.3,
  sprite_url: null,
  sprite_shiny_url: null,
  obtain_method: 'raid',
}

const AVAILABLE_GMAX = [GMAX_CHARIZARD, GMAX_PIKACHU]

const BASE_POKEMON: GmaxEligiblePokemon = {
  id: 'test-poke-1',
  species_id: 6,
  is_shiny: false,
  current_hp: 200,
  max_hp: 300,
  effective_atk: 250,
  effective_def: 200,
  effective_spatk: 300,
  effective_spdef: 200,
  effective_speed: 150,
}

// ─── Tests canGigantamax ──────────────────────────────────────────────────────

test.group('canGigantamax', () => {
  test('autorise en mode raid avec espèce débloquée', ({ assert }) => {
    const result = canGigantamax('raid', 6, AVAILABLE_GMAX, [6], false)
    assert.isTrue(result)
  })

  test('autorise en mode tower avec espèce débloquée', ({ assert }) => {
    const result = canGigantamax('tower', 6, AVAILABLE_GMAX, [6], false)
    assert.isTrue(result)
  })

  test('refuse en mode combat normal (idle)', ({ assert }) => {
    const result = canGigantamax('idle' as CombatMode, 6, AVAILABLE_GMAX, [6], false)
    assert.isFalse(result)
  })

  test('refuse en mode dungeon', ({ assert }) => {
    const result = canGigantamax('dungeon', 6, AVAILABLE_GMAX, [6], false)
    assert.isFalse(result)
  })

  test('refuse en mode pvp', ({ assert }) => {
    const result = canGigantamax('pvp', 6, AVAILABLE_GMAX, [6], false)
    assert.isFalse(result)
  })

  test('refuse si gmax_already_used = true', ({ assert }) => {
    const result = canGigantamax('raid', 6, AVAILABLE_GMAX, [6], true)
    assert.isFalse(result)
  })

  test('refuse si espèce non disponible en GMax', ({ assert }) => {
    const result = canGigantamax('raid', 1, AVAILABLE_GMAX, [1], false)
    assert.isFalse(result)
  })

  test('refuse si joueur n\'a pas débloqué le GMax', ({ assert }) => {
    const result = canGigantamax('raid', 6, AVAILABLE_GMAX, [25], false) // unlocked 25, not 6
    assert.isFalse(result)
  })

  test('refuse avec liste unlocked vide', ({ assert }) => {
    const result = canGigantamax('raid', 6, AVAILABLE_GMAX, [], false)
    assert.isFalse(result)
  })
})

// ─── Tests selectGigantamax ───────────────────────────────────────────────────

test.group('selectGigantamax', () => {
  test('retourne la forme GMax pour une espèce', ({ assert }) => {
    const result = selectGigantamax(6, AVAILABLE_GMAX)
    assert.equal(result?.species_id, 6)
    assert.equal(result?.gmax_name_fr, 'Dracaufeu-Gigantamax')
  })

  test('retourne null pour une espèce sans GMax', ({ assert }) => {
    const result = selectGigantamax(999, AVAILABLE_GMAX)
    assert.isNull(result)
  })

  test('retourne null pour liste vide', ({ assert }) => {
    const result = selectGigantamax(6, [])
    assert.isNull(result)
  })
})

// ─── Tests applyGigantamax ────────────────────────────────────────────────────

test.group('applyGigantamax', () => {
  test('applique les multiplicateurs correctement', ({ assert }) => {
    const result = applyGigantamax(BASE_POKEMON, GMAX_CHARIZARD)

    assert.equal(result.max_hp, Math.floor(300 * 1.5))        // 450
    assert.equal(result.current_hp, Math.floor(300 * 1.5))    // full heal = 450
    assert.equal(result.effective_atk, Math.floor(250 * 1.3)) // 325
    assert.equal(result.effective_def, Math.floor(200 * 1.2)) // 240
    assert.equal(result.effective_spatk, Math.floor(300 * 1.4)) // 420
    assert.equal(result.effective_spdef, Math.floor(200 * 1.2)) // 240
    assert.equal(result.effective_speed, Math.floor(150 * 1.1)) // 165
  })

  test('retourne le nom GMax et les sprites', ({ assert }) => {
    const result = applyGigantamax(BASE_POKEMON, GMAX_CHARIZARD)
    assert.equal(result.gmax_name_fr, 'Dracaufeu-Gigantamax')
    assert.equal(result.sprite_url, 'https://example.com/gmax-charizard.png')
    assert.equal(result.sprite_shiny_url, 'https://example.com/gmax-charizard-shiny.png')
  })

  test('full heal même si HP bas', ({ assert }) => {
    const low_hp_pokemon: GmaxEligiblePokemon = { ...BASE_POKEMON, current_hp: 10 }
    const result = applyGigantamax(low_hp_pokemon, GMAX_CHARIZARD)
    assert.equal(result.current_hp, result.max_hp) // full heal
    assert.isAbove(result.current_hp, 10) // definitely healed
  })

  test('utilise Math.floor pour les stats entières', ({ assert }) => {
    const result = applyGigantamax(BASE_POKEMON, GMAX_CHARIZARD)
    assert.equal(result.effective_speed, Math.floor(150 * 1.1))
    assert.isTrue(Number.isInteger(result.effective_speed))
  })

  test('gère les sprites null', ({ assert }) => {
    const result = applyGigantamax({ ...BASE_POKEMON, species_id: 25 }, GMAX_PIKACHU)
    assert.isNull(result.sprite_url)
    assert.isNull(result.sprite_shiny_url)
  })
})

// ─── Tests calcGmaxStats ──────────────────────────────────────────────────────

test.group('calcGmaxStats', () => {
  test('calcule les stats GMax prévisionnelles', ({ assert }) => {
    const base = { max_hp: 300, effective_atk: 250, effective_def: 200, effective_spatk: 300, effective_spdef: 200, effective_speed: 150 }
    const result = calcGmaxStats(base, GMAX_CHARIZARD)

    assert.equal(result.hp, Math.floor(300 * 1.5))
    assert.equal(result.atk, Math.floor(250 * 1.3))
    assert.equal(result.def, Math.floor(200 * 1.2))
    assert.equal(result.spatk, Math.floor(300 * 1.4))
    assert.equal(result.spdef, Math.floor(200 * 1.2))
    assert.equal(result.speed, Math.floor(150 * 1.1))
  })
})

// ─── Tests formules XP/Niveaux ────────────────────────────────────────────────

test.group('xpRequiredForLevel', () => {
  test('niveau 1 = 0 XP', ({ assert }) => {
    assert.equal(xpRequiredForLevel(1), 0)
  })

  test('niveau 0 = 0 XP', ({ assert }) => {
    assert.equal(xpRequiredForLevel(0), 0)
  })

  test('niveau 10 = 1000 XP (n³)', ({ assert }) => {
    assert.equal(xpRequiredForLevel(10), 1000)
  })

  test('niveau 50 = 125000 XP', ({ assert }) => {
    assert.equal(xpRequiredForLevel(50), 125_000)
  })

  test('niveau 100 = 1000000 XP', ({ assert }) => {
    assert.equal(xpRequiredForLevel(100), 1_000_000)
  })
})

test.group('levelFromXp', () => {
  test('0 XP = niveau 1', ({ assert }) => {
    assert.equal(levelFromXp(0), 1)
  })

  test('1000 XP = niveau 10', ({ assert }) => {
    assert.equal(levelFromXp(1000), 10)
  })

  test('125000 XP = niveau 50', ({ assert }) => {
    assert.equal(levelFromXp(125_000), 50)
  })

  test('niveau maximum = 100', ({ assert }) => {
    assert.equal(levelFromXp(99_999_999), 100)
  })

  test('XP juste avant un niveau = niveau précédent', ({ assert }) => {
    // Juste avant niveau 10 : 999 XP → niveau 9
    assert.equal(levelFromXp(999), 9)
  })
})

// ─── Tests calcCandyXpGain ────────────────────────────────────────────────────

test.group('calcCandyXpGain', () => {
  test('Bonbon Exp. L = 30 000 XP', ({ assert }) => {
    assert.equal(calcCandyXpGain('exp_candy_l'), 30_000)
  })

  test('Bonbon Exp. XL = 100 000 XP', ({ assert }) => {
    assert.equal(calcCandyXpGain('exp_candy_xl'), 100_000)
  })

  test('effet inconnu = 0 XP', ({ assert }) => {
    assert.equal(calcCandyXpGain('unknown_item'), 0)
  })

  test('rare_candy = 0 XP (géré séparément)', ({ assert }) => {
    assert.equal(calcCandyXpGain('rare_candy'), 0)
  })
})

// ─── Tests applyRareCandyResult ───────────────────────────────────────────────

test.group('applyRareCandyResult', () => {
  test('augmente le niveau de 1', ({ assert }) => {
    const result = applyRareCandyResult(50, null)
    assert.equal(result.new_level, 51)
  })

  test('ne dépasse pas le niveau 100', ({ assert }) => {
    const result = applyRareCandyResult(100, null)
    assert.equal(result.new_level, 100)
    assert.isFalse(result.can_evolve)
  })

  test('détecte l\'évolution possible', ({ assert }) => {
    const result = applyRareCandyResult(35, 36)
    assert.equal(result.new_level, 36)
    assert.isTrue(result.can_evolve)
  })

  test('pas d\'évolution si niveau évolution non atteint', ({ assert }) => {
    const result = applyRareCandyResult(34, 36)
    assert.isFalse(result.can_evolve)
  })

  test('pas d\'évolution si evolution_level null', ({ assert }) => {
    const result = applyRareCandyResult(50, null)
    assert.isFalse(result.can_evolve)
  })
})

// ─── Tests applyExpCandyResult ────────────────────────────────────────────────

test.group('applyExpCandyResult', () => {
  test('gagne de l\'XP et monte de niveau', ({ assert }) => {
    // Niveau 9 (xp ~729), +30000 → niveau bien au-dessus
    const result = applyExpCandyResult(9, 729, 30_000, null)
    assert.isAbove(result.new_level, 9)
    assert.equal(result.new_xp, 729 + 30_000)
  })

  test('ne dépasse pas le niveau 100', ({ assert }) => {
    const result = applyExpCandyResult(99, 970_299, 100_000, null)
    assert.equal(result.new_level, 100)
  })

  test('détecte l\'évolution possible', ({ assert }) => {
    // Niveau 15, XP : 3375. Évolution niveau 16 (4096 XP).
    // Candy L = 30000 → new_xp = 33375 → niveau ~32
    const result = applyExpCandyResult(15, 3375, 30_000, 16)
    assert.isTrue(result.can_evolve)
    assert.isAbove(result.new_level, 15)
  })

  test('pas d\'évolution si déjà au-delà du niveau d\'évolution', ({ assert }) => {
    // Pokémon déjà niveau 40, évolution niveau 36 → current_level >= evolution_level
    const result = applyExpCandyResult(40, 64_000, 30_000, 36)
    assert.isFalse(result.can_evolve)
  })

  test('calcule levels_gained correctement', ({ assert }) => {
    const result = applyExpCandyResult(1, 0, 1_000, null)
    assert.equal(result.levels_gained, result.new_level - 1)
  })
})
