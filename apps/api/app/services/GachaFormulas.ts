/**
 * GachaFormulas — Fonctions pures gacha (sans dépendances Lucid/AdonisJS).
 * Importé par les tests unitaires.
 */
import type { Nature, PokemonRarity } from '@pokegrind/shared'

export const NATURES: Nature[] = [
  'hardy', 'lonely', 'brave', 'adamant', 'naughty',
  'bold', 'docile', 'relaxed', 'impish', 'lax',
  'timid', 'hasty', 'serious', 'jolly', 'naive',
  'modest', 'mild', 'quiet', 'bashful', 'rash',
  'calm', 'gentle', 'sassy', 'careful', 'quirky',
]

export const RATES: Record<PokemonRarity, number> = {
  common: 0.55,
  rare: 0.33,
  epic: 0.09,
  legendary: 0.025,
  mythic: 0.005,
}

export const PITY_EPIC_THRESHOLD = 50
export const PITY_LEGENDARY_DEFAULT = 200
export const PITY_LEGENDARY_UPGRADED = 180

export const GOLD_COST_1 = 1000
export const GOLD_COST_10 = 9000

/**
 * Détermine la rareté du tirage selon les pity counters et les taux.
 */
export function drawRarity(
  pityEpic: number,
  pityLegendary: number,
  legendaryThreshold: number
): PokemonRarity {
  if (pityLegendary >= legendaryThreshold) return 'legendary'
  if (pityEpic >= PITY_EPIC_THRESHOLD) return 'epic'

  const roll = Math.random()
  if (roll < RATES.mythic) return 'mythic'
  if (roll < RATES.mythic + RATES.legendary) return 'legendary'
  if (roll < RATES.mythic + RATES.legendary + RATES.epic) return 'epic'
  if (roll < RATES.mythic + RATES.legendary + RATES.epic + RATES.rare) return 'rare'
  return 'common'
}

/**
 * Génère les IVs selon la rareté.
 */
export function generateIVs(rarity: PokemonRarity, isShiny: boolean): {
  hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number
} {
  const randomIv = () => Math.floor(Math.random() * 32)
  const highIv = () => Math.floor(Math.random() * 12) + 20 // 20-31
  const perfectIv = () => 31

  if (isShiny) {
    const ivs = [randomIv(), randomIv(), randomIv(), 31, 31, 31]
    ivs.sort(() => Math.random() - 0.5)
    return { hp: ivs[0], atk: ivs[1], def: ivs[2], spatk: ivs[3], spdef: ivs[4], speed: ivs[5] }
  }

  switch (rarity) {
    case 'mythic': {
      const pos = Math.floor(Math.random() * 6)
      const values = [31, 31, 31, 31, 31, 31]
      values[pos] = randomIv()
      return { hp: values[0], atk: values[1], def: values[2], spatk: values[3], spdef: values[4], speed: values[5] }
    }
    case 'legendary': {
      const positions = [0, 1, 2, 3, 4, 5]
      const perfect = positions.sort(() => Math.random() - 0.5).slice(0, 3)
      const values = [randomIv(), randomIv(), randomIv(), randomIv(), randomIv(), randomIv()]
      for (const p of perfect) values[p] = perfectIv()
      return { hp: values[0], atk: values[1], def: values[2], spatk: values[3], spdef: values[4], speed: values[5] }
    }
    case 'epic': {
      const pos = Math.floor(Math.random() * 6)
      const values = [randomIv(), randomIv(), randomIv(), randomIv(), randomIv(), randomIv()]
      values[pos] = highIv()
      return { hp: values[0], atk: values[1], def: values[2], spatk: values[3], spdef: values[4], speed: values[5] }
    }
    default:
      return {
        hp: randomIv(), atk: randomIv(), def: randomIv(),
        spatk: randomIv(), spdef: randomIv(), speed: randomIv(),
      }
  }
}

/**
 * Vérifie si un Pokémon est shiny (1/8192).
 */
export function rollShiny(): boolean {
  return Math.random() < 1 / 8192
}
