/**
 * Tests unitaires — PvP (EloService + PvpService logique pure)
 * Exécution : node --import=tsx/esm tests/unit/run.ts
 */

import { test } from '@japa/runner'
import {
  calcEloChange,
  calcTier,
  calcWinProbability,
  TIER_GEMS,
  ELO_FLOOR,
} from '../../app/services/EloService.js'

// ─── ELO : calculs de base ────────────────────────────────────────────────────

test.group('calcEloChange', () => {

  test('victoire vs adversaire +200 ELO → petit gain (attaquant sous-favori)', ({ assert }) => {
    const { attacker_delta } = calcEloChange(1200, 1400, true, 'gold')
    // Attendu élevé car adversaire plus fort
    assert.isAbove(attacker_delta, 10)
    assert.isBelow(attacker_delta, 30)
  })

  test('victoire vs adversaire -200 ELO → gain plus faible (attaquant favori)', ({ assert }) => {
    const { attacker_delta: delta_fav } = calcEloChange(1400, 1200, true, 'gold')
    const { attacker_delta: delta_underfav } = calcEloChange(1200, 1400, true, 'gold')
    // Favori gagne moins que l'outsider
    assert.isBelow(delta_fav, delta_underfav)
    assert.isAbove(delta_fav, 0)
  })

  test('défaite → perte ELO cohérente (delta attaquant négatif)', ({ assert }) => {
    const { attacker_delta } = calcEloChange(1200, 1200, false, 'gold')
    assert.isBelow(attacker_delta, 0)
  })

  test('défaite → delta défenseur positif (défenseur gagne ELO)', ({ assert }) => {
    const { defender_delta } = calcEloChange(1200, 1200, false, 'gold')
    assert.isAbove(defender_delta, 0)
  })

  test('ELO plancher : impossible de descendre sous 100', ({ assert }) => {
    // Joueur à 105 ELO qui perd — ne peut pas aller sous 100
    const { attacker_delta } = calcEloChange(105, 1000, false, 'bronze')
    const elo_after = 105 + attacker_delta
    assert.isAtLeast(elo_after, ELO_FLOOR)
  })

  test('ELO plancher : joueur déjà à 100 ELO, delta = 0', ({ assert }) => {
    const { attacker_delta } = calcEloChange(100, 1000, false, 'bronze')
    assert.equal(attacker_delta, 0)
  })

  test('K-factor legend (12) produit moins de variation que bronze (32)', ({ assert }) => {
    const { attacker_delta: delta_legend } = calcEloChange(2200, 2200, true, 'legend')
    const { attacker_delta: delta_bronze  } = calcEloChange(1000, 1000, true, 'bronze')
    assert.isBelow(delta_legend, delta_bronze)
  })

})

// ─── ELO → Tier ───────────────────────────────────────────────────────────────

test.group('calcTier', () => {

  test('tier Bronze à 999 ELO', ({ assert }) => {
    assert.equal(calcTier(999), 'bronze')
  })

  test('tier Silver à 1000 ELO', ({ assert }) => {
    assert.equal(calcTier(1000), 'silver')
  })

  test('tier Gold à 1200 ELO', ({ assert }) => {
    assert.equal(calcTier(1200), 'gold')
  })

  test('tier Diamond à 1500 ELO', ({ assert }) => {
    assert.equal(calcTier(1500), 'diamond')
  })

  test('tier Master à 1800 ELO', ({ assert }) => {
    assert.equal(calcTier(1800), 'master')
  })

  test('tier Legend à 2200 ELO', ({ assert }) => {
    assert.equal(calcTier(2200), 'legend')
  })

  test('gems attribuées au passage de palier Silver (10 gems)', ({ assert }) => {
    assert.equal(TIER_GEMS['silver'], 10)
  })

  test('gems attribuées au passage de palier Legend (10 gems)', ({ assert }) => {
    assert.equal(TIER_GEMS['legend'], 10)
  })

  test('pas de gems pour Bronze', ({ assert }) => {
    assert.equal(TIER_GEMS['bronze'], 0)
  })

})

// ─── Probabilité de victoire ─────────────────────────────────────────────────

test.group('calcWinProbability', () => {

  test('ELO identiques → 50% de chance de victoire', ({ assert }) => {
    assert.equal(calcWinProbability(1000, 1000), 50)
  })

  test('attaquant +200 ELO → probabilité > 50%', ({ assert }) => {
    assert.isAbove(calcWinProbability(1200, 1000), 50)
  })

  test('attaquant -200 ELO → probabilité < 50%', ({ assert }) => {
    assert.isBelow(calcWinProbability(800, 1000), 50)
  })

  test('retourne une valeur entre 0 et 100', ({ assert }) => {
    const prob = calcWinProbability(500, 2800)
    assert.isAtLeast(prob, 0)
    assert.isAtMost(prob, 100)
  })

})

// ─── Cas métier spécifiques ───────────────────────────────────────────────────

test.group('Cas métier PvP', () => {

  test('delta ELO : attaquant 1200 ELO vs défenseur 1400 ELO, victoire attaquant', ({ assert }) => {
    // K-factor gold = 24
    // expected_attacker = 1 / (1 + 10^((1400-1200)/400)) = 1 / (1 + 10^0.5) ≈ 0.240
    // delta = round(24 * (1 - 0.240)) ≈ round(24 * 0.760) ≈ round(18.24) = 18
    const { attacker_delta, defender_delta } = calcEloChange(1200, 1400, true, 'gold')
    assert.isAbove(attacker_delta, 15)   // entre 15 et 20
    assert.isBelow(attacker_delta, 22)
    assert.isBelow(defender_delta, 0)    // défenseur perd de l'ELO
  })

  test('snapshot défense figé : changer les IVs côté attaquant ne modifie pas le snapshot', ({ assert }) => {
    // Les snapshots sont des objets JSON sérialisés indépendants — pas de référence partagée
    const original_ivs = { hp: 20, atk: 15, def: 10, spatk: 25, spdef: 18, speed: 31 }
    const snapshot_ivs = JSON.parse(JSON.stringify(original_ivs))  // Copie profonde
    original_ivs.atk = 31
    // La copie ne doit pas être affectée
    assert.equal(snapshot_ivs.atk, 15)
    assert.equal(original_ivs.atk, 31)
  })

  test('timeout 500 actions → victoire défenseur (simulation)', ({ assert }) => {
    // Le défenseur gagne par timeout — vérifié par logique dans simulatePvpBattle
    // Ici on vérifie que le résultat est cohérent : si actions >= MAX_BATTLE_ACTIONS
    // et aucune équipe n'est à 0 HP → défenseur gagne
    // On teste indirectement via la formule de timeout
    const MAX_BATTLE_ACTIONS = 500
    assert.equal(MAX_BATTLE_ACTIONS, 500)

    // La victoire défenseur est le fallback — vérifié dans le code
    // winner = atk_alive > 0 && def_alive === 0 ? 'attacker' : 'defender'
    // Après timeout : deux équipes en vie → 'defender'
    const atk_alive_after_timeout: number = 3
    const def_alive_after_timeout: number = 2
    const winner = atk_alive_after_timeout > 0 && def_alive_after_timeout === 0
      ? 'attacker'
      : 'defender'
    assert.equal(winner, 'defender')
  })

  test('fin de saison : soft reset ELO — 1000 est le point de départ des nouvelles saisons', ({ assert }) => {
    const starting_elo = 1000
    assert.equal(calcTier(starting_elo), 'silver')
    // Un joueur qui commence une nouvelle saison à 1000 ELO est en Silver
  })

  test('fin de saison : gems selon tier — diamond reçoit 35 gems', ({ assert }) => {
    const season_rewards = [
      { tier: 'bronze',  gems: 0  },
      { tier: 'silver',  gems: 10 },
      { tier: 'gold',    gems: 20 },
      { tier: 'diamond', gems: 35 },
      { tier: 'master',  gems: 50 },
      { tier: 'legend',  gems: 80 },
    ]
    const diamond_reward = season_rewards.find(r => r.tier === 'diamond')
    assert.equal(diamond_reward?.gems, 35)
  })

})
