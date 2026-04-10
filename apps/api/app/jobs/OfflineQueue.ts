/**
 * OfflineQueue — File BullMQ pour les calculs offline.
 * Ce module est importable sans boot AdonisJS (pas de providers chargés).
 */

import { Queue } from 'bullmq'

export interface OfflineJobPayload {
  player_id: string
  last_seen_at: string      // ISO timestamp
  floor_number: number
  team_snapshot: {
    pokemon: Array<{
      species_id: number
      level: number
      nature: string
      ivs: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }
      moves: Array<{ move_id: number; power: number | null; category: string; type: string }>
      type1: string
      type2: string | null
      base_atk: number
      base_spatk: number
      base_speed: number
    }>
  }
}

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

export const OfflineQueue = new Queue<OfflineJobPayload>('offline-calculation', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})
