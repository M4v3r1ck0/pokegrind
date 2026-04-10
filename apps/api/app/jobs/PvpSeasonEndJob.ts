/**
 * PvpSeasonEndJob — Distribution des récompenses de fin de saison PvP.
 * Déclenché par le scheduler quand la saison est expirée.
 */

import db from '@adonisjs/lucid/services/db'
import GemsService from '#services/GemsService'
import logger from '@adonisjs/core/services/logger'

export async function processPvpSeason(): Promise<void> {
  const season = await db.from('pvp_seasons').where('is_active', true).first()

  if (!season) {
    // Aucune saison active — créer la première si nécessaire
    await createNewSeason(1)
    return
  }

  const now = new Date()
  const end_at = new Date(season.end_at)

  if (now < end_at) {
    // Saison en cours — rien à faire
    return
  }

  logger.info(`[PvpSeasonEndJob] Fin de la saison "${season.name_fr}" (id=${season.id})`)

  // ── 1. Désactiver la saison ───────────────────────────────────────────────
  await db.from('pvp_seasons').where('id', season.id).update({ is_active: false })

  // ── 2. Calculer les rangs finaux ──────────────────────────────────────────
  await db.rawQuery(`
    UPDATE pvp_rankings SET rank = subq.rank_val
    FROM (
      SELECT player_id,
             ROW_NUMBER() OVER (ORDER BY elo DESC) as rank_val
      FROM pvp_rankings
      WHERE season_id = ?
    ) subq
    WHERE pvp_rankings.player_id = subq.player_id
      AND pvp_rankings.season_id = ?
  `, [season.id, season.id])

  // ── 3. Distribuer les récompenses ─────────────────────────────────────────
  const rankings = await db
    .from('pvp_rankings')
    .where('season_id', season.id)
    .select('player_id', 'tier', 'elo')

  const rewards_json: Array<{ tier: string; gems: number; title: string | null }> =
    typeof season.rewards_json === 'string'
      ? JSON.parse(season.rewards_json)
      : season.rewards_json

  let distributed = 0
  for (const ranking of rankings) {
    const reward = rewards_json.find((r) => r.tier === ranking.tier)
    const gems = reward?.gems ?? 0

    // Éviter les doublons (idempotent)
    const already = await db
      .from('pvp_season_rewards')
      .where('player_id', ranking.player_id)
      .where('season_id', season.id)
      .first()
    if (already) continue

    await db.table('pvp_season_rewards').insert({
      id: crypto.randomUUID(),
      player_id: ranking.player_id,
      season_id: season.id,
      tier: ranking.tier,
      elo_final: ranking.elo,
      gems_awarded: gems,
      awarded_at: new Date(),
    })

    if (gems > 0) {
      await GemsService.awardGems(
        ranking.player_id,
        gems,
        `Fin Saison PvP "${season.name_fr}" — Palier ${ranking.tier}`,
        'pvp_elo_tier'
      )
    }

    distributed++
  }

  logger.info(`[PvpSeasonEndJob] ${distributed} récompenses distribuées.`)

  // ── 4. Créer la nouvelle saison ───────────────────────────────────────────
  const next_number = extractSeasonNumber(season.name_fr) + 1
  await createNewSeason(next_number)

  logger.info(`[PvpSeasonEndJob] Nouvelle saison ${next_number} créée.`)
}

async function createNewSeason(number: number): Promise<void> {
  const existing_active = await db.from('pvp_seasons').where('is_active', true).first()
  if (existing_active) return  // Ne pas créer si une saison active existe déjà

  const season_names = [
    'Aube', 'Tempête', 'Éclipse', 'Renaissance', 'Crépuscule',
    'Aurore', 'Tonnerre', 'Blizzard', 'Inferno', 'Zénith',
  ]
  const name_suffix = season_names[(number - 1) % season_names.length]

  const now = new Date()
  const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  await db.table('pvp_seasons').insert({
    name_fr: `Saison ${number} — ${name_suffix}`,
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
}

function extractSeasonNumber(name_fr: string): number {
  const match = name_fr.match(/Saison (\d+)/)
  return match ? parseInt(match[1], 10) : 1
}
