import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class TierSeeder extends BaseSeeder {
  async run() {
    const species = await db.from('pokemon_species').select(
      'id', 'rarity',
      'base_hp', 'base_atk', 'base_def',
      'base_spatk', 'base_spdef', 'base_speed'
    )

    let updated = 0
    for (const s of species) {
      const total =
        (s.base_hp ?? 0) + (s.base_atk ?? 0) + (s.base_def ?? 0) +
        (s.base_spatk ?? 0) + (s.base_spdef ?? 0) + (s.base_speed ?? 0)

      let tier: string
      if (s.rarity === 'legendary' || s.rarity === 'mythic') {
        tier = 'S+'
      } else if (total >= 600) {
        tier = 'S'
      } else if (total >= 500) {
        tier = 'A'
      } else if (total >= 450) {
        tier = 'B'
      } else if (total >= 350) {
        tier = 'C'
      } else {
        tier = 'D'
      }

      await db.from('pokemon_species').where('id', s.id).update({ tier })
      updated++
    }

    console.log(`✓ ${updated} espèces Pokémon assignées à leur tier`)
  }
}
