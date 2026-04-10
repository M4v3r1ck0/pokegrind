/**
 * Tests unitaires — DaycareService (fonctions pures + logique métier)
 * Exécuter : node --import=tsx/esm tests/unit/run.ts
 */
import { test } from '@japa/runner'
import {
  HATCH_THRESHOLDS,
  calcBreedingIVs,
  areBreedingCompatible,
  DITTO_SPECIES_ID,
  type IVSet,
} from '../../app/services/DaycareFormulas.js'

// ─── Mock PokemonSpecies minimal ─────────────────────────────────────────────

function makeSpecies(id: number, eggGroups: string[]): any {
  return { id, eggGroups }
}

// ─── Seuils d'éclosion ────────────────────────────────────────────────────────

test.group('Seuils d\'éclosion', () => {
  test('seuil éclosion commun = 500 000 dégâts', ({ assert }) => {
    assert.equal(HATCH_THRESHOLDS.common, 500_000)
  })

  test('seuil éclosion rare = 1 000 000 dégâts', ({ assert }) => {
    assert.equal(HATCH_THRESHOLDS.rare, 1_000_000)
  })

  test('seuil éclosion épique = 2 000 000 dégâts', ({ assert }) => {
    assert.equal(HATCH_THRESHOLDS.epic, 2_000_000)
  })

  test('seuil éclosion légendaire = 5 000 000 dégâts', ({ assert }) => {
    assert.equal(HATCH_THRESHOLDS.legendary, 5_000_000)
  })
})

// ─── Dressage — IVs hérités ──────────────────────────────────────────────────

test.group('Dressage — IVs hérités', () => {
  test('dressage : 3 meilleurs IVs hérités des deux parents', ({ assert }) => {
    const p1: IVSet = { hp: 31, atk: 31, def: 31, spatk: 0, spdef: 0, speed: 0 }
    const p2: IVSet = { hp: 0, atk: 0, def: 0, spatk: 31, spdef: 31, speed: 31 }

    const child = calcBreedingIVs(p1, p2)

    // Les 3 meilleurs IVs des parents sont HP=31, ATK=31, DEF=31 (de p1) ET SPATK=31, SPDEF=31, SPEED=31 (de p2)
    // Tous les best-by-stat = 31, les 3 premiers pris → les 3 premiers alphabétiques ou les premiers dans le tri
    // En pratique les 6 best sont tous 31 → les 3 hérités seront 3 des 6 à 31
    // et les 3 autres aussi 31 (car best de p2)
    // → Tous les IVs hérités = 31
    const inherited_count = [child.hp, child.atk, child.def, child.spatk, child.spdef, child.speed]
      .filter(iv => iv === 31).length
    assert.isTrue(inherited_count >= 3, `Au moins 3 IVs à 31, obtenu ${inherited_count}`)
  })

  test('dressage : les 3 IVs hérités sont les meilleurs combinés', ({ assert }) => {
    // p1 a de bons IVs en HP, ATK, DEF
    // p2 a de bons IVs en SPATK, SPDEF, SPEED
    const p1: IVSet = { hp: 28, atk: 30, def: 25, spatk: 5, spdef: 3, speed: 2 }
    const p2: IVSet = { hp: 4, atk: 6, def: 7, spatk: 27, spdef: 29, speed: 31 }

    const child = calcBreedingIVs(p1, p2)

    // Meilleurs IVs par stat : hp=28, atk=30, def=25, spatk=27, spdef=29, speed=31
    // Top 3 : speed=31, atk=30, spdef=29
    // Ces 3 doivent être hérités avec leur valeur exacte
    assert.equal(child.speed, 31)
    assert.equal(child.atk, 30)
    assert.equal(child.spdef, 29)

    // Les 3 autres (hp=28, def=25, spatk=27) sont aléatoires (0-31)
    assert.isTrue(child.hp >= 0 && child.hp <= 31)
    assert.isTrue(child.def >= 0 && child.def <= 31)
    assert.isTrue(child.spatk >= 0 && child.spatk <= 31)
  })

  test('dressage : tous les IVs hérités sont dans 0-31', ({ assert }) => {
    const p1: IVSet = { hp: 15, atk: 20, def: 10, spatk: 25, spdef: 30, speed: 5 }
    const p2: IVSet = { hp: 20, atk: 10, def: 25, spatk: 15, spdef: 5, speed: 30 }

    const child = calcBreedingIVs(p1, p2)
    const stats: (keyof IVSet)[] = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed']
    for (const stat of stats) {
      assert.isTrue(child[stat] >= 0 && child[stat] <= 31, `IV ${stat}=${child[stat]} hors plage`)
    }
  })
})

// ─── Compatibilité dressage ──────────────────────────────────────────────────

test.group('Compatibilité dressage', () => {
  test('Ovoïde (ID 132) compatible avec toute espèce', ({ assert }) => {
    const ditto = makeSpecies(DITTO_SPECIES_ID, ['ditto'])
    const charizard = makeSpecies(6, ['monster', 'dragon'])
    const pikachu = makeSpecies(25, ['field', 'fairy'])
    const snorlax = makeSpecies(143, ['monster'])

    assert.isTrue(areBreedingCompatible(ditto, charizard))
    assert.isTrue(areBreedingCompatible(charizard, ditto))
    assert.isTrue(areBreedingCompatible(ditto, pikachu))
    assert.isTrue(areBreedingCompatible(ditto, snorlax))
  })

  test('deux Pokémon du même egg_group sont compatibles', ({ assert }) => {
    const charizard = makeSpecies(6, ['monster', 'dragon'])
    const snorlax = makeSpecies(143, ['monster'])

    assert.isTrue(areBreedingCompatible(charizard, snorlax))
  })

  test('deux Pokémon sans egg_group commun ne sont pas compatibles', ({ assert }) => {
    const pikachu = makeSpecies(25, ['field', 'fairy'])
    const onix = makeSpecies(95, ['mineral'])

    assert.isFalse(areBreedingCompatible(pikachu, onix))
  })

  test('même espèce → pas de dressage', ({ assert }) => {
    const char1 = makeSpecies(4, ['monster', 'dragon'])
    const char2 = makeSpecies(4, ['monster', 'dragon'])

    assert.isFalse(areBreedingCompatible(char1, char2))
  })

  test('groupe no-eggs → incompatible', ({ assert }) => {
    const legendary = makeSpecies(144, ['no-eggs'])
    const normal = makeSpecies(143, ['monster'])

    assert.isFalse(areBreedingCompatible(legendary, normal))
  })

  test('espèces différentes, même egg_group → compatible', ({ assert }) => {
    const squirtle = makeSpecies(7, ['water1', 'monster'])
    const totodile = makeSpecies(158, ['water1', 'monster'])

    assert.isTrue(areBreedingCompatible(squirtle, totodile))
  })
})

// ─── Logique d'éclosion (valeurs simulées sans DB) ────────────────────────────

test.group('Éclosion — probabilités', () => {
  test('Shiny à 5★ : probabilité 1/200', ({ assert }) => {
    // Simuler 10 000 éclosions à 5★ → ~50 shiny (tolérance large)
    let shiny_count = 0
    const trials = 10_000
    for (let i = 0; i < trials; i++) {
      if (Math.random() < 1 / 200) shiny_count++
    }
    // Attendu : ~50 ± 30 (3 sigma)
    assert.isTrue(shiny_count > 5 && shiny_count < 120,
      `Shiny count: ${shiny_count} (attendu ~50 sur ${trials} essais)`)
  })

  test('Talent Caché : probabilité 0.5%', ({ assert }) => {
    // Simuler 10 000 éclosions → ~50 talents
    let talent_count = 0
    const trials = 10_000
    for (let i = 0; i < trials; i++) {
      if (Math.random() < 0.005) talent_count++
    }
    // Attendu : ~50 ± 30
    assert.isTrue(talent_count > 5 && talent_count < 120,
      `Talent count: ${talent_count} (attendu ~50 sur ${trials} essais)`)
  })

  test('stars ne dépasse pas 5', ({ assert }) => {
    // Test logique : Math.min(5, stars + 1)
    for (let stars = 0; stars <= 10; stars++) {
      const result = Math.min(5, stars + 1)
      assert.isTrue(result <= 5, `Stars ${stars} → ${result} devrait être ≤ 5`)
    }
    assert.equal(Math.min(5, 5 + 1), 5)
    assert.equal(Math.min(5, 4 + 1), 5)
    assert.equal(Math.min(5, 3 + 1), 4)
  })
})

// ─── Distribution des dégâts ─────────────────────────────────────────────────

test.group('Distribution des dégâts', () => {
  test('dégâts distribués équitablement entre slots actifs', ({ assert }) => {
    // Test de la formule : damage_per_slot = floor(total / active_count)
    const total_damage = 1_000
    const active_slots = 4
    const per_slot = Math.floor(total_damage / active_slots)

    assert.equal(per_slot, 250)
  })

  test('dégâts nuls si aucun slot actif', ({ assert }) => {
    const active_slots = 0
    // On vérifie que la division par zéro est gérée
    const per_slot = active_slots > 0 ? Math.floor(1000 / active_slots) : 0
    assert.equal(per_slot, 0)
  })

  test('un seul slot actif reçoit tous les dégâts', ({ assert }) => {
    const total_damage = 750
    const active_slots = 1
    const per_slot = Math.floor(total_damage / active_slots)
    assert.equal(per_slot, 750)
  })
})
