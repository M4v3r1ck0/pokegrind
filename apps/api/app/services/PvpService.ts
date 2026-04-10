/**
 * PvpService — PvP asynchrone avec matchmaking ELO.
 * Le combat est résolu instantanément côté serveur.
 * Pas de temps réel — le défenseur joue son équipe de défense enregistrée.
 */

import db from '@adonisjs/lucid/services/db'
import GemsService from '#services/GemsService'
import PushService from '#services/PushService'
import { calcEloChange, calcTier, calcWinProbability, TIER_GEMS, type PvpTier } from '#services/EloService'
import { buildBfCombatPokemon, type BfTeamMember, type CombatAction } from '#services/BattleFrontierFormulas'
import { calcDamage } from '#services/CombatService'
import type { CombatPokemon } from '#services/CombatService'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PvpTeamSnapshot {
  pokemon: Array<{
    id: string
    species_id: number
    name_fr: string
    level: number
    type1: string
    type2: string | null
    sprite_url: string
    tier: string
    rarity: string
    nature: string
    nature_mint_override: string | null
    base_hp: number
    base_atk: number
    base_def: number
    base_spatk: number
    base_spdef: number
    base_speed: number
    evolves_from_id: number | null
    is_shiny: boolean
    ivs: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }
    moves: Array<{ id: number; name_fr: string; type: string; category: string; power: number | null; accuracy: number | null; pp: number; priority: number }>
  }>
}

export interface PvpOpponent {
  player_id: string
  username: string
  elo: number
  tier: PvpTier
  defense_team: PvpTeamSnapshot
  win_probability: number
}

export interface PvpAttackResult {
  battle_id: string
  result: 'attacker_win' | 'defender_win'
  elo_change: number
  elo_after: number
  tier_before: PvpTier
  tier_after: PvpTier
  tier_changed: boolean
  gems_earned: number
  replay: CombatAction[]
  duration_simulated_ms: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MATCHMAKING_WINDOWS = [200, 400, 800, 99999]
const COOLDOWN_SAME_OPPONENT_MS = 4 * 60 * 60 * 1000   // 4 heures
const COOLDOWN_ATTACK_SPAM_MS   = 30 * 1000              // 30 secondes
const MAX_BATTLE_ACTIONS        = 500

// ─── Helpers ─────────────────────────────────────────────────────────────────

function snapshotToTeamMembers(snapshot: PvpTeamSnapshot): BfTeamMember[] {
  return snapshot.pokemon.map((p) => ({
    id: p.id,
    species_id: p.species_id,
    name_fr: p.name_fr,
    tier: p.tier,
    rarity: p.rarity as BfTeamMember['rarity'],
    type1: p.type1 as BfTeamMember['type1'],
    type2: p.type2 as BfTeamMember['type2'],
    evolves_from_id: p.evolves_from_id,
    level: p.level,
    nature: p.nature as BfTeamMember['nature'],
    nature_mint_override: p.nature_mint_override as BfTeamMember['nature_mint_override'],
    base_hp: p.base_hp,
    base_atk: p.base_atk,
    base_def: p.base_def,
    base_spatk: p.base_spatk,
    base_spdef: p.base_spdef,
    base_speed: p.base_speed,
    ivs: p.ivs,
    moves: p.moves.map((m) => ({
      id: m.id,
      name_fr: m.name_fr,
      type: m.type as BfTeamMember['moves'][0]['type'],
      category: m.category as BfTeamMember['moves'][0]['category'],
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
    })),
    is_shiny: p.is_shiny,
    sprite_url: p.sprite_url,
  }))
}

// ─── Moteur de combat PvP (synchrone, max 500 actions) ───────────────────────

/**
 * Simule un combat PvP instantanément.
 * Timeout à 500 actions → victoire du défenseur.
 */
function simulatePvpBattle(
  attacker_members: BfTeamMember[],
  defender_members: BfTeamMember[]
): { winner: 'attacker' | 'defender'; actions: CombatAction[]; duration_ms: number } {
  const start = Date.now()
  const atk_pokemon = attacker_members.map(m => buildBfCombatPokemon(m))
  const def_pokemon = defender_members.map(m => buildBfCombatPokemon(m))

  const actions: CombatAction[] = []

  let atk_alive = atk_pokemon.filter(p => p.current_hp > 0)
  let def_alive  = def_pokemon.filter(p => p.current_hp > 0)

  while (atk_alive.length > 0 && def_alive.length > 0 && actions.length < MAX_BATTLE_ACTIONS) {
    const attacker_a = atk_alive[0]
    const attacker_d = def_alive[0]

    const order: Array<{ pokemon: CombatPokemon; is_atk: boolean }> = [
      { pokemon: attacker_a, is_atk: true  },
      { pokemon: attacker_d, is_atk: false },
    ].sort((a, b) => b.pokemon.effective_speed - a.pokemon.effective_speed)

    for (const { pokemon: attacker, is_atk } of order) {
      if (attacker.current_hp <= 0) continue
      const defenders = is_atk ? def_alive : atk_alive
      const defender = defenders.find(d => d.current_hp > 0)
      if (!defender) break

      const move = pickPvpMove(attacker)
      if (!move) continue

      const result = calcDamage(attacker, defender, move)
      const actual_damage = Math.min(result.damage, defender.current_hp)
      defender.current_hp = Math.max(0, defender.current_hp - actual_damage)

      actions.push({
        attacker_id: attacker.id,
        attacker_name: attacker.name_fr,
        move_name: move.name_fr,
        target_id: defender.id,
        target_name: defender.name_fr,
        damage: actual_damage,
        is_critical: result.is_critical,
        effectiveness: result.effectiveness,
        remaining_hp: defender.current_hp,
        max_hp: defender.max_hp,
        ko: defender.current_hp === 0,
      })

      if (defender.current_hp === 0) {
        atk_alive = atk_pokemon.filter(p => p.current_hp > 0)
        def_alive  = def_pokemon.filter(p => p.current_hp > 0)
        if (atk_alive.length === 0 || def_alive.length === 0) break
      }
    }
  }

  // Timeout 500 actions → victoire défenseur
  const winner: 'attacker' | 'defender' = atk_alive.length > 0 && def_alive.length === 0
    ? 'attacker'
    : 'defender'

  return { winner, actions, duration_ms: Date.now() - start }
}

function pickPvpMove(pokemon: CombatPokemon) {
  const { moves, pp_remaining, current_move_index } = pokemon
  if (moves.length === 0) return null

  for (let i = 0; i < moves.length; i++) {
    const idx = (current_move_index + i) % moves.length
    if (pp_remaining[idx] > 0 && moves[idx].power) {
      pokemon.current_move_index = (idx + 1) % moves.length
      pokemon.pp_remaining[idx]--
      return moves[idx]
    }
  }
  const idx = current_move_index % moves.length
  pokemon.current_move_index = (idx + 1) % moves.length
  return moves[idx] ?? null
}

// ─── Service ─────────────────────────────────────────────────────────────────

class PvpService {
  /**
   * Retourne la saison PvP active.
   */
  async getActiveSeason() {
    return db.from('pvp_seasons').where('is_active', true).first()
  }

  /**
   * Retourne le ranking du joueur pour la saison active (crée si inexistant).
   */
  async getOrCreateRanking(player_id: string, season_id: number) {
    const existing = await db
      .from('pvp_rankings')
      .where('player_id', player_id)
      .where('season_id', season_id)
      .first()
    if (existing) return existing

    await db.table('pvp_rankings').insert({
      id: crypto.randomUUID(),
      player_id,
      season_id,
      elo: 1000,
      wins: 0,
      losses: 0,
      win_streak: 0,
      best_elo: 1000,
      tier: 'silver',
      rank: null,
      updated_at: new Date(),
    })

    return db.from('pvp_rankings').where('player_id', player_id).where('season_id', season_id).first()
  }

  /**
   * Trouve un adversaire par matchmaking ELO.
   * Fenêtre progressive : ±200 → ±400 → ±800 → tout le monde.
   */
  async findOpponent(player_id: string, season_id: number): Promise<PvpOpponent> {
    const my_ranking = await this.getOrCreateRanking(player_id, season_id)
    const my_elo: number = my_ranking.elo

    // Joueurs récemment attaqués (4h)
    const cooldown_since = new Date(Date.now() - COOLDOWN_SAME_OPPONENT_MS)
    const recent_attacks = await db
      .from('pvp_battles')
      .where('attacker_id', player_id)
      .where('created_at', '>=', cooldown_since)
      .select('defender_id')

    const excluded_ids = new Set([player_id, ...recent_attacks.map((r: any) => r.defender_id)])

    let candidates: any[] = []

    for (const window of MATCHMAKING_WINDOWS) {
      const rows = await db
        .from('pvp_rankings as r')
        .join('players as p', 'p.id', 'r.player_id')
        .join('pvp_defense_teams as dt', 'dt.player_id', 'r.player_id')
        .where('r.season_id', season_id)
        .whereNotIn('r.player_id', [...excluded_ids])
        .whereBetween('r.elo', [my_elo - window, my_elo + window])
        .orderByRaw('ABS(r.elo - ?) ASC', [my_elo])
        .limit(20)
        .select('r.player_id', 'r.elo', 'r.tier', 'p.username', 'dt.team_json')

      if (rows.length > 0) {
        candidates = rows
        break
      }
    }

    if (candidates.length === 0) {
      throw new Error('Aucun adversaire disponible pour le moment.')
    }

    // Choisir aléatoirement parmi les 10 plus proches
    const pool = candidates.slice(0, 10)
    const opponent = pool[Math.floor(Math.random() * pool.length)]

    const defense_team: PvpTeamSnapshot = typeof opponent.team_json === 'string'
      ? JSON.parse(opponent.team_json)
      : opponent.team_json

    // Masquer les IVs exacts côté client (remplacer par ~20-31)
    const masked_team: PvpTeamSnapshot = {
      pokemon: defense_team.pokemon.map((p) => ({
        ...p,
        ivs: { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 }, // masqué
      })),
    }

    return {
      player_id: opponent.player_id,
      username: opponent.username,
      elo: Number(opponent.elo),
      tier: opponent.tier as PvpTier,
      defense_team: masked_team,
      win_probability: calcWinProbability(my_elo, Number(opponent.elo)),
    }
  }

  /**
   * Attaque un joueur défenseur.
   * Simule le combat, met à jour les ELOs, crée la notification.
   */
  async attackPlayer(attacker_id: string, defender_id: string): Promise<PvpAttackResult> {
    const season = await this.getActiveSeason()
    if (!season) throw new Error('Aucune saison PvP active.')

    // ── Cooldown anti-spam (30s) ───────────────────────────────────────────
    const spam_since = new Date(Date.now() - COOLDOWN_ATTACK_SPAM_MS)
    const recent = await db
      .from('pvp_battles')
      .where('attacker_id', attacker_id)
      .where('created_at', '>=', spam_since)
      .count('* as total')
      .first()
    if (Number(recent?.total ?? 0) > 0) {
      throw new Error('Attends 30 secondes entre chaque combat.')
    }

    // ── Cooldown même adversaire (4h) ─────────────────────────────────────
    const cooldown_since = new Date(Date.now() - COOLDOWN_SAME_OPPONENT_MS)
    const repeat = await db
      .from('pvp_battles')
      .where('attacker_id', attacker_id)
      .where('defender_id', defender_id)
      .where('created_at', '>=', cooldown_since)
      .count('* as total')
      .first()
    if (Number(repeat?.total ?? 0) > 0) {
      throw new Error('Tu as déjà attaqué ce joueur récemment (cooldown 4h).')
    }

    // ── Vérifier que l'attaquant a une équipe ──────────────────────────────
    const attacker_team = await db
      .from('player_pokemon')
      .where('player_id', attacker_id)
      .whereNotNull('slot_team')
      .orderBy('slot_team')
      .limit(6)

    if (attacker_team.length === 0) {
      throw new Error("Tu n'as pas de Pokémon dans ton équipe.")
    }

    // ── Récupérer l'équipe de défense du défenseur ─────────────────────────
    const defense_row = await db
      .from('pvp_defense_teams')
      .where('player_id', defender_id)
      .first()
    if (!defense_row) {
      throw new Error("Ce joueur n'a pas d'équipe de défense enregistrée.")
    }

    const defense_snapshot: PvpTeamSnapshot = typeof defense_row.team_json === 'string'
      ? JSON.parse(defense_row.team_json)
      : defense_row.team_json

    // ── Construire le snapshot de l'équipe attaquante ──────────────────────
    const attacker_snapshot = await this.buildAttackerSnapshot(attacker_id)

    // ── Récupérer les rankings ─────────────────────────────────────────────
    const [atk_ranking, def_ranking] = await Promise.all([
      this.getOrCreateRanking(attacker_id, season.id),
      this.getOrCreateRanking(defender_id, season.id),
    ])

    // ── Simuler le combat ─────────────────────────────────────────────────
    const atk_members = snapshotToTeamMembers(attacker_snapshot)
    const def_members = snapshotToTeamMembers(defense_snapshot)
    const { winner, actions, duration_ms } = simulatePvpBattle(atk_members, def_members)

    const attacker_won = winner === 'attacker'
    const result_str: 'attacker_win' | 'defender_win' = attacker_won ? 'attacker_win' : 'defender_win'

    // ── Calcul ELO ────────────────────────────────────────────────────────
    const atk_elo  = Number(atk_ranking.elo)
    const def_elo  = Number(def_ranking.elo)
    const tier_before = calcTier(atk_elo)

    const { attacker_delta, defender_delta } = calcEloChange(
      atk_elo, def_elo, attacker_won, tier_before
    )

    const atk_elo_after = atk_elo + attacker_delta
    const def_elo_after = def_elo + defender_delta
    const tier_after    = calcTier(atk_elo_after)
    const tier_changed  = tier_before !== tier_after
    const gems_earned   = tier_changed && attacker_won ? (TIER_GEMS[tier_after] ?? 0) : 0

    // ── Transaction BDD ───────────────────────────────────────────────────
    const battle_id = crypto.randomUUID()

    await db.transaction(async (trx) => {
      // Sauvegarder le combat
      await trx.table('pvp_battles').insert({
        id: battle_id,
        season_id: season.id,
        attacker_id,
        defender_id,
        attacker_team_json: JSON.stringify(attacker_snapshot),
        defender_team_json: JSON.stringify(defense_snapshot),
        result: result_str,
        elo_change_attacker: attacker_delta,
        elo_change_defender: defender_delta,
        attacker_elo_after: atk_elo_after,
        defender_elo_after: def_elo_after,
        actions_replay: JSON.stringify(actions),
        duration_simulated_ms: duration_ms,
        created_at: new Date(),
      })

      // Mettre à jour l'ELO attaquant
      await trx.from('pvp_rankings')
        .where('player_id', attacker_id)
        .where('season_id', season.id)
        .update({
          elo: atk_elo_after,
          best_elo: db.raw(`GREATEST(best_elo, ${atk_elo_after})`),
          tier: tier_after,
          wins: attacker_won ? db.raw('wins + 1') : db.raw('wins'),
          losses: attacker_won ? db.raw('losses') : db.raw('losses + 1'),
          win_streak: attacker_won ? db.raw('win_streak + 1') : db.raw('0'),
          updated_at: new Date(),
        })

      // Mettre à jour l'ELO défenseur
      const def_tier_after = calcTier(def_elo_after)
      await trx.from('pvp_rankings')
        .where('player_id', defender_id)
        .where('season_id', season.id)
        .update({
          elo: def_elo_after,
          best_elo: db.raw(`GREATEST(best_elo, ${def_elo_after})`),
          tier: def_tier_after,
          wins: attacker_won ? db.raw('wins') : db.raw('wins + 1'),
          losses: attacker_won ? db.raw('losses + 1') : db.raw('losses'),
          win_streak: attacker_won ? db.raw('0') : db.raw('win_streak + 1'),
          updated_at: new Date(),
        })

      // Notification pour le défenseur
      await trx.table('pvp_notifications').insert({
        id: crypto.randomUUID(),
        player_id: defender_id,
        battle_id,
        is_read: false,
        created_at: new Date(),
      })
    })

    // ── Gems si nouveau palier ─────────────────────────────────────────────
    if (gems_earned > 0) {
      await GemsService.awardGems(
        attacker_id,
        gems_earned,
        `PvP — Nouveau palier atteint : ${tier_after}`,
        'pvp_elo_tier'
      )
    }

    // ── Notification push défenseur (non-bloquante) ────────────────────────
    const attacker_player = await db.from('players').where('id', attacker_id).first()
    PushService.notifyPvpAttacked(
      defender_id,
      attacker_player?.username ?? 'Inconnu',
      result_str,
      defender_delta
    ).catch(() => {})

    // ── Notifier via Socket.io (non-bloquant) ─────────────────────────────
    this.notifySocketPvp(attacker_id, defender_id, battle_id, result_str, defender_delta, def_elo_after, atk_elo_after, attacker_player?.username ?? 'Inconnu', atk_elo).catch(() => {})

    return {
      battle_id,
      result: result_str,
      elo_change: attacker_delta,
      elo_after: atk_elo_after,
      tier_before,
      tier_after,
      tier_changed,
      gems_earned,
      replay: actions,
      duration_simulated_ms: duration_ms,
    }
  }

  /**
   * Enregistre l'équipe de défense du joueur.
   * L'équipe est figée en snapshot — les changements futurs d'équipe idle ne l'affectent pas.
   */
  async setDefenseTeam(player_id: string, pokemon_ids: string[]): Promise<void> {
    if (pokemon_ids.length === 0 || pokemon_ids.length > 6) {
      throw new Error('L\'équipe de défense doit contenir entre 1 et 6 Pokémon.')
    }

    // Vérifier appartenance et pas en pension
    const pokemons = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'ps.id', 'pp.species_id')
      .join('player_pokemon_moves as ppm', 'ppm.player_pokemon_id', 'pp.id')
      .join('moves as m', 'm.id', 'ppm.move_id')
      .where('pp.player_id', player_id)
      .whereIn('pp.id', pokemon_ids)
      .whereNull('pp.slot_daycare')
      .select(
        'pp.id',
        'pp.species_id',
        'pp.level',
        'pp.nature',
        'pp.nature_mint_override',
        'pp.is_shiny',
        'pp.iv_hp',
        'pp.iv_atk',
        'pp.iv_def',
        'pp.iv_spatk',
        'pp.iv_spdef',
        'pp.iv_speed',
        'ps.name_fr',
        'ps.type1',
        'ps.type2',
        'ps.tier',
        'ps.rarity',
        'ps.base_hp',
        'ps.base_atk',
        'ps.base_def',
        'ps.base_spatk',
        'ps.base_spdef',
        'ps.base_speed',
        'ps.evolves_from_id',
        'ps.sprite_url',
        'ppm.slot as move_slot',
        'm.id as move_id',
        'm.name_fr as move_name',
        'm.type as move_type',
        'm.category as move_category',
        'm.power as move_power',
        'm.accuracy as move_accuracy',
        'm.pp as move_pp',
        'm.priority as move_priority'
      )

    // Grouper les moves par Pokémon
    const pokemon_map = new Map<string, any>()
    for (const row of pokemons) {
      if (!pokemon_map.has(row.id)) {
        pokemon_map.set(row.id, {
          id: row.id,
          species_id: row.species_id,
          name_fr: row.name_fr,
          level: row.level,
          type1: row.type1,
          type2: row.type2,
          sprite_url: row.sprite_url,
          tier: row.tier,
          rarity: row.rarity,
          nature: row.nature,
          nature_mint_override: row.nature_mint_override,
          base_hp: row.base_hp,
          base_atk: row.base_atk,
          base_def: row.base_def,
          base_spatk: row.base_spatk,
          base_spdef: row.base_spdef,
          base_speed: row.base_speed,
          evolves_from_id: row.evolves_from_id,
          is_shiny: row.is_shiny,
          ivs: {
            hp: row.iv_hp, atk: row.iv_atk, def: row.iv_def,
            spatk: row.iv_spatk, spdef: row.iv_spdef, speed: row.iv_speed,
          },
          moves: [],
        })
      }
      pokemon_map.get(row.id)!.moves.push({
        id: row.move_id,
        name_fr: row.move_name,
        type: row.move_type,
        category: row.move_category,
        power: row.move_power,
        accuracy: row.move_accuracy,
        pp: row.move_pp,
        priority: row.move_priority,
      })
    }

    // Respecter l'ordre pokemon_ids
    const ordered = pokemon_ids
      .map(id => pokemon_map.get(id))
      .filter(Boolean)

    if (ordered.length === 0) {
      throw new Error('Aucun Pokémon valide trouvé (vérifiez appartenance et pension).')
    }

    const snapshot: PvpTeamSnapshot = { pokemon: ordered }

    await db.rawQuery(
      `INSERT INTO pvp_defense_teams (player_id, team_json, updated_at)
       VALUES (?, ?::jsonb, NOW())
       ON CONFLICT (player_id) DO UPDATE SET team_json = EXCLUDED.team_json, updated_at = NOW()`,
      [player_id, JSON.stringify(snapshot)]
    )
  }

  /**
   * Retourne l'équipe de défense du joueur.
   */
  async getDefenseTeam(player_id: string): Promise<PvpTeamSnapshot | null> {
    const row = await db.from('pvp_defense_teams').where('player_id', player_id).first()
    if (!row) return null
    return typeof row.team_json === 'string' ? JSON.parse(row.team_json) : row.team_json
  }

  /**
   * Retourne le classement ELO paginé pour la saison active.
   */
  async getLeaderboard(
    season_id: number,
    page: number = 1,
    tier?: string
  ): Promise<{ data: any[]; meta: { total: number; page: number; last_page: number } }> {
    const per_page = 50

    const applyFilters = (q: any) => {
      q = q.where('r.season_id', season_id)
      if (tier) q = q.where('r.tier', tier)
      return q
    }

    const count_row = await applyFilters(
      db.from('pvp_rankings as r')
    ).count('* as total').first()
    const total = Number(count_row?.total ?? 0)

    const data = await applyFilters(
      db.from('pvp_rankings as r').join('players as p', 'p.id', 'r.player_id')
    )
      .orderBy('r.elo', 'desc')
      .limit(per_page)
      .offset((page - 1) * per_page)
      .select(
        'r.player_id',
        'r.elo',
        'r.tier',
        'r.wins',
        'r.losses',
        'r.rank',
        'p.username'
      )

    const enriched = data.map((row: any, i: number) => ({
      rank: row.rank ?? (page - 1) * per_page + i + 1,
      player_id: row.player_id,
      username: row.username,
      elo: Number(row.elo),
      tier: row.tier,
      wins: Number(row.wins),
      losses: Number(row.losses),
      win_rate: Number(row.wins) + Number(row.losses) > 0
        ? Math.round((Number(row.wins) / (Number(row.wins) + Number(row.losses))) * 100)
        : 0,
    }))

    return {
      data: enriched,
      meta: { total, page, last_page: Math.max(1, Math.ceil(total / per_page)) },
    }
  }

  /**
   * Retourne les 20 derniers combats du joueur.
   */
  async getHistory(player_id: string, season_id: number): Promise<any[]> {
    const battles = await db
      .from('pvp_battles as b')
      .join('players as atk', 'atk.id', 'b.attacker_id')
      .join('players as def', 'def.id', 'b.defender_id')
      .where('b.season_id', season_id)
      .where((q) => {
        q.where('b.attacker_id', player_id).orWhere('b.defender_id', player_id)
      })
      .orderBy('b.created_at', 'desc')
      .limit(20)
      .select(
        'b.id',
        'b.result',
        'b.elo_change_attacker',
        'b.elo_change_defender',
        'b.attacker_elo_after',
        'b.defender_elo_after',
        'b.created_at',
        'atk.username as attacker_username',
        'def.username as defender_username',
        'b.attacker_id',
        'b.defender_id'
      )

    return battles.map((b: any) => {
      const i_am_attacker = b.attacker_id === player_id
      const my_elo_change = i_am_attacker ? b.elo_change_attacker : b.elo_change_defender
      const opponent_username = i_am_attacker ? b.defender_username : b.attacker_username
      const i_won = i_am_attacker
        ? b.result === 'attacker_win'
        : b.result === 'defender_win'

      return {
        battle_id: b.id,
        opponent_username,
        result: i_won ? 'win' : 'loss',
        elo_change: my_elo_change,
        elo_after: i_am_attacker ? b.attacker_elo_after : b.defender_elo_after,
        created_at: b.created_at,
        i_am_attacker,
      }
    })
  }

  /**
   * Retourne le replay d'un combat.
   */
  async getReplay(battle_id: string, player_id: string): Promise<any> {
    const battle = await db
      .from('pvp_battles as b')
      .join('players as atk', 'atk.id', 'b.attacker_id')
      .join('players as def', 'def.id', 'b.defender_id')
      .where('b.id', battle_id)
      .where((q) => {
        q.where('b.attacker_id', player_id).orWhere('b.defender_id', player_id)
      })
      .select('b.*', 'atk.username as attacker_username', 'def.username as defender_username')
      .first()

    if (!battle) throw new Error('Combat introuvable ou accès non autorisé.')

    const actions_replay = typeof battle.actions_replay === 'string'
      ? JSON.parse(battle.actions_replay)
      : battle.actions_replay

    return {
      battle_id,
      result: battle.result,
      attacker_username: battle.attacker_username,
      defender_username: battle.defender_username,
      elo_change_attacker: battle.elo_change_attacker,
      elo_change_defender: battle.elo_change_defender,
      attacker_elo_after: battle.attacker_elo_after,
      defender_elo_after: battle.defender_elo_after,
      actions_replay,
      created_at: battle.created_at,
    }
  }

  /**
   * Retourne les notifications non lues du joueur (attaques reçues).
   */
  async getNotifications(player_id: string): Promise<any[]> {
    return db
      .from('pvp_notifications as n')
      .join('pvp_battles as b', 'b.id', 'n.battle_id')
      .join('players as atk', 'atk.id', 'b.attacker_id')
      .where('n.player_id', player_id)
      .orderBy('n.created_at', 'desc')
      .limit(50)
      .select(
        'n.id',
        'n.is_read',
        'n.created_at',
        'b.id as battle_id',
        'b.result',
        'b.elo_change_defender',
        'atk.username as attacker_username'
      )
  }

  /**
   * Marque toutes les notifications du joueur comme lues.
   */
  async markNotificationsRead(player_id: string): Promise<void> {
    await db.from('pvp_notifications').where('player_id', player_id).update({ is_read: true })
  }

  /**
   * Recalcule les rangs mondiaux pour la saison active.
   * Appelé toutes les heures par le scheduler.
   */
  async recalcRanks(season_id: number): Promise<void> {
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
    `, [season_id, season_id])
  }

  /**
   * Construit le snapshot de l'équipe active de l'attaquant.
   */
  private async buildAttackerSnapshot(player_id: string): Promise<PvpTeamSnapshot> {
    const rows = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'ps.id', 'pp.species_id')
      .join('player_pokemon_moves as ppm', 'ppm.player_pokemon_id', 'pp.id')
      .join('moves as m', 'm.id', 'ppm.move_id')
      .where('pp.player_id', player_id)
      .whereNotNull('pp.slot_team')
      .orderBy('pp.slot_team')
      .select(
        'pp.id', 'pp.species_id', 'pp.level', 'pp.nature', 'pp.nature_mint_override',
        'pp.is_shiny', 'pp.iv_hp', 'pp.iv_atk', 'pp.iv_def', 'pp.iv_spatk', 'pp.iv_spdef', 'pp.iv_speed',
        'ps.name_fr', 'ps.type1', 'ps.type2', 'ps.tier', 'ps.rarity',
        'ps.base_hp', 'ps.base_atk', 'ps.base_def', 'ps.base_spatk', 'ps.base_spdef', 'ps.base_speed',
        'ps.evolves_from_id', 'ps.sprite_url',
        'ppm.slot as move_slot', 'm.id as move_id', 'm.name_fr as move_name',
        'm.type as move_type', 'm.category as move_category', 'm.power as move_power',
        'm.accuracy as move_accuracy', 'm.pp as move_pp', 'm.priority as move_priority'
      )

    const pokemon_map = new Map<string, any>()
    for (const row of rows) {
      if (!pokemon_map.has(row.id)) {
        pokemon_map.set(row.id, {
          id: row.id,
          species_id: row.species_id,
          name_fr: row.name_fr,
          level: row.level,
          type1: row.type1,
          type2: row.type2,
          sprite_url: row.sprite_url,
          tier: row.tier,
          rarity: row.rarity,
          nature: row.nature,
          nature_mint_override: row.nature_mint_override,
          base_hp: row.base_hp,
          base_atk: row.base_atk,
          base_def: row.base_def,
          base_spatk: row.base_spatk,
          base_spdef: row.base_spdef,
          base_speed: row.base_speed,
          evolves_from_id: row.evolves_from_id,
          is_shiny: row.is_shiny,
          ivs: {
            hp: row.iv_hp, atk: row.iv_atk, def: row.iv_def,
            spatk: row.iv_spatk, spdef: row.iv_spdef, speed: row.iv_speed,
          },
          moves: [],
        })
      }
      pokemon_map.get(row.id)!.moves.push({
        id: row.move_id,
        name_fr: row.move_name,
        type: row.move_type,
        category: row.move_category,
        power: row.move_power,
        accuracy: row.move_accuracy,
        pp: row.move_pp,
        priority: row.move_priority,
      })
    }

    return { pokemon: [...pokemon_map.values()] }
  }

  /**
   * Émet les events Socket.io PvP (import différé pour éviter la dépendance circulaire).
   */
  private async notifySocketPvp(
    attacker_id: string,
    defender_id: string,
    battle_id: string,
    result: 'attacker_win' | 'defender_win',
    defender_elo_change: number,
    defender_elo_after: number,
    attacker_elo_after: number,
    attacker_username: string,
    attacker_elo_before: number
  ): Promise<void> {
    try {
      const { emitPvpAttacked, emitPvpLeaderboardUpdate, emitPvpTierUp } = await import('#start/socket')

      // Notifier le défenseur
      await emitPvpAttacked(defender_id, {
        attacker_username,
        attacker_elo: attacker_elo_before,
        result,
        elo_change: defender_elo_change,
        elo_after: defender_elo_after,
        battle_id,
      })

      // Notifier l'attaquant si passage de tier
      if (attacker_elo_after > attacker_elo_before) {
        const tier_before = calcTier(attacker_elo_before)
        const tier_after  = calcTier(attacker_elo_after)
        if (tier_before !== tier_after) {
          const gems = TIER_GEMS[tier_after] ?? 0
          emitPvpTierUp(attacker_id, tier_before, tier_after, gems)
        }
      }

      // Mettre à jour le top 10
      await emitPvpLeaderboardUpdate()
    } catch {
      // Socket.io non disponible
    }
  }
}

export default new PvpService()
