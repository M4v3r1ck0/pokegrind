/**
 * TeamController — Gestion de l'équipe et des movesets d'un joueur.
 */

import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import PlayerPokemon from '#models/player_pokemon'

const setSlotValidator = vine.compile(
  vine.object({
    pokemon_id: vine.string().uuid(),
    slot: vine.number().min(1).max(6).optional(),
  })
)

const updateMovesValidator = vine.compile(
  vine.object({
    slots: vine.array(
      vine.object({
        slot: vine.number().min(1).max(4),
        move_id: vine.number().positive(),
      })
    ).minLength(1).maxLength(4),
  })
)

function serializePokemon(row: any, moves: any[] = []) {
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
    slot_team: row.slot_team,
    slot_daycare: row.slot_daycare,
    species: {
      name_fr: row.name_fr,
      type1: row.type1,
      type2: row.type2,
      sprite_url: row.sprite_url,
      sprite_shiny_url: row.sprite_shiny_url,
    },
    moves,
  }
}

export default class TeamController {
  /**
   * GET /api/team
   * Liste tous les PlayerPokemon du joueur avec leurs moves.
   */
  async index({ player, response }: HttpContext) {
    const rows = await db
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
      .orderByRaw('pp.slot_team ASC NULLS LAST')
      .orderBy('pp.created_at', 'desc')

    const pokemonIds = rows.map((r: any) => r.id)
    const movesRows =
      pokemonIds.length > 0
        ? await db
            .from('player_pokemon_moves as ppm')
            .join('moves as m', 'ppm.move_id', 'm.id')
            .whereIn('ppm.player_pokemon_id', pokemonIds)
            .select(
              'ppm.player_pokemon_id',
              'ppm.slot',
              'ppm.move_id',
              'ppm.pp_current',
              'ppm.pp_max',
              'm.name_fr as move_name_fr',
              'm.type as move_type',
              'm.category',
              'm.power'
            )
        : []

    const movesByPokemon = new Map<string, any[]>()
    for (const move of movesRows) {
      if (!movesByPokemon.has(move.player_pokemon_id)) {
        movesByPokemon.set(move.player_pokemon_id, [])
      }
      movesByPokemon.get(move.player_pokemon_id)!.push({
        id: move.id,
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

    const data = rows.map((row: any) =>
      serializePokemon(row, (movesByPokemon.get(row.id) ?? []).sort((a, b) => a.slot - b.slot))
    )

    return response.ok({ data })
  }

  /**
   * POST /api/team/slot
   * Assigne un Pokémon à un slot d'équipe (slot null = retirer de l'équipe).
   */
  async setSlot({ request, player, response }: HttpContext) {
    const { pokemon_id, slot } = await request.validateUsing(setSlotValidator)

    const pokemon = await PlayerPokemon.query()
      .where('id', pokemon_id)
      .where('player_id', player.id)
      .first()

    if (!pokemon) {
      return response.notFound({ message: 'Pokémon introuvable.' })
    }

    if (pokemon.slotDaycare !== null) {
      return response.unprocessableEntity({ message: 'Ce Pokémon est en pension.' })
    }

    if (slot === undefined || slot === null) {
      // Retirer de l'équipe
      await db.from('player_pokemon').where('id', pokemon_id).update({ slot_team: null })
    } else {
      await db.transaction(async (trx) => {
        // Libérer le slot s'il est occupé par un autre Pokémon
        await trx
          .from('player_pokemon')
          .where('player_id', player.id)
          .where('slot_team', slot)
          .whereNot('id', pokemon_id)
          .update({ slot_team: null })

        await trx.from('player_pokemon').where('id', pokemon_id).update({ slot_team: slot })
      })
    }

    // Retourner l'état complet de l'équipe
    const slots = await this._getTeamSlots(player.id)
    return response.ok({ slots })
  }

  /**
   * GET /api/team/:id/moves
   * Moves apprenables par ce Pokémon (level_learned_at <= pokemon.level).
   */
  async availableMoves({ params, player, response }: HttpContext) {
    const pokemon = await PlayerPokemon.query()
      .where('id', params.id)
      .where('player_id', player.id)
      .first()

    if (!pokemon) {
      return response.notFound({ message: 'Pokémon introuvable.' })
    }

    // Moves du learnset apprenables jusqu'au niveau actuel
    const learnsetMoves = await db
      .from('pokemon_learnset as pl')
      .join('moves as m', 'pl.move_id', 'm.id')
      .where('pl.species_id', pokemon.speciesId)
      .where('pl.learn_method', 'level')
      .where('pl.level_learned_at', '<=', pokemon.level)
      .select(
        'pl.move_id',
        'pl.level_learned_at',
        'm.name_fr',
        'm.type',
        'm.category',
        'm.power',
        'm.accuracy',
        'm.pp',
        'm.priority'
      )
      .orderBy('pl.level_learned_at', 'asc')

    // Moves actuellement équipés (peuvent être hors learnset accessible si assignés par migration)
    const currentMoves = await db
      .from('player_pokemon_moves as ppm')
      .join('moves as m', 'ppm.move_id', 'm.id')
      .leftJoin('pokemon_learnset as pl', function (q) {
        q.on('pl.move_id', 'ppm.move_id')
          .andOnVal('pl.species_id', pokemon.speciesId)
          .andOnVal('pl.learn_method', 'level')
      })
      .where('ppm.player_pokemon_id', params.id)
      .select(
        'ppm.move_id',
        db.raw('COALESCE(pl.level_learned_at, 0) as level_learned_at'),
        'm.name_fr',
        'm.type',
        'm.category',
        'm.power',
        'm.accuracy',
        'm.pp',
        'm.priority'
      )

    // Fusionner : learnset + moves actuels, sans doublons
    const seenIds = new Set(learnsetMoves.map((m: any) => m.move_id))
    const extraMoves = currentMoves.filter((m: any) => !seenIds.has(m.move_id))
    const allMoves = [...learnsetMoves, ...extraMoves]

    return response.ok({
      moves: allMoves.map((m: any) => ({
        move_id: m.move_id,
        level_learned_at: Number(m.level_learned_at),
        name_fr: m.name_fr,
        type: m.type,
        category: m.category,
        power: m.power,
        accuracy: m.accuracy,
        pp: m.pp,
        priority: m.priority,
      })),
    })
  }

  /**
   * PUT /api/team/:id/moves
   * Remplace les moves d'un Pokémon (max 4 slots).
   */
  async updateMoves({ params, request, player, response }: HttpContext) {
    const { slots } = await request.validateUsing(updateMovesValidator)

    const pokemon = await PlayerPokemon.query()
      .where('id', params.id)
      .where('player_id', player.id)
      .first()

    if (!pokemon) {
      return response.notFound({ message: 'Pokémon introuvable.' })
    }

    // Vérifier que tous les moves demandés sont dans le learnset accessible
    const moveIds = slots.map((s) => s.move_id)
    const validMoves = await db
      .from('pokemon_learnset as pl')
      .join('moves as m', 'pl.move_id', 'm.id')
      .where('pl.species_id', pokemon.speciesId)
      .where('pl.learn_method', 'level')
      .where('pl.level_learned_at', '<=', pokemon.level)
      .whereIn('pl.move_id', moveIds)
      .select('pl.move_id', 'm.pp')

    if (validMoves.length !== moveIds.length) {
      return response.unprocessableEntity({ message: 'Certains moves ne peuvent pas être appris par ce Pokémon.' })
    }

    const ppByMove = new Map(validMoves.map((m: any) => [m.move_id, m.pp]))

    await db.transaction(async (trx) => {
      await trx.from('player_pokemon_moves').where('player_pokemon_id', params.id).delete()
      if (slots.length > 0) {
        await trx.table('player_pokemon_moves').insert(
          slots.map((s) => ({
            id: crypto.randomUUID(),
            player_pokemon_id: params.id,
            slot: s.slot,
            move_id: s.move_id,
            pp_current: ppByMove.get(s.move_id) ?? 20,
            pp_max: ppByMove.get(s.move_id) ?? 20,
          }))
        )
      }
    })

    const updatedMoves = await db
      .from('player_pokemon_moves as ppm')
      .join('moves as m', 'ppm.move_id', 'm.id')
      .where('ppm.player_pokemon_id', params.id)
      .select('ppm.slot', 'ppm.move_id', 'ppm.pp_current', 'ppm.pp_max', 'm.name_fr', 'm.type', 'm.category', 'm.power')
      .orderBy('ppm.slot', 'asc')

    return response.ok({
      moves: updatedMoves.map((m: any) => ({
        slot: m.slot,
        move_id: m.move_id,
        name_fr: m.name_fr,
        type: m.type,
        category: m.category,
        power: m.power,
        pp_current: m.pp_current,
        pp_max: m.pp_max,
      })),
    })
  }

  private async _getTeamSlots(player_id: string) {
    const rows = await db
      .from('player_pokemon as pp')
      .join('pokemon_species as ps', 'pp.species_id', 'ps.id')
      .where('pp.player_id', player_id)
      .whereNotNull('pp.slot_team')
      .select('pp.*', 'ps.name_fr', 'ps.type1', 'ps.type2', 'ps.rarity', 'ps.sprite_url', 'ps.sprite_shiny_url')
      .orderBy('pp.slot_team', 'asc')

    const bySlot = new Map(rows.map((r: any) => [r.slot_team, serializePokemon(r)]))
    return Array.from({ length: 6 }, (_, i) => ({
      slot: i + 1,
      pokemon: bySlot.get(i + 1) ?? null,
    }))
  }
}
