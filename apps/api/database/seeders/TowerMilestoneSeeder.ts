import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

// Paliers fixes
const FIXED_MILESTONES = [
  { floor: 10,  gems: 2,  name_fr: 'Apprenti Grimpeur' },
  { floor: 20,  gems: 2,  name_fr: 'Explorateur' },
  { floor: 30,  gems: 3,  name_fr: 'Aventurier' },
  { floor: 40,  gems: 3,  name_fr: 'Vaillant Guerrier' },
  { floor: 50,  gems: 5,  name_fr: 'Dompteur des Cimes' },
  { floor: 75,  gems: 8,  name_fr: 'Maître des Hauteurs' },
  { floor: 100, gems: 15, name_fr: 'Conquérant Céleste' },
  { floor: 150, gems: 20, name_fr: 'Titan Ascendant' },
  { floor: 200, gems: 25, name_fr: 'Légende de la Tour' },
  { floor: 300, gems: 35, name_fr: 'Dieu de l\'Abîme' },
  { floor: 500, gems: 50, name_fr: 'Transcendant Éternel' },
]

// Paliers dynamiques au-delà de 500 (tous les 100 étages)
const dynamic_milestones: { floor: number; gems: number; name_fr: string }[] = []
for (let floor = 600; floor <= 9900; floor += 100) {
  dynamic_milestones.push({
    floor,
    gems: 10 + Math.floor((floor - 500) / 100) * 2,
    name_fr: `Palier ${floor}`,
  })
}

const ALL_MILESTONES = [...FIXED_MILESTONES, ...dynamic_milestones]

export default class extends BaseSeeder {
  async run() {
    for (const m of ALL_MILESTONES) {
      await db.rawQuery(
        `INSERT INTO tower_milestones (floor_number, gems_reward, name_fr)
         VALUES (?, ?, ?)
         ON CONFLICT (floor_number) DO NOTHING`,
        [m.floor, m.gems, m.name_fr]
      )
    }
    console.log(`[TowerMilestoneSeeder] ${ALL_MILESTONES.length} paliers insérés`)
  }
}
