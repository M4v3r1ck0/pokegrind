/**
 * OfflineCalculationJob — Calcul des gains offline d'un joueur.
 * Déclenché au login si last_seen_at > 5 minutes.
 * Worker BullMQ : démarré via start/worker.ts.
 */

import { Worker, type Job } from 'bullmq'
import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import Floor from '#models/floor'
import OfflineReport from '#models/offline_report'
import daycareService from '#services/DaycareService'
import {
  estimateTeamDPS,
  calculateDrops,
  calculateItemDropsOffline,
  formatAbsence,
  MIN_ABSENCE_SECONDS,
  MAX_ABSENCE_SECONDS,
  ENEMY_HP_FACTOR,
} from '#services/OfflineFormulas'
import type { OfflineJobPayload } from '#jobs/OfflineQueue'

// ─── Traitement du job ────────────────────────────────────────────────────────

export async function processOfflineJob(job: Job<OfflineJobPayload>): Promise<void> {
  const { player_id, last_seen_at, floor_number, team_snapshot } = job.data

  // 1. Calculer la durée d'absence
  const absence_ms = Date.now() - new Date(last_seen_at).getTime()
  const absence_seconds = Math.min(absence_ms / 1000, MAX_ABSENCE_SECONDS)

  if (absence_seconds < MIN_ABSENCE_SECONDS) return

  // 2. Charger l'étage
  const floor = await Floor.query().where('floor_number', floor_number).first()
  if (!floor) return

  const floor_snapshot = {
    floor_number: floor.floorNumber,
    min_level: floor.minLevel,
    max_level: floor.maxLevel,
    gold_base: floor.goldBase,
    xp_base: floor.xpBase,
  }

  // 3. Estimer le DPS de l'équipe
  const avg_dps = estimateTeamDPS(team_snapshot as any)

  // 4. Calculer les kills (HP moyen ennemi = niveau_moyen × ENEMY_HP_FACTOR)
  const enemy_avg_level = Math.floor((floor.minLevel + floor.maxLevel) / 2)
  const enemy_avg_hp = Math.max(1, enemy_avg_level * ENEMY_HP_FACTOR)
  const kills = Math.max(0, Math.floor((avg_dps * absence_seconds) / enemy_avg_hp))

  // 5. Calculer or et XP (pas de bonus boss en offline)
  const gold_per_kill = floor.goldBase * (0.9 + Math.random() * 0.2)
  const gold_earned = Math.floor(kills * gold_per_kill)
  const xp_earned = kills * floor.xpBase

  // 6. Distribuer les dégâts pension + éclosions
  const daycare_damage = avg_dps * absence_seconds
  const hatches = await daycareService.applyOfflineDamage(player_id, daycare_damage)

  // 7. Calculer les drops CT
  const drops = calculateDrops(floor_snapshot, kills)

  // 7b. Calculer les item drops
  const floor_item_configs = await db
    .from('floor_item_drops as fid')
    .join('items as i', 'i.id', 'fid.item_id')
    .where('fid.floor_id', floor.id)
    .select('fid.item_id', 'i.name_fr as item_name_fr', 'fid.drop_rate', 'fid.drop_quantity_min as qty_min', 'fid.drop_quantity_max as qty_max')

  const item_drops = calculateItemDropsOffline(
    floor_item_configs.map((c: any) => ({
      item_id: c.item_id,
      item_name_fr: c.item_name_fr,
      drop_rate: Number(c.drop_rate),
      qty_min: c.qty_min ?? 1,
      qty_max: c.qty_max ?? 1,
    })),
    kills
  )

  // Upsert item drops into player_items
  for (const drop of item_drops) {
    await db.rawQuery(`
      INSERT INTO player_items (id, player_id, item_id, quantity, obtained_at)
      VALUES (gen_random_uuid(), ?, ?, ?, NOW())
      ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_items.quantity + EXCLUDED.quantity
    `, [player_id, drop.item_id, drop.quantity])
  }

  // 8. Créer le rapport
  await OfflineReport.create({
    playerId: player_id,
    goldEarned: gold_earned,
    xpEarned: xp_earned,
    kills,
    hatches,
    dropsJson: { ct_drops: drops, item_drops },
    absenceSeconds: Math.floor(absence_seconds),
    floorFarmed: floor_number,
  })

  // 9. Appliquer les gains en BDD
  if (gold_earned > 0 || kills > 0) {
    await db.from('players').where('id', player_id).increment({
      gold: gold_earned,
      total_kills: kills,
      total_gold_earned: gold_earned,
    })
  }

  // 10. Marquer le rapport comme non lu (flag Redis, TTL 24h)
  await redis.set(`offline_report_pending:${player_id}`, '1', 'EX', 86400)
}

// ─── Worker BullMQ ────────────────────────────────────────────────────────────

function getRedisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: 0,
    keyPrefix: 'pokegrind:',
  }
}

export function startOfflineWorker(): Worker<OfflineJobPayload> {
  const worker = new Worker<OfflineJobPayload>(
    'offline-calculation',
    processOfflineJob,
    { connection: getRedisConnection(), concurrency: 5 }
  )

  worker.on('completed', (job) => {
    console.log(`[OfflineJob] Completed for player ${job.data.player_id}`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[OfflineJob] Failed for player ${job?.data.player_id}:`, err.message)
  })

  return worker
}
