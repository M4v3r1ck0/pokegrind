/**
 * BattleFrontierService — Logique Battle Frontier complète.
 * Orchestre sessions, combats, classements, shop et succès.
 */

import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import { DateTime } from 'luxon'
import BfRotation from '#models/bf_rotation'
import BfSession from '#models/bf_session'
import BfLeaderboard from '#models/bf_leaderboard'
import GemsService from '#services/GemsService'
import PushService from '#services/PushService'
import {
  validateTeamForRotation,
  resolveBfBattle,
  calcRotationRewards,
  generateRotationName,
  CHALLENGE_POOL,
  buildBfCombatPokemon,
  type BfTeamMember,
  type BfBattleResult,
  type BfMode,
  type ChallengeType,
} from '#services/BattleFrontierFormulas'
import type { Nature, PokemonType } from '@pokegrind/shared'

// Import différé pour éviter la dépendance circulaire au boot
async function notifyLeaderboardUpdate(rotation_id: string): Promise<void> {
  try {
    const { emitBfLeaderboardUpdate } = await import('#start/socket')
    await emitBfLeaderboardUpdate(rotation_id)
  } catch {
    // Socket.io non disponible (ex: tests unitaires) — silencieux
  }
}

const MODES: BfMode[] = ['tower', 'factory', 'arena']

// ─── Rotation courante ────────────────────────────────────────────────────────

class BattleFrontierService {

  async getCurrentRotation(): Promise<BfRotation | null> {
    const now = new Date()
    return BfRotation.query()
      .where('start_at', '<=', now)
      .where('end_at', '>=', now)
      .orderBy('start_at', 'desc')
      .first()
  }

  // ─── Inscription ─────────────────────────────────────────────────────────

  async joinRotation(player_id: string, rotation_id: string, mode: string): Promise<{ session: BfSession; errors?: string[] }> {
    const rotation = await BfRotation.find(rotation_id)
    if (!rotation) throw new Error('Rotation introuvable')

    const now = new Date()
    if (rotation.startAt.toJSDate() > now || rotation.endAt.toJSDate() < now) {
      throw new Error('Cette rotation n\'est plus active')
    }
    if (rotation.mode !== mode) {
      throw new Error(`Cette rotation est en mode ${rotation.mode}`)
    }

    // Vérifier si une session existe déjà
    const existing = await BfSession.query()
      .where('player_id', player_id)
      .where('rotation_id', rotation_id)
      .first()
    if (existing) {
      return { session: existing }
    }

    // Charger l'équipe du joueur
    const team = await this.loadPlayerTeam(player_id)
    if (team.length === 0) throw new Error('Équipe vide — impossible de rejoindre')

    // Valider l'équipe contre les règles
    const rules = {
      tier_restriction: rotation.tierRestriction,
      challenge_type: (rotation.challengeType as ChallengeType) ?? 'standard',
      rules_json: rotation.rulesJson ?? {},
      mode: mode as BfMode,
    }
    const validation = validateTeamForRotation(team, rules)
    if (!validation.valid) {
      return { session: null as any, errors: validation.errors }
    }

    // Factory : générer le pool
    let factory_pool: BfTeamMember[] | null = null
    if (mode === 'factory') {
      factory_pool = await this.generateFactoryPool(rotation)
    }

    const session = await BfSession.create({
      playerId: player_id,
      rotationId: rotation_id,
      mode: mode as BfMode,
      currentStreak: 0,
      bestStreak: 0,
      frontierPointsEarned: 0,
      status: 'active',
      teamSnapshot: { pokemon: team },
      factoryPool: factory_pool,
      startedAt: DateTime.now(),
    })

    return { session }
  }

  // ─── Combat ──────────────────────────────────────────────────────────────

  async resolveBattle(player_id: string): Promise<BfBattleResult & { session_id: string }> {
    const rotation = await this.getCurrentRotation()
    if (!rotation) throw new Error('Aucune rotation active')

    const session = await BfSession.query()
      .where('player_id', player_id)
      .where('rotation_id', rotation.id)
      .where('status', 'active')
      .first()
    if (!session) throw new Error('Aucune session active pour cette rotation')

    // Équipe du joueur depuis le snapshot
    const team = (session.teamSnapshot as any).pokemon as BfTeamMember[]

    // Générer l'adversaire
    const enemy_team = await this.generateOpponent(session, rotation)

    // Résoudre le combat
    const rules = {
      tier_restriction: rotation.tierRestriction,
      challenge_type: (rotation.challengeType as ChallengeType) ?? 'standard',
      rules_json: rotation.rulesJson ?? {},
      mode: session.mode,
    }
    const combat_result = resolveBfBattle(team, enemy_team, session.currentStreak, session.mode)

    // Battle number
    const battle_count = await db.from('bf_battles').where('session_id', session.id).count('* as c').first()
    const battle_number = Number(battle_count?.c ?? 0) + 1

    // Enregistrer le combat
    await db.table('bf_battles').insert({
      id: crypto.randomUUID(),
      session_id: session.id,
      battle_number,
      opponent_snapshot: JSON.stringify(enemy_team),
      result: combat_result.result,
      duration_seconds: combat_result.duration_seconds,
      created_at: new Date(),
    })

    // Mettre à jour la session
    const new_pf = session.frontierPointsEarned + combat_result.pf_earned
    const new_streak = combat_result.streak_new
    const new_best = Math.max(session.bestStreak, new_streak)

    await session.merge({
      currentStreak: new_streak,
      bestStreak: new_best,
      frontierPointsEarned: new_pf,
      status: combat_result.result === 'loss' ? 'completed' : 'active',
      endedAt: combat_result.result === 'loss' ? DateTime.now() : undefined,
    }).save()

    // Attribuer les PF au joueur
    if (combat_result.pf_earned > 0) {
      await db.from('players').where('id', player_id).increment('frontier_points', combat_result.pf_earned)
    }

    // Mettre à jour le classement
    if (combat_result.score_delta > 0) {
      await this.updateLeaderboard(player_id, rotation.id, combat_result.score_delta)
      // Notifier les clients connectés via Socket.io
      notifyLeaderboardUpdate(rotation.id).catch(() => {})
    }

    // Vérifier les succès
    await this.checkAchievements(player_id, session, new_streak, combat_result.result)

    return { ...combat_result, session_id: session.id }
  }

  // ─── Classement ──────────────────────────────────────────────────────────

  async updateLeaderboard(player_id: string, rotation_id: string, score_delta: number): Promise<void> {
    const existing = await BfLeaderboard.query()
      .where('player_id', player_id)
      .where('rotation_id', rotation_id)
      .first()

    if (existing) {
      await db.from('bf_leaderboard')
        .where('player_id', player_id)
        .where('rotation_id', rotation_id)
        .update({
          score: db.raw(`score + ${score_delta}`),
          updated_at: new Date(),
        })
    } else {
      await db.table('bf_leaderboard').insert({
        rotation_id,
        player_id,
        score: score_delta,
        updated_at: new Date(),
      })
    }

    // Invalider le cache Redis
    const keys = await redis.keys(`bf_leaderboard:${rotation_id}:*`)
    if (keys.length > 0) await redis.del(...keys)
  }

  async getLeaderboard(rotation_id: string, page: number = 1): Promise<{
    data: any[]
    meta: { total: number; page: number; last_page: number }
  }> {
    const per_page = 50
    const cache_key = `bf_leaderboard:${rotation_id}:${page}`
    const cached = await redis.get(cache_key)
    if (cached) return JSON.parse(cached)

    const count_row = await db.from('bf_leaderboard').where('rotation_id', rotation_id).count('* as total').first()
    const total = Number(count_row?.total ?? 0)

    const data = await db.from('bf_leaderboard')
      .join('players', 'players.id', 'bf_leaderboard.player_id')
      .where('bf_leaderboard.rotation_id', rotation_id)
      .select(
        'bf_leaderboard.player_id',
        'players.username',
        'bf_leaderboard.score',
        'bf_leaderboard.rank',
      )
      .orderBy('bf_leaderboard.score', 'desc')
      .limit(per_page)
      .offset((page - 1) * per_page)

    // Calculer les rangs dynamiquement si pas en BDD
    const ranked = data.map((entry, i) => ({ ...entry, rank: (page - 1) * per_page + i + 1 }))
    const result = { data: ranked, meta: { total, page, last_page: Math.ceil(total / per_page) } }

    await redis.set(cache_key, JSON.stringify(result), 'EX', 30)
    return result
  }

  async getMyRank(player_id: string, rotation_id: string): Promise<number | null> {
    const rank_row = await db.raw(`
      SELECT rank FROM (
        SELECT player_id, RANK() OVER (ORDER BY score DESC) as rank
        FROM bf_leaderboard
        WHERE rotation_id = ?
      ) ranked
      WHERE player_id = ?
    `, [rotation_id, player_id])
    return rank_row.rows[0]?.rank ?? null
  }

  // ─── Shop BF ─────────────────────────────────────────────────────────────

  async getShop(): Promise<any[]> {
    return db.from('bf_shop_items').where('is_active', true).orderBy('item_type').orderBy('cost_pf')
  }

  async purchaseItem(player_id: string, item_id: number, quantity: number = 1): Promise<{ success: boolean; error?: string }> {
    const item = await db.from('bf_shop_items').where('id', item_id).where('is_active', true).first()
    if (!item) return { success: false, error: 'Item introuvable' }

    const player = await db.from('players').where('id', player_id).select('frontier_points').first()
    if (!player) return { success: false, error: 'Joueur introuvable' }

    const total_cost = item.cost_pf * quantity
    if (player.frontier_points < total_cost) {
      return { success: false, error: `PF insuffisants (${player.frontier_points}/${total_cost})` }
    }

    // Vérifier stock par rotation si applicable
    if (item.stock_per_rotation !== null) {
      const rotation = await this.getCurrentRotation()
      if (rotation) {
        const purchases = await db.from('bf_shop_purchases')
          .where('player_id', player_id)
          .where('item_id', item_id)
          .where('rotation_id', rotation.id)
          .sum('quantity as total')
          .first()
        const already_bought = Number(purchases?.total ?? 0)
        if (already_bought + quantity > item.stock_per_rotation) {
          return { success: false, error: `Stock épuisé pour cette rotation (${item.stock_per_rotation} max)` }
        }
      }
    }

    const rotation = await this.getCurrentRotation()
    await db.from('players').where('id', player_id).decrement('frontier_points', total_cost)
    await db.table('bf_shop_purchases').insert({
      id: crypto.randomUUID(),
      player_id,
      item_id,
      rotation_id: rotation?.id ?? null,
      quantity,
      pf_spent: total_cost,
      used: false,
      created_at: new Date(),
    })

    return { success: true }
  }

  async useIvCapsule(player_id: string, pokemon_id: string, stat: string): Promise<{ success: boolean; error?: string }> {
    const VALID_STATS = ['hp', 'atk', 'def', 'spatk', 'spdef', 'speed'] as const
    if (!VALID_STATS.includes(stat as any)) return { success: false, error: 'Stat invalide' }

    // Trouver une capsule inutilisée
    const capsule = await db.from('bf_shop_purchases')
      .join('bf_shop_items', 'bf_shop_items.id', 'bf_shop_purchases.item_id')
      .where('bf_shop_purchases.player_id', player_id)
      .where('bf_shop_items.item_type', 'iv_capsule')
      .whereRaw(`bf_shop_items.item_data->>'stat' = ?`, [stat])
      .where('bf_shop_purchases.used', false)
      .select('bf_shop_purchases.id')
      .first()
    if (!capsule) return { success: false, error: `Aucune Capsule IV ${stat.toUpperCase()} disponible` }

    const pokemon = await db.from('player_pokemon').where('id', pokemon_id).where('player_id', player_id).first()
    if (!pokemon) return { success: false, error: 'Pokémon introuvable' }

    const iv_col = `iv_${stat}`
    if (pokemon[iv_col] === 31) return { success: false, error: `L'IV ${stat.toUpperCase()} est déjà à 31` }

    await db.from('player_pokemon').where('id', pokemon_id).update({ [iv_col]: 31 })
    await db.from('bf_shop_purchases').where('id', capsule.id).update({ used: true })

    return { success: true }
  }

  async useNatureMint(player_id: string, pokemon_id: string, nature: Nature): Promise<{ success: boolean; error?: string }> {
    const mint = await db.from('bf_shop_purchases')
      .join('bf_shop_items', 'bf_shop_items.id', 'bf_shop_purchases.item_id')
      .where('bf_shop_purchases.player_id', player_id)
      .where('bf_shop_items.item_type', 'nature_mint')
      .whereRaw(`bf_shop_items.item_data->>'nature' = ?`, [nature])
      .where('bf_shop_purchases.used', false)
      .select('bf_shop_purchases.id')
      .first()
    if (!mint) return { success: false, error: `Aucune Menthe ${nature} disponible` }

    const pokemon = await db.from('player_pokemon').where('id', pokemon_id).where('player_id', player_id).first()
    if (!pokemon) return { success: false, error: 'Pokémon introuvable' }

    await db.from('player_pokemon').where('id', pokemon_id).update({ nature_mint_override: nature })
    await db.from('bf_shop_purchases').where('id', mint.id).update({ used: true })

    return { success: true }
  }

  // ─── Succès ───────────────────────────────────────────────────────────────

  async checkAchievements(player_id: string, session: BfSession, new_streak: number, result: 'win' | 'loss'): Promise<void> {
    const achievements = await db.from('bf_achievements').select('*')
    const unlocked = await db.from('bf_player_achievements').where('player_id', player_id).select('achievement_id')
    const unlocked_ids = new Set(unlocked.map((r: any) => r.achievement_id))

    // Compter total wins du joueur
    const wins_row = await db.from('bf_battles')
      .join('bf_sessions', 'bf_sessions.id', 'bf_battles.session_id')
      .where('bf_sessions.player_id', player_id)
      .where('bf_battles.result', 'win')
      .count('* as total')
      .first()
    const total_wins = Number(wins_row?.total ?? 0)

    for (const ach of achievements) {
      if (unlocked_ids.has(ach.id)) continue

      let met = false
      switch (ach.condition_type) {
        case 'total_wins':
          met = total_wins >= ach.condition_value
          break
        case 'streak':
          met = new_streak >= ach.condition_value
          break
        case 'mode_complete':
          met = result === 'win' && session.mode === ach.mode
          break
      }

      if (met) {
        await db.table('bf_player_achievements').insert({
          player_id,
          achievement_id: ach.id,
          unlocked_at: new Date(),
        }).onConflict(['player_id', 'achievement_id']).ignore()

        if (ach.gems_reward > 0) {
          await GemsService.awardGems(
            player_id,
            ach.gems_reward,
            `Succès BF : ${ach.name_fr}`,
            'bf_achievement'
          )
        }
      }
    }
  }

  // ─── Abandon ─────────────────────────────────────────────────────────────

  async abandonSession(player_id: string): Promise<void> {
    const rotation = await this.getCurrentRotation()
    if (!rotation) return

    await BfSession.query()
      .where('player_id', player_id)
      .where('rotation_id', rotation.id)
      .where('status', 'active')
      .update({ status: 'abandoned', ended_at: new Date() })
  }

  // ─── Rotation scheduler ────────────────────────────────────────────────────

  async createNewRotation(): Promise<BfRotation> {
    const last = await BfRotation.query().orderBy('start_at', 'desc').first()

    // Alterner les modes
    const last_mode_idx = MODES.indexOf((last?.mode as BfMode) ?? 'arena')
    const next_mode = MODES[(last_mode_idx + 1) % 3]

    // Choisir un challenge aléatoire
    const challenge = CHALLENGE_POOL[Math.floor(Math.random() * CHALLENGE_POOL.length)]

    const start = new Date()
    const end = new Date(start.getTime() + 48 * 60 * 60 * 1000)

    const rotation = await BfRotation.create({
      mode: next_mode,
      nameFr: generateRotationName(next_mode, challenge.type),
      challengeType: challenge.type,
      tierRestriction: challenge.tier_restriction,
      rulesJson: challenge.rules,
      startAt: DateTime.fromJSDate(start),
      endAt: DateTime.fromJSDate(end),
    })

    // Notifier les joueurs abonnés
    const subscribers = await db.from('push_subscriptions')
      .whereRaw(`notification_prefs_json->>'bf_rotation' = 'true'`)
      .select('player_id')
    const player_ids = subscribers.map((s: any) => s.player_id)
    if (player_ids.length > 0) {
      PushService.notifyBfRotation(player_ids, next_mode).catch(() => {})
    }

    return rotation
  }

  async distributeRotationRewards(rotation_id: string): Promise<void> {
    const leaderboard_data = await db.from('bf_leaderboard')
      .where('rotation_id', rotation_id)
      .orderBy('score', 'desc')
      .limit(100)
      .select('player_id', 'score')

    const rewards = calcRotationRewards(leaderboard_data)

    for (const r of rewards) {
      // PF bonus
      if (r.pf_bonus > 0) {
        await db.from('players').where('id', r.player_id).increment('frontier_points', r.pf_bonus)
      }
      // Gems
      if (r.gems_bonus > 0) {
        const source = r.rank <= 10 ? 'bf_top10' : 'bf_top100'
        await GemsService.awardGems(
          r.player_id,
          r.gems_bonus,
          `BF Top ${r.rank <= 10 ? '10' : '100'} — Rotation ${rotation_id}`,
          source
        )
      }
      // Mise à jour rang
      await db.from('bf_leaderboard')
        .where('rotation_id', rotation_id)
        .where('player_id', r.player_id)
        .update({ rank: r.rank })
    }
  }

  // ─── Privé ────────────────────────────────────────────────────────────────

  private async loadPlayerTeam(player_id: string): Promise<BfTeamMember[]> {
    const rows = await db.from('player_pokemon')
      .join('pokemon_species', 'pokemon_species.id', 'player_pokemon.species_id')
      .where('player_pokemon.player_id', player_id)
      .whereNotNull('player_pokemon.slot_team')
      .orderBy('player_pokemon.slot_team', 'asc')
      .select(
        'player_pokemon.id',
        'player_pokemon.level',
        'player_pokemon.nature',
        'player_pokemon.nature_mint_override',
        'player_pokemon.iv_hp',
        'player_pokemon.iv_atk',
        'player_pokemon.iv_def',
        'player_pokemon.iv_spatk',
        'player_pokemon.iv_spdef',
        'player_pokemon.iv_speed',
        'player_pokemon.is_shiny',
        'pokemon_species.id as species_id',
        'pokemon_species.name_fr',
        'pokemon_species.tier',
        'pokemon_species.rarity',
        'pokemon_species.type1',
        'pokemon_species.type2',
        'pokemon_species.evolves_from_id',
        'pokemon_species.base_hp',
        'pokemon_species.base_atk',
        'pokemon_species.base_def',
        'pokemon_species.base_spatk',
        'pokemon_species.base_spdef',
        'pokemon_species.base_speed',
        'pokemon_species.sprite_url',
      )

    return Promise.all(rows.map(async (row: any) => {
      const moves = await db.from('player_pokemon_moves')
        .join('moves', 'moves.id', 'player_pokemon_moves.move_id')
        .leftJoin('move_effects', 'move_effects.id', 'moves.effect_id')
        .where('player_pokemon_moves.player_pokemon_id', row.id)
        .select(
          'moves.id', 'moves.name_fr', 'moves.type', 'moves.category',
          'moves.power', 'moves.accuracy', 'moves.pp', 'moves.priority',
          'move_effects.effect_type', 'move_effects.stat_target', 'move_effects.stat_change',
          'move_effects.target', 'move_effects.duration_min', 'move_effects.duration_max',
          'move_effects.chance_percent',
          'player_pokemon_moves.pp_current',
        )

      return {
        id: row.id,
        species_id: row.species_id,
        name_fr: row.name_fr,
        tier: row.tier ?? 'C',
        rarity: row.rarity,
        type1: row.type1 as PokemonType,
        type2: row.type2 as PokemonType | null,
        evolves_from_id: row.evolves_from_id,
        level: row.level,
        nature: row.nature,
        nature_mint_override: row.nature_mint_override,
        base_hp: row.base_hp ?? 50,
        base_atk: row.base_atk ?? 50,
        base_def: row.base_def ?? 50,
        base_spatk: row.base_spatk ?? 50,
        base_spdef: row.base_spdef ?? 50,
        base_speed: row.base_speed ?? 50,
        base_speed_raw: row.base_speed ?? 50,
        ivs: {
          hp: row.iv_hp ?? 0, atk: row.iv_atk ?? 0, def: row.iv_def ?? 0,
          spatk: row.iv_spatk ?? 0, spdef: row.iv_spdef ?? 0, speed: row.iv_speed ?? 0,
        },
        moves: moves.map((m: any) => ({
          id: m.id,
          name_fr: m.name_fr,
          type: m.type as PokemonType,
          category: m.category,
          power: m.power,
          accuracy: m.accuracy,
          pp: m.pp_current ?? m.pp ?? 10,
          priority: m.priority ?? 0,
          effect: m.effect_type ? {
            effect_type: m.effect_type,
            stat_target: m.stat_target,
            stat_change: m.stat_change,
            target: m.target,
            duration_min: m.duration_min,
            duration_max: m.duration_max,
            chance_percent: m.chance_percent ?? 100,
          } : null,
        })),
        is_shiny: row.is_shiny ?? false,
        sprite_url: row.sprite_url ?? '',
      } as BfTeamMember
    }))
  }

  private async generateOpponent(session: BfSession, rotation: BfRotation): Promise<BfTeamMember[]> {
    const tier_filter = rotation.tierRestriction ?? ['D','C','B','A','S']
    const team_size = session.mode === 'arena' ? 3 : 6

    // Piocher des Pokémon aléatoires du tier autorisé
    const candidates = await db.from('pokemon_species')
      .whereIn('tier', tier_filter)
      .whereNotNull('base_hp')
      .orderByRaw('RANDOM()')
      .limit(team_size)
      .select('*')

    return candidates.map((s: any, i: number) => ({
      id: `enemy_${i}`,
      species_id: s.id,
      name_fr: s.name_fr,
      tier: s.tier,
      rarity: s.rarity,
      type1: s.type1 as PokemonType,
      type2: s.type2 as PokemonType | null,
      evolves_from_id: s.evolves_from_id,
      level: 50,
      nature: 'hardy' as any,
      nature_mint_override: null,
      base_hp: s.base_hp ?? 50,
      base_atk: s.base_atk ?? 50,
      base_def: s.base_def ?? 50,
      base_spatk: s.base_spatk ?? 50,
      base_spdef: s.base_spdef ?? 50,
      base_speed: s.base_speed ?? 50,
      ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
      moves: this.defaultMoves(),
      is_shiny: false,
      sprite_url: s.sprite_url ?? '',
    } as BfTeamMember))
  }

  private defaultMoves(): import('#services/CombatService').CombatMove[] {
    // Moves par défaut si le Pokémon ennemi n'a pas de moveset assigné
    return [
      { id: 33, name_fr: 'Charge', type: 'normal' as PokemonType, category: 'physical', power: 40, accuracy: 100, pp: 35, priority: 0 },
    ]
  }

  private async generateFactoryPool(rotation: BfRotation): Promise<BfTeamMember[]> {
    const tier_filter = rotation.tierRestriction ?? ['D','C','B']
    const candidates = await db.from('pokemon_species')
      .whereIn('tier', tier_filter)
      .whereNotNull('base_hp')
      .orderByRaw('RANDOM()')
      .limit(6)
      .select('*')

    return candidates.map((s: any, i: number) => ({
      id: `factory_${i}`,
      species_id: s.id,
      name_fr: s.name_fr,
      tier: s.tier,
      rarity: s.rarity,
      type1: s.type1 as PokemonType,
      type2: s.type2 as PokemonType | null,
      evolves_from_id: s.evolves_from_id,
      level: 50,
      nature: 'hardy' as any,
      nature_mint_override: null,
      base_hp: s.base_hp ?? 50,
      base_atk: s.base_atk ?? 50,
      base_def: s.base_def ?? 50,
      base_spatk: s.base_spatk ?? 50,
      base_spdef: s.base_spdef ?? 50,
      base_speed: s.base_speed ?? 50,
      ivs: { hp: 31, atk: 31, def: 31, spatk: 31, spdef: 31, speed: 31 },
      moves: this.defaultMoves(),
      is_shiny: false,
      sprite_url: s.sprite_url ?? '',
    } as BfTeamMember))
  }
}

const battleFrontierService = new BattleFrontierService()
export default battleFrontierService
export { BattleFrontierService }
