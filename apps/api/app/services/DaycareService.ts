/**
 * DaycareService — Pension, dressage, éclosion
 * Toute la logique métier tourne côté serveur.
 */

import db from '@adonisjs/lucid/services/db'
import DaycareSlot from '#models/daycare_slot'
import PlayerPokemon from '#models/player_pokemon'
import PokemonSpecies from '#models/pokemon_species'
import type { PokemonRarity } from '@pokegrind/shared'
import pokedexService from '#services/PokedexService'
import { applyPrestigeDaycareMult } from '#services/PrestigeFormulas'
import {
  HATCH_THRESHOLDS,
  DEFAULT_SLOT_COUNT,
  MAX_SLOT_COUNT,
  DITTO_SPECIES_ID,
  calcBreedingIVs,
  areBreedingCompatible,
  randomNature,
  randomIV,
} from '#services/DaycareFormulas'

// Re-export des fonctions pures pour les consommateurs existants
export {
  HATCH_THRESHOLDS,
  DEFAULT_SLOT_COUNT,
  MAX_SLOT_COUNT,
  DITTO_SPECIES_ID,
  calcBreedingIVs,
  areBreedingCompatible,
} from '#services/DaycareFormulas'
export type { IVSet } from '#services/DaycareFormulas'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HatchResult {
  original_pokemon_id: string
  new_pokemon_id: string
  new_pokemon_name_fr: string
  new_pokemon_rarity: PokemonRarity
  new_pokemon_species_id: number
  stars_gained: number
  is_shiny: boolean
  has_hidden_talent: boolean
  hidden_talent_move?: { id: number; name_fr: string; type: string; category: string; power: number | null }
  auto_restarted: boolean
  slot_number: number
}

export interface DaycareSlotState {
  slot_number: number
  is_unlocked: boolean
  pokemon: {
    id: string
    name_fr: string
    rarity: PokemonRarity
    stars: number
    sprite_url: string
    is_shiny: boolean
    species_id: number
  } | null
  partner: {
    id: string
    name_fr: string
    rarity: PokemonRarity
    stars: number
    sprite_url: string
    is_shiny: boolean
    species_id: number
  } | null
  damage_accumulated: number
  damage_threshold: number
  progress_percent: number
  is_ready: boolean
  started_at: string | null
  is_breeding: boolean
}

export interface DaycareState {
  slots: DaycareSlotState[]
  max_slots_unlocked: number
  auto_collect_active: boolean
  queue_active: boolean
}

export interface ReadySlot {
  slot_number: number
  pokemon_name_fr: string
}

// ─── Gestion des upgrades ─────────────────────────────────────────────────────

export async function getUnlockedSlotCount(player_id: string): Promise<number> {
  const upgrades = await db
    .from('player_upgrades')
    .join('shop_upgrades', 'shop_upgrades.id', 'player_upgrades.upgrade_id')
    .where('player_upgrades.player_id', player_id)
    .where('shop_upgrades.effect_type', 'daycare_slot')
    .select('shop_upgrades.effect_value')

  let max_slot = DEFAULT_SLOT_COUNT
  for (const row of upgrades) {
    const val = typeof row.effect_value === 'string'
      ? JSON.parse(row.effect_value)
      : row.effect_value
    if (val?.slot && val.slot > max_slot) {
      max_slot = val.slot
    }
  }
  return max_slot
}

export async function hasUpgrade(player_id: string, effect_type: string): Promise<boolean> {
  const row = await db
    .from('player_upgrades')
    .join('shop_upgrades', 'shop_upgrades.id', 'player_upgrades.upgrade_id')
    .where('player_upgrades.player_id', player_id)
    .where('shop_upgrades.effect_type', effect_type)
    .first()
  return !!row
}

// ─── DaycareService ───────────────────────────────────────────────────────────

class DaycareService {

  // ── État global pension ──────────────────────────────────────────────────

  async getDaycareState(player_id: string): Promise<DaycareState> {
    const max_slots = await getUnlockedSlotCount(player_id)
    const auto_collect = await hasUpgrade(player_id, 'auto_collect')
    const queue_active = await hasUpgrade(player_id, 'daycare_queue')

    // Charger tous les slots existants
    const slots = await DaycareSlot.query()
      .where('player_id', player_id)
      .orderBy('slot_number', 'asc')

    // Précharger les Pokémon + espèces
    const pokemon_ids = [
      ...slots.map((s) => s.playerPokemonId).filter(Boolean),
      ...slots.map((s) => s.partnerPokemonId).filter(Boolean),
    ] as string[]

    const pokemon_map = new Map<string, { pokemon: PlayerPokemon; species: PokemonSpecies }>()
    if (pokemon_ids.length > 0) {
      const pokemons = await PlayerPokemon.query()
        .whereIn('id', pokemon_ids)
        .preload('species')
      for (const pp of pokemons) {
        pokemon_map.set(pp.id, { pokemon: pp, species: pp.species })
      }
    }

    const slot_states: DaycareSlotState[] = []

    for (let n = 1; n <= MAX_SLOT_COUNT; n++) {
      const slot = slots.find((s) => s.slotNumber === n)
      const is_unlocked = n <= max_slots

      let pokemon_state: DaycareSlotState['pokemon'] = null
      let partner_state: DaycareSlotState['partner'] = null
      let damage_accumulated = 0
      let damage_threshold = 0
      let started_at: string | null = null
      let is_breeding = false

      if (slot) {
        damage_accumulated = slot.damageAccumulated
        started_at = slot.startedAt?.toISO() ?? null

        if (slot.playerPokemonId) {
          const entry = pokemon_map.get(slot.playerPokemonId)
          if (entry) {
            const threshold = HATCH_THRESHOLDS[entry.species.rarity as PokemonRarity] ?? HATCH_THRESHOLDS.common
            damage_threshold = threshold
            pokemon_state = {
              id: entry.pokemon.id,
              name_fr: entry.pokemon.nickname ?? entry.species.nameFr,
              rarity: entry.species.rarity,
              stars: entry.pokemon.stars,
              sprite_url: entry.species.spriteUrl ?? '',
              is_shiny: entry.pokemon.isShiny,
              species_id: entry.pokemon.speciesId,
            }
          }
        }

        if (slot.partnerPokemonId) {
          const entry = pokemon_map.get(slot.partnerPokemonId)
          if (entry) {
            partner_state = {
              id: entry.pokemon.id,
              name_fr: entry.pokemon.nickname ?? entry.species.nameFr,
              rarity: entry.species.rarity,
              stars: entry.pokemon.stars,
              sprite_url: entry.species.spriteUrl ?? '',
              is_shiny: entry.pokemon.isShiny,
              species_id: entry.pokemon.speciesId,
            }
            is_breeding = true
          }
        }
      }

      const progress_percent = damage_threshold > 0
        ? Math.min(100, (damage_accumulated / damage_threshold) * 100)
        : 0

      slot_states.push({
        slot_number: n,
        is_unlocked,
        pokemon: pokemon_state,
        partner: partner_state,
        damage_accumulated,
        damage_threshold,
        progress_percent,
        is_ready: damage_threshold > 0 && damage_accumulated >= damage_threshold,
        started_at,
        is_breeding,
      })
    }

    return {
      slots: slot_states,
      max_slots_unlocked: max_slots,
      auto_collect_active: auto_collect,
      queue_active,
    }
  }

  // ── Dépôt ────────────────────────────────────────────────────────────────

  async depositPokemon(
    player_id: string,
    pokemon_id: string,
    slot_number: number,
    partner_id?: string
  ): Promise<DaycareSlot> {
    // Vérifier que le slot est débloqué
    const max_slots = await getUnlockedSlotCount(player_id)
    if (slot_number < 1 || slot_number > max_slots) {
      throw new Error(`Slot ${slot_number} non débloqué (max: ${max_slots})`)
    }

    // Vérifier que le slot existe et est vide
    const slot = await DaycareSlot.query()
      .where('player_id', player_id)
      .where('slot_number', slot_number)
      .firstOrFail()

    if (slot.playerPokemonId !== null) {
      throw new Error(`Le slot ${slot_number} est déjà occupé`)
    }

    // Vérifier le Pokémon principal
    const pokemon = await PlayerPokemon.query()
      .where('id', pokemon_id)
      .where('player_id', player_id)
      .preload('species')
      .firstOrFail()

    if (pokemon.slotTeam !== null) {
      throw new Error('Ce Pokémon est dans l\'équipe active')
    }
    if (pokemon.level < 100) {
      throw new Error(`Ce Pokémon est niveau ${pokemon.level} — seuls les Pokémon niveau 100 peuvent être mis en pension`)
    }
    if (pokemon.slotDaycare !== null) {
      throw new Error('Ce Pokémon est déjà en pension')
    }

    // Vérifier le partenaire si fourni
    let partner: PlayerPokemon | null = null
    if (partner_id) {
      partner = await PlayerPokemon.query()
        .where('id', partner_id)
        .where('player_id', player_id)
        .preload('species')
        .firstOrFail()

      if (partner.slotTeam !== null) {
        throw new Error('Le partenaire est dans l\'équipe active')
      }
      if (partner.level < 100) {
        throw new Error(`Le partenaire est niveau ${partner.level} — seuls les Pokémon niveau 100 peuvent être mis en pension`)
      }
      if (partner.slotDaycare !== null) {
        throw new Error('Le partenaire est déjà en pension')
      }
      if (!areBreedingCompatible(pokemon.species, partner.species)) {
        throw new Error('Ces deux Pokémon ne sont pas compatibles pour le dressage')
      }
    }

    // Effectuer le dépôt
    await db.from('daycare_slots')
      .where('id', slot.id)
      .update({
        player_pokemon_id: pokemon_id,
        partner_pokemon_id: partner_id ?? null,
        damage_accumulated: 0,
        started_at: new Date(),
      })

    // Mettre à jour slot_daycare sur le Pokémon
    await db.from('player_pokemon')
      .where('id', pokemon_id)
      .update({ slot_daycare: slot_number })

    if (partner_id) {
      await db.from('player_pokemon')
        .where('id', partner_id)
        .update({ slot_daycare: slot_number })
    }

    // Recharger et retourner le slot mis à jour
    return DaycareSlot.query()
      .where('player_id', player_id)
      .where('slot_number', slot_number)
      .firstOrFail()
  }

  // ── Retrait ──────────────────────────────────────────────────────────────

  async withdrawPokemon(player_id: string, slot_number: number): Promise<void> {
    const slot = await DaycareSlot.query()
      .where('player_id', player_id)
      .where('slot_number', slot_number)
      .firstOrFail()

    if (!slot.playerPokemonId) {
      throw new Error(`Le slot ${slot_number} est déjà vide`)
    }

    const pokemon_id = slot.playerPokemonId
    const partner_id = slot.partnerPokemonId

    // Vider le slot
    await db.from('daycare_slots')
      .where('id', slot.id)
      .update({
        player_pokemon_id: null,
        partner_pokemon_id: null,
        damage_accumulated: 0,
        started_at: null,
      })

    // Libérer les Pokémon
    await db.from('player_pokemon')
      .where('id', pokemon_id)
      .update({ slot_daycare: null })

    if (partner_id) {
      await db.from('player_pokemon')
        .where('id', partner_id)
        .update({ slot_daycare: null })
    }
  }

  // ── Distribution des dégâts ──────────────────────────────────────────────

  /**
   * Distribue les dégâts infligés pendant une bataille entre tous les slots actifs.
   * Retourne les slots ayant atteint leur seuil (prêts à éclore).
   */
  async distributeDamage(player_id: string, damage_dealt: number): Promise<ReadySlot[]> {
    if (damage_dealt <= 0) return []

    // Appliquer le multiplicateur prestige de pension
    try {
      const player_row = await db.from('players').where('id', player_id).select('prestige_daycare_mult').first()
      if (player_row?.prestige_daycare_mult) {
        damage_dealt = applyPrestigeDaycareMult(damage_dealt, Number(player_row.prestige_daycare_mult))
      }
    } catch { /* ignore */ }

    // Charger les slots actifs
    const active_slots = await db
      .from('daycare_slots')
      .where('player_id', player_id)
      .whereNotNull('player_pokemon_id')
      .select('id', 'slot_number', 'player_pokemon_id', 'damage_accumulated')

    if (active_slots.length === 0) return []

    const damage_per_slot = Math.floor(damage_dealt / active_slots.length)
    if (damage_per_slot <= 0) return []

    // Charger les raretés pour identifier les seuils
    const poke_ids = active_slots.map((s: any) => s.player_pokemon_id)
    const species_map = await this.getSpeciesRarityMap(poke_ids)

    const newly_ready: ReadySlot[] = []

    for (const slot of active_slots) {
      const rarity = species_map.get(slot.player_pokemon_id) ?? 'common'
      const threshold = HATCH_THRESHOLDS[rarity as PokemonRarity] ?? HATCH_THRESHOLDS.common
      const old_damage = Number(slot.damage_accumulated)
      const new_damage = old_damage + damage_per_slot

      // Ne pas dépasser le seuil × 2 (éviter surstock)
      const capped = Math.min(new_damage, threshold * 2)

      await db.from('daycare_slots')
        .where('id', slot.id)
        .update({ damage_accumulated: capped })

      // Vérifier si nouvellement prêt (était sous le seuil, maintenant dessus)
      if (old_damage < threshold && capped >= threshold) {
        const pokemon = await PlayerPokemon.query()
          .where('id', slot.player_pokemon_id)
          .preload('species')
          .first()
        newly_ready.push({
          slot_number: slot.slot_number,
          pokemon_name_fr: pokemon?.nickname ?? pokemon?.species?.nameFr ?? 'Pokémon',
        })
      }
    }

    return newly_ready
  }

  /**
   * Retourne tous les slots d'un joueur qui ont atteint le seuil d'éclosion.
   */
  async getReadySlots(player_id: string): Promise<ReadySlot[]> {
    const slots = await db
      .from('daycare_slots')
      .where('player_id', player_id)
      .whereNotNull('player_pokemon_id')
      .select('slot_number', 'player_pokemon_id', 'damage_accumulated')

    const poke_ids = slots.map((s: any) => s.player_pokemon_id)
    if (poke_ids.length === 0) return []

    const species_map = await this.getSpeciesRarityMap(poke_ids)

    const ready: ReadySlot[] = []
    for (const slot of slots) {
      const rarity = species_map.get(slot.player_pokemon_id) ?? 'common'
      const threshold = HATCH_THRESHOLDS[rarity as PokemonRarity] ?? HATCH_THRESHOLDS.common
      if (Number(slot.damage_accumulated) >= threshold) {
        const pokemon = await PlayerPokemon.query()
          .where('id', slot.player_pokemon_id)
          .preload('species')
          .first()
        ready.push({
          slot_number: slot.slot_number,
          pokemon_name_fr: pokemon?.nickname ?? pokemon?.species?.nameFr ?? 'Pokémon',
        })
      }
    }
    return ready
  }

  // ── Éclosion ─────────────────────────────────────────────────────────────

  async hatchEgg(player_id: string, slot_number: number): Promise<HatchResult> {
    const slot = await DaycareSlot.query()
      .where('player_id', player_id)
      .where('slot_number', slot_number)
      .firstOrFail()

    if (!slot.playerPokemonId) {
      throw new Error(`Le slot ${slot_number} est vide`)
    }

    // Charger le Pokémon principal + espèce
    const pokemon = await PlayerPokemon.query()
      .where('id', slot.playerPokemonId)
      .preload('species')
      .firstOrFail()

    const species = pokemon.species
    const rarity = species.rarity as PokemonRarity
    const threshold = HATCH_THRESHOLDS[rarity] ?? HATCH_THRESHOLDS.common

    if (Number(slot.damageAccumulated) < threshold) {
      throw new Error(`Le seuil d'éclosion n'est pas encore atteint (${slot.damageAccumulated}/${threshold})`)
    }

    // Charger le partenaire si dressage
    let partner: PlayerPokemon | null = null
    if (slot.partnerPokemonId) {
      partner = await PlayerPokemon.query()
        .where('id', slot.partnerPokemonId)
        .preload('species')
        .firstOrFail()
    }

    // ── 1. Calculer les IVs ─────────────────────────────────────────────
    let child_ivs: IVSet
    if (partner) {
      const p1_ivs: IVSet = {
        hp: pokemon.ivHp ?? 0,
        atk: pokemon.ivAtk ?? 0,
        def: pokemon.ivDef ?? 0,
        spatk: pokemon.ivSpatk ?? 0,
        spdef: pokemon.ivSpdef ?? 0,
        speed: pokemon.ivSpeed ?? 0,
      }
      const p2_ivs: IVSet = {
        hp: partner.ivHp ?? 0,
        atk: partner.ivAtk ?? 0,
        def: partner.ivDef ?? 0,
        spatk: partner.ivSpatk ?? 0,
        spdef: partner.ivSpdef ?? 0,
        speed: partner.ivSpeed ?? 0,
      }
      child_ivs = calcBreedingIVs(p1_ivs, p2_ivs)
    } else {
      child_ivs = {
        hp: randomIV(),
        atk: randomIV(),
        def: randomIV(),
        spatk: randomIV(),
        spdef: randomIV(),
        speed: randomIV(),
      }
    }

    // ── 2. Talent Caché : 0.5% ──────────────────────────────────────────
    let hidden_talent_move_id: number | null = null
    let hidden_talent_move_data: HatchResult['hidden_talent_move'] | undefined

    if (Math.random() < 0.005) {
      const talent_moves = await db
        .from('pokemon_learnset')
        .where('species_id', species.id)
        .where('learn_method', 'hidden_talent')
        .join('moves', 'moves.id', 'pokemon_learnset.move_id')
        .select('moves.id', 'moves.name_fr', 'moves.type', 'moves.category', 'moves.power')
        .limit(10)

      if (talent_moves.length > 0) {
        const chosen = talent_moves[Math.floor(Math.random() * talent_moves.length)]
        hidden_talent_move_id = chosen.id
        hidden_talent_move_data = {
          id: chosen.id,
          name_fr: chosen.name_fr,
          type: chosen.type,
          category: chosen.category,
          power: chosen.power,
        }
      }
    }

    // ── 3. Shiny à 5★ : 1/200 (avec shiny_boost event éventuel) ─────────
    let shiny_threshold = 1 / 200
    try {
      const { default: eventService } = await import('#services/EventService')
      const { calcShinyRate } = await import('#services/EventService')
      const shiny_config = await eventService.getActiveEventConfig('shiny_boost')
      if (shiny_config) {
        // En pension le taux de base est 1/200, on applique le même multiplicateur
        shiny_threshold = (1 / 200) * (shiny_config.multiplier ?? 1)
      }
    } catch { /* ignore */ }
    const is_shiny = pokemon.stars >= 5 ? Math.random() < shiny_threshold : false

    // ── 4. Incrémenter les stars du parent (max 5) ──────────────────────
    const new_stars = Math.min(5, pokemon.stars + 1)
    await db.from('player_pokemon').where('id', pokemon.id).update({ stars: new_stars })

    // ── 5. Créer le bébé ─────────────────────────────────────────────────
    const baby_id = crypto.randomUUID()
    await db.table('player_pokemon').insert({
      id: baby_id,
      player_id,
      species_id: species.id,
      nickname: null,
      level: 1,
      is_shiny,
      stars: 0,
      nature: randomNature(),
      iv_hp: child_ivs.hp,
      iv_atk: child_ivs.atk,
      iv_def: child_ivs.def,
      iv_spatk: child_ivs.spatk,
      iv_spdef: child_ivs.spdef,
      iv_speed: child_ivs.speed,
      equipped_item_id: null,
      slot_team: null,
      slot_daycare: null,
      hidden_talent_move_id,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // ── 6. Mise à jour Pokédex (bébé issu de l'éclosion) ────────────────
    const baby_iv_total = child_ivs.hp + child_ivs.atk + child_ivs.def + child_ivs.spatk + child_ivs.spdef + child_ivs.speed
    pokedexService.updateEntry({
      player_id,
      species_id: species.id,
      iv_total: baby_iv_total,
      is_shiny,
      is_hatched: true,
    }).catch(() => {})

    // ── 7. Auto-collect ou libération du slot ────────────────────────────
    const auto_collect = await hasUpgrade(player_id, 'auto_collect')
    let auto_restarted = false

    if (auto_collect) {
      // Redéposer automatiquement le même Pokémon (reset dégâts)
      await db.from('daycare_slots').where('id', slot.id).update({
        damage_accumulated: 0,
        started_at: new Date(),
        // Conserver player_pokemon_id et partner_pokemon_id
      })
      auto_restarted = true
    } else {
      // Vider le slot
      await db.from('daycare_slots').where('id', slot.id).update({
        player_pokemon_id: null,
        partner_pokemon_id: null,
        damage_accumulated: 0,
        started_at: null,
      })
      await db.from('player_pokemon').where('id', pokemon.id).update({ slot_daycare: null })
      if (partner) {
        await db.from('player_pokemon').where('id', partner.id).update({ slot_daycare: null })
      }

      // Traiter la file d'attente si active
      const queue_active = await hasUpgrade(player_id, 'daycare_queue')
      if (queue_active) {
        // Import dynamique pour éviter dépendance circulaire
        const { default: DaycareQueueService } = await import('#services/DaycareQueueService')
        await DaycareQueueService.processQueue(player_id, slot_number)
      }
    }

    return {
      original_pokemon_id: pokemon.id,
      new_pokemon_id: baby_id,
      new_pokemon_name_fr: species.nameFr,
      new_pokemon_rarity: rarity,
      new_pokemon_species_id: species.id,
      stars_gained: 1,
      is_shiny,
      has_hidden_talent: !!hidden_talent_move_id,
      hidden_talent_move: hidden_talent_move_data,
      auto_restarted,
      slot_number,
    }
  }

  // ── Pokémon compatibles pour dressage ────────────────────────────────────

  async getCompatiblePokemon(player_id: string, pokemon_id: string): Promise<PlayerPokemon[]> {
    const target = await PlayerPokemon.query()
      .where('id', pokemon_id)
      .where('player_id', player_id)
      .preload('species')
      .firstOrFail()

    const candidates = await PlayerPokemon.query()
      .where('player_id', player_id)
      .where('level', 100)
      .whereNull('slot_team')
      .whereNull('slot_daycare')
      .where('id', '!=', pokemon_id)
      .preload('species')

    return candidates.filter((c) => areBreedingCompatible(target.species, c.species))
  }

  // ── Damage offline ──────────────────────────────────────────────────────

  /**
   * Distribue les dégâts offline accumulés pendant l'absence.
   * Déclenche les éclosions auto si auto_collect est actif.
   * Retourne le nombre d'éclosions effectuées.
   */
  async applyOfflineDamage(player_id: string, total_damage: number): Promise<number> {
    if (total_damage <= 0) return 0

    const newly_ready = await this.distributeDamage(player_id, total_damage)
    if (newly_ready.length === 0) return 0

    const auto_collect = await hasUpgrade(player_id, 'auto_collect')
    if (!auto_collect) return newly_ready.length

    // Auto-hatch chaque slot prêt
    let hatched = 0
    for (const slot of newly_ready) {
      try {
        await this.hatchEgg(player_id, slot.slot_number)
        hatched++
      } catch {
        // Slot non prêt ou erreur → ignorer
      }
    }
    return hatched
  }

  // ── Helpers privés ───────────────────────────────────────────────────────

  private async getSpeciesRarityMap(pokemon_ids: string[]): Promise<Map<string, PokemonRarity>> {
    const result = new Map<string, PokemonRarity>()
    if (pokemon_ids.length === 0) return result

    const rows = await db
      .from('player_pokemon')
      .join('pokemon_species', 'pokemon_species.id', 'player_pokemon.species_id')
      .whereIn('player_pokemon.id', pokemon_ids)
      .select('player_pokemon.id as pp_id', 'pokemon_species.rarity')

    for (const row of rows) {
      result.set(row.pp_id, row.rarity as PokemonRarity)
    }
    return result
  }
}

// Singleton
const daycareService = new DaycareService()
export default daycareService
