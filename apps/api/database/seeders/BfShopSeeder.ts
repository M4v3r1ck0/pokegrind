import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const BF_SHOP_ITEMS = [
  // CTs exclusives
  { name_fr: 'CT Ultralaser',     cost_pf: 200, item_type: 'ct_exclusive',  item_data: { move_id: 63  }, description_fr: 'Apprend Ultralaser au Pokémon choisi.' },
  { name_fr: 'CT Séismoroc',      cost_pf: 150, item_type: 'ct_exclusive',  item_data: { move_id: 89  }, description_fr: 'Apprend Séismoroc au Pokémon choisi.' },
  { name_fr: 'CT Blizzard',       cost_pf: 100, item_type: 'ct_exclusive',  item_data: { move_id: 59  }, description_fr: 'Apprend Blizzard au Pokémon choisi.' },
  { name_fr: 'CT Tonnerre',       cost_pf: 100, item_type: 'ct_exclusive',  item_data: { move_id: 87  }, description_fr: 'Apprend Tonnerre au Pokémon choisi.' },
  { name_fr: 'CT Lance-Flammes',  cost_pf: 100, item_type: 'ct_exclusive',  item_data: { move_id: 53  }, description_fr: 'Apprend Lance-Flammes au Pokémon choisi.' },
  { name_fr: 'CT Surf',           cost_pf: 100, item_type: 'ct_exclusive',  item_data: { move_id: 57  }, description_fr: 'Apprend Surf au Pokémon choisi.' },
  // Capsules IV
  { name_fr: 'Capsule IV HP',     cost_pf: 150, item_type: 'iv_capsule',    item_data: { stat: 'hp'    }, description_fr: 'Monte l\'IV HP du Pokémon choisi à 31.' },
  { name_fr: 'Capsule IV ATK',    cost_pf: 150, item_type: 'iv_capsule',    item_data: { stat: 'atk'   }, description_fr: 'Monte l\'IV Attaque du Pokémon choisi à 31.' },
  { name_fr: 'Capsule IV DEF',    cost_pf: 150, item_type: 'iv_capsule',    item_data: { stat: 'def'   }, description_fr: 'Monte l\'IV Défense du Pokémon choisi à 31.' },
  { name_fr: 'Capsule IV SP.ATK', cost_pf: 150, item_type: 'iv_capsule',    item_data: { stat: 'spatk' }, description_fr: 'Monte l\'IV Sp. Atk du Pokémon choisi à 31.' },
  { name_fr: 'Capsule IV SP.DEF', cost_pf: 150, item_type: 'iv_capsule',    item_data: { stat: 'spdef' }, description_fr: 'Monte l\'IV Sp. Déf du Pokémon choisi à 31.' },
  { name_fr: 'Capsule IV SPE',    cost_pf: 150, item_type: 'iv_capsule',    item_data: { stat: 'speed' }, description_fr: 'Monte l\'IV Vitesse du Pokémon choisi à 31.' },
  // Menthes de Nature
  { name_fr: 'Menthe Rigide',     cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'hardy'   }, description_fr: 'Override la nature du Pokémon vers Hardy.' },
  { name_fr: 'Menthe Solitaire',  cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'lonely'  }, description_fr: 'Override la nature du Pokémon vers Solitaire.' },
  { name_fr: 'Menthe Brave',      cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'brave'   }, description_fr: 'Override la nature du Pokémon vers Brave.' },
  { name_fr: 'Menthe Ferme',      cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'adamant' }, description_fr: 'Override la nature du Pokémon vers Ferme (+Atk/-Sp.Atk).' },
  { name_fr: 'Menthe Timide',     cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'timid'   }, description_fr: 'Override la nature du Pokémon vers Timide (+Vit/-Atk).' },
  { name_fr: 'Menthe Modeste',    cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'modest'  }, description_fr: 'Override la nature du Pokémon vers Modeste (+Sp.Atk/-Atk).' },
  { name_fr: 'Menthe Calme',      cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'calm'    }, description_fr: 'Override la nature du Pokémon vers Calme (+Sp.Déf/-Atk).' },
  { name_fr: 'Menthe Prudente',   cost_pf: 100, item_type: 'nature_mint',   item_data: { nature: 'careful' }, description_fr: 'Override la nature du Pokémon vers Prudente (+Sp.Déf/-Sp.Atk).' },
]

export default class BfShopSeeder extends BaseSeeder {
  async run() {
    for (const item of BF_SHOP_ITEMS) {
      await db.rawQuery(
        `INSERT INTO bf_shop_items (name_fr, description_fr, cost_pf, item_type, item_data, is_active, stock_per_rotation)
         VALUES (?, ?, ?, ?, ?::jsonb, ?, ?)
         ON CONFLICT DO NOTHING`,
        [item.name_fr, item.description_fr, item.cost_pf, item.item_type, JSON.stringify(item.item_data), true, null]
      )
    }
    console.log(`✓ ${BF_SHOP_ITEMS.length} items Battle Frontier shop insérés`)
  }
}
