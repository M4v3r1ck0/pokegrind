/**
 * SavedTeamController — Équipes sauvegardées + profils de moveset.
 */

import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import playerUpgradeService from '#services/PlayerUpgradeService'

export default class SavedTeamController {
  // ─── Vérification upgrade ─────────────────────────────────────────────────

  private async requireUpgrade(player_id: string, effect_type: string, response: any): Promise<boolean> {
    const has = await playerUpgradeService.hasUpgrade(player_id, effect_type)
    if (!has) {
      response.forbidden({ message: `Amélioration "${effect_type}" requise` })
      return false
    }
    return true
  }

  // ─── Équipes sauvegardées ─────────────────────────────────────────────────

  async index({ player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'saved_teams', response)) return

    const teams = await db
      .from('player_saved_teams')
      .where('player_id', player.id)
      .orderBy('slot', 'asc')
      .select('id', 'slot', 'name_fr', 'team_json')

    return { teams }
  }

  async save({ params, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'saved_teams', response)) return

    const slot = Number(params.slot)
    if (slot < 1 || slot > 5) return response.badRequest({ message: 'Slot invalide (1-5)' })

    // Snapshot de l'équipe actuelle
    const team = await db
      .from('player_pokemon')
      .where('player_id', player.id)
      .whereNotNull('slot_team')
      .orderBy('slot_team', 'asc')
      .select('id as pokemon_id', 'slot_team as slot')

    const team_json = team.map((p: any) => ({ slot: p.slot, pokemon_id: p.pokemon_id }))

    await db
      .from('player_saved_teams')
      .where('player_id', player.id)
      .where('slot', slot)
      .update({ team_json: JSON.stringify(team_json), updated_at: new Date() })

    return { success: true, slot, team_json }
  }

  async load({ params, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'saved_teams', response)) return

    const slot = Number(params.slot)
    const saved = await db
      .from('player_saved_teams')
      .where('player_id', player.id)
      .where('slot', slot)
      .first()

    if (!saved || !saved.team_json) {
      return response.notFound({ message: 'Aucune équipe sauvegardée dans ce slot' })
    }

    const team_json: Array<{ slot: number; pokemon_id: string }> =
      typeof saved.team_json === 'string' ? JSON.parse(saved.team_json) : saved.team_json

    // Valider que les Pokémon appartiennent au joueur et ne sont pas en pension
    for (const entry of team_json) {
      const pp = await db
        .from('player_pokemon')
        .where('id', entry.pokemon_id)
        .where('player_id', player.id)
        .first()
      if (!pp) return response.badRequest({ message: `Pokémon ${entry.pokemon_id} introuvable` })
      if (pp.slot_daycare !== null) return response.badRequest({ message: `Pokémon ${entry.pokemon_id} est en pension` })
    }

    // Vider l'équipe actuelle
    await db.from('player_pokemon').where('player_id', player.id).update({ slot_team: null })

    // Appliquer la nouvelle équipe
    for (const entry of team_json) {
      await db.from('player_pokemon').where('id', entry.pokemon_id).update({ slot_team: entry.slot })
    }

    return { success: true, loaded_slot: slot }
  }

  async rename({ params, request, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'saved_teams', response)) return

    const schema = vine.compile(vine.object({ name_fr: vine.string().maxLength(32) }))
    const { name_fr } = await schema.validate(request.body())
    const slot = Number(params.slot)

    await db
      .from('player_saved_teams')
      .where('player_id', player.id)
      .where('slot', slot)
      .update({ name_fr, updated_at: new Date() })

    return { success: true }
  }

  async swapPokemon({ request, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'quick_swap', response)) return

    const schema = vine.compile(
      vine.object({
        old_pokemon_id: vine.string().uuid(),
        new_pokemon_id: vine.string().uuid(),
      })
    )
    const { old_pokemon_id, new_pokemon_id } = await schema.validate(request.body())

    const old_pp = await db.from('player_pokemon').where('id', old_pokemon_id).where('player_id', player.id).first()
    const new_pp = await db.from('player_pokemon').where('id', new_pokemon_id).where('player_id', player.id).first()

    if (!old_pp || !new_pp) return response.notFound({ message: 'Pokémon introuvable' })
    if (old_pp.slot_team === null) return response.badRequest({ message: 'L\'ancien Pokémon n\'est pas dans l\'équipe' })
    if (new_pp.slot_daycare !== null) return response.badRequest({ message: 'Le nouveau Pokémon est en pension' })
    if (new_pp.slot_team !== null) return response.badRequest({ message: 'Le nouveau Pokémon est déjà dans l\'équipe' })

    const team_slot = old_pp.slot_team
    await db.from('player_pokemon').where('id', old_pokemon_id).update({ slot_team: null })
    await db.from('player_pokemon').where('id', new_pokemon_id).update({ slot_team: team_slot })

    return { success: true, team_slot }
  }

  // ─── Profils de moveset ───────────────────────────────────────────────────

  async movesetProfiles({ params, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'moveset_profiles', response)) return

    const pokemon_id = params.id
    const pp = await db.from('player_pokemon').where('id', pokemon_id).where('player_id', player.id).first()
    if (!pp) return response.notFound({ message: 'Pokémon introuvable' })

    const profiles = await db
      .from('pokemon_moveset_profiles')
      .where('player_pokemon_id', pokemon_id)
      .orderBy('profile_slot', 'asc')
      .select('id', 'profile_slot', 'name_fr', 'moves_json')

    return { profiles }
  }

  async saveProfile({ params, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'moveset_profiles', response)) return

    const pokemon_id = params.id
    const profile_slot = Number(params.slot)
    if (profile_slot < 1 || profile_slot > 3) return response.badRequest({ message: 'Slot invalide (1-3)' })

    const pp = await db.from('player_pokemon').where('id', pokemon_id).where('player_id', player.id).first()
    if (!pp) return response.notFound({ message: 'Pokémon introuvable' })

    const moves = await db
      .from('player_pokemon_moves')
      .where('player_pokemon_id', pokemon_id)
      .orderBy('slot', 'asc')
      .select('slot', 'move_id')

    const moves_json = moves.map((m: any) => ({ slot: m.slot, move_id: m.move_id }))

    const existing = await db
      .from('pokemon_moveset_profiles')
      .where('player_pokemon_id', pokemon_id)
      .where('profile_slot', profile_slot)
      .first()

    if (existing) {
      await db
        .from('pokemon_moveset_profiles')
        .where('id', existing.id)
        .update({ moves_json: JSON.stringify(moves_json) })
    } else {
      await db.table('pokemon_moveset_profiles').insert({
        id: crypto.randomUUID(),
        player_pokemon_id: pokemon_id,
        profile_slot,
        name_fr: `Profil ${profile_slot}`,
        moves_json: JSON.stringify(moves_json),
      })
    }

    return { success: true, profile_slot }
  }

  async loadProfile({ params, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'moveset_profiles', response)) return

    const pokemon_id = params.id
    const profile_slot = Number(params.slot)

    const pp = await db.from('player_pokemon').where('id', pokemon_id).where('player_id', player.id).first()
    if (!pp) return response.notFound({ message: 'Pokémon introuvable' })

    const profile = await db
      .from('pokemon_moveset_profiles')
      .where('player_pokemon_id', pokemon_id)
      .where('profile_slot', profile_slot)
      .first()

    if (!profile) return response.notFound({ message: 'Profil introuvable' })

    const moves_json: Array<{ slot: number; move_id: number }> =
      typeof profile.moves_json === 'string' ? JSON.parse(profile.moves_json) : profile.moves_json

    // Appliquer les moves
    for (const entry of moves_json) {
      await db
        .from('player_pokemon_moves')
        .where('player_pokemon_id', pokemon_id)
        .where('slot', entry.slot)
        .update({ move_id: entry.move_id })
    }

    return { success: true }
  }

  async renameProfile({ params, request, player, response }: HttpContext) {
    if (!await this.requireUpgrade(player.id, 'moveset_profiles', response)) return

    const schema = vine.compile(vine.object({ name_fr: vine.string().maxLength(32) }))
    const { name_fr } = await schema.validate(request.body())
    const pokemon_id = params.id
    const profile_slot = Number(params.slot)

    const pp = await db.from('player_pokemon').where('id', pokemon_id).where('player_id', player.id).first()
    if (!pp) return response.notFound({ message: 'Pokémon introuvable' })

    await db
      .from('pokemon_moveset_profiles')
      .where('player_pokemon_id', pokemon_id)
      .where('profile_slot', profile_slot)
      .update({ name_fr })

    return { success: true }
  }
}
