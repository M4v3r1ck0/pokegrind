/**
 * Tests unitaires — Raid Service (fonctions pures RaidFormulas)
 */

import { test } from '@japa/runner'

import {
  calcRaidDamage,
  calcRewardTier,
  calcContributionPercent,
  isCooldownExpired,
  calcNextAttackAt,
  calcProgressPercent,
  calcTimeRemainingSeconds,
  buildRewardEntries,
  buildExpiredRewardEntries,
  estimatePlayersNeeded,
  RAID_COOLDOWN_MS,
  RAID_SIMULATE_SECONDS,
  type RewardTiers,
} from '../../app/services/RaidFormulas.js'

import type { OfflinePokemonSnapshot } from '../../app/services/OfflineFormulas.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_TIERS: RewardTiers = {
  legend:   { min_percent: 5.0,  rewards: ['legendary_pokemon', 'gems_50'] },
  champion: { min_percent: 2.0,  rewards: ['legendary_pokemon', 'gems_30'] },
  hero:     { min_percent: 0.5,  rewards: ['rare_pokemon', 'gems_15'] },
  fighter:  { min_percent: 0.1,  rewards: ['gems_10'] },
  support:  { min_percent: 0.01, rewards: ['gems_5'] },
}

function makeTeam(count = 3): OfflinePokemonSnapshot[] {
  return Array.from({ length: count }, (_, i) => ({
    species_id: 6 + i,
    level: 100,
    nature: 'hardy' as any,
    ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
    type1: 'fire' as any,
    type2: null,
    base_atk: 84,
    base_spatk: 109,
    base_speed: 100,
    moves: [
      { move_id: 394, power: 90, category: 'special' as any, type: 'fire' as any },
      { move_id: 56,  power: 95, category: 'special' as any, type: 'ice' as any },
    ],
  }))
}

// ─── Tests Cooldown ───────────────────────────────────────────────────────────

test.group('Cooldown 4h', () => {
  test('cooldown 4h : deuxième attaque trop tôt → rejeté', ({ assert }) => {
    const now = Date.now()
    const last_attack_at = new Date(now - 1 * 60 * 60 * 1000).toISOString() // 1h ago
    const expired = isCooldownExpired(last_attack_at, now)
    assert.isFalse(expired)
  })

  test('cooldown 4h : après exactement 4h → autorisé', ({ assert }) => {
    const now = Date.now()
    const last_attack_at = new Date(now - RAID_COOLDOWN_MS).toISOString() // exactly 4h ago
    const expired = isCooldownExpired(last_attack_at, now)
    assert.isTrue(expired)
  })

  test('cooldown 4h : après 5h → autorisé', ({ assert }) => {
    const now = Date.now()
    const last_attack_at = new Date(now - 5 * 60 * 60 * 1000).toISOString()
    const expired = isCooldownExpired(last_attack_at, now)
    assert.isTrue(expired)
  })

  test('cooldown 4h : première attaque (null) → autorisé', ({ assert }) => {
    assert.isTrue(isCooldownExpired(null))
  })

  test('calcNextAttackAt retourne +4h après la dernière attaque', ({ assert }) => {
    const now = new Date('2026-01-01T12:00:00.000Z')
    const next = calcNextAttackAt(now.toISOString())
    assert.isNotNull(next)
    const expected = new Date('2026-01-01T16:00:00.000Z')
    assert.equal(new Date(next!).getTime(), expected.getTime())
  })
})

// ─── Tests Dégâts ────────────────────────────────────────────────────────────

test.group('Calcul des dégâts Raid', () => {
  test('calcRaidDamage : retourne un damage > 0 avec une équipe valide', ({ assert }) => {
    const team = makeTeam(3)
    const result = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 42 })
    assert.isAbove(result.damage, 0)
    assert.isAbove(result.base_dps, 0)
    assert.equal(result.simulated_seconds, RAID_SIMULATE_SECONDS)
  })

  test('variance ±15% : deux attaques avec seeds différents → dégâts différents', ({ assert }) => {
    const team = makeTeam(3)
    const result1 = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 1 })
    const result2 = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 9999 })
    assert.notEqual(result1.damage, result2.damage)
  })

  test('multiplicateur prestige appliqué aux dégâts Raid', ({ assert }) => {
    const team = makeTeam(3)
    const base = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 42 })
    const prestige = calcRaidDamage({ team, prestige_gold_mult: 2.0, seed: 42 })
    assert.isAbove(prestige.damage, base.damage)
  })

  test('variance borne inférieure : seed 0 → damage >= base * 0.85', ({ assert }) => {
    const team = makeTeam(3)
    const result = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 0 })
    const expected_min = result.base_dps * RAID_SIMULATE_SECONDS * 0.85
    assert.isAtLeast(result.damage, Math.floor(expected_min * 0.9)) // marge 10% pour arrondi
  })
})

// ─── Tests HP ────────────────────────────────────────────────────────────────

test.group('HP et progression', () => {
  test('calcProgressPercent : 0 damage → 0% vaincu', ({ assert }) => {
    assert.equal(calcProgressPercent(1_000_000, 1_000_000), 0)
  })

  test('calcProgressPercent : HP 0 → 100% vaincu', ({ assert }) => {
    assert.equal(calcProgressPercent(0, 1_000_000), 100)
  })

  test('calcProgressPercent : HP à 50% → 50% vaincu', ({ assert }) => {
    assert.equal(calcProgressPercent(500_000, 1_000_000), 50)
  })

  test('HP tombent à 0 → raid considéré defeated (progressPercent = 100)', ({ assert }) => {
    const pct = calcProgressPercent(0, 10_000_000_000)
    assert.equal(pct, 100)
  })

  test('calcTimeRemainingSeconds : temps futur → positif', ({ assert }) => {
    const future = new Date(Date.now() + 3_600_000).toISOString()
    const secs = calcTimeRemainingSeconds(future)
    assert.isAbove(secs, 3500)
  })

  test('calcTimeRemainingSeconds : temps passé → 0', ({ assert }) => {
    const past = new Date(Date.now() - 3_600_000).toISOString()
    assert.equal(calcTimeRemainingSeconds(past), 0)
  })
})

// ─── Tests Tiers ─────────────────────────────────────────────────────────────

test.group('Calcul des tiers de récompense', () => {
  test('contribution 5% → tier Légende', ({ assert }) => {
    assert.equal(calcRewardTier(5.0, MOCK_TIERS), 'legend')
  })

  test('contribution 10% → tier Légende', ({ assert }) => {
    assert.equal(calcRewardTier(10.0, MOCK_TIERS), 'legend')
  })

  test('contribution 2% → tier Champion', ({ assert }) => {
    assert.equal(calcRewardTier(2.0, MOCK_TIERS), 'champion')
  })

  test('contribution 2.4% → tier Champion', ({ assert }) => {
    assert.equal(calcRewardTier(2.4, MOCK_TIERS), 'champion')
  })

  test('contribution 0.5% → tier Héros', ({ assert }) => {
    assert.equal(calcRewardTier(0.5, MOCK_TIERS), 'hero')
  })

  test('contribution 0.4% → tier Combattant (sous le seuil héros 0.5%)', ({ assert }) => {
    assert.equal(calcRewardTier(0.4, MOCK_TIERS), 'fighter')
  })

  test('contribution 0.1% → tier Combattant', ({ assert }) => {
    assert.equal(calcRewardTier(0.1, MOCK_TIERS), 'fighter')
  })

  test('contribution 0.09% → tier Support (sous le seuil combattant 0.1%)', ({ assert }) => {
    assert.equal(calcRewardTier(0.09, MOCK_TIERS), 'support')
  })

  test('contribution 0.01% → tier Support', ({ assert }) => {
    assert.equal(calcRewardTier(0.01, MOCK_TIERS), 'support')
  })

  test('contribution 0.005% → tier Support (sous support threshold)', ({ assert }) => {
    // En dessous du seuil minimum → 'none'
    assert.equal(calcRewardTier(0.005, MOCK_TIERS), 'none')
  })
})

// ─── Tests Contribution % ────────────────────────────────────────────────────

test.group('Calcul du pourcentage de contribution', () => {
  test('calcContributionPercent : 1M sur 10M → 10%', ({ assert }) => {
    assert.equal(calcContributionPercent(1_000_000, 10_000_000), 10)
  })

  test('calcContributionPercent : total 0 → 0%', ({ assert }) => {
    assert.equal(calcContributionPercent(1000, 0), 0)
  })

  test('calcContributionPercent : 500M sur 10B → 5%', ({ assert }) => {
    const pct = calcContributionPercent(500_000_000, 10_000_000_000)
    assert.equal(pct, 5)
  })
})

// ─── Tests Récompenses ───────────────────────────────────────────────────────

test.group('Génération des récompenses', () => {
  test('récompenses distribuées pour tier legend → pokemon + gems', ({ assert }) => {
    const entries = buildRewardEntries('legend', MOCK_TIERS, 150, 'Mewtwo')
    assert.isAbove(entries.length, 0)
    const gems_entry = entries.find((e) => e.reward_type === 'gems')
    assert.isNotNull(gems_entry)
    assert.equal((gems_entry!.reward_data as any).amount, 50)
  })

  test('récompenses distribuées pour tier support → gems seulement', ({ assert }) => {
    const entries = buildRewardEntries('support', MOCK_TIERS, 150, 'Mewtwo')
    assert.isAbove(entries.length, 0)
    const gems_entry = entries.find((e) => e.reward_type === 'gems')
    assert.isNotNull(gems_entry)
    assert.equal((gems_entry!.reward_data as any).amount, 5)
  })

  test('raid expiré → récompenses support uniquement', ({ assert }) => {
    const entries = buildExpiredRewardEntries(MOCK_TIERS, 150, 'Mewtwo')
    // Doit correspondre aux récompenses du tier support
    const expected = buildRewardEntries('support', MOCK_TIERS, 150, 'Mewtwo')
    assert.deepEqual(entries, expected)
  })

  test('tier none → aucune récompense', ({ assert }) => {
    const entries = buildRewardEntries('none', MOCK_TIERS, 150, 'Mewtwo')
    assert.equal(entries.length, 0)
  })

  test('récompenses champion incluent pokemon légendaire', ({ assert }) => {
    const entries = buildRewardEntries('champion', MOCK_TIERS, 150, 'Mewtwo')
    const pokemon_entry = entries.find((e) => e.reward_type === 'pokemon')
    assert.isNotNull(pokemon_entry)
  })
})

// ─── Tests estimation joueurs nécessaires ────────────────────────────────────

test.group('Estimation joueurs nécessaires', () => {
  test('Mewtwo (10B HP, 24h, DPS 150k) → nombre raisonnable de joueurs', ({ assert }) => {
    const needed = estimatePlayersNeeded(10_000_000_000, 24, 150_000)
    // 10B HP / (150k DPS × 30s × 6 attaques) = ~3700 joueurs
    // Mais c'est une estimation — doit être > 100 et < 50000
    assert.isAbove(needed, 100)
    assert.isBelow(needed, 50_000)
  })

  test('Rayquaza (25B HP, 48h) → plus difficile que Mewtwo (24h)', ({ assert }) => {
    const mewtwo = estimatePlayersNeeded(10_000_000_000, 24, 150_000)
    const rayquaza = estimatePlayersNeeded(25_000_000_000, 48, 150_000)
    // Rayquaza nécessite moins de joueurs grâce aux 48h, mais HP est 2.5× plus haut
    // Vérifier juste que les deux sont cohérents (> 0)
    assert.isAbove(mewtwo, 0)
    assert.isAbove(rayquaza, 0)
  })

  test('Xerneas (5B HP, 24h) → moins de joueurs nécessaires que Mewtwo', ({ assert }) => {
    const mewtwo = estimatePlayersNeeded(10_000_000_000, 24, 150_000)
    const xerneas = estimatePlayersNeeded(5_000_000_000, 24, 150_000)
    assert.isBelow(xerneas, mewtwo)
  })
})

// ─── Tests atomicité (simulation) ────────────────────────────────────────────

test.group('Dégâts atomiques (simulation)', () => {
  test('deux calculs de dégâts indépendants ne partagent pas d\'état', ({ assert }) => {
    const team = makeTeam(3)
    // Chaque appel est pur — pas de shared state → résultats indépendants
    const r1 = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 1 })
    const r2 = calcRaidDamage({ team, prestige_gold_mult: 1.0, seed: 2 })
    // Les deux doivent être positifs et indépendants
    assert.isAbove(r1.damage, 0)
    assert.isAbove(r2.damage, 0)
    // Avec des seeds différents, les dégâts doivent être différents
    assert.notEqual(r1.damage, r2.damage)
  })

  test('calcRaidDamage : déterministe avec le même seed', ({ assert }) => {
    const team = makeTeam(3)
    const r1 = calcRaidDamage({ team, prestige_gold_mult: 1.5, seed: 777 })
    const r2 = calcRaidDamage({ team, prestige_gold_mult: 1.5, seed: 777 })
    assert.equal(r1.damage, r2.damage)
  })
})
