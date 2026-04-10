/**
 * ItemService — Pure functions for equippable item effects.
 * No AdonisJS imports — fully testable without framework boot.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EquippedItem {
  id: number
  effect_type: string
  effect_value: Record<string, any>
}

export interface EffectiveStats {
  hp: number
  atk: number
  def: number
  spatk: number
  spdef: number
  speed: number
}

export interface ItemEvent {
  event_type: 'item_used' | 'item_destroyed' | 'item_triggered'
  pokemon_id: string
  item_name_fr: string
  effect: string
}

// Minimal pokemon interface needed for item effects
export interface ItemAwarePokemon {
  id: string
  current_hp: number
  max_hp: number
  status: { type: string } | null
  equipped_item: EquippedItem | null
  item_used: boolean
  air_balloon_intact: boolean
  actions_taken: number
}

// ─── Heuristic contact move types ────────────────────────────────────────────
// Physical moves are generally contact unless the type is listed here
const NON_CONTACT_PHYSICAL_TYPES = new Set(['rock', 'ground'])

export function isContactMove(category: string, move_type: string): boolean {
  return category === 'physical' && !NON_CONTACT_PHYSICAL_TYPES.has(move_type)
}

// ─── Stat multipliers applied at pokemon load time ───────────────────────────

/**
 * Apply item stat multipliers at pokemon load time.
 * Returns a modified stats object. Does not mutate input.
 */
export function applyItemStatMultipliers(stats: EffectiveStats, item: EquippedItem | null): EffectiveStats {
  if (!item) return { ...stats }

  const s = { ...stats }
  const ev = item.effect_value

  switch (item.effect_type) {
    case 'choice_scarf':
      s.speed = Math.floor(s.speed * (ev.speed_mult ?? 1.5))
      break
    case 'choice_band':
      s.atk = Math.floor(s.atk * (ev.atk_mult ?? 1.5))
      break
    case 'choice_specs':
      s.spatk = Math.floor(s.spatk * (ev.spatk_mult ?? 1.5))
      break
    case 'shell_bell':
      s.def = Math.floor(s.def * (ev.def_mult ?? 1.5))
      s.spdef = Math.floor(s.spdef * (ev.spdef_mult ?? 1.5))
      s.speed = Math.floor(s.speed * (ev.speed_mult ?? 0.5))
      break
    case 'miracle_seed':
      s.speed = Math.floor(s.speed * (ev.speed_mult ?? 1.2))
      break
    case 'assault_vest':
      s.atk = Math.floor(s.atk * (ev.atk_mult ?? 1.1))
      s.spatk = Math.floor(s.spatk * (ev.spatk_mult ?? 1.1))
      s.def = Math.floor(s.def * (ev.def_mult ?? 0.9))
      s.spdef = Math.floor(s.spdef * (ev.spdef_mult ?? 0.9))
      break
    case 'bright_powder':
      if (ev.all_stats_mult) {
        s.atk = Math.floor(s.atk * ev.all_stats_mult)
        s.def = Math.floor(s.def * ev.all_stats_mult)
        s.spatk = Math.floor(s.spatk * ev.all_stats_mult)
        s.spdef = Math.floor(s.spdef * ev.all_stats_mult)
        s.speed = Math.floor(s.speed * ev.all_stats_mult)
      }
      break
    // All other items do not modify base stats
    default:
      break
  }

  return s
}

// ─── Damage modifiers applied during calcDamage ──────────────────────────────

/**
 * Apply item damage modifiers.
 * Called after base damage is computed.
 * Returns the modified damage value.
 */
export function applyItemDamageModifiers(
  damage: number,
  attacker_item: EquippedItem | null,
  defender_item: EquippedItem | null,
  move_category: string,
  move_type: string,
  effectiveness: number,
  is_critical: boolean,
  is_contact: boolean,
  defender_hp_ratio: number,
  air_balloon_intact: boolean
): number {
  // Ground immunity from Air Balloon
  if (move_type === 'ground' && air_balloon_intact) {
    return 0
  }

  let d = damage

  // Attacker item bonuses
  if (attacker_item) {
    const ev = attacker_item.effect_value
    switch (attacker_item.effect_type) {
      case 'life_orb':
        d = Math.floor(d * (ev.damage_mult ?? 1.3))
        break
      case 'expert_belt':
        if (effectiveness >= 2) {
          d = Math.floor(d * (ev.super_effective_mult ?? 1.2))
        }
        break
      case 'type_plate':
        if (ev.type === move_type) {
          d = Math.floor(d * (ev.type_boost_mult ?? 1.2))
        }
        break
      case 'hard_claw':
        if (is_contact) {
          d = Math.floor(d * (ev.contact_damage_mult ?? 1.3))
        }
        break
    }
  }

  // Defender item damage reduction
  if (defender_item) {
    const ev = defender_item.effect_value
    switch (defender_item.effect_type) {
      case 'muscle_belt':
        if (is_critical) {
          // Crit damage is ×1.5, reduce that extra by reduce_crit_damage
          // so instead of (base_damage × 1.5), we get base_damage × (1 + 0.5 × (1 - reduce_crit_damage))
          // Simplification: reduce the critical bonus portion
          const ratio = ev.reduce_crit_damage ?? 0.5
          // We already applied crit ×1.5 in calcDamage; adjust here
          // damage = non_crit × 1.5. We want non_crit × (1.5 - 0.5×ratio) = non_crit × (1 + 0.5×(1-ratio))
          const non_crit_estimate = Math.floor(d / 1.5)
          d = Math.floor(non_crit_estimate * (1 + 0.5 * (1 - ratio)))
        }
        break
    }
  }

  return Math.max(0, d)
}

// ─── After-action item effects ────────────────────────────────────────────────

/**
 * Apply after-action item effects (Leftovers heal, Life Orb recoil, Orb triggers).
 * Mutates pokemon. Returns event or null.
 */
export function applyItemAfterAction(pokemon: ItemAwarePokemon & { item_name_fr?: string }): ItemEvent | null {
  const item = pokemon.equipped_item
  if (!item || pokemon.item_used) return null

  const ev = item.effect_value
  pokemon.actions_taken = (pokemon.actions_taken ?? 0) + 1

  switch (item.effect_type) {
    case 'leftovers': {
      const heal = Math.floor(pokemon.max_hp * (ev.heal_ratio ?? 0.0625))
      if (heal > 0 && pokemon.current_hp < pokemon.max_hp) {
        pokemon.current_hp = Math.min(pokemon.max_hp, pokemon.current_hp + heal)
        return {
          event_type: 'item_triggered',
          pokemon_id: pokemon.id,
          item_name_fr: pokemon.item_name_fr ?? 'Restes',
          effect: `+${heal} PV`,
        }
      }
      return null
    }

    case 'life_orb': {
      const recoil = Math.max(1, Math.floor(pokemon.max_hp * (ev.recoil_ratio ?? 0.1)))
      pokemon.current_hp = Math.max(0, pokemon.current_hp - recoil)
      return {
        event_type: 'item_triggered',
        pokemon_id: pokemon.id,
        item_name_fr: pokemon.item_name_fr ?? 'Vie-Orbe',
        effect: `-${recoil} PV (recul)`,
      }
    }

    case 'toxic_orb': {
      const trigger_actions = ev.trigger_actions ?? 3
      if (pokemon.actions_taken >= trigger_actions && !pokemon.status) {
        pokemon.status = { type: 'badly_poisoned' } as any
        pokemon.item_used = true
        return {
          event_type: 'item_triggered',
          pokemon_id: pokemon.id,
          item_name_fr: pokemon.item_name_fr ?? 'Orbe Toxique',
          effect: 'Empoisonnement grave infligé',
        }
      }
      return null
    }

    case 'flame_orb': {
      const trigger_actions = ev.trigger_actions ?? 3
      if (pokemon.actions_taken >= trigger_actions && !pokemon.status) {
        pokemon.status = { type: 'burn' } as any
        pokemon.item_used = true
        return {
          event_type: 'item_triggered',
          pokemon_id: pokemon.id,
          item_name_fr: pokemon.item_name_fr ?? 'Orbe Flamme',
          effect: 'Brûlure infligée',
        }
      }
      return null
    }

    default:
      return null
  }
}

// ─── On-hit received effects ──────────────────────────────────────────────────

/**
 * Apply item effects when a pokemon takes a hit.
 * Mutates pokemon. Returns event or null.
 */
export function applyItemOnHitReceived(
  pokemon: ItemAwarePokemon & { item_name_fr?: string },
  move_type?: string
): ItemEvent | null {
  const item = pokemon.equipped_item
  if (!item || pokemon.item_used) return null

  const ev = item.effect_value
  const hp_ratio = pokemon.max_hp > 0 ? pokemon.current_hp / pokemon.max_hp : 0

  switch (item.effect_type) {
    case 'sitrus_berry': {
      const threshold = ev.hp_threshold ?? 0.5
      if (hp_ratio < threshold) {
        const heal = Math.floor(pokemon.max_hp * (ev.heal_ratio ?? 0.25))
        pokemon.current_hp = Math.min(pokemon.max_hp, pokemon.current_hp + heal)
        pokemon.item_used = true
        return {
          event_type: 'item_used',
          pokemon_id: pokemon.id,
          item_name_fr: pokemon.item_name_fr ?? 'Baie Sitrus',
          effect: `+${heal} PV`,
        }
      }
      return null
    }

    case 'lum_berry': {
      if (pokemon.status) {
        pokemon.status = null
        pokemon.item_used = true
        return {
          event_type: 'item_used',
          pokemon_id: pokemon.id,
          item_name_fr: pokemon.item_name_fr ?? 'Baie Lum',
          effect: 'Statut soigné',
        }
      }
      return null
    }

    case 'air_balloon': {
      // Pop the balloon when hit by any non-ground move
      if (pokemon.air_balloon_intact && move_type !== 'ground') {
        pokemon.air_balloon_intact = false
        return {
          event_type: 'item_destroyed',
          pokemon_id: pokemon.id,
          item_name_fr: pokemon.item_name_fr ?? 'Ballon',
          effect: 'Ballon éclaté !',
        }
      }
      return null
    }

    default:
      return null
  }
}

// ─── Choice lock ─────────────────────────────────────────────────────────────

/**
 * Returns the move ID to lock to if a Choice item is equipped, or null.
 * first_move_used_id: the ID of the first move used this battle.
 */
export function getChoiceLockMove(item: EquippedItem | null, first_move_used_id: number | null): number | null {
  if (!item) return null
  if (!['choice_scarf', 'choice_band', 'choice_specs'].includes(item.effect_type)) return null
  return first_move_used_id
}

// ─── Item drop calculation ────────────────────────────────────────────────────

export interface FloorDropConfig {
  item_id: number
  item_name_fr: string
  drop_rate: number
  qty_min: number
  qty_max: number
}

export interface ItemDrop {
  item_id: number
  item_name_fr: string
  quantity: number
}

/**
 * Calculate item drops for a given number of kills.
 * Pure function — no DB calls.
 */
export function calculateItemDrops(
  floor_drops: FloorDropConfig[],
  kills: number
): ItemDrop[] {
  if (!floor_drops.length || kills <= 0) return []

  const result: ItemDrop[] = []

  for (const config of floor_drops) {
    let total_qty = 0
    for (let k = 0; k < kills; k++) {
      if (Math.random() < config.drop_rate) {
        const qty = config.qty_min === config.qty_max
          ? config.qty_min
          : config.qty_min + Math.floor(Math.random() * (config.qty_max - config.qty_min + 1))
        total_qty += qty
      }
    }
    if (total_qty > 0) {
      result.push({ item_id: config.item_id, item_name_fr: config.item_name_fr, quantity: total_qty })
    }
  }

  return result
}
