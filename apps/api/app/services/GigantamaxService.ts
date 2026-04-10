/**
 * GigantamaxService — Gigantamax, Formes Cosmétiques, Bonbons, Évolutions manuelles.
 * Toute la logique métier de ce sprint.
 */

import db from '@adonisjs/lucid/services/db'
import gemsService from '#services/GemsService'
import pokedexService from '#services/PokedexService'
import {
  canGigantamax,
  selectGigantamax,
  applyGigantamax,
  calcGmaxStats,
  applyRareCandyResult,
  applyExpCandyResult,
  calcCandyXpGain,
  xpRequiredForLevel,
  levelFromXp,
  type GigantamaxData,
  type CombatMode,
} from '#services/GigantamaxFormulas'

// Re-export pour le controller
export {
  canGigantamax,
  selectGigantamax,
  applyGigantamax,
  calcGmaxStats,
  applyRareCandyResult,
  applyExpCandyResult,
  xpRequiredForLevel,
  levelFromXp,
  type GigantamaxData,
  type CombatMode,
}

// ─── Types publics ────────────────────────────────────────────────────────────

export interface CandyResult {
  level_before: number
  level_after: number
  xp_before: number
  xp_after: number
  xp_gained: number
  levels_gained: number
  can_evolve: boolean
  evolution_species: { id: number; name_fr: string; sprite_url: string | null } | null
}

export interface EvolutionResult {
  pokemon_id: string
  species_before: { id: number; name_fr: string }
  species_after: { id: number; name_fr: string; sprite_url: string | null }
  ivs_preserved: boolean
}

export interface LivingDexStatus {
  species_count: number
  shiny_count: number
  form_count: number
  gmax_count: number
  total_species: number
  progress_percent: number
}

// ─── Service ──────────────────────────────────────────────────────────────────

class GigantamaxService {
  // ─── Gigantamax ───────────────────────────────────────────────────────────

  async getPlayerGmaxUnlocked(player_id: string): Promise<object[]> {
    return db
      .from('player_gigantamax')
      .where('player_id', player_id)
      .join('gigantamax_forms', 'player_gigantamax.species_id', 'gigantamax_forms.species_id')
      .join('pokemon_species', 'gigantamax_forms.species_id', 'pokemon_species.id')
      .select(
        'gigantamax_forms.*',
        'pokemon_species.name_fr as base_name_fr',
        'player_gigantamax.unlocked_at',
      )
      .orderBy('gigantamax_forms.species_id')
  }

  async getAllGmaxAvailable(): Promise<object[]> {
    return db
      .from('gigantamax_forms')
      .join('pokemon_species', 'gigantamax_forms.species_id', 'pokemon_species.id')
      .select(
        'gigantamax_forms.*',
        'pokemon_species.name_fr as base_name_fr',
        'pokemon_species.sprite_url as base_sprite_url',
      )
      .orderBy('gigantamax_forms.species_id')
  }

  async getPlayerGmaxForCombat(player_id: string): Promise<GigantamaxData[]> {
    const rows = await db
      .from('player_gigantamax')
      .where('player_id', player_id)
      .join('gigantamax_forms', 'player_gigantamax.species_id', 'gigantamax_forms.species_id')
      .select('gigantamax_forms.*')

    return rows.map((r: any) => ({
      id: r.id,
      species_id: r.species_id,
      gmax_name_fr: r.gmax_name_fr,
      gmax_move_id: r.gmax_move_id,
      gmax_hp_mult: Number(r.gmax_hp_mult),
      gmax_atk_mult: Number(r.gmax_atk_mult),
      gmax_def_mult: Number(r.gmax_def_mult),
      gmax_spatk_mult: Number(r.gmax_spatk_mult),
      gmax_spdef_mult: Number(r.gmax_spdef_mult),
      gmax_speed_mult: Number(r.gmax_speed_mult),
      sprite_url: r.sprite_url,
      sprite_shiny_url: r.sprite_shiny_url,
      obtain_method: r.obtain_method,
    }))
  }

  async unlockGigantamax(player_id: string, species_id: number): Promise<void> {
    const exists = await db
      .from('player_gigantamax')
      .where({ player_id, species_id })
      .first()

    if (!exists) {
      await db.table('player_gigantamax').insert({
        player_id,
        species_id,
        unlocked_at: new Date(),
      })
    }
  }

  async getPlayerUnlockedSpeciesIds(player_id: string): Promise<number[]> {
    const rows = await db
      .from('player_gigantamax')
      .where('player_id', player_id)
      .select('species_id')
    return rows.map((r: any) => r.species_id)
  }

  // ─── Formes cosmétiques ───────────────────────────────────────────────────

  async getCosmeticFormsForSpecies(species_id: number): Promise<object[]> {
    return db
      .from('pokemon_cosmetic_forms')
      .where('species_id', species_id)
      .orderBy('id')
  }

  async changeCosmeticForm(
    player_id: string,
    pokemon_id: string,
    form_id: number
  ): Promise<object> {
    // 1. Vérifier que le Pokémon appartient au joueur
    const pokemon = await db
      .from('player_pokemon')
      .where({ id: pokemon_id, player_id })
      .first()
    if (!pokemon) throw new Error('Pokémon introuvable ou non autorisé.')

    // 2. Vérifier que la forme existe pour cette espèce
    const form = await db
      .from('pokemon_cosmetic_forms')
      .where({ id: form_id, species_id: pokemon.species_id })
      .first()
    if (!form) throw new Error('Forme cosmétique introuvable pour ce Pokémon.')

    // 3. Si obtain_method = 'item' → vérifier l'item requis
    // (simplifié : on accepte si le joueur a un "Appareil Rotom" ou équivalent)
    // Le vrai système d'items est géré dans une future mise à jour
    // Pour l'instant : on permet le changement sans consommation d'item

    // 4. Mettre à jour
    await db
      .from('player_pokemon')
      .where('id', pokemon_id)
      .update({ active_cosmetic_form_id: form_id, updated_at: new Date() })

    return db.from('player_pokemon').where('id', pokemon_id).first()
  }

  async resetCosmeticForm(player_id: string, pokemon_id: string): Promise<void> {
    const pokemon = await db.from('player_pokemon').where({ id: pokemon_id, player_id }).first()
    if (!pokemon) throw new Error('Pokémon introuvable ou non autorisé.')
    await db.from('player_pokemon').where('id', pokemon_id).update({
      active_cosmetic_form_id: null,
      updated_at: new Date(),
    })
  }

  // ─── Bonbons ─────────────────────────────────────────────────────────────

  async useCandy(
    player_id: string,
    pokemon_id: string,
    item_id: number,
    quantity: number = 1
  ): Promise<CandyResult> {
    // 1. Vérifier le Pokémon
    const pokemon = await db
      .from('player_pokemon')
      .where({ id: pokemon_id, player_id })
      .join('pokemon_species', 'player_pokemon.species_id', 'pokemon_species.id')
      .select(
        'player_pokemon.id',
        'player_pokemon.level',
        'player_pokemon.xp',
        'player_pokemon.species_id',
        'pokemon_species.name_fr as species_name_fr',
        'pokemon_species.evolves_from_id',
      )
      .first()
    if (!pokemon) throw new Error('Pokémon introuvable ou non autorisé.')

    // 2. Vérifier l'item
    const item = await db.from('items').where('id', item_id).first()
    if (!item) throw new Error('Item introuvable.')

    const CANDY_TYPES = ['rare_candy', 'exp_candy_l', 'exp_candy_xl']
    if (!CANDY_TYPES.includes(item.effect_type)) {
      throw new Error(`Cet item n'est pas un bonbon (type: ${item.effect_type}).`)
    }

    // 3. Vérifier la quantité en inventaire
    const inventory = await db
      .from('player_items')
      .where({ player_id, item_id })
      .first()
    if (!inventory || inventory.quantity < quantity) {
      throw new Error(`Quantité insuffisante (possède: ${inventory?.quantity ?? 0}).`)
    }

    // 4. Vérifier que Bonbon Rare est utilisable
    if (item.effect_type === 'rare_candy' && pokemon.level >= 100) {
      throw new Error('Ce Pokémon est déjà au niveau maximum (100).')
    }

    // 5. Trouver l'espèce évoluée
    const evolved_species = await this.findEvolutionTarget(pokemon.species_id, pokemon.level)

    // 6. Calculer le résultat
    const current_level = pokemon.level
    const current_xp = Number(pokemon.xp ?? 0)
    let result: CandyResult

    if (item.effect_type === 'rare_candy') {
      const candy_result = applyRareCandyResult(
        current_level,
        evolved_species?.level_threshold ?? null
      )
      // Chaque bonbon = +1 niveau, mais on applique quantity
      let final_level = current_level
      let can_evolve = false
      for (let i = 0; i < quantity; i++) {
        const r = applyRareCandyResult(final_level, evolved_species?.level_threshold ?? null)
        final_level = r.new_level
        if (r.can_evolve) can_evolve = true
      }
      const new_xp = xpRequiredForLevel(final_level)
      result = {
        level_before: current_level,
        level_after: final_level,
        xp_before: current_xp,
        xp_after: new_xp,
        xp_gained: new_xp - current_xp,
        levels_gained: final_level - current_level,
        can_evolve,
        evolution_species: can_evolve && evolved_species ? {
          id: evolved_species.id,
          name_fr: evolved_species.name_fr,
          sprite_url: evolved_species.sprite_url,
        } : null,
      }
    } else {
      // Bonbon Exp.
      const xp_per_candy = calcCandyXpGain(item.effect_type)
      let cur_level = current_level
      let cur_xp = current_xp
      let can_evolve = false

      for (let i = 0; i < quantity; i++) {
        const r = applyExpCandyResult(cur_level, cur_xp, xp_per_candy, evolved_species?.level_threshold ?? null)
        cur_level = r.new_level
        cur_xp = r.new_xp
        if (r.can_evolve) can_evolve = true
      }

      result = {
        level_before: current_level,
        level_after: cur_level,
        xp_before: current_xp,
        xp_after: cur_xp,
        xp_gained: cur_xp - current_xp,
        levels_gained: cur_level - current_level,
        can_evolve,
        evolution_species: can_evolve && evolved_species ? {
          id: evolved_species.id,
          name_fr: evolved_species.name_fr,
          sprite_url: evolved_species.sprite_url,
        } : null,
      }
    }

    // 7. Appliquer en BDD (transaction)
    await db.transaction(async (trx) => {
      // Mettre à jour le niveau et XP du Pokémon
      await trx.from('player_pokemon').where('id', pokemon_id).update({
        level: result.level_after,
        xp: result.xp_after,
        updated_at: new Date(),
      })

      // Décrémenter l'inventaire
      if (inventory.quantity === quantity) {
        await trx.from('player_items').where({ player_id, item_id }).delete()
      } else {
        await trx
          .from('player_items')
          .where({ player_id, item_id })
          .decrement('quantity', quantity)
      }
    })

    return result
  }

  // ─── Évolution manuelle ───────────────────────────────────────────────────

  async evolvePokemon(player_id: string, pokemon_id: string): Promise<EvolutionResult> {
    const pokemon = await db
      .from('player_pokemon')
      .where({ id: pokemon_id, player_id })
      .join('pokemon_species', 'player_pokemon.species_id', 'pokemon_species.id')
      .select(
        'player_pokemon.id',
        'player_pokemon.level',
        'player_pokemon.species_id',
        'player_pokemon.iv_hp', 'player_pokemon.iv_atk', 'player_pokemon.iv_def',
        'player_pokemon.iv_spatk', 'player_pokemon.iv_spdef', 'player_pokemon.iv_speed',
        'player_pokemon.nature', 'player_pokemon.is_shiny', 'player_pokemon.stars',
        'player_pokemon.slot_team', 'player_pokemon.slot_daycare',
        'pokemon_species.name_fr as base_name_fr',
        'pokemon_species.evolves_from_id',
      )
      .first()
    if (!pokemon) throw new Error('Pokémon introuvable ou non autorisé.')

    // Trouver l'espèce évoluée
    const evolved_target = await this.findEvolutionTarget(pokemon.species_id, pokemon.level)
    if (!evolved_target) {
      throw new Error("Ce Pokémon ne peut pas évoluer pour l'instant.")
    }
    if (pokemon.level < evolved_target.level_threshold) {
      throw new Error(`Niveau insuffisant pour évoluer (niveau ${evolved_target.level_threshold} requis).`)
    }

    // Appliquer l'évolution
    await db.transaction(async (trx) => {
      await trx.from('player_pokemon').where('id', pokemon_id).update({
        species_id: evolved_target.id,
        updated_at: new Date(),
      })

      // Mettre à jour le Pokédex
      const iv_total = (pokemon.iv_hp ?? 0) + (pokemon.iv_atk ?? 0) + (pokemon.iv_def ?? 0) +
        (pokemon.iv_spatk ?? 0) + (pokemon.iv_spdef ?? 0) + (pokemon.iv_speed ?? 0)
      await pokedexService.updateEntry({
        player_id,
        species_id: evolved_target.id,
        iv_total,
        is_shiny: pokemon.is_shiny,
      })
    })

    // Mettre à jour le Living Dex
    await this.updateLivingDex(player_id, pokemon_id, evolved_target.id, pokemon.is_shiny)

    return {
      pokemon_id,
      species_before: { id: pokemon.species_id, name_fr: pokemon.base_name_fr },
      species_after: {
        id: evolved_target.id,
        name_fr: evolved_target.name_fr,
        sprite_url: evolved_target.sprite_url,
      },
      ivs_preserved: true,
    }
  }

  // ─── Living Dex ───────────────────────────────────────────────────────────

  async updateLivingDex(
    player_id: string,
    pokemon_id: string,
    species_id: number,
    is_shiny: boolean,
    form_key = 'default'
  ): Promise<void> {
    const existing = await db
      .from('player_living_dex')
      .where({ player_id, species_id, form_key })
      .first()

    if (!existing) {
      await db.table('player_living_dex').insert({
        player_id,
        species_id,
        form_key,
        has_shiny: is_shiny,
        pokemon_id,
        updated_at: new Date(),
      })
    } else {
      const updates: Record<string, any> = {
        pokemon_id,
        updated_at: new Date(),
      }
      if (is_shiny) updates.has_shiny = true
      await db.from('player_living_dex').where({ player_id, species_id, form_key }).update(updates)
    }

    // Vérifier les objectifs
    await this.checkLivingDexObjectives(player_id)
  }

  async onPokemonSold(player_id: string, species_id: number, pokemon_id: string): Promise<void> {
    // Vérifier si le joueur a d'autres exemplaires de cette espèce
    const others = await db
      .from('player_pokemon')
      .where('player_id', player_id)
      .where('species_id', species_id)
      .whereNot('id', pokemon_id)
      .count('* as total')
      .first()

    if (Number(others?.total ?? 0) === 0) {
      await db
        .from('player_living_dex')
        .where({ player_id, species_id, form_key: 'default' })
        .delete()
    }
  }

  async getLivingDexStatus(player_id: string): Promise<LivingDexStatus> {
    const [species_row, shiny_row, form_row, gmax_row, total_row] = await Promise.all([
      db.from('player_living_dex').where('player_id', player_id).countDistinct('species_id as count').first(),
      db.from('player_living_dex').where({ player_id, has_shiny: true }).count('* as count').first(),
      db.from('player_living_dex').where('player_id', player_id).count('* as count').first(),
      db.from('player_gigantamax').where('player_id', player_id).count('* as count').first(),
      db.from('pokemon_species').count('* as count').first(),
    ])

    const species_count = Number(species_row?.count ?? 0)
    const shiny_count = Number(shiny_row?.count ?? 0)
    const form_count = Number(form_row?.count ?? 0)
    const gmax_count = Number(gmax_row?.count ?? 0)
    const total_species = Number(total_row?.count ?? 1025)

    return {
      species_count,
      shiny_count,
      form_count,
      gmax_count,
      total_species,
      progress_percent: parseFloat(((species_count / total_species) * 100).toFixed(1)),
    }
  }

  async getLivingDexObjectives(player_id: string): Promise<object[]> {
    const objectives = await db.from('living_dex_objectives').orderBy('condition_value')
    const progress = await db
      .from('player_living_dex_objectives')
      .where('player_id', player_id)

    const progress_map = new Map(progress.map((p: any) => [p.objective_id, p]))
    const status = await this.getLivingDexStatus(player_id)

    return objectives.map((obj: any) => {
      const player_progress = progress_map.get(obj.id)
      const current_value = this.getObjectiveCurrentValue(obj.condition_type, status)
      const is_completed = current_value >= obj.condition_value

      return {
        ...obj,
        current_value,
        is_completed,
        can_claim: is_completed && !(player_progress?.claimed ?? false),
        claimed: player_progress?.claimed ?? false,
      }
    })
  }

  async claimObjective(player_id: string, objective_id: number): Promise<void> {
    const objective = await db.from('living_dex_objectives').where('id', objective_id).first()
    if (!objective) throw new Error('Objectif introuvable.')

    const existing = await db
      .from('player_living_dex_objectives')
      .where({ player_id, objective_id })
      .first()

    if (existing?.claimed) throw new Error('Récompense déjà réclamée.')

    // Vérifier que la condition est remplie
    const status = await this.getLivingDexStatus(player_id)
    const current_value = this.getObjectiveCurrentValue(objective.condition_type, status)
    if (current_value < objective.condition_value) {
      throw new Error('Condition non remplie.')
    }

    await db.transaction(async (trx) => {
      if (!existing) {
        await trx.table('player_living_dex_objectives').insert({
          player_id,
          objective_id,
          completed: true,
          claimed: true,
          completed_at: new Date(),
        })
      } else {
        await trx
          .from('player_living_dex_objectives')
          .where({ player_id, objective_id })
          .update({ claimed: true })
      }

      if (objective.gems_reward > 0) {
        await gemsService.awardGems(
          player_id,
          objective.gems_reward,
          `Objectif Pokédex Living : ${objective.name_fr}`,
          'achievement'
        )
      }
    })
  }

  async getMissingSpecies(
    player_id: string,
    generation?: number
  ): Promise<object[]> {
    let query = db
      .from('pokemon_species')
      .whereNotIn('id', (subq) => {
        subq
          .from('player_living_dex')
          .where('player_id', player_id)
          .where('form_key', 'default')
          .select('species_id')
      })
      .select('id', 'name_fr', 'rarity', 'generation', 'sprite_url')
      .orderBy('id')

    if (generation) {
      query = query.where('generation', generation)
    }

    return query.limit(200)
  }

  // ─── Helpers privés ───────────────────────────────────────────────────────

  private async findEvolutionTarget(
    species_id: number,
    current_level: number
  ): Promise<{ id: number; name_fr: string; sprite_url: string | null; level_threshold: number } | null> {
    // Chercher une espèce qui évolue depuis species_id
    const evolved = await db
      .from('pokemon_species')
      .where('evolves_from_id', species_id)
      .select('id', 'name_fr', 'sprite_url')
      .first()

    if (!evolved) return null

    // Chercher le niveau requis dans le learnset / évolutions
    // Approximation : niveau 16, 32, 36 selon l'espèce (standard Pokémon)
    // En production, cela serait dans une table pokemon_evolutions
    // Pour l'instant, utiliser des seuils fixes par espèce connue
    const level_threshold = this.getEvolutionLevel(species_id)

    return {
      id: evolved.id,
      name_fr: evolved.name_fr,
      sprite_url: evolved.sprite_url,
      level_threshold,
    }
  }

  private getEvolutionLevel(species_id: number): number {
    // Tableau simplifié des niveaux d'évolution principaux
    const EVOLUTION_LEVELS: Record<number, number> = {
      // Kanto starters
      1: 16, 2: 32, 4: 16, 5: 36, 7: 16, 8: 36,
      // Rattata, Pidgey...
      19: 20, 16: 18, 21: 20, 23: 22, 27: 22,
      // Pikachu (pas d'évolution par niveau en standard, mais ici on simplifie)
      // Évolutions classiques
      43: 21, 44: 32, 46: 24, 69: 21, 70: 32,
      92: 25, 74: 25, 75: 35, 77: 40, 79: 37,
    }
    return EVOLUTION_LEVELS[species_id] ?? 36  // défaut niveau 36
  }

  private getObjectiveCurrentValue(
    condition_type: string,
    status: LivingDexStatus
  ): number {
    switch (condition_type) {
      case 'species_count': return status.species_count
      case 'shiny_count':   return status.shiny_count
      case 'form_count':    return status.form_count
      case 'gmax_count':    return status.gmax_count
      case 'full_gen':      return 0  // calculé séparément si besoin
      default:              return 0
    }
  }

  private async checkLivingDexObjectives(player_id: string): Promise<void> {
    const status = await this.getLivingDexStatus(player_id)
    const objectives = await db.from('living_dex_objectives')

    for (const obj of objectives) {
      const current_value = this.getObjectiveCurrentValue(obj.condition_type, status)
      if (current_value < obj.condition_value) continue

      const existing = await db
        .from('player_living_dex_objectives')
        .where({ player_id, objective_id: obj.id })
        .first()

      if (!existing) {
        await db.table('player_living_dex_objectives').insert({
          player_id,
          objective_id: obj.id,
          completed: true,
          claimed: false,
          completed_at: new Date(),
        })
      } else if (!existing.completed) {
        await db
          .from('player_living_dex_objectives')
          .where({ player_id, objective_id: obj.id })
          .update({ completed: true, completed_at: new Date() })
      }
    }
  }
}

const gigantamaxService = new GigantamaxService()
export default gigantamaxService
