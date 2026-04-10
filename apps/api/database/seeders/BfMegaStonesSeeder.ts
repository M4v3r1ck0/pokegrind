/**
 * BfMegaStonesSeeder — Ajoute 4 Méga-Stones emblématiques au BF Shop.
 * Idempotent via ON CONFLICT DO NOTHING.
 */

import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const BF_MEGA_STONES = [
  { name_fr: 'Lucarionite',   cost_pf: 300, description_fr: 'Permet à Lucario de Méga-Évoluer en Méga-Lucario.' },
  { name_fr: 'Gardevoirite',  cost_pf: 300, description_fr: 'Permet à Gardevoir de Méga-Évoluer en Méga-Gardevoir.' },
  { name_fr: 'Carchacroite',  cost_pf: 350, description_fr: 'Permet à Carchacrok de Méga-Évoluer en Méga-Carchacrok.' },
  { name_fr: 'Tyranocifite',  cost_pf: 400, description_fr: 'Permet à Tyranocif de Méga-Évoluer en Méga-Tyranocif.' },
]

export default class BfMegaStonesSeeder extends BaseSeeder {
  async run() {
    for (const stone of BF_MEGA_STONES) {
      await db.rawQuery(
        `INSERT INTO bf_shop_items (name_fr, description_fr, cost_pf, item_type, item_data, is_active, stock_per_rotation)
         SELECT ?, ?, ?, 'mega_stone', '{"category":"mega_stone"}'::jsonb, true, 1
         WHERE NOT EXISTS (
           SELECT 1 FROM bf_shop_items WHERE name_fr = ?
         )`,
        [stone.name_fr, stone.description_fr, stone.cost_pf, stone.name_fr]
      )
    }
    console.log(`✓ ${BF_MEGA_STONES.length} Méga-Stones ajoutées au BF Shop`)
  }
}
