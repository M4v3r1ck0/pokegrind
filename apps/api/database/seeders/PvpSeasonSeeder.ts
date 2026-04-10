import db from '@adonisjs/lucid/services/db'

export default class PvpSeasonSeeder {
  async run() {
    const existing = await db.from('pvp_seasons').where('is_active', true).first()
    if (existing) {
      console.log('[PvpSeasonSeeder] Saison active déjà existante, skip.')
      return
    }

    const now = new Date()
    const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    await db.table('pvp_seasons').insert({
      name_fr: 'Saison 1 — Aube',
      start_at: now,
      end_at: end,
      is_active: true,
      rewards_json: JSON.stringify([
        { tier: 'bronze',  gems: 0,  title: null },
        { tier: 'silver',  gems: 10, title: 'Combattant Argent' },
        { tier: 'gold',    gems: 20, title: 'Champion Or' },
        { tier: 'diamond', gems: 35, title: 'Élite Diamant' },
        { tier: 'master',  gems: 50, title: 'Maître Suprême' },
        { tier: 'legend',  gems: 80, title: 'Légende Éternelle' },
      ]),
    })

    console.log('[PvpSeasonSeeder] Saison 1 — Aube créée.')
  }
}
