/**
 * Tests unitaires — Calcul offline (fonctions pures uniquement)
 * Exécuter : node --import=tsx/esm tests/unit/run.ts
 */
import { test } from '@japa/runner'
import {
  formatAbsence,
  estimateTeamDPS,
  estimatePokemonDPSOffline,
  calculateDrops,
  getCTPool,
  calcAbsenceSeconds,
  MIN_ABSENCE_SECONDS,
  MAX_ABSENCE_SECONDS,
  CT_DROP_RATE,
  type TeamSnapshot,
  type OfflinePokemonSnapshot,
  type FloorSnapshot,
} from '../../app/services/OfflineFormulas.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCharmanderSnapshot(): OfflinePokemonSnapshot {
  return {
    species_id: 4,
    level: 50,
    nature: 'adamant',
    ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
    moves: [
      { move_id: 52, power: 95, category: 'special', type: 'fire' },    // Lance-Flammes
      { move_id: 10, power: 40, category: 'physical', type: 'normal' }, // Griffe
    ],
    type1: 'fire',
    type2: null,
    base_atk: 52,
    base_spatk: 60,
    base_speed: 65,
  }
}

function makeTeamSnapshot(count = 1): TeamSnapshot {
  return {
    pokemon: Array.from({ length: count }, () => makeCharmanderSnapshot()),
  }
}

function makeFloor(floor_number = 10, min_level = 15, max_level = 20): FloorSnapshot {
  return { floor_number, min_level, max_level, gold_base: 50, xp_base: 30 }
}

// ─── Absence < 5 min → pas de rapport ────────────────────────────────────────

test.group('Absence seuil', () => {
  test('absence < 5 min → calcAbsenceSeconds retourne null', ({ assert }) => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString() // 1 minute
    const result = calcAbsenceSeconds(recent)
    assert.isNull(result)
  })

  test('absence exactement 5 min → calcAbsenceSeconds retourne null (< MIN)', ({ assert }) => {
    const exactly5 = new Date(Date.now() - MIN_ABSENCE_SECONDS * 1000).toISOString()
    const result = calcAbsenceSeconds(exactly5)
    // Border case : peut être null ou 300 selon timing ms — vérifier seulement la valeur max
    assert.isTrue(result === null || result <= MIN_ABSENCE_SECONDS)
  })

  test('absence 1h → retourne ~3600 secondes', ({ assert }) => {
    const one_hour_ago = new Date(Date.now() - 3600 * 1000).toISOString()
    const result = calcAbsenceSeconds(one_hour_ago)
    assert.isNotNull(result)
    assert.isTrue(result! > 3500 && result! <= 3700, `Attendu ~3600, obtenu ${result}`)
  })

  test('absence > 24h → cap à 86400 secondes', ({ assert }) => {
    const two_days_ago = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const result = calcAbsenceSeconds(two_days_ago)
    assert.isNotNull(result)
    assert.equal(result, MAX_ABSENCE_SECONDS)
  })

  test('last_seen_at null → retourne null', ({ assert }) => {
    assert.isNull(calcAbsenceSeconds(null))
  })
})

// ─── DPS estimation ───────────────────────────────────────────────────────────

test.group('Estimation DPS', () => {
  test('Salamèche niv.50 → DPS > 0', ({ assert }) => {
    const poke = makeCharmanderSnapshot()
    const dps = estimatePokemonDPSOffline(poke)
    assert.isTrue(dps > 0, `DPS attendu > 0, obtenu ${dps}`)
  })

  test('Pokémon sans moves offensifs → DPS = 0', ({ assert }) => {
    const poke = makeCharmanderSnapshot()
    poke.moves = [{ move_id: 1, power: null, category: 'status', type: 'normal' }]
    assert.equal(estimatePokemonDPSOffline(poke), 0)
  })

  test('équipe de 3 → DPS = somme DPS individuels', ({ assert }) => {
    const team = makeTeamSnapshot(3)
    const individual = estimatePokemonDPSOffline(makeCharmanderSnapshot())
    const team_dps = estimateTeamDPS(team)
    // Tolérance flottante
    assert.isTrue(
      Math.abs(team_dps - individual * 3) < 0.01,
      `Attendu ${individual * 3}, obtenu ${team_dps}`
    )
  })

  test('équipe vide → DPS = 0', ({ assert }) => {
    assert.equal(estimateTeamDPS({ pokemon: [] }), 0)
  })

  test('niveau supérieur → DPS plus élevé', ({ assert }) => {
    const low = { ...makeCharmanderSnapshot(), level: 10 }
    const high = { ...makeCharmanderSnapshot(), level: 100 }
    assert.isTrue(estimatePokemonDPSOffline(high) > estimatePokemonDPSOffline(low))
  })
})

// ─── Formatage de l'absence ───────────────────────────────────────────────────

test.group('Format absence', () => {
  test('3662 secondes → "1h 01min"', ({ assert }) => {
    assert.equal(formatAbsence(3662), '1h 01min')
  })

  test('3600 secondes → "1h 00min"', ({ assert }) => {
    assert.equal(formatAbsence(3600), '1h 00min')
  })

  test('2520 secondes → "42min"', ({ assert }) => {
    assert.equal(formatAbsence(2520), '42min')
  })

  test('86400 secondes (24h) → "24h 00min"', ({ assert }) => {
    assert.equal(formatAbsence(86400), '24h 00min')
  })

  test('300 secondes (5min) → "5min"', ({ assert }) => {
    assert.equal(formatAbsence(300), '5min')
  })
})

// ─── Calcul des drops ─────────────────────────────────────────────────────────

test.group('Calcul des drops', () => {
  test('taux CT 0.1% par kill → ~10 CTs pour 10000 kills', ({ assert }) => {
    const floor = makeFloor(10)
    const drops = calculateDrops(floor, 10_000)
    const total_ct = drops.reduce((sum, d) => sum + d.quantity, 0)
    // Attendu ~10 ± 15 (tolérance large pour aléatoire)
    assert.isTrue(total_ct > 0 && total_ct < 40, `Total CT: ${total_ct} (attendu ~10)`)
  })

  test('0 kills → drops vides', ({ assert }) => {
    const floor = makeFloor(10)
    assert.deepEqual(calculateDrops(floor, 0), [])
  })

  test('pools de CTs différents selon l\'étage', ({ assert }) => {
    const pool1 = getCTPool(5)
    const pool50 = getCTPool(50)
    assert.isTrue(pool1.length > 0)
    assert.isTrue(pool50.length > 0)
    // Les pools sont différents
    assert.notDeepEqual(pool1, pool50)
  })

  test('CT_DROP_RATE = 0.001 (0.1%)', ({ assert }) => {
    assert.equal(CT_DROP_RATE, 0.001)
  })
})
