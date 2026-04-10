/**
 * Tests unitaires — CombatService
 * Exécuter : node --import=tsx/esm tests/unit/run.ts
 */
import { test } from '@japa/runner'
import {
  calcHP,
  calcStat,
  getNatureModifier,
  getTypeEffectiveness,
  calcDamage,
  applyStatusBeforeAction,
  buildCombatPokemon,
  calcActionDelay,
  selectNextMove,
  STRUGGLE_MOVE,
  type CombatPokemon,
  type CombatMove,
} from '../../app/services/CombatService.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePokemon(overrides: Partial<CombatPokemon> = {}): CombatPokemon {
  // Séparer les paramètres de build des overrides runtime (effective_speed etc.)
  const {
    effective_speed,
    effective_atk,
    effective_def,
    effective_spatk,
    effective_spdef,
    current_hp,
    max_hp,
    status,
    confusion,
    stat_modifiers,
    pp_remaining,
    next_action_at,
    current_move_index,
    ...buildParams
  } = overrides as any

  const base = buildCombatPokemon({
    id: 'test',
    species_id: 4,
    name_fr: 'Salamèche',
    level: 50,
    nature: 'hardy',
    ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
    type1: 'fire',
    type2: null,
    base_hp: 39,
    base_atk: 52,
    base_def: 43,
    base_spatk: 60,
    base_spdef: 50,
    base_speed: 65,
    moves: [],
    sprite_url: '',
    is_shiny: false,
    ...buildParams,
  })

  // Appliquer les overrides des valeurs runtime calculées
  return {
    ...base,
    ...(effective_speed !== undefined ? { effective_speed } : {}),
    ...(effective_atk !== undefined ? { effective_atk } : {}),
    ...(effective_def !== undefined ? { effective_def } : {}),
    ...(effective_spatk !== undefined ? { effective_spatk } : {}),
    ...(effective_spdef !== undefined ? { effective_spdef } : {}),
    ...(current_hp !== undefined ? { current_hp } : {}),
    ...(max_hp !== undefined ? { max_hp } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(confusion !== undefined ? { confusion } : {}),
    ...(stat_modifiers !== undefined ? { stat_modifiers } : {}),
    ...(pp_remaining !== undefined ? { pp_remaining } : {}),
    ...(next_action_at !== undefined ? { next_action_at } : {}),
    ...(current_move_index !== undefined ? { current_move_index } : {}),
  }
}

function makeMove(overrides: Partial<CombatMove> = {}): CombatMove {
  return {
    id: 1,
    name_fr: 'Lance-Flammes',
    type: 'fire',
    category: 'special',
    power: 90,
    accuracy: 100,
    pp: 15,
    priority: 0,
    effect: null,
    ...overrides,
  }
}

// ─── Formules de stats ───────────────────────────────────────────────────────

test.group('Formules HP et stats', () => {
  test('Formule HP : Salamèche niv.50 IV31 = 128 HP', ({ assert }) => {
    // calcHP(39, 31, 50) = floor((2*39+31)*50/100) + 50 + 10
    //                    = floor((78+31)*50/100) + 60
    //                    = floor(5450/100) + 60
    //                    = 54 + 60 = 114... attendons le résultat
    // Formule officielle : floor((2*base+iv)*level/100) + level + 10
    const hp = calcHP(39, 31, 50)
    // (2*39+31) = 109 ; 109*50=5450 ; 5450/100=54.5 → floor=54 ; 54+50+10 = 114
    assert.equal(hp, 114)
  })

  test('Formule HP : Dracaufeu niv.50 IV31', ({ assert }) => {
    // base_hp Dracaufeu = 78, IV 31, niveau 50
    // floor((2*78+31)*50/100) + 50 + 10
    // = floor((156+31)*50/100) + 60
    // = floor(187*50/100) + 60
    // = floor(9350/100) + 60
    // = 93 + 60 = 153
    const hp = calcHP(78, 31, 50)
    assert.equal(hp, 153)
  })

  test('Formule stat ATK Adamant ×1.1', ({ assert }) => {
    const modifier = getNatureModifier('adamant', 'atk')
    assert.equal(modifier, 1.1)
  })

  test('Formule stat ATK Adamant — calcul complet niv.50', ({ assert }) => {
    // ATK Salamèche niv.50 base=52 IV=31 nature=hardy (×1.0)
    // floor((2*52+31)*50/100 + 5) * 1.0
    // = floor((104+31)*50/100 + 5)
    // = floor(135*50/100 + 5)
    // = floor(67.5 + 5) = floor(72.5) = 72
    const atk = calcStat(52, 31, 50, 1.0)
    assert.equal(atk, 72)
  })

  test('Nature Adamant boost ATK ×1.1', ({ assert }) => {
    // ATK Salamèche niv.50 base=52 IV=31 nature=adamant
    const atk = calcStat(52, 31, 50, 1.1)
    // floor(72.5 * 1.1) = floor(79.75) = 79
    assert.equal(atk, 79)
  })

  test('Nature Bold penalty ATK ×0.9', ({ assert }) => {
    const modifier = getNatureModifier('bold', 'atk')
    assert.equal(modifier, 0.9)
  })

  test('Nature Hardy = neutre (×1.0)', ({ assert }) => {
    assert.equal(getNatureModifier('hardy', 'atk'), 1.0)
    assert.equal(getNatureModifier('hardy', 'speed'), 1.0)
  })
})

// ─── Efficacité de type ──────────────────────────────────────────────────────

test.group('Efficacité de type', () => {
  test('Feu vs Plante = ×2', ({ assert }) => {
    assert.equal(getTypeEffectiveness('fire', 'grass', null), 2)
  })

  test('Feu vs Eau = ×0.5', ({ assert }) => {
    assert.equal(getTypeEffectiveness('fire', 'water', null), 0.5)
  })

  test('Électrik vs Sol = ×0 (immunité)', ({ assert }) => {
    assert.equal(getTypeEffectiveness('electric', 'ground', null), 0)
  })

  test('Normal vs Spectre = ×0 (immunité)', ({ assert }) => {
    assert.equal(getTypeEffectiveness('normal', 'ghost', null), 0)
  })

  test('Dragon vs Fée = ×0 (immunité)', ({ assert }) => {
    assert.equal(getTypeEffectiveness('dragon', 'fairy', null), 0)
  })

  test('Feu vs Roche+Eau = ×0.5×0.5 = ×0.25', ({ assert }) => {
    assert.equal(getTypeEffectiveness('fire', 'rock', 'water'), 0.25)
  })

  test('Eau vs Feu+Roche = ×2×2 = ×4', ({ assert }) => {
    assert.equal(getTypeEffectiveness('water', 'fire', 'rock'), 4)
  })

  test('Combat vs Normal = ×2', ({ assert }) => {
    assert.equal(getTypeEffectiveness('fighting', 'normal', null), 2)
  })

  test('Poison vs Fée = ×2', ({ assert }) => {
    assert.equal(getTypeEffectiveness('poison', 'fairy', null), 2)
  })
})

// ─── STAB ────────────────────────────────────────────────────────────────────

test.group('STAB et dégâts', () => {
  test('STAB ×1.5 : move du même type que l\'attaquant', ({ assert }) => {
    // Salamèche (Feu) utilise Lance-Flammes (Feu) → STAB
    // On vérifie que le dégât est ~1.5× par rapport à un move sans STAB
    const attacker = makePokemon()
    const defender = makePokemon({ id: 'def', type1: 'normal', type2: null })

    const moveStab = makeMove({ type: 'fire' })    // STAB pour Salamèche
    const moveNoStab = makeMove({ type: 'water' }) // Pas de STAB

    // Fixer Math.random pour tests déterministes
    const origRandom = Math.random
    Math.random = () => 0.5  // 92.5% random fixé (0.5 → 93/100)

    const resultStab = calcDamage(attacker, defender, moveStab)
    const resultNoStab = calcDamage(attacker, defender, moveNoStab)

    Math.random = origRandom

    // Avec STAB, damage doit être ~1.5× sans STAB
    // Note: pas de critical dans ce test
    assert.isTrue(resultStab.damage > resultNoStab.damage)
    // Ratio approximatif
    const ratio = resultStab.damage / resultNoStab.damage
    assert.isTrue(ratio > 1.4 && ratio < 1.6, `Ratio STAB attendu ~1.5, obtenu ${ratio}`)
  })

  test('Critique ×1.5 augmente les dégâts', ({ assert }) => {
    // Test indirect : dégâts de base calculés correctement
    const attacker = makePokemon()
    const defender = makePokemon({ id: 'def', type1: 'normal', type2: null })
    const move = makeMove({ type: 'normal', category: 'physical' })

    const origRandom = Math.random
    let callCount = 0
    Math.random = () => {
      callCount++
      // Premier appel (critique) → 0 = critique garanti (< 1/24 ≈ 0.042)
      // Autres appels (random 85-100%) → 0.5
      return callCount === 1 ? 0 : 0.5
    }

    const resultCrit = calcDamage(attacker, defender, move)

    callCount = 0
    Math.random = () => {
      callCount++
      return callCount === 1 ? 1 : 0.5  // Pas de critique
    }

    const resultNoCrit = calcDamage(attacker, defender, move)
    Math.random = origRandom

    assert.isTrue(resultCrit.is_critical)
    assert.isFalse(resultNoCrit.is_critical)
    assert.isTrue(resultCrit.damage > resultNoCrit.damage)
    const ratio = resultCrit.damage / resultNoCrit.damage
    assert.isTrue(ratio > 1.4 && ratio < 1.6, `Ratio critique attendu ~1.5, obtenu ${ratio}`)
  })

  test('Move de statut → 0 dégâts', ({ assert }) => {
    const attacker = makePokemon()
    const defender = makePokemon({ id: 'def' })
    const move = makeMove({ category: 'status', power: null })

    const result = calcDamage(attacker, defender, move)
    assert.equal(result.damage, 0)
    assert.isFalse(result.is_critical)
  })
})

// ─── Effets de statut ────────────────────────────────────────────────────────

test.group('Effets de statut', () => {
  test('Brûlure = -10% HP max par action', ({ assert }) => {
    const pokemon = makePokemon()
    const hpBefore = pokemon.current_hp
    pokemon.status = { type: 'burn', actions_remaining: 999 }

    const result = applyStatusBeforeAction(pokemon)
    const expected_damage = Math.max(1, Math.floor(pokemon.max_hp * 0.1))

    assert.equal(result.damage_taken, expected_damage)
    assert.equal(pokemon.current_hp, hpBefore - expected_damage)
    assert.isFalse(result.should_skip)
  })

  test('Poison = -8% HP max par action', ({ assert }) => {
    const pokemon = makePokemon()
    const hpBefore = pokemon.current_hp
    pokemon.status = { type: 'poison', actions_remaining: 999 }

    const result = applyStatusBeforeAction(pokemon)
    const expected = Math.max(1, Math.floor(pokemon.max_hp * 0.08))

    assert.equal(result.damage_taken, expected)
    assert.equal(pokemon.current_hp, hpBefore - expected)
  })

  test('Sommeil = skip garanti', ({ assert }) => {
    const pokemon = makePokemon()
    pokemon.status = { type: 'sleep', actions_remaining: 3 }

    const result = applyStatusBeforeAction(pokemon)
    assert.isTrue(result.should_skip)
    assert.equal(result.damage_taken, 0)
    // actions_remaining décrémenté
    assert.equal(pokemon.status!.actions_remaining, 2)
  })

  test('Paralysie Speed ×0.5 dans timing', ({ assert }) => {
    const pokemon = makePokemon({ effective_speed: 100 })
    const normalDelay = calcActionDelay(pokemon)

    pokemon.status = { type: 'paralysis', actions_remaining: 999 }
    const paralysisDelay = calcActionDelay(pokemon)

    // Speed normal 100 → 3000ms ; Speed paralysé 50 → 6000ms
    assert.equal(normalDelay, 3000)
    assert.equal(paralysisDelay, 6000)
  })
})

// ─── Timing ──────────────────────────────────────────────────────────────────

test.group('Timing des actions', () => {
  test('Speed 100 → action toutes les 3000ms', ({ assert }) => {
    const pokemon = makePokemon({ effective_speed: 100 })
    // Override calcActionDelay indirectement via effective_speed
    assert.equal(calcActionDelay(pokemon), 3000)
  })

  test('Speed 150 → action toutes les 2000ms', ({ assert }) => {
    const pokemon = makePokemon({ effective_speed: 150 })
    assert.equal(calcActionDelay(pokemon), 2000)
  })

  test('Speed 50 → action toutes les 6000ms', ({ assert }) => {
    const pokemon = makePokemon({ effective_speed: 50 })
    assert.equal(calcActionDelay(pokemon), 6000)
  })
})

// ─── PP et Lutte ─────────────────────────────────────────────────────────────

test.group('PP et sélection de move', () => {
  test('PP vides → skip au move suivant', ({ assert }) => {
    const moves: CombatMove[] = [
      makeMove({ id: 1, name_fr: 'Move1', pp: 5 }),
      makeMove({ id: 2, name_fr: 'Move2', pp: 5 }),
      makeMove({ id: 3, name_fr: 'Move3', pp: 5 }),
      makeMove({ id: 4, name_fr: 'Move4', pp: 5 }),
    ]
    const pokemon = makePokemon({ moves })
    pokemon.pp_remaining = [0, 5, 5, 5]  // Move1 épuisé
    pokemon.current_move_index = 0

    const { move, index } = selectNextMove(pokemon)
    assert.equal(index, 1)  // Doit choisir Move2
    assert.equal(move.name_fr, 'Move2')
  })

  test('Tous PP vides → Lutte', ({ assert }) => {
    const moves: CombatMove[] = [
      makeMove({ id: 1, pp: 5 }),
      makeMove({ id: 2, pp: 5 }),
    ]
    const pokemon = makePokemon({ moves })
    pokemon.pp_remaining = [0, 0]

    const { move, index } = selectNextMove(pokemon)
    assert.equal(index, -1)
    assert.equal(move.name_fr, 'Lutte')
    assert.equal(move.id, -1)
    assert.equal(move.power, 50)
  })

  test('Lutte est un move Normal Physique 50 puissance', ({ assert }) => {
    assert.equal(STRUGGLE_MOVE.type, 'normal')
    assert.equal(STRUGGLE_MOVE.category, 'physical')
    assert.equal(STRUGGLE_MOVE.power, 50)
  })
})
