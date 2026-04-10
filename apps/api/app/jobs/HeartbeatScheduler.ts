/**
 * HeartbeatScheduler — Vérifie toutes les heures les joueurs absents
 * et déclenche les calculs offline manqués (ex: fermeture brutale du navigateur).
 */

import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { OfflineQueue } from '#jobs/OfflineQueue'
import { MIN_ABSENCE_SECONDS } from '#services/OfflineFormulas'

/**
 * Vérifie les joueurs absents depuis plus de MIN_ABSENCE_SECONDS
 * et n'ayant pas encore de rapport pending.
 * Appelé toutes les heures par le scheduler AdonisJS.
 */
export async function checkAbsentPlayers(): Promise<void> {
  const threshold_date = new Date(Date.now() - MIN_ABSENCE_SECONDS * 1000)

  const absent_players = await db
    .from('players')
    .where('last_seen_at', '<', threshold_date)
    .whereNotNull('last_seen_at')
    .select('id', 'last_seen_at', 'current_floor')
    .limit(100)

  let queued = 0
  for (const player of absent_players) {
    // Vérifier qu'il n'y a pas déjà un rapport pending
    const pending = await redis.get(`offline_report_pending:${player.id}`)
    if (pending) continue

    // Vérifier qu'il n'y a pas déjà un job en attente dans la queue
    const existing_jobs = await OfflineQueue.getJobs(['waiting', 'active'])
    const already_queued = existing_jobs.some((j) => j.data.player_id === player.id)
    if (already_queued) continue

    // Snapshot minimal — pas d'équipe connue, DPS estimé sera 0
    // Un vrai snapshot nécessite de charger l'équipe depuis la BDD
    const team = await buildMinimalTeamSnapshot(player.id)

    await OfflineQueue.add('calculate-offline', {
      player_id: player.id,
      last_seen_at: new Date(player.last_seen_at).toISOString(),
      floor_number: player.current_floor ?? 1,
      team_snapshot: team,
    })

    queued++
  }

  if (queued > 0) {
    console.log(`[HeartbeatScheduler] ${queued} offline jobs queued for absent players`)
  }
}

/**
 * Construit un snapshot d'équipe depuis la BDD pour un joueur.
 * Utilisé par le scheduler (contrairement au login qui a déjà le snapshot).
 */
async function buildMinimalTeamSnapshot(player_id: string): Promise<any> {
  const team_pokemon = await db
    .from('player_pokemon')
    .join('pokemon_species', 'pokemon_species.id', 'player_pokemon.species_id')
    .where('player_pokemon.player_id', player_id)
    .whereNotNull('player_pokemon.slot_team')
    .orderBy('player_pokemon.slot_team', 'asc')
    .select(
      'player_pokemon.id',
      'player_pokemon.level',
      'player_pokemon.nature',
      'player_pokemon.iv_hp',
      'player_pokemon.iv_atk',
      'player_pokemon.iv_def',
      'player_pokemon.iv_spatk',
      'player_pokemon.iv_spdef',
      'player_pokemon.iv_speed',
      'pokemon_species.id as species_id',
      'pokemon_species.type1',
      'pokemon_species.type2',
      'pokemon_species.base_atk',
      'pokemon_species.base_spatk',
      'pokemon_species.base_speed'
    )

  const pokemon_snapshots = await Promise.all(
    team_pokemon.map(async (pp: any) => {
      // Charger les moves
      const moves = await db
        .from('player_pokemon_moves')
        .join('moves', 'moves.id', 'player_pokemon_moves.move_id')
        .where('player_pokemon_moves.player_pokemon_id', pp.id)
        .select('moves.id as move_id', 'moves.power', 'moves.category', 'moves.type')

      return {
        species_id: pp.species_id,
        level: pp.level,
        nature: pp.nature,
        ivs: {
          hp: pp.iv_hp ?? 0,
          atk: pp.iv_atk ?? 0,
          def: pp.iv_def ?? 0,
          spatk: pp.iv_spatk ?? 0,
          spdef: pp.iv_spdef ?? 0,
          speed: pp.iv_speed ?? 0,
        },
        moves: moves.map((m: any) => ({
          move_id: m.move_id,
          power: m.power,
          category: m.category,
          type: m.type,
        })),
        type1: pp.type1,
        type2: pp.type2 ?? null,
        base_atk: pp.base_atk ?? 50,
        base_spatk: pp.base_spatk ?? 50,
        base_speed: pp.base_speed ?? 50,
      }
    })
  )

  return { pokemon: pokemon_snapshots }
}

export { buildMinimalTeamSnapshot }
