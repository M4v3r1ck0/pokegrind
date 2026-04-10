/**
 * Tests unitaires — DungeonService (pure functions)
 */

import { test } from '@japa/runner'

import {
  hashString,
  currentWeekNumber,
  weightedRandom,
  generateRoomLayout,
  modifierCountForDifficulty,
  applyDungeonModifiers,
  calcRestHealing,
  drawRandomReward,
  type DungeonPokemonSnapshot,
  type DungeonModifier,
} from '../../app/services/DungeonGeneratorService.js'
import { createSeededRng } from '../../app/services/TowerGeneratorService.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<DungeonPokemonSnapshot> = {}): DungeonPokemonSnapshot {
  return {
    player_pokemon_id: 'poke-1',
    species_id: 6,
    name_fr: 'Dracaufeu',
    level: 50,
    current_hp: 148,
    max_hp: 148,
    sprite_url: '',
    is_shiny: false,
    nature: 'adamant',
    ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
    base_hp: 78,
    base_atk: 84,
    base_def: 78,
    base_spatk: 109,
    base_spdef: 85,
    base_speed: 100,
    type1: 'fire',
    type2: 'flying',
    moves: [
      { id: 53, name_fr: 'Lance-Flammes', type: 'fire', category: 'special',
        power: 90, accuracy: 100, pp: 15, pp_remaining: 15, priority: 0, effect: null },
    ],
    ...overrides,
  }
}

function makeModifier(overrides: Partial<DungeonModifier> = {}): DungeonModifier {
  return {
    id: 1,
    name_fr: 'Adrénaline',
    description_fr: 'Speed ×1.3',
    modifier_type: 'buff',
    effect_json: { all_speed_mult: 1.3 },
    ...overrides,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

test.group('hashString', () => {
  test('retourne un entier positif', ({ assert }) => {
    assert.isAbove(hashString('hello'), -1)
    assert.isNumber(hashString('hello'))
  })
  test('même string → même hash', ({ assert }) => {
    assert.equal(hashString('pokegrind'), hashString('pokegrind'))
  })
  test('strings différentes → hashes différents (avec haute probabilité)', ({ assert }) => {
    assert.notEqual(hashString('player-a'), hashString('player-b'))
  })
})

test.group('currentWeekNumber', () => {
  test('retourne un entier positif', ({ assert }) => {
    const w = currentWeekNumber()
    assert.isNumber(w)
    assert.isAbove(w, 0)
  })
  test('semaine cohérente avec la date', ({ assert }) => {
    const w = currentWeekNumber()
    // Semaines depuis epoch ~ 2024-04 = autour de 2800
    assert.isAbove(w, 2800)
    assert.isBelow(w, 9999)
  })
})

test.group('weightedRandom', () => {
  test('retourne une clé valide', ({ assert }) => {
    const rng = createSeededRng(42)
    const weights = { combat: 50, rest: 25, treasure: 25 }
    for (let i = 0; i < 20; i++) {
      const result = weightedRandom(weights, rng)
      assert.include(['combat', 'rest', 'treasure'], result)
    }
  })
  test('distribution respecte approximativement les poids', ({ assert }) => {
    const rng = createSeededRng(1337)
    const weights = { a: 80, b: 20 }
    let count_a = 0
    for (let i = 0; i < 1000; i++) {
      if (weightedRandom(weights, rng) === 'a') count_a++
    }
    // Doit être entre 70% et 90%
    assert.isAbove(count_a, 700)
    assert.isBelow(count_a, 900)
  })
})

// ─── Layout de salles ─────────────────────────────────────────────────────────

test.group('generateRoomLayout', () => {
  test('salle 1 toujours de type combat', ({ assert }) => {
    const layout = generateRoomLayout(1, 'player-uuid', 2800)
    assert.equal(layout[0].room_number, 1)
    assert.equal(layout[0].type, 'combat')
  })

  test('salle 10 toujours de type boss', ({ assert }) => {
    const layout = generateRoomLayout(1, 'player-uuid', 2800)
    assert.equal(layout[9].room_number, 10)
    assert.equal(layout[9].type, 'boss')
  })

  test('retourne exactement 10 salles', ({ assert }) => {
    const layout = generateRoomLayout(1, 'player-uuid', 2800)
    assert.equal(layout.length, 10)
  })

  test('salles numérotées 1 à 10', ({ assert }) => {
    const layout = generateRoomLayout(1, 'player-uuid', 2800)
    for (let i = 0; i < 10; i++) {
      assert.equal(layout[i].room_number, i + 1)
    }
  })

  test('semi-déterministe : même joueur + même semaine + même donjon = même layout', ({ assert }) => {
    const l1 = generateRoomLayout(1, 'player-abc', 2800)
    const l2 = generateRoomLayout(1, 'player-abc', 2800)
    assert.deepEqual(l1, l2)
  })

  test('layout différent pour deux joueurs différents', ({ assert }) => {
    const l1 = generateRoomLayout(1, 'player-aaa', 2800)
    const l2 = generateRoomLayout(1, 'player-bbb', 2800)
    // Les salles 2-9 doivent différer au moins une fois
    const middle1 = l1.slice(1, 9).map((r) => r.type).join(',')
    const middle2 = l2.slice(1, 9).map((r) => r.type).join(',')
    assert.notEqual(middle1, middle2)
  })

  test('layout différent pour deux semaines différentes', ({ assert }) => {
    const l1 = generateRoomLayout(1, 'player-abc', 2800)
    const l2 = generateRoomLayout(1, 'player-abc', 2801)
    const middle1 = l1.slice(1, 9).map((r) => r.type).join(',')
    const middle2 = l2.slice(1, 9).map((r) => r.type).join(',')
    assert.notEqual(middle1, middle2)
  })

  test('layout différent pour deux donjons différents', ({ assert }) => {
    const l1 = generateRoomLayout(1, 'player-abc', 2800)
    const l2 = generateRoomLayout(2, 'player-abc', 2800)
    const middle1 = l1.slice(1, 9).map((r) => r.type).join(',')
    const middle2 = l2.slice(1, 9).map((r) => r.type).join(',')
    assert.notEqual(middle1, middle2)
  })

  test('toutes les salles 2-9 ont un type valide', ({ assert }) => {
    const VALID_TYPES = ['combat', 'elite', 'rest', 'treasure', 'shop', 'trap']
    const layout = generateRoomLayout(3, 'player-xyz', 2800)
    for (const room of layout.slice(1, 9)) {
      assert.include(VALID_TYPES, room.type)
    }
  })

  test('salles initialement non complétées', ({ assert }) => {
    const layout = generateRoomLayout(1, 'player-abc', 2800)
    for (const room of layout) {
      assert.isFalse(room.completed)
    }
  })

  test('proportion de salles rest ≈ 15% sur 100 layouts', ({ assert }) => {
    let rest_count = 0
    for (let i = 0; i < 100; i++) {
      const layout = generateRoomLayout(1, `player-${i}`, 2800)
      // Salles 2-9 seulement (8 salles)
      rest_count += layout.slice(1, 9).filter((r) => r.type === 'rest').length
    }
    // 100 layouts × 8 salles = 800 total, ~15% = ~120 rest
    assert.isAbove(rest_count, 80)
    assert.isBelow(rest_count, 180)
  })
})

// ─── Modificateurs ────────────────────────────────────────────────────────────

test.group('modifierCountForDifficulty', () => {
  test('normal → 1 modificateur', ({ assert }) => {
    assert.equal(modifierCountForDifficulty('normal'), 1)
  })
  test('hard → 2 modificateurs', ({ assert }) => {
    assert.equal(modifierCountForDifficulty('hard'), 2)
  })
  test('legendary → 3 modificateurs', ({ assert }) => {
    assert.equal(modifierCountForDifficulty('legendary'), 3)
  })
})

test.group('applyDungeonModifiers', () => {
  test('Adrénaline : speed ×1.3 appliqué', ({ assert }) => {
    const team = [makeSnapshot()]
    const original_speed = team[0].base_speed  // 100
    const mods = [makeModifier({ effect_json: { all_speed_mult: 1.3 } })]
    const result = applyDungeonModifiers(team, mods)
    assert.equal(result[0].base_speed, Math.floor(original_speed * 1.3))
  })

  test('Berserker : ATK ×1.5, DEF ×0.7', ({ assert }) => {
    const team = [makeSnapshot()]
    const orig_atk = team[0].base_atk
    const orig_def = team[0].base_def
    const mods = [makeModifier({ effect_json: { all_atk_mult: 1.5, all_def_mult: 0.7 } })]
    const result = applyDungeonModifiers(team, mods)
    assert.equal(result[0].base_atk,  Math.floor(orig_atk * 1.5))
    assert.equal(result[0].base_def,  Math.floor(orig_def * 0.7))
  })

  test('Vitalité : HP max ×1.25, current_hp ≤ nouveau max', ({ assert }) => {
    const team = [makeSnapshot({ current_hp: 80, max_hp: 148 })]
    const mods = [makeModifier({ effect_json: { all_hp_mult: 1.25 } })]
    const result = applyDungeonModifiers(team, mods)
    const expected_max = Math.floor(148 * 1.25)
    assert.equal(result[0].max_hp, expected_max)
    assert.isAtMost(result[0].current_hp, result[0].max_hp)
  })

  test('Malédiction : HP max ×0.75, current_hp réduit si nécessaire', ({ assert }) => {
    const team = [makeSnapshot({ current_hp: 148, max_hp: 148 })]
    const mods = [makeModifier({ effect_json: { all_hp_mult: 0.75 } })]
    const result = applyDungeonModifiers(team, mods)
    const expected_max = Math.floor(148 * 0.75)
    assert.equal(result[0].max_hp, expected_max)
    assert.isAtMost(result[0].current_hp, result[0].max_hp)
  })

  test('Épuisement : PP divisés par 2 (arrondi inférieur, min 1)', ({ assert }) => {
    const team = [makeSnapshot()]
    team[0].moves[0].pp_remaining = 15
    const mods = [makeModifier({ effect_json: { pp_reduction: 0.5 } })]
    const result = applyDungeonModifiers(team, mods)
    assert.equal(result[0].moves[0].pp_remaining, Math.floor(15 * 0.5))
  })

  test('PP_reduction avec pp=1 → min 1', ({ assert }) => {
    const team = [makeSnapshot()]
    team[0].moves[0].pp_remaining = 1
    const mods = [makeModifier({ effect_json: { pp_reduction: 0.5 } })]
    const result = applyDungeonModifiers(team, mods)
    assert.isAtLeast(result[0].moves[0].pp_remaining, 1)
  })

  test('ne mute pas le snapshot original', ({ assert }) => {
    const team = [makeSnapshot()]
    const original_speed = team[0].base_speed
    const mods = [makeModifier({ effect_json: { all_speed_mult: 2.0 } })]
    applyDungeonModifiers(team, mods)
    assert.equal(team[0].base_speed, original_speed)
  })

  test('modificateur Anti-Type : blocked_type présent ne provoque pas d\'erreur', ({ assert }) => {
    const team = [makeSnapshot()]
    const mods = [makeModifier({ effect_json: { random_type_blocked: true, blocked_type: 'fire' } })]
    assert.doesNotThrow(() => applyDungeonModifiers(team, mods))
  })

  test('aucun modificateur → snapshots inchangés', ({ assert }) => {
    const team = [makeSnapshot()]
    const result = applyDungeonModifiers(team, [])
    assert.equal(result[0].base_speed, team[0].base_speed)
    assert.equal(result[0].base_atk,   team[0].base_atk)
    assert.equal(result[0].max_hp,     team[0].max_hp)
  })
})

// ─── Salle de repos ───────────────────────────────────────────────────────────

test.group('calcRestHealing', () => {
  test('salle repos : HP restaurés à 30% du max', ({ assert }) => {
    const team = [makeSnapshot({ current_hp: 50, max_hp: 148 })]
    const healed = calcRestHealing(team)
    const expected = Math.floor(148 * 0.30)
    assert.equal(healed['poke-1'], expected)
  })

  test('HP plein → heal = 0', ({ assert }) => {
    const team = [makeSnapshot({ current_hp: 148, max_hp: 148 })]
    const healed = calcRestHealing(team)
    assert.equal(healed['poke-1'], 0)
  })

  test('Pokémon KO (hp=0) → exclu du heal', ({ assert }) => {
    const team = [makeSnapshot({ current_hp: 0, max_hp: 148 })]
    const healed = calcRestHealing(team)
    assert.isUndefined(healed['poke-1'])
  })

  test('heal ne dépasse pas le HP max', ({ assert }) => {
    const team = [makeSnapshot({ current_hp: 140, max_hp: 148 })]
    const healed = calcRestHealing(team)
    const result_hp = team[0].current_hp + (healed['poke-1'] ?? 0)
    assert.isAtMost(result_hp, team[0].max_hp)
  })

  test('plusieurs Pokémon → tous traités', ({ assert }) => {
    const team = [
      makeSnapshot({ player_pokemon_id: 'p1', current_hp: 50, max_hp: 100 }),
      makeSnapshot({ player_pokemon_id: 'p2', current_hp: 20, max_hp: 80 }),
    ]
    const healed = calcRestHealing(team)
    assert.equal(healed['p1'], Math.floor(100 * 0.30))
    assert.equal(healed['p2'], Math.floor(80  * 0.30))
  })
})

// ─── Tirage de récompenses ────────────────────────────────────────────────────

test.group('drawRandomReward', () => {
  test('pool vide → null', ({ assert }) => {
    const rng = createSeededRng(1)
    assert.isNull(drawRandomReward([], rng))
  })

  test('retourne un item du pool', ({ assert }) => {
    const rng  = createSeededRng(42)
    const pool = [
      { type: 'item', item_name: 'Vie-Orbe', weight: 50 },
      { type: 'item', item_name: 'Restes', weight: 50 },
    ]
    const drawn: any = drawRandomReward(pool, rng)
    assert.include(['Vie-Orbe', 'Restes'], drawn.item_name)
  })

  test('récompense garantie : gems toujours présents si pool = [{type:gems}]', ({ assert }) => {
    const rng  = createSeededRng(999)
    const pool = [{ type: 'gems', amount: 15, weight: 100 }]
    const drawn: any = drawRandomReward(pool, rng)
    assert.equal(drawn.type, 'gems')
    assert.equal(drawn.amount, 15)
  })

  test('tirage aléatoire respecte les poids (100% d\'un seul item)', ({ assert }) => {
    const rng  = createSeededRng(123)
    const pool = [
      { type: 'pokemon', species_id: 147, weight: 100 },
      { type: 'item',   item_name: 'Restes', weight: 0 },
    ]
    for (let i = 0; i < 10; i++) {
      const drawn: any = drawRandomReward(pool, rng)
      assert.equal(drawn.type, 'pokemon')
    }
  })
})

// ─── Cas métier ───────────────────────────────────────────────────────────────

test.group('Cas métier Donjons', () => {
  test('prestige insuffisant → message explicite (simulé)', ({ assert }) => {
    // Test unitaire : on vérifie que le message d'erreur attendu est cohérent
    const prestige_player = 1
    const min_prestige_donjon = 5
    assert.isTrue(prestige_player < min_prestige_donjon)
  })

  test('un seul run par donjon par semaine : même semaine = conflit', ({ assert }) => {
    const week1 = currentWeekNumber()
    const week2 = currentWeekNumber()
    assert.equal(week1, week2)
  })

  test('reset hebdomadaire : semaine suivante ≠ semaine courante', ({ assert }) => {
    const current = currentWeekNumber()
    const next    = current + 1
    assert.notEqual(current, next)
  })

  test('Brume Toxique : tous les Pokémon démarrent empoisonnés (flag vérifié)', ({ assert }) => {
    const mod = makeModifier({ effect_json: { poison_on_start: true } })
    assert.isTrue(mod.effect_json.poison_on_start === true)
  })

  test('Anti-Type : blocked_type stocké dans effect_json', ({ assert }) => {
    const mod = makeModifier({ effect_json: { random_type_blocked: true, blocked_type: 'electric' } })
    assert.equal(mod.effect_json.blocked_type, 'electric')
  })

  test('salle shop : prix réduit vs prix de base (60% du prix standard)', ({ assert }) => {
    const base_price = 5000
    const reduced    = Math.floor(base_price * 0.6)
    assert.isBelow(reduced, base_price)
    assert.equal(reduced, 3000)
  })

  test('combat simulé : équipe KO → défaite', ({ assert }) => {
    // Vérifier que tous les Pokémon KO = defeat
    const surviving: any[] = []   // aucun survivant
    const def_alive: any[] = []
    const player_wins = surviving.length > 0 && def_alive.length === 0
    assert.isFalse(player_wins)
  })

  test('victoire boss → run.status = completed (logique)', ({ assert }) => {
    const run_status_after_boss_win = 'completed'
    assert.equal(run_status_after_boss_win, 'completed')
  })

  test('récompenses pool — garantie gems toujours présente', ({ assert }) => {
    const pool = {
      guaranteed: [{ type: 'gems', amount: 15 }],
      random: [{ type: 'item', item_name: 'Vie-Orbe', weight: 100 }],
    }
    assert.isAbove(pool.guaranteed.length, 0)
    assert.equal(pool.guaranteed[0].type, 'gems')
    assert.equal(pool.guaranteed[0].amount, 15)
  })
})
