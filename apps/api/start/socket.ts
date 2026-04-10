/**
 * Socket.io — initialisation et events de combat
 * Préchargé après le démarrage du serveur HTTP AdonisJS.
 */

import { Server as SocketServer } from 'socket.io'
import server from '@adonisjs/core/services/server'
import combatProgressionService from '#services/CombatProgressionService'
import env from '#start/env'
import battleFrontierService from '#services/BattleFrontierService'
import towerService from '#services/TowerService'
import raidService from '#services/RaidService'
import db from '@adonisjs/lucid/services/db'

const HOUR_MS = 60 * 60 * 1000

let io: SocketServer | null = null

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io non initialisé')
  return io
}

export function initSocket(httpServer: import('node:http').Server): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: [env.get('FRONTEND_URL'), env.get('ADMIN_URL')].filter(Boolean),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  combatProgressionService.setIO(io)
  towerService.setIO(io)
  raidService.setIO(io)

  io.on('connection', (socket) => {
    // ── Client rejoint sa room de combat ─────────────────────────────────
    socket.on('combat:join', async (player_id: string) => {
      if (!player_id) return
      const room = `combat:${player_id}`
      await socket.join(room)

      // Envoyer l'état actuel si session existe
      const session = combatProgressionService.getSession(player_id)
      if (session) {
        socket.emit('combat:full_state', session.toSnapshot())
      }
    })

    // ── Client demande l'état complet (reconnexion) ───────────────────────
    socket.on('combat:state', async (player_id: string) => {
      if (!player_id) return
      const session = combatProgressionService.getSession(player_id)
      if (session) {
        socket.emit('combat:full_state', session.toSnapshot())
      } else {
        socket.emit('combat:full_state', null)
      }
    })

    // ── Battle Frontier : rejoindre la room de rotation ─────────────────
    socket.on('bf:join_rotation', async (rotation_id: string) => {
      if (!rotation_id) return
      await socket.join(`bf:${rotation_id}`)
    })

    // ── Battle Frontier : quitter la room ────────────────────────────────
    socket.on('bf:leave_rotation', async (rotation_id: string) => {
      if (!rotation_id) return
      await socket.leave(`bf:${rotation_id}`)
    })

    // ── PvP : rejoindre la room personnelle ─────────────────────────────
    socket.on('pvp:join', async (player_id: string) => {
      if (!player_id) return
      await socket.join(`player:${player_id}`)
    })

    socket.on('pvp:leave', async (player_id: string) => {
      if (!player_id) return
      await socket.leave(`player:${player_id}`)
    })

    // ── Tour Infinie : rejoindre la room ─────────────────────────────────
    socket.on('tower:join', async (player_id: string) => {
      if (!player_id) return
      await socket.join(`tower:${player_id}`)
      const session = towerService.getSession(player_id)
      if (session) {
        socket.emit('tower:full_state', session.toSnapshot())
      }
    })

    socket.on('tower:state', async (player_id: string) => {
      if (!player_id) return
      const session = towerService.getSession(player_id)
      socket.emit('tower:full_state', session ? session.toSnapshot() : null)
    })

    // ── Raids Mondiaux : rejoindre la room d'un raid ─────────────────────
    socket.on('raid:join', async (raid_id: string) => {
      if (!raid_id) return
      await socket.join(`raid:${raid_id}`)
    })

    socket.on('raid:leave', async (raid_id: string) => {
      if (!raid_id) return
      await socket.leave(`raid:${raid_id}`)
    })

    socket.on('disconnect', () => {
      // Sessions continuent de tourner côté serveur — pas d'arrêt
    })
  })

  // ── Recalcul des rangs Tour Infinie toutes les heures ─────────────────
  setInterval(async () => {
    try {
      const season = await towerService.getActiveSeason()
      if (season) {
        await towerService.updateRanks(season.id)
      }
    } catch (err) {
      console.error('[TowerService] updateRanks error:', err)
    }
  }, HOUR_MS)

  // ── Raids : broadcast HP toutes les 5 secondes ────────────────────────
  setInterval(async () => {
    try {
      await raidService.broadcastRaidHp()
    } catch (err) {
      console.error('[RaidService] broadcastRaidHp error:', err)
    }
  }, 5_000)

  // ── Raids : sync Redis → BDD toutes les 60 secondes ──────────────────
  setInterval(async () => {
    try {
      await raidService.syncRaidHpToDb()
    } catch (err) {
      console.error('[RaidService] syncRaidHpToDb error:', err)
    }
  }, 60_000)

  // ── Raids : rotation automatique tous les 3 jours ─────────────────────
  // Vérifie toutes les heures si un nouveau raid doit démarrer
  setInterval(async () => {
    try {
      const db_module = await import('@adonisjs/lucid/services/db')
      const db = db_module.default
      const active = await db.from('raid_instances').where('status', 'active').first()
      if (!active) {
        // Pas de raid actif — vérifier si le dernier date de plus de 3 jours
        const last = await db.from('raid_instances').orderBy('started_at', 'desc').first()
        const THREE_DAYS_MS = 3 * 24 * HOUR_MS
        if (!last || (Date.now() - new Date(last.started_at).getTime()) > THREE_DAYS_MS) {
          await raidService.scheduleNextRaid()
        }
      }
    } catch (err) {
      console.error('[RaidService] scheduleNextRaid check error:', err)
    }
  }, HOUR_MS)

  return io
}

/**
 * Émet une mise à jour du classement BF à tous les clients dans la room de rotation.
 * Appelé depuis BattleFrontierService après chaque victoire.
 */
export async function emitBfLeaderboardUpdate(
  rotation_id: string,
  player_id: string
): Promise<void> {
  const io_instance = io
  if (!io_instance) return

  const top5 = await battleFrontierService.getLeaderboard(rotation_id, 1).then(r => r.data.slice(0, 5))
  const my_rank = await battleFrontierService.getMyRank(player_id, rotation_id)

  io_instance.to(`bf:${rotation_id}`).emit('bf:leaderboard_update', {
    top5: top5.map((e: any, i: number) => ({
      rank: i + 1,
      username: e.username,
      score: e.score,
    })),
    my_rank,
  })
}

/**
 * Émet l'annonce d'une nouvelle rotation à tous les clients connectés.
 */
export function emitBfRotationIncoming(rotation_name_fr: string, mode: string, starts_in_seconds: number): void {
  if (!io) return
  io.emit('bf:rotation_incoming', { rotation_name_fr, mode, starts_in_seconds })
}

/**
 * Notifie le défenseur d'une attaque PvP reçue.
 */
export async function emitPvpAttacked(
  defender_id: string,
  payload: {
    attacker_username: string
    attacker_elo: number
    result: 'attacker_win' | 'defender_win'
    elo_change: number
    elo_after: number
    battle_id: string
  }
): Promise<void> {
  if (!io) return
  io.to(`player:${defender_id}`).emit('pvp:attacked', payload)
}

/**
 * Émet la mise à jour du top 10 PvP à tous les clients connectés.
 */
export async function emitPvpLeaderboardUpdate(): Promise<void> {
  if (!io) return

  const season = await db.from('pvp_seasons').where('is_active', true).first()
  if (!season) return

  const top10 = await db
    .from('pvp_rankings as r')
    .join('players as p', 'p.id', 'r.player_id')
    .where('r.season_id', season.id)
    .orderBy('r.elo', 'desc')
    .limit(10)
    .select('r.rank', 'r.elo', 'r.tier', 'p.username')

  io.emit('pvp:leaderboard_update', {
    top10: top10.map((e: any, i: number) => ({
      rank: e.rank ?? i + 1,
      username: e.username,
      elo: Number(e.elo),
      tier: e.tier,
    })),
  })
}

/**
 * Notifie un joueur d'un passage de tier PvP.
 */
export function emitPvpTierUp(
  player_id: string,
  tier_before: string,
  tier_after: string,
  gems_earned: number
): void {
  if (!io) return
  io.to(`player:${player_id}`).emit('pvp:tier_up', { tier_before, tier_after, gems_earned })
}
