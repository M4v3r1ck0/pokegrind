import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import PlayerPokemon from '#models/player_pokemon'
import db from '@adonisjs/lucid/services/db'

const SELL_PRICES: Record<string, number> = {
  common: 50,
  rare: 150,
  epic: 500,
  legendary: 2000,
  mythic: 5000,
}

const inventoryQueryValidator = vine.compile(
  vine.object({
    page: vine.number().positive().optional(),
    limit: vine.number().min(1).max(200).optional(),
    rarity: vine.string().in(['common', 'rare', 'epic', 'legendary', 'mythic']).optional(),
    is_shiny: vine.boolean().optional(),
    sort: vine.string().in(['recent', 'rarity', 'iv_total', 'name', 'level']).optional(),
    min_level: vine.number().min(1).max(100).optional(),
  })
)

const sellValidator = vine.compile(
  vine.object({
    pokemon_ids: vine.array(vine.string()).minLength(1).maxLength(50),
  })
)

const assignTeamValidator = vine.compile(
  vine.object({
    slot: vine.number().min(1).max(6),
  })
)

function serializePokemon(row: any) {
  return {
    id: row.id,
    species_id: row.species_id,
    name_fr: row.name_fr,
    nickname: row.nickname,
    level: row.level,
    is_shiny: row.is_shiny,
    stars: row.stars,
    nature: row.nature,
    ivs: {
      hp: row.iv_hp,
      atk: row.iv_atk,
      def: row.iv_def,
      spatk: row.iv_spatk,
      spdef: row.iv_spdef,
      speed: row.iv_speed,
    },
    iv_total: (row.iv_hp ?? 0) + (row.iv_atk ?? 0) + (row.iv_def ?? 0) +
              (row.iv_spatk ?? 0) + (row.iv_spdef ?? 0) + (row.iv_speed ?? 0),
    rarity: row.rarity,
    type1: row.type1,
    type2: row.type2,
    sprite_url: row.sprite_url,
    sprite_shiny_url: row.sprite_shiny_url,
    slot_team: row.slot_team,
    slot_daycare: row.slot_daycare,
    created_at: row.created_at,
  }
}

export default class InventoryController {
  /**
   * GET /api/player/pokemon
   */
  async index(ctx: HttpContext) {
    const query = await ctx.request.validateUsing(inventoryQueryValidator)
    const player = ctx.player

    const page = query.page ?? 1
    const limit = query.limit ?? 20

    let q = db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'pp.species_id', 'ps.id')
      .where('pp.player_id', player.id)
      .select(
        'pp.*',
        'ps.name_fr',
        'ps.type1',
        'ps.type2',
        'ps.rarity',
        'ps.sprite_url',
        'ps.sprite_shiny_url'
      )

    if (query.rarity) {
      q = q.where('ps.rarity', query.rarity)
    }
    if (query.is_shiny !== undefined) {
      q = q.where('pp.is_shiny', query.is_shiny)
    }
    if (query.min_level !== undefined) {
      q = q.where('pp.level', '>=', query.min_level)
    }

    // Tri
    switch (query.sort) {
      case 'rarity': {
        const rarityOrder = `CASE ps.rarity WHEN 'mythic' THEN 5 WHEN 'legendary' THEN 4 WHEN 'epic' THEN 3 WHEN 'rare' THEN 2 ELSE 1 END`
        q = q.orderByRaw(`${rarityOrder} DESC`).orderBy('pp.created_at', 'desc')
        break
      }
      case 'iv_total':
        q = q.orderByRaw(
          '(pp.iv_hp + pp.iv_atk + pp.iv_def + pp.iv_spatk + pp.iv_spdef + pp.iv_speed) DESC NULLS LAST'
        )
        break
      case 'name':
        q = q.orderBy('ps.name_fr', 'asc')
        break
      case 'level':
        q = q.orderBy('pp.level', 'desc').orderBy('pp.created_at', 'desc')
        break
      default:
        q = q.orderBy('pp.created_at', 'desc')
    }

    let countQ = db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'pp.species_id', 'ps.id')
      .where('pp.player_id', player.id)
      .count('* as total')

    if (query.rarity) countQ = countQ.where('ps.rarity', query.rarity)
    if (query.is_shiny !== undefined) countQ = countQ.where('pp.is_shiny', query.is_shiny)
    if (query.min_level !== undefined) countQ = countQ.where('pp.level', '>=', query.min_level)

    const total = await countQ.first()

    const totalCount = Number((total as any)?.total ?? 0)
    const lastPage = Math.ceil(totalCount / limit)
    const offset = (page - 1) * limit

    const rows = await q.offset(offset).limit(limit)

    // Charger les moves pour chaque Pokémon
    const pokemonIds = rows.map((r: any) => r.id)
    const movesRows =
      pokemonIds.length > 0
        ? await db
            .from('player_pokemon_moves as ppm')
            .join('moves as m', 'ppm.move_id', 'm.id')
            .whereIn('ppm.player_pokemon_id', pokemonIds)
            .select('ppm.*', 'm.name_fr as move_name_fr', 'm.type as move_type', 'm.category', 'm.power')
        : []

    const movesByPokemon = new Map<string, any[]>()
    for (const move of movesRows) {
      if (!movesByPokemon.has(move.player_pokemon_id)) {
        movesByPokemon.set(move.player_pokemon_id, [])
      }
      movesByPokemon.get(move.player_pokemon_id)!.push({
        slot: move.slot,
        move_id: move.move_id,
        name_fr: move.move_name_fr,
        type: move.move_type,
        category: move.category,
        power: move.power,
        pp_current: move.pp_current,
        pp_max: move.pp_max,
      })
    }

    const data = rows.map((row: any) => ({
      ...serializePokemon(row),
      moves: movesByPokemon.get(row.id) ?? [],
    }))

    return ctx.response.ok({
      data,
      meta: { total: totalCount, page, limit, last_page: lastPage },
    })
  }

  /**
   * GET /api/player/pokemon/:id
   */
  async show(ctx: HttpContext) {
    const { id } = ctx.params
    const player = ctx.player

    const row = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'pp.species_id', 'ps.id')
      .where('pp.id', id)
      .where('pp.player_id', player.id)
      .select('pp.*', 'ps.name_fr', 'ps.type1', 'ps.type2', 'ps.rarity', 'ps.sprite_url', 'ps.sprite_shiny_url')
      .first()

    if (!row) {
      return ctx.response.notFound({ message: 'Pokémon introuvable' })
    }

    const moves = await db
      .from('player_pokemon_moves as ppm')
      .join('moves as m', 'ppm.move_id', 'm.id')
      .where('ppm.player_pokemon_id', id)
      .select('ppm.*', 'm.name_fr as move_name_fr', 'm.type as move_type', 'm.category', 'm.power')

    return ctx.response.ok({
      ...serializePokemon(row),
      moves: moves.map((m) => ({
        slot: m.slot,
        move_id: m.move_id,
        name_fr: m.move_name_fr,
        type: m.move_type,
        category: m.category,
        power: m.power,
        pp_current: m.pp_current,
        pp_max: m.pp_max,
      })),
    })
  }

  /**
   * POST /api/player/pokemon/sell
   */
  async sell(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(sellValidator)
    const player = ctx.player

    // Récupérer les Pokémon avec vérification propriétaire
    const rows = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'pp.species_id', 'ps.id')
      .whereIn('pp.id', data.pokemon_ids)
      .where('pp.player_id', player.id)
      .select('pp.id', 'pp.slot_team', 'pp.slot_daycare', 'ps.rarity', 'pp.is_shiny')

    if (rows.length !== data.pokemon_ids.length) {
      return ctx.response.unprocessableEntity({
        message: "Certains Pokémon n'appartiennent pas à ce joueur ou sont introuvables",
      })
    }

    // Vérifier qu'aucun n'est en équipe ou en pension
    const inTeam = rows.find((r: any) => r.slot_team !== null)
    if (inTeam) {
      return ctx.response.unprocessableEntity({
        message: 'Impossible de vendre un Pokémon qui est dans votre équipe',
      })
    }

    const inDaycare = rows.find((r: any) => r.slot_daycare !== null)
    if (inDaycare) {
      return ctx.response.unprocessableEntity({
        message: 'Impossible de vendre un Pokémon qui est en pension',
      })
    }

    // Calculer le total
    let goldEarned = 0
    for (const row of rows) {
      const base = SELL_PRICES[row.rarity as string] ?? 50
      const multiplier = row.is_shiny ? 5 : 1
      goldEarned += base * multiplier
    }

    await db.transaction(async (trx) => {
      await trx.from('player_pokemon').whereIn('id', data.pokemon_ids).delete()
      await trx
        .from('players')
        .where('id', player.id)
        .increment('gold', goldEarned)
    })

    await player.refresh()

    return ctx.response.ok({
      sold_count: rows.length,
      gold_earned: goldEarned,
      gold_total: player.gold,
    })
  }

  /**
   * POST /api/player/pokemon/:id/assign-team
   */
  async assignTeam(ctx: HttpContext) {
    const { id } = ctx.params
    const data = await ctx.request.validateUsing(assignTeamValidator)
    const player = ctx.player
    const slot = data.slot

    const pokemon = await PlayerPokemon.query()
      .where('id', id)
      .where('player_id', player.id)
      .first()

    if (!pokemon) {
      return ctx.response.notFound({ message: 'Pokémon introuvable' })
    }

    if (pokemon.slotDaycare !== null) {
      return ctx.response.unprocessableEntity({
        message: 'Ce Pokémon est en pension',
      })
    }

    await db.transaction(async (trx) => {
      // Si un autre Pokémon occupe ce slot → le sortir de l'équipe
      await trx
        .from('player_pokemon')
        .where('player_id', player.id)
        .where('slot_team', slot)
        .whereNot('id', id)
        .update({ slot_team: null })

      // Assigner le slot
      await trx.from('player_pokemon').where('id', id).update({ slot_team: slot })
    })

    return this.team(ctx)
  }

  /**
   * GET /api/player/team
   */
  async team(ctx: HttpContext) {
    const player = ctx.player

    const rows = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'pp.species_id', 'ps.id')
      .where('pp.player_id', player.id)
      .whereNotNull('pp.slot_team')
      .select('pp.*', 'ps.name_fr', 'ps.type1', 'ps.type2', 'ps.rarity', 'ps.sprite_url', 'ps.sprite_shiny_url')
      .orderBy('pp.slot_team', 'asc')

    const bySlot = new Map(rows.map((r: any) => [r.slot_team, serializePokemon(r)]))

    const slots = Array.from({ length: 6 }, (_, i) => ({
      slot: i + 1,
      pokemon: bySlot.get(i + 1) ?? null,
    }))

    return ctx.response.ok({ slots })
  }
}
