import db from '@adonisjs/lucid/services/db'
import ItemSeeder from './ItemSeeder.js'

export default class GoldShopSeeder {
  async run() {
    // Dépend de ItemSeeder — le déclencher si la table items est vide
    const count = await db.from('items').count('* as total').first()
    if (Number(count?.total ?? 0) === 0) {
      console.log('[GoldShopSeeder] Table items vide — exécution de ItemSeeder en prérequis...')
      await new ItemSeeder().run()
    }

    const items = await db.from('items').select('id', 'name_fr')
    const id = (name: string): number => {
      const item = items.find(i => i.name_fr === name)
      if (!item) throw new Error(`Item not found: ${name}`)
      return item.id
    }

    const permanent_items = [
      { name: 'Baie Sitrus', cost: 500 },
      { name: 'Baie Lum', cost: 600 },
      { name: 'Loupe', cost: 800 },
      { name: 'Griffe Dure', cost: 1500 },
      { name: 'Expert Ceinture', cost: 2000 },
      { name: 'Lentille de Mire', cost: 2500 },
      { name: 'Restes', cost: 3000 },
      { name: 'Herbe Miracle', cost: 700 },
      { name: 'Ceinture Musclée', cost: 2000 },
      { name: 'Ceinture Vaillante', cost: 2500 },
      // Type plates
      { name: 'Plaque Flamme', cost: 1800 },
      { name: 'Plaque Aqua', cost: 1800 },
      { name: 'Plaque Tonnerre', cost: 1800 },
      { name: 'Plaque Herbe', cost: 1800 },
      { name: 'Plaque Givre', cost: 1800 },
      { name: 'Plaque Combat', cost: 1800 },
      { name: 'Plaque Toxique', cost: 1800 },
      { name: 'Plaque Terre', cost: 1800 },
      { name: 'Plaque Vol', cost: 1800 },
      { name: 'Plaque Psy', cost: 1800 },
      { name: 'Plaque Insecte', cost: 1800 },
      { name: 'Plaque Roc', cost: 1800 },
      { name: 'Plaque Spectre', cost: 1800 },
      { name: 'Plaque Dragon', cost: 1800 },
      { name: 'Plaque Ténèbres', cost: 1800 },
      { name: 'Plaque Acier', cost: 1800 },
      { name: 'Plaque Fée', cost: 1800 },
      { name: 'Plaque Normal', cost: 1800 },
    ]

    const weekly_items = [
      { name: 'Vie-Orbe', cost: 8000 },
      { name: 'Choix Rapide', cost: 10000 },
      { name: 'Choix Bande', cost: 10000 },
      { name: 'Choix Lunettes', cost: 10000 },
      { name: 'Ballon', cost: 5000 },
      { name: 'Coque-Écaille', cost: 8000 },
      { name: 'Écaille Bleue', cost: 8000 },
    ]

    const rows = [
      ...permanent_items.map(i => ({ item_id: id(i.name), cost_gold: i.cost, stock_type: 'unlimited', is_active: true })),
      ...weekly_items.map(i => ({ item_id: id(i.name), cost_gold: i.cost, stock_type: 'weekly', is_active: true })),
    ]

    for (const row of rows) {
      await db.rawQuery(`
        INSERT INTO gold_shop_items (item_id, cost_gold, stock_type, is_active)
        VALUES (?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `, [row.item_id, row.cost_gold, row.stock_type, row.is_active])
    }

    console.log(`[GoldShopSeeder] Seeded ${rows.length} shop entries (${permanent_items.length} permanent + ${weekly_items.length} weekly)`)
  }
}
