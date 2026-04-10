import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const BF_ACHIEVEMENTS = [
  { name_fr: 'Premier Pas',       description_fr: 'Remporte ton premier combat BF.',                  condition_type: 'total_wins',    condition_value: 1,   gems_reward: 1,  mode: null    },
  { name_fr: 'Combattant',        description_fr: 'Remporte 10 combats BF.',                          condition_type: 'total_wins',    condition_value: 10,  gems_reward: 2,  mode: null    },
  { name_fr: 'Vétéran',           description_fr: 'Remporte 50 combats BF.',                          condition_type: 'total_wins',    condition_value: 50,  gems_reward: 3,  mode: null    },
  { name_fr: 'Légende Frontier',  description_fr: 'Remporte 200 combats BF.',                         condition_type: 'total_wins',    condition_value: 200, gems_reward: 5,  mode: null    },
  { name_fr: 'Série de 10',       description_fr: 'Atteins une série de 10 victoires consécutives.',  condition_type: 'streak',        condition_value: 10,  gems_reward: 3,  mode: null    },
  { name_fr: 'Série de 25',       description_fr: 'Atteins une série de 25 victoires consécutives.',  condition_type: 'streak',        condition_value: 25,  gems_reward: 5,  mode: null    },
  { name_fr: 'Série de 50',       description_fr: 'Atteins une série de 50 victoires consécutives.',  condition_type: 'streak',        condition_value: 50,  gems_reward: 10, mode: null    },
  { name_fr: 'Tour Complète',     description_fr: 'Termine une session Battle Tower complète.',        condition_type: 'mode_complete', condition_value: 1,   gems_reward: 5,  mode: 'tower'   },
  { name_fr: 'Usine Complète',    description_fr: 'Termine une session Battle Factory complète.',      condition_type: 'mode_complete', condition_value: 1,   gems_reward: 5,  mode: 'factory' },
  { name_fr: 'Arène Complète',    description_fr: 'Termine une session Battle Arena complète.',        condition_type: 'mode_complete', condition_value: 1,   gems_reward: 5,  mode: 'arena'   },
]

export default class BfAchievementsSeeder extends BaseSeeder {
  async run() {
    for (const ach of BF_ACHIEVEMENTS) {
      await db.rawQuery(
        `INSERT INTO bf_achievements (name_fr, description_fr, condition_type, condition_value, mode, gems_reward)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
        [ach.name_fr, ach.description_fr, ach.condition_type, ach.condition_value, ach.mode, ach.gems_reward]
      )
    }
    console.log(`✓ ${BF_ACHIEVEMENTS.length} succès Battle Frontier insérés`)
  }
}
