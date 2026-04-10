import db from '@adonisjs/lucid/services/db'

export default class FloorItemDropSeeder {
  async run() {
    // Fetch item IDs by name
    const items = await db.from('items').select('id', 'name_fr')
    const id = (name: string): number => {
      const item = items.find(i => i.name_fr === name)
      if (!item) throw new Error(`Item not found: ${name}`)
      return item.id
    }

    // Fetch all floors
    const floors = await db.from('floors').select('id', 'floor_number').orderBy('floor_number', 'asc')

    const rows: Array<{ floor_id: number; item_id: number; drop_rate: number; drop_quantity_min: number; drop_quantity_max: number }> = []

    for (const floor of floors) {
      const fn = floor.floor_number

      // Floors 1-20: basics
      if (fn >= 1) {
        rows.push({ floor_id: floor.id, item_id: id('Baie Sitrus'), drop_rate: 0.005, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Baie Lum'), drop_rate: 0.003, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Loupe'), drop_rate: 0.003, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Griffe Dure'), drop_rate: 0.002, drop_quantity_min: 1, drop_quantity_max: 1 })
      }

      // Floors 21-40: + uncommons
      if (fn >= 21) {
        rows.push({ floor_id: floor.id, item_id: id('Expert Ceinture'), drop_rate: 0.002, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Lentille de Mire'), drop_rate: 0.002, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Restes'), drop_rate: 0.001, drop_quantity_min: 1, drop_quantity_max: 1 })
      }

      // Floors 41-60: + rares
      if (fn >= 41) {
        rows.push({ floor_id: floor.id, item_id: id('Vie-Orbe'), drop_rate: 0.0005, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Choix Rapide'), drop_rate: 0.0005, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Choix Bande'), drop_rate: 0.0005, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Coque-Écaille'), drop_rate: 0.0005, drop_quantity_min: 1, drop_quantity_max: 1 })
      }

      // Floors 61-80: + type plates
      if (fn >= 61) {
        const plates = [
          'Plaque Flamme','Plaque Aqua','Plaque Tonnerre','Plaque Herbe','Plaque Givre',
          'Plaque Combat','Plaque Toxique','Plaque Terre','Plaque Vol','Plaque Psy',
          'Plaque Insecte','Plaque Roc','Plaque Spectre','Plaque Dragon',
          'Plaque Ténèbres','Plaque Acier','Plaque Fée','Plaque Normal',
        ]
        for (const plate of plates) {
          rows.push({ floor_id: floor.id, item_id: id(plate), drop_rate: 0.001, drop_quantity_min: 1, drop_quantity_max: 1 })
        }
      }

      // Floors 81-100: + epics
      if (fn >= 81) {
        rows.push({ floor_id: floor.id, item_id: id('Orbe Toxique'), drop_rate: 0.0002, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Orbe Flamme'), drop_rate: 0.0002, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Ballon'), drop_rate: 0.001, drop_quantity_min: 1, drop_quantity_max: 1 })
        rows.push({ floor_id: floor.id, item_id: id('Graine Lumineuse'), drop_rate: 0.0002, drop_quantity_min: 1, drop_quantity_max: 1 })
      }
    }

    if (rows.length === 0) {
      console.log('[FloorItemDropSeeder] No floors found, skipping')
      return
    }

    // Batch insert with ON CONFLICT DO NOTHING
    const chunk_size = 100
    let inserted = 0
    for (let i = 0; i < rows.length; i += chunk_size) {
      const chunk = rows.slice(i, i + chunk_size)
      await db.rawQuery(`
        INSERT INTO floor_item_drops (floor_id, item_id, drop_rate, drop_quantity_min, drop_quantity_max)
        VALUES ${chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')}
        ON CONFLICT (floor_id, item_id) DO NOTHING
      `, chunk.flatMap(r => [r.floor_id, r.item_id, r.drop_rate, r.drop_quantity_min, r.drop_quantity_max]))
      inserted += chunk.length
    }

    console.log(`[FloorItemDropSeeder] Inserted ${inserted} floor_item_drops rows`)
  }
}
