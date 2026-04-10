/**
 * RaidService — Raids Mondiaux Coopératifs.
 * Combat asynchrone collectif contre des Pokémon légendaires/mythiques.
 *
 * Architecture :
 * - HP du Raid stockés dans Redis (atomicité) + sync BDD toutes les 60s
 * - Cooldown par joueur : 4h entre deux attaques
 * - Récompenses calculées à la fin selon le % de contribution
 */

import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import type { Server as SocketServer } from 'socket.io'
import gemsService from '#services/GemsService'
import PushService from '#services/PushService'
import {
  calcRaidDamage,
  calcRewardTier,
  calcContributionPercent,
  isCooldownExpired,
  calcNextAttackAt,
  calcProgressPercent,
  calcTimeRemainingSeconds,
  buildRewardEntries,
  buildExpiredRewardEntries,
  estimatePlayersNeeded,
  RAID_COOLDOWN_MS,
  type RewardTiers,
  type RaidTier,
} from '#services/RaidFormulas'
import { canGigantamax, type GigantamaxData } from '#services/GigantamaxFormulas'

const GMAX_RAID_DAMAGE_MULT = 1.5
import type { OfflinePokemonSnapshot } from '#services/OfflineFormulas'

// ─── Types publics ────────────────────────────────────────────────────────────

export interface RaidAttackResult {
  damage_dealt: number
  hp_remaining: number
  hp_total: number
  progress_percent: number
  my_total_damage: number
  my_contribution_percent: number
  current_tier: RaidTier
  cooldown_next_attack: string
  raid_defeated: boolean
}

export interface ActiveRaidInfo {
  id: string
  boss: {
    name_fr: string
    species_id: number
    difficulty: string
    sprite_url: string | null
  }
  hp_remaining: number
  hp_total: number
  progress_percent: number
  ends_at: string
  time_remaining_seconds: number
  total_participants: number
  my_contribution: {
    damage_dealt: number
    attacks_count: number
    contribution_percent: number
    current_tier: RaidTier
    can_attack_now: boolean
    next_attack_at: string | null
  } | null
}

export interface LeaderboardEntry {
  rank: number
  username: string
  damage_dealt: number
  contribution_percent: number
  tier: string
  attacks_count: number
}

// ─── Clés Redis ───────────────────────────────────────────────────────────────

const raidHpKey = (raid_id: string) => `raid:hp:${raid_id}`
const raidDefeatedKey = (raid_id: string) => `raid:defeated:${raid_id}`

// ─── Service ──────────────────────────────────────────────────────────────────

let io: SocketServer | null = null

class RaidService {
  setIO(socket_io: SocketServer) {
    io = socket_io
  }

  // ─── Démarrer un Raid ──────────────────────────────────────────────────────

  async startRaid(boss_id: number): Promise<object> {
    // Vérifier qu'aucun raid actif du même boss
    const existing = await db
      .from('raid_instances')
      .where({ boss_id, status: 'active' })
      .first()

    if (existing) {
      throw new Error(`Un Raid de ce boss est déjà actif (id: ${existing.id}).`)
    }

    const boss = await db.from('raid_bosses').where('id', boss_id).first()
    if (!boss) throw new Error(`Boss de raid introuvable (id: ${boss_id}).`)

    const started_at = new Date()
    const ends_at = new Date(started_at.getTime() + boss.duration_hours * 3600 * 1000)

    const [raid] = await db.table('raid_instances').insert({
      id: crypto.randomUUID(),
      boss_id,
      hp_remaining: boss.total_hp,
      hp_total: boss.total_hp,
      status: 'active',
      started_at,
      ends_at,
      total_participants: 0,
      total_damage_dealt: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*')

    // Initialiser HP Redis
    await redis.set(raidHpKey(raid.id), String(boss.total_hp))

    // Broadcast global : nouveau Raid
    if (io) {
      io.emit('raid:new', {
        id: raid.id,
        boss_name_fr: boss.name_fr,
        difficulty: boss.difficulty,
        ends_at: ends_at.toISOString(),
        sprite_url: boss.sprite_url,
      })
    }

    // Notifier tous les joueurs abonnés
    const all_players = await db.from('players').select('id')
    const player_ids = all_players.map((p: any) => p.id)
    await PushService.notifyRaidStart(player_ids, boss.name_fr, ends_at.toISOString())

    return { ...raid, boss }
  }

  // ─── Attaquer le Raid ──────────────────────────────────────────────────────

  async attackRaid(player_id: string, raid_id: string): Promise<RaidAttackResult> {
    const now = new Date()

    // 1. Vérifier que le Raid est actif
    const raid = await db.from('raid_instances').where({ id: raid_id, status: 'active' }).first()
    if (!raid) throw new Error('Raid introuvable ou terminé.')

    if (now > new Date(raid.ends_at)) {
      // Raid expiré mais pas encore clos → le clore maintenant
      await this.endRaid(raid_id, 'expired')
      throw new Error('Le Raid a expiré.')
    }

    // 2. Contribution existante ou nouvelle
    let contribution = await db
      .from('raid_contributions')
      .where({ raid_id, player_id })
      .first()

    // 3. Vérifier cooldown
    if (contribution && !isCooldownExpired(contribution.last_attack_at)) {
      const next = calcNextAttackAt(contribution.last_attack_at)
      throw Object.assign(new Error('Cooldown non expiré.'), {
        code: 'COOLDOWN',
        next_attack_at: next,
      })
    }

    // 4. Vérifier que le joueur a une équipe
    const team_pokemon = await db
      .from('player_pokemon')
      .where('player_id', player_id)
      .whereNotNull('slot_team')
      .join('pokemon_species', 'player_pokemon.species_id', 'pokemon_species.id')
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
        'pokemon_species.type1',
        'pokemon_species.type2',
        'pokemon_species.base_atk',
        'pokemon_species.base_spatk',
        'pokemon_species.base_speed',
        'pokemon_species.id as species_id'
      )

    if (!team_pokemon.length) {
      throw new Error("Aucun Pokémon dans l'équipe.")
    }

    // 5. Récupérer les moves de l'équipe
    const pokemon_ids = team_pokemon.map((p: any) => p.id)
    const moves_rows = await db
      .from('player_pokemon_moves')
      .whereIn('player_pokemon_id', pokemon_ids)
      .join('moves', 'player_pokemon_moves.move_id', 'moves.id')
      .select(
        'player_pokemon_moves.player_pokemon_id',
        'moves.id as move_id',
        'moves.power',
        'moves.category',
        'moves.type'
      )

    const moves_by_pokemon = new Map<string, typeof moves_rows>()
    for (const mv of moves_rows) {
      const arr = moves_by_pokemon.get(mv.player_pokemon_id) ?? []
      arr.push(mv)
      moves_by_pokemon.set(mv.player_pokemon_id, arr)
    }

    // 6. Construire les snapshots
    const team_snapshots: OfflinePokemonSnapshot[] = team_pokemon.map((p: any) => ({
      species_id: p.species_id,
      level: p.level,
      nature: p.nature,
      ivs: {
        hp: p.iv_hp ?? 0,
        atk: p.iv_atk ?? 0,
        def: p.iv_def ?? 0,
        spatk: p.iv_spatk ?? 0,
        spdef: p.iv_spdef ?? 0,
        speed: p.iv_speed ?? 0,
      },
      type1: p.type1,
      type2: p.type2 ?? null,
      base_atk: p.base_atk,
      base_spatk: p.base_spatk,
      base_speed: p.base_speed,
      moves: (moves_by_pokemon.get(p.id) ?? []).map((mv: any) => ({
        move_id: mv.move_id,
        power: mv.power,
        category: mv.category,
        type: mv.type,
      })),
    }))

    // 7. Récupérer le multiplicateur prestige du joueur
    const player_row = await db
      .from('players')
      .where('id', player_id)
      .select('prestige_gold_mult')
      .first()
    const prestige_gold_mult = Number(player_row?.prestige_gold_mult ?? 1)

    // 8. Calculer les dégâts
    let { damage } = calcRaidDamage({ team: team_snapshots, prestige_gold_mult })

    // 8b. Bonus Gigantamax : ×1.5 si le joueur a un GMax débloqué dans son équipe
    const gmax_used = await this.applyGmaxBonusIfEligible(player_id, team_pokemon, damage)
    if (gmax_used.applied) {
      damage = gmax_used.damage
    }

    // 9. Déduire HP atomiquement via Redis
    const hp_remaining = await this.deductRaidHp(raid_id, damage, Number(raid.hp_total))

    // 10. Mettre à jour la contribution en BDD
    const contribution_id = contribution?.id ?? crypto.randomUUID()
    if (!contribution) {
      await db.table('raid_contributions').insert({
        id: contribution_id,
        raid_id,
        player_id,
        damage_dealt: damage,
        attacks_count: 1,
        last_attack_at: now,
        rewards_claimed: false,
        joined_at: now,
        created_at: now,
        updated_at: now,
      })
      // Incrémenter total_participants
      await db.from('raid_instances').where('id', raid_id).increment('total_participants', 1)
    } else {
      await db
        .from('raid_contributions')
        .where('id', contribution.id)
        .increment('damage_dealt', damage)
        .update({ attacks_count: db.raw('attacks_count + 1'), last_attack_at: now, updated_at: now })
    }

    // Mettre à jour total_damage_dealt
    await db
      .from('raid_instances')
      .where('id', raid_id)
      .increment('total_damage_dealt', damage)
      .update({ updated_at: now })

    // 11. Récupérer la contribution totale mise à jour
    const contrib_updated = await db
      .from('raid_contributions')
      .where({ raid_id, player_id })
      .first()

    const total_damage_row = await db
      .from('raid_instances')
      .where('id', raid_id)
      .select('total_damage_dealt')
      .first()

    const my_total_damage = Number(contrib_updated?.damage_dealt ?? damage)
    const total_damage_so_far = Number(total_damage_row?.total_damage_dealt ?? damage)
    const contribution_percent = calcContributionPercent(my_total_damage, total_damage_so_far)

    const boss = await db.from('raid_bosses').where('id', raid.boss_id).first()
    const tiers: RewardTiers = typeof boss.rewards_tiers === 'string'
      ? JSON.parse(boss.rewards_tiers)
      : boss.rewards_tiers
    const current_tier = calcRewardTier(contribution_percent, tiers)

    // 12. Émettre les events Socket.io
    if (io) {
      io.to(`raid:${raid_id}`).emit('raid:attack', {
        username: await this.getUsername(player_id),
        damage_dealt: damage,
        hp_after: hp_remaining,
        contribution_percent,
        gmax_applied: gmax_used.applied,
        gmax_pokemon_name_fr: gmax_used.pokemon_name_fr ?? null,
        gmax_name_fr: gmax_used.gmax_name_fr ?? null,
      })
    }

    // 13. Vérifier si le Raid est vaincu
    const raid_defeated = hp_remaining <= 0
    if (raid_defeated) {
      // Marquer comme vaincu dans Redis pour éviter les doublons
      const already = await redis.set(raidDefeatedKey(raid_id), '1', 'EX', 300, 'NX')
      if (already === 'OK') {
        // Seul le premier appel après hp <= 0 déclenche la fin
        await this.endRaid(raid_id, 'defeated')
      }
    }

    return {
      damage_dealt: damage,
      hp_remaining: Math.max(0, hp_remaining),
      hp_total: Number(raid.hp_total),
      progress_percent: calcProgressPercent(Math.max(0, hp_remaining), Number(raid.hp_total)),
      my_total_damage,
      my_contribution_percent: contribution_percent,
      current_tier,
      cooldown_next_attack: new Date(now.getTime() + RAID_COOLDOWN_MS).toISOString(),
      raid_defeated,
    }
  }

  // ─── Décrémenter HP atomiquement via Redis ─────────────────────────────────

  async deductRaidHp(raid_id: string, damage: number, hp_total: number): Promise<number> {
    const key = raidHpKey(raid_id)

    // S'assurer que la clé Redis existe (initialisation lazy)
    const current = await redis.get(key)
    if (current === null) {
      const db_raid = await db.from('raid_instances').where('id', raid_id).select('hp_remaining').first()
      const hp_init = db_raid ? String(db_raid.hp_remaining) : String(hp_total)
      await redis.set(key, hp_init, 'NX')
    }

    // DECRBY atomique
    const new_hp = await redis.decrby(key, damage)
    return Math.max(0, new_hp)
  }

  // ─── Fin du Raid ───────────────────────────────────────────────────────────

  async endRaid(raid_id: string, reason: 'defeated' | 'expired'): Promise<void> {
    const raid = await db.from('raid_instances').where('id', raid_id).first()
    if (!raid) return
    if (raid.status !== 'active') return // déjà terminé

    const now = new Date()
    await db.from('raid_instances').where('id', raid_id).update({
      status: reason === 'defeated' ? 'defeated' : 'expired',
      defeated_at: reason === 'defeated' ? now : null,
      updated_at: now,
    })

    const boss = await db.from('raid_bosses').where('id', raid.boss_id).first()
    const tiers: RewardTiers = typeof boss.rewards_tiers === 'string'
      ? JSON.parse(boss.rewards_tiers)
      : boss.rewards_tiers

    const contributions = await db
      .from('raid_contributions')
      .where('raid_id', raid_id)

    const total_damage = Number(raid.total_damage_dealt) || 1

    for (const contrib of contributions) {
      const percent = calcContributionPercent(Number(contrib.damage_dealt), total_damage)
      const tier = reason === 'defeated'
        ? calcRewardTier(percent, tiers)
        : 'support' // raid expiré → support uniquement

      await db.from('raid_contributions').where('id', contrib.id).update({
        reward_tier: tier,
        updated_at: now,
      })

      const reward_entries = reason === 'defeated'
        ? buildRewardEntries(tier, tiers, boss.species_id, boss.name_fr)
        : buildExpiredRewardEntries(tiers, boss.species_id, boss.name_fr)

      for (const entry of reward_entries) {
        await db.table('raid_rewards').insert({
          id: crypto.randomUUID(),
          player_id: contrib.player_id,
          raid_id,
          reward_type: entry.reward_type,
          reward_data: JSON.stringify(entry.reward_data),
          collected: false,
          created_at: now,
        })

        // Émettre event socket GMax unlock immédiatement
        if (entry.reward_type === 'gmax_unlock' && io) {
          const species_id = (entry.reward_data as any).species_id
          const gmax_name_fr = (entry.reward_data as any).name_fr
          // Insérer dans player_gigantamax
          await db.rawQuery(`
            INSERT INTO player_gigantamax (player_id, species_id, unlocked_at)
            VALUES (?, ?, NOW())
            ON CONFLICT DO NOTHING
          `, [contrib.player_id, species_id])
          io.to(`player:${contrib.player_id}`).emit('player:gmax_unlocked', {
            species_id,
            gmax_name_fr,
          })
        }
      }
    }

    // Notifier via Socket.io
    if (io) {
      if (reason === 'defeated') {
        io.to(`raid:${raid_id}`).emit('raid:defeated', {
          boss_name_fr: boss.name_fr,
          total_participants: raid.total_participants,
          total_damage: raid.total_damage_dealt,
          message: `Le Raid est vaincu ! Tes récompenses t'attendent.`,
        })
        io.emit('raid:world_victory', {
          boss_name_fr: boss.name_fr,
          participant_count: raid.total_participants,
        })
      }
    }

    // Notifications push aux participants
    const player_ids = contributions.map((c: any) => c.player_id)
    if (player_ids.length > 0 && reason === 'defeated') {
      await PushService.notifyRaidDefeated(player_ids, boss.name_fr)
    }

    // Nettoyer Redis
    await redis.del(raidHpKey(raid_id))
    await redis.del(raidDefeatedKey(raid_id))
  }

  // ─── Sync HP Redis → BDD (toutes les 60s) ─────────────────────────────────

  async syncRaidHpToDb(): Promise<void> {
    const active_raids = await db
      .from('raid_instances')
      .where('status', 'active')
      .select('id', 'hp_remaining')

    for (const raid of active_raids) {
      const redis_hp = await redis.get(raidHpKey(raid.id))
      if (redis_hp !== null) {
        const hp = Math.max(0, parseInt(redis_hp, 10))
        await db.from('raid_instances').where('id', raid.id).update({
          hp_remaining: hp,
          updated_at: new Date(),
        })
      }
    }
  }

  // ─── Broadcast HP toutes les 5s ───────────────────────────────────────────

  async broadcastRaidHp(): Promise<void> {
    if (!io) return

    const active_raids = await db
      .from('raid_instances')
      .where('status', 'active')
      .select('id', 'hp_remaining', 'hp_total', 'boss_id')

    for (const raid of active_raids) {
      const hp_str = await redis.get(raidHpKey(raid.id))
      const hp = hp_str !== null ? Math.max(0, parseInt(hp_str, 10)) : Number(raid.hp_remaining)
      const hp_total = Number(raid.hp_total)

      io.to(`raid:${raid.id}`).emit('raid:hp_update', {
        hp_remaining: hp,
        hp_total,
        progress_percent: calcProgressPercent(hp, hp_total),
      })

      // Vérifier expiration
      const raid_full = await db.from('raid_instances').where('id', raid.id).first()
      if (raid_full && new Date() > new Date(raid_full.ends_at)) {
        const already = await redis.set(raidDefeatedKey(raid.id), '1', 'EX', 300, 'NX')
        if (already === 'OK') {
          await this.endRaid(raid.id, 'expired')
        }
      }
    }
  }

  // ─── Scheduler : lancer le prochain Raid ──────────────────────────────────

  async scheduleNextRaid(): Promise<void> {
    const available_bosses = await db.from('raid_bosses').where('is_active', true)
    if (!available_bosses.length) return

    const last_raid = await db
      .from('raid_instances')
      .orderBy('started_at', 'desc')
      .first()

    const filtered = last_raid
      ? available_bosses.filter((b: any) => b.id !== last_raid.boss_id)
      : available_bosses

    const pool = filtered.length > 0 ? filtered : available_bosses
    const next = pool[Math.floor(Math.random() * pool.length)]
    await this.startRaid(next.id)
  }

  // ─── Collecter une récompense ──────────────────────────────────────────────

  async collectReward(player_id: string, reward_id: string): Promise<object> {
    const reward = await db
      .from('raid_rewards')
      .where({ id: reward_id, player_id, collected: false })
      .first()

    if (!reward) throw new Error('Récompense introuvable ou déjà collectée.')

    const reward_data = typeof reward.reward_data === 'string'
      ? JSON.parse(reward.reward_data)
      : reward.reward_data

    await db.transaction(async (trx) => {
      await trx.from('raid_rewards').where('id', reward_id).update({
        collected: true,
      })

      if (reward.reward_type === 'gems') {
        await gemsService.awardGems(player_id, reward_data.amount, 'Récompense Raid Mondial', 'raid_reward')
      } else if (reward.reward_type === 'gold') {
        await trx.from('players').where('id', player_id).increment('gold', reward_data.amount ?? 0)
      }
      // Les récompenses pokemon/item sont signalées mais le vrai spawn se fait ailleurs
    })

    return { collected: true, reward_type: reward.reward_type, reward_data }
  }

  // ─── Getters publics ──────────────────────────────────────────────────────

  async getActiveRaids(player_id?: string): Promise<ActiveRaidInfo[]> {
    const raids = await db
      .from('raid_instances')
      .where('status', 'active')
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .select(
        'raid_instances.id',
        'raid_instances.hp_remaining',
        'raid_instances.hp_total',
        'raid_instances.ends_at',
        'raid_instances.total_participants',
        'raid_bosses.name_fr as boss_name_fr',
        'raid_bosses.species_id as boss_species_id',
        'raid_bosses.difficulty as boss_difficulty',
        'raid_bosses.sprite_url as boss_sprite_url',
        'raid_bosses.rewards_tiers',
      )

    const results: ActiveRaidInfo[] = []

    for (const r of raids) {
      const hp_str = await redis.get(raidHpKey(r.id))
      const hp_remaining = hp_str !== null ? Math.max(0, parseInt(hp_str, 10)) : Number(r.hp_remaining)
      const hp_total = Number(r.hp_total)
      const now = Date.now()

      let my_contribution = null
      if (player_id) {
        const contrib = await db
          .from('raid_contributions')
          .where({ raid_id: r.id, player_id })
          .first()

        const tiers: RewardTiers = typeof r.rewards_tiers === 'string'
          ? JSON.parse(r.rewards_tiers)
          : r.rewards_tiers

        const total_dmg = Number(
          (await db.from('raid_instances').where('id', r.id).select('total_damage_dealt').first())?.total_damage_dealt ?? 0
        )
        const my_dmg = contrib ? Number(contrib.damage_dealt) : 0
        const contribution_percent = calcContributionPercent(my_dmg, total_dmg || 1)

        my_contribution = {
          damage_dealt: my_dmg,
          attacks_count: contrib?.attacks_count ?? 0,
          contribution_percent,
          current_tier: contrib ? calcRewardTier(contribution_percent, tiers) : 'none' as RaidTier,
          can_attack_now: contrib ? isCooldownExpired(contrib.last_attack_at) : true,
          next_attack_at: contrib ? calcNextAttackAt(contrib.last_attack_at) : null,
        }
      }

      results.push({
        id: r.id,
        boss: {
          name_fr: r.boss_name_fr,
          species_id: r.boss_species_id,
          difficulty: r.boss_difficulty,
          sprite_url: r.boss_sprite_url,
        },
        hp_remaining,
        hp_total,
        progress_percent: calcProgressPercent(hp_remaining, hp_total),
        ends_at: new Date(r.ends_at).toISOString(),
        time_remaining_seconds: calcTimeRemainingSeconds(new Date(r.ends_at).toISOString(), now),
        total_participants: r.total_participants,
        my_contribution,
      })
    }

    return results
  }

  async getRaidDetail(raid_id: string, _player_id?: string): Promise<object | null> {
    const [raid] = await this.buildRaidQuery(raid_id)
    if (!raid) return null

    const hp_str = await redis.get(raidHpKey(raid_id))
    const hp_remaining = hp_str !== null ? Math.max(0, parseInt(hp_str, 10)) : Number(raid.hp_remaining)

    return {
      ...raid,
      hp_remaining,
      progress_percent: calcProgressPercent(hp_remaining, Number(raid.hp_total)),
    }
  }

  async getLeaderboard(raid_id: string, player_id?: string): Promise<object> {
    const raid = await db
      .from('raid_instances')
      .where('raid_instances.id', raid_id)
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .select('raid_instances.*', 'raid_bosses.name_fr as boss_name_fr', 'raid_bosses.rewards_tiers')
      .first()

    if (!raid) throw new Error('Raid introuvable.')

    const hp_str = await redis.get(raidHpKey(raid_id))
    const hp_remaining = hp_str !== null ? Math.max(0, parseInt(hp_str, 10)) : Number(raid.hp_remaining)

    const contributions = await db
      .from('raid_contributions')
      .where('raid_id', raid_id)
      .join('players', 'raid_contributions.player_id', 'players.id')
      .orderBy('damage_dealt', 'desc')
      .limit(50)
      .select(
        'raid_contributions.player_id',
        'raid_contributions.damage_dealt',
        'raid_contributions.attacks_count',
        'raid_contributions.reward_tier',
        'players.username'
      )

    const total_damage = Number(raid.total_damage_dealt) || 1
    const tiers: RewardTiers = typeof raid.rewards_tiers === 'string'
      ? JSON.parse(raid.rewards_tiers)
      : raid.rewards_tiers

    const leaderboard: LeaderboardEntry[] = contributions.map((c: any, i: number) => {
      const pct = calcContributionPercent(Number(c.damage_dealt), total_damage)
      return {
        rank: i + 1,
        username: c.username,
        damage_dealt: Number(c.damage_dealt),
        contribution_percent: pct,
        tier: c.reward_tier ?? calcRewardTier(pct, tiers),
        attacks_count: c.attacks_count,
      }
    })

    let my_rank: number | null = null
    let my_entry: LeaderboardEntry | null = null
    if (player_id) {
      const idx = leaderboard.findIndex((e) => {
        const contrib = contributions.find((c: any) => c.player_id === player_id)
        return contrib && e.damage_dealt === Number(contrib.damage_dealt)
      })
      if (idx >= 0) {
        my_rank = idx + 1
        my_entry = leaderboard[idx]
      }
    }

    return {
      raid: {
        id: raid_id,
        name_fr: raid.boss_name_fr,
        status: raid.status,
        hp_remaining,
        hp_total: Number(raid.hp_total),
        progress_percent: calcProgressPercent(hp_remaining, Number(raid.hp_total)),
      },
      leaderboard,
      my_rank,
      my_entry,
    }
  }

  async getHistory(): Promise<object[]> {
    return db
      .from('raid_instances')
      .whereIn('status', ['defeated', 'expired'])
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .orderBy('raid_instances.started_at', 'desc')
      .limit(10)
      .select(
        'raid_instances.id',
        'raid_instances.status',
        'raid_instances.hp_total',
        'raid_instances.total_participants',
        'raid_instances.total_damage_dealt',
        'raid_instances.started_at',
        'raid_instances.ends_at',
        'raid_instances.defeated_at',
        'raid_bosses.name_fr as boss_name_fr',
        'raid_bosses.difficulty as boss_difficulty',
        'raid_bosses.sprite_url as boss_sprite_url',
      )
  }

  async getPendingRewards(player_id: string): Promise<object[]> {
    return db
      .from('raid_rewards')
      .where({ player_id, collected: false })
      .join('raid_instances', 'raid_rewards.raid_id', 'raid_instances.id')
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .select(
        'raid_rewards.id',
        'raid_rewards.reward_type',
        'raid_rewards.reward_data',
        'raid_rewards.created_at',
        'raid_bosses.name_fr as boss_name_fr',
      )
  }

  async getMyContribution(player_id: string, raid_id: string): Promise<object | null> {
    const contrib = await db
      .from('raid_contributions')
      .where({ raid_id, player_id })
      .first()

    if (!contrib) return null

    const raid = await db
      .from('raid_instances')
      .where('id', raid_id)
      .select('total_damage_dealt', 'boss_id')
      .first()

    const boss = await db.from('raid_bosses').where('id', raid.boss_id).first()
    const tiers: RewardTiers = typeof boss.rewards_tiers === 'string'
      ? JSON.parse(boss.rewards_tiers)
      : boss.rewards_tiers

    const total_dmg = Number(raid.total_damage_dealt) || 1
    const my_dmg = Number(contrib.damage_dealt)
    const contribution_percent = calcContributionPercent(my_dmg, total_dmg)
    const tier = calcRewardTier(contribution_percent, tiers)

    return {
      ...contrib,
      contribution_percent,
      current_tier: tier,
      can_attack_now: isCooldownExpired(contrib.last_attack_at),
      next_attack_at: calcNextAttackAt(contrib.last_attack_at),
    }
  }

  // ─── Stats admin ──────────────────────────────────────────────────────────

  async getAdminRaidStats(raid_id: string): Promise<object> {
    const raid = await db
      .from('raid_instances')
      .where('raid_instances.id', raid_id)
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .select('raid_instances.*', 'raid_bosses.name_fr as boss_name_fr', 'raid_bosses.total_hp as boss_hp')
      .first()

    if (!raid) throw new Error('Raid introuvable.')

    const hp_str = await redis.get(raidHpKey(raid_id))
    const hp_remaining = hp_str !== null ? Math.max(0, parseInt(hp_str, 10)) : Number(raid.hp_remaining)

    const top_contributors = await db
      .from('raid_contributions')
      .where('raid_id', raid_id)
      .join('players', 'raid_contributions.player_id', 'players.id')
      .orderBy('damage_dealt', 'desc')
      .limit(10)
      .select('players.username', 'raid_contributions.damage_dealt', 'raid_contributions.attacks_count')

    return {
      raid_id,
      boss_name_fr: raid.boss_name_fr,
      status: raid.status,
      hp_remaining,
      hp_total: Number(raid.hp_total),
      progress_percent: calcProgressPercent(hp_remaining, Number(raid.hp_total)),
      total_participants: raid.total_participants,
      total_damage_dealt: raid.total_damage_dealt,
      started_at: raid.started_at,
      ends_at: raid.ends_at,
      top_contributors,
    }
  }

  async listAllRaids(): Promise<object[]> {
    return db
      .from('raid_instances')
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .orderBy('raid_instances.started_at', 'desc')
      .select(
        'raid_instances.id',
        'raid_instances.status',
        'raid_instances.hp_remaining',
        'raid_instances.hp_total',
        'raid_instances.total_participants',
        'raid_instances.total_damage_dealt',
        'raid_instances.started_at',
        'raid_instances.ends_at',
        'raid_bosses.id as boss_id',
        'raid_bosses.name_fr as boss_name_fr',
        'raid_bosses.difficulty as boss_difficulty',
      )
  }

  // ─── Utilitaires privés ───────────────────────────────────────────────────

  private async buildRaidQuery(raid_id: string) {
    return db
      .from('raid_instances')
      .where('raid_instances.id', raid_id)
      .join('raid_bosses', 'raid_instances.boss_id', 'raid_bosses.id')
      .select(
        'raid_instances.*',
        'raid_bosses.name_fr as boss_name_fr',
        'raid_bosses.species_id as boss_species_id',
        'raid_bosses.difficulty as boss_difficulty',
        'raid_bosses.sprite_url as boss_sprite_url',
        'raid_bosses.rewards_tiers',
      )
  }

  private async getUsername(player_id: string): Promise<string> {
    const player = await db.from('players').where('id', player_id).select('username').first()
    return player?.username ?? 'Inconnu'
  }

  // ─── Gigantamax bonus pour les Raids ─────────────────────────────────────

  private async applyGmaxBonusIfEligible(
    player_id: string,
    team_pokemon: any[],
    base_damage: number
  ): Promise<{ applied: boolean; damage: number; pokemon_name_fr?: string; gmax_name_fr?: string }> {
    try {
      const species_ids = team_pokemon.map((p: any) => p.species_id)
      const [gmax_forms, unlocked_rows] = await Promise.all([
        db.from('gigantamax_forms').whereIn('species_id', species_ids).select('*') as Promise<GigantamaxData[]>,
        db.from('player_gigantamax').where('player_id', player_id).select('species_id'),
      ])

      if (gmax_forms.length === 0) return { applied: false, damage: base_damage }

      const unlocked_ids = unlocked_rows.map((r: any) => r.species_id)

      for (const p of team_pokemon) {
        if (!canGigantamax('raid', p.species_id, gmax_forms, unlocked_ids, false)) continue

        const gmax = gmax_forms.find((g) => g.species_id === p.species_id)
        if (!gmax) continue

        // Fetch pokemon name for the event
        const species_row = await db.from('pokemon_species').where('id', p.species_id).select('name_fr').first()

        return {
          applied: true,
          damage: Math.floor(base_damage * GMAX_RAID_DAMAGE_MULT),
          pokemon_name_fr: species_row?.name_fr ?? `#${p.species_id}`,
          gmax_name_fr: gmax.gmax_name_fr,
        }
      }
    } catch { /* GMax bonus optionnel */ }

    return { applied: false, damage: base_damage }
  }
}

const raidService = new RaidService()
export default raidService
export { estimatePlayersNeeded }
