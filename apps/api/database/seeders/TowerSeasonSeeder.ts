import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  async run() {
    const now = new Date()
    const end = new Date(now.getTime() + 90 * 24 * 3600_000) // 3 mois

    await db.rawQuery(
      `INSERT INTO tower_seasons (name_fr, start_at, end_at, is_active)
       VALUES (?, ?, ?, true)
       ON CONFLICT DO NOTHING`,
      ['Saison Tour 1 — Aube', now.toISOString(), end.toISOString()]
    )

    console.log('[TowerSeasonSeeder] Saison 1 insérée')
  }
}
