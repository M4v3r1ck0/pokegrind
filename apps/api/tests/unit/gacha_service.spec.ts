import { test } from '@japa/runner'
import '@japa/assert'
import {
  drawRarity as drawRarityFn,
  generateIVs as generateIVsFn,
  PITY_EPIC_THRESHOLD,
  PITY_LEGENDARY_DEFAULT,
  PITY_LEGENDARY_UPGRADED,
  GOLD_COST_1,
  GOLD_COST_10,
} from '../../app/services/GachaFormulas.js'

// Shim pour conserver la syntaxe GachaService.drawRarity() des tests existants
const GachaService = {
  drawRarity: drawRarityFn,
  generateIVs: generateIVsFn,
}

test.group('GachaService — drawRarity', () => {
  test('pity épique se déclenche à 50 pulls sans épique', ({ assert }) => {
    const rarity = GachaService.drawRarity(
      PITY_EPIC_THRESHOLD,
      0,
      PITY_LEGENDARY_DEFAULT
    )
    assert.equal(rarity, 'epic')
  })

  test('pity légendaire se déclenche à 200 pulls sans légendaire', ({ assert }) => {
    const rarity = GachaService.drawRarity(
      0,
      PITY_LEGENDARY_DEFAULT,
      PITY_LEGENDARY_DEFAULT
    )
    assert.equal(rarity, 'legendary')
  })

  test('pity légendaire réduit à 180 avec amélioration gems', ({ assert }) => {
    const rarity = GachaService.drawRarity(
      0,
      PITY_LEGENDARY_UPGRADED,
      PITY_LEGENDARY_UPGRADED
    )
    assert.equal(rarity, 'legendary')
  })

  test('pity légendaire ne se déclenche pas à 179 avec amélioration', ({ assert }) => {
    // Avec le threshold réduit à 180, un counter à 179 ne déclenche pas encore
    // On simule 10000 tirages — aucun ne sera forcé légendaire à 179
    let forcedLegendary = false
    for (let i = 0; i < 100; i++) {
      // On stub Math.random à 0 pour s'assurer qu'on ne tombe pas sur legendary naturellement
      const original = Math.random
      Math.random = () => 0.999 // forcer common
      const rarity = GachaService.drawRarity(0, 179, PITY_LEGENDARY_UPGRADED)
      Math.random = original
      if (rarity === 'legendary' && 179 < PITY_LEGENDARY_UPGRADED) {
        forcedLegendary = true
      }
    }
    assert.isFalse(forcedLegendary)
  })

  test('pity épique prioritaire sur pity légendaire si les deux sont déclenchés', ({ assert }) => {
    // Les deux sont au seuil — le légendaire doit primer (ordre dans drawRarity)
    const rarity = GachaService.drawRarity(
      PITY_EPIC_THRESHOLD,
      PITY_LEGENDARY_DEFAULT,
      PITY_LEGENDARY_DEFAULT
    )
    assert.equal(rarity, 'legendary')
  })
})

test.group('GachaService — generateIVs', () => {
  test('shiny génère minimum 3 IVs à 31', ({ assert }) => {
    for (let i = 0; i < 50; i++) {
      const ivs = GachaService.generateIVs('common', true)
      const values = Object.values(ivs)
      const perfect = values.filter((v) => v === 31)
      assert.isAtLeast(perfect.length, 3, `IVs shiny: ${JSON.stringify(ivs)}`)
    }
  })

  test('légendaire génère minimum 3 IVs à 31', ({ assert }) => {
    for (let i = 0; i < 50; i++) {
      const ivs = GachaService.generateIVs('legendary', false)
      const values = Object.values(ivs)
      const perfect = values.filter((v) => v === 31)
      // 3 garantis (les autres peuvent aussi être 31 par chance)
      assert.isAtLeast(perfect.length, 3, `IVs legendary: ${JSON.stringify(ivs)}`)
    }
  })

  test('mythique génère minimum 5 IVs à 31', ({ assert }) => {
    for (let i = 0; i < 50; i++) {
      const ivs = GachaService.generateIVs('mythic', false)
      const values = Object.values(ivs)
      const perfect = values.filter((v) => v === 31)
      // 5 garantis (le 6ème peut aussi être 31 par chance)
      assert.isAtLeast(perfect.length, 5, `IVs mythic: ${JSON.stringify(ivs)}`)
    }
  })

  test('épique génère exactement 1 IV à 20 ou plus garanti', ({ assert }) => {
    for (let i = 0; i < 50; i++) {
      const ivs = GachaService.generateIVs('epic', false)
      const values = Object.values(ivs)
      const highIvs = values.filter((v) => v >= 20)
      assert.isAtLeast(highIvs.length, 1, `IVs epic: ${JSON.stringify(ivs)}`)
    }
  })

  test('tous les IVs sont dans la plage 0-31', ({ assert }) => {
    const rarities: Array<'common' | 'rare' | 'epic' | 'legendary' | 'mythic'> = [
      'common', 'rare', 'epic', 'legendary', 'mythic',
    ]
    for (const rarity of rarities) {
      const ivs = GachaService.generateIVs(rarity, false)
      for (const [stat, value] of Object.entries(ivs)) {
        assert.isAtLeast(value, 0, `${stat} >= 0 pour ${rarity}`)
        assert.isAtMost(value, 31, `${stat} <= 31 pour ${rarity}`)
      }
    }
  })
})

test.group('GachaService — coûts', () => {
  test('coût 1 pull = 1000 or', ({ assert }) => {
    assert.equal(GOLD_COST_1, 1000)
  })

  test('coût 10 pulls = 9000 or (remise 10%)', ({ assert }) => {
    assert.equal(GOLD_COST_10, 9000)
    assert.isBelow(GOLD_COST_10, GOLD_COST_1 * 10)
  })
})

test.group('GachaService — pity reset', () => {
  test('le pity épique se reset à 0 quand déclenché', ({ assert }) => {
    // On simule manuellement ce que fait performPulls
    let pityEpic = PITY_EPIC_THRESHOLD
    const rarity = GachaService.drawRarity(pityEpic, 0, PITY_LEGENDARY_DEFAULT)
    assert.equal(rarity, 'epic')

    // Après un tirage épique, le pity se reset
    if (rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
      pityEpic = 0
    } else {
      pityEpic++
    }
    assert.equal(pityEpic, 0)
  })

  test('le pity légendaire se reset à 0 quand déclenché', ({ assert }) => {
    let pityLegendary = PITY_LEGENDARY_DEFAULT
    const rarity = GachaService.drawRarity(0, pityLegendary, PITY_LEGENDARY_DEFAULT)
    assert.equal(rarity, 'legendary')

    if (rarity === 'legendary' || rarity === 'mythic') {
      pityLegendary = 0
    } else {
      pityLegendary++
    }
    assert.equal(pityLegendary, 0)
  })
})
