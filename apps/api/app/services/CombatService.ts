/**
 * CombatService — Moteur de combat idle PokeGrind
 * Toute la logique de combat tourne côté serveur. Zero calcul côté client.
 */

import type { Nature, PokemonType, MoveCategory } from '@pokegrind/shared'
import { type EquippedItem, applyItemStatMultipliers, applyItemDamageModifiers, getChoiceLockMove, isContactMove } from './ItemService.js'

export type { EquippedItem }

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatBlock {
  hp: number
  atk: number
  def: number
  spatk: number
  spdef: number
  speed: number
}

export interface StatModifiers {
  atk: number    // -6 à +6
  def: number
  spatk: number
  spdef: number
  speed: number
  evasion: number
  accuracy: number
}

export interface StatusEffect {
  type: 'burn' | 'poison' | 'toxic' | 'paralysis' | 'sleep' | 'freeze'
  actions_remaining: number
  toxic_counter?: number
}

export interface ConfusionEffect {
  actions_remaining: number
}

export interface CombatMove {
  id: number
  name_fr: string
  type: PokemonType
  category: MoveCategory
  power: number | null
  accuracy: number | null
  pp: number
  priority: number
  effect?: {
    effect_type: string | null
    stat_target: string | null
    stat_change: number | null
    target: string | null
    duration_min: number | null
    duration_max: number | null
    chance_percent: number
  } | null
}

export interface CombatPokemon {
  id: string
  species_id: number
  name_fr: string
  level: number
  nature: Nature
  ivs: StatBlock
  type1: PokemonType
  type2: PokemonType | null
  base_hp: number
  base_atk: number
  base_def: number
  base_spatk: number
  base_spdef: number
  base_speed: number
  moves: CombatMove[]
  sprite_url: string
  sprite_shiny_url?: string
  is_shiny: boolean

  // État runtime
  current_hp: number
  max_hp: number
  effective_atk: number
  effective_def: number
  effective_spatk: number
  effective_spdef: number
  effective_speed: number
  status: StatusEffect | null
  confusion: ConfusionEffect | null
  stat_modifiers: StatModifiers
  current_move_index: number
  pp_remaining: number[]
  next_action_at: number

  // Item fields (optional for backward compat)
  equipped_item?: EquippedItem | null
  item_used?: boolean
  choice_locked_move?: number | null
  air_balloon_intact?: boolean
  actions_taken?: number
  item_name_fr?: string

  // Mega Evolution fields (optional)
  is_mega_evolved?: boolean
  mega_name_fr?: string
  current_sprite_url?: string

  // XP (joueurs uniquement)
  experience?: number
}

export interface DamageResult {
  damage: number
  is_critical: boolean
  effectiveness: number
}

export interface StatusActionResult {
  should_skip: boolean
  damage_taken: number
}

// ─── Nature modifiers ───────────────────────────────────────────────────────

type StatKey = keyof Omit<StatBlock, 'hp'>

const NATURE_MODIFIERS: Record<Nature, { boost: StatKey | null; penalty: StatKey | null }> = {
  hardy:   { boost: null,      penalty: null },
  lonely:  { boost: 'atk',    penalty: 'def' },
  brave:   { boost: 'atk',    penalty: 'speed' },
  adamant: { boost: 'atk',    penalty: 'spatk' },
  naughty: { boost: 'atk',    penalty: 'spdef' },
  bold:    { boost: 'def',    penalty: 'atk' },
  docile:  { boost: null,      penalty: null },
  relaxed: { boost: 'def',    penalty: 'speed' },
  impish:  { boost: 'def',    penalty: 'spatk' },
  lax:     { boost: 'def',    penalty: 'spdef' },
  timid:   { boost: 'speed',  penalty: 'atk' },
  hasty:   { boost: 'speed',  penalty: 'def' },
  serious: { boost: null,      penalty: null },
  jolly:   { boost: 'speed',  penalty: 'spatk' },
  naive:   { boost: 'speed',  penalty: 'spdef' },
  modest:  { boost: 'spatk',  penalty: 'atk' },
  mild:    { boost: 'spatk',  penalty: 'def' },
  quiet:   { boost: 'spatk',  penalty: 'speed' },
  bashful: { boost: null,      penalty: null },
  rash:    { boost: 'spatk',  penalty: 'spdef' },
  calm:    { boost: 'spdef',  penalty: 'atk' },
  gentle:  { boost: 'spdef',  penalty: 'def' },
  sassy:   { boost: 'spdef',  penalty: 'speed' },
  careful: { boost: 'spdef',  penalty: 'spatk' },
  quirky:  { boost: null,      penalty: null },
}

// ─── Formules de stats (Gen 3+) ─────────────────────────────────────────────

/**
 * Calcule les HP max officiels (Gen 3+)
 * HP = floor((2×base + iv) × level / 100) + level + 10
 */
export function calcHP(base: number, iv: number, level: number): number {
  return Math.floor(((2 * base + iv) * level) / 100) + level + 10
}

/**
 * Calcule une stat autre que HP
 * Stat = floor((floor((2×base + iv) × level / 100) + 5) × nature_modifier)
 */
export function calcStat(
  base: number,
  iv: number,
  level: number,
  nature_modifier: number
): number {
  return Math.floor((Math.floor(((2 * base + iv) * level) / 100) + 5) * nature_modifier)
}

export function getNatureModifier(nature: Nature, stat: StatKey): number {
  const mod = NATURE_MODIFIERS[nature]
  if (mod.boost === stat) return 1.1
  if (mod.penalty === stat) return 0.9
  return 1.0
}

// ─── Table d'efficacité de type (18×18) ─────────────────────────────────────

// [attaquant][défenseur] = multiplicateur
// 0 = immunité, 0.5 = peu efficace, 1 = neutre, 2 = super efficace
const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5, fire: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison:   { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground:   { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying:   { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { fire: 0.5, grass: 2, fighting: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost:    { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy:    { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
}

/**
 * Retourne le multiplicateur d'efficacité de type
 * Gère les doubles types (multiplicateurs combinés)
 */
export function getTypeEffectiveness(
  moveType: PokemonType,
  defType1: PokemonType,
  defType2: PokemonType | null
): number {
  const chart = TYPE_CHART[moveType] ?? {}
  const e1 = chart[defType1] ?? 1
  const e2 = defType2 !== null ? (chart[defType2] ?? 1) : 1
  return e1 * e2
}

// ─── Stages de stats ─────────────────────────────────────────────────────────

// Multiplicateurs officiels pour stages -6 à +6
const STAGE_MULTIPLIERS = [0.25, 0.2857, 0.3333, 0.4, 0.5, 0.6667, 1, 1.5, 2, 2.5, 3, 3.5, 4]

function getStageMultiplier(stage: number): number {
  const idx = Math.max(0, Math.min(12, stage + 6))
  return STAGE_MULTIPLIERS[idx]
}

// ─── Calcul des dégâts ───────────────────────────────────────────────────────

/**
 * Formule officielle Gen 3+ :
 * damage = floor((((2×level/5+2) × power × (stat_off / stat_def)) / 50 + 2)
 *           × effectiveness × STAB × crit × random)
 */
export function calcDamage(
  attacker: CombatPokemon,
  defender: CombatPokemon,
  move: CombatMove
): DamageResult {
  if (move.category === 'status') {
    return { damage: 0, is_critical: false, effectiveness: 1 }
  }
  if (!move.power || move.power === 0) {
    return { damage: 0, is_critical: false, effectiveness: 1 }
  }

  const isPhysical = move.category === 'physical'
  const stat_off = isPhysical ? attacker.effective_atk : attacker.effective_spatk
  const stat_def = isPhysical ? defender.effective_def : defender.effective_spdef

  // Appliquer les stages
  const atk_stage = isPhysical ? attacker.stat_modifiers.atk : attacker.stat_modifiers.spatk
  const def_stage = isPhysical ? defender.stat_modifiers.def : defender.stat_modifiers.spdef
  const stat_off_mod = stat_off * getStageMultiplier(atk_stage)
  const stat_def_mod = stat_def * getStageMultiplier(def_stage)

  // Critique : taux de base 1/24, ×2 avec Lentille de Mire
  const crit_rate = attacker.equipped_item?.effect_type === 'scope_lens'
    ? (attacker.equipped_item.effect_value.crit_rate ?? 1 / 12)
    : 1 / 24
  const is_critical = Math.random() < crit_rate
  const crit_mod = is_critical ? 1.5 : 1

  // STAB
  const stab = move.type === attacker.type1 || move.type === attacker.type2 ? 1.5 : 1

  // Efficacité type
  const effectiveness = getTypeEffectiveness(move.type, defender.type1, defender.type2)

  // Random 85-100%
  const random = (85 + Math.floor(Math.random() * 16)) / 100

  const base = ((2 * attacker.level) / 5 + 2) * move.power * (stat_off_mod / stat_def_mod)
  const base_damage = Math.max(1, Math.floor(((base / 50 + 2) * effectiveness * stab * crit_mod * random)))

  // Air Balloon immunity to ground
  if (move.type === 'ground' && defender.air_balloon_intact) {
    return { damage: 0, is_critical: false, effectiveness: 0 }
  }

  const is_contact = isContactMove(move.category, move.type)
  const defender_hp_ratio = defender.max_hp > 0 ? defender.current_hp / defender.max_hp : 0

  const damage = applyItemDamageModifiers(
    base_damage,
    attacker.equipped_item ?? null,
    defender.equipped_item ?? null,
    move.category,
    move.type,
    effectiveness,
    is_critical,
    is_contact,
    defender_hp_ratio,
    defender.air_balloon_intact ?? false
  )

  return { damage: Math.max(move.category !== 'status' ? 1 : 0, damage), is_critical, effectiveness }
}

// ─── Effets de statut ────────────────────────────────────────────────────────

/**
 * Applique les effets de statut avant l'action du Pokémon.
 * Retourne si l'action doit être sautée et les dégâts pris.
 */
export function applyStatusBeforeAction(pokemon: CombatPokemon): StatusActionResult {
  let should_skip = false
  let damage_taken = 0

  // Statut principal
  if (pokemon.status) {
    const s = pokemon.status

    switch (s.type) {
      case 'sleep':
        should_skip = true
        s.actions_remaining -= 1
        if (s.actions_remaining <= 0) pokemon.status = null
        break

      case 'freeze':
        // 25% de chance de dégel à chaque action
        if (Math.random() < 0.25) {
          pokemon.status = null
        } else {
          should_skip = true
        }
        break

      case 'paralysis':
        // 30% de chance de skip
        if (Math.random() < 0.30) {
          should_skip = true
        }
        break

      case 'burn':
        // -10% HP max
        damage_taken = Math.max(1, Math.floor(pokemon.max_hp * 0.1))
        pokemon.current_hp = Math.max(0, pokemon.current_hp - damage_taken)
        break

      case 'poison':
        // -8% HP max
        damage_taken = Math.max(1, Math.floor(pokemon.max_hp * 0.08))
        pokemon.current_hp = Math.max(0, pokemon.current_hp - damage_taken)
        break

      case 'toxic':
        // -(8% × counter) HP max, counter++
        s.toxic_counter = (s.toxic_counter ?? 1)
        damage_taken = Math.max(1, Math.floor(pokemon.max_hp * 0.08 * s.toxic_counter))
        pokemon.current_hp = Math.max(0, pokemon.current_hp - damage_taken)
        s.toxic_counter += 1
        break
    }
  }

  // Confusion (statut secondaire)
  if (!should_skip && pokemon.confusion) {
    const c = pokemon.confusion
    c.actions_remaining -= 1
    if (c.actions_remaining <= 0) {
      pokemon.confusion = null
    } else {
      // 33% de se blesser
      if (Math.random() < 0.33) {
        should_skip = true
        // Dégâts de confusion : 40 puissance, Normal, Physique, sur soi-même
        const self_damage = Math.max(
          1,
          Math.floor(
            (((2 * pokemon.level) / 5 + 2) * 40 * (pokemon.effective_atk / pokemon.effective_def)) /
              50 +
              2
          )
        )
        damage_taken += self_damage
        pokemon.current_hp = Math.max(0, pokemon.current_hp - self_damage)
      }
    }
  }

  return { should_skip, damage_taken }
}

/**
 * Applique un statut principal à un Pokémon.
 * Remplace le statut existant (sauf confusion qui est séparé).
 */
export function applyStatus(
  pokemon: CombatPokemon,
  statusType: StatusEffect['type'],
  durationMin: number,
  durationMax: number
): boolean {
  // Immunités
  if (statusType === 'burn' && (pokemon.type1 === 'fire' || pokemon.type2 === 'fire')) return false
  if (statusType === 'freeze' && (pokemon.type1 === 'ice' || pokemon.type2 === 'ice')) return false
  if (
    (statusType === 'poison' || statusType === 'toxic') &&
    (pokemon.type1 === 'poison' ||
      pokemon.type2 === 'poison' ||
      pokemon.type1 === 'steel' ||
      pokemon.type2 === 'steel')
  )
    return false
  if (
    statusType === 'paralysis' &&
    (pokemon.type1 === 'electric' || pokemon.type2 === 'electric')
  )
    return false

  const duration =
    durationMin + Math.floor(Math.random() * (durationMax - durationMin + 1))
  pokemon.status = { type: statusType, actions_remaining: duration }
  if (statusType === 'toxic') pokemon.status.toxic_counter = 1

  // Paralysie : speed effective ×0.5 (appliqué en runtime sur next_action_at)
  return true
}

/**
 * Applique la confusion à un Pokémon (cumulable avec statut principal).
 */
export function applyConfusion(pokemon: CombatPokemon): void {
  if (!pokemon.confusion) {
    pokemon.confusion = { actions_remaining: 3 + Math.floor(Math.random() * 3) }
  }
}

// ─── Initialisation d'un CombatPokemon ──────────────────────────────────────

export function buildCombatPokemon(params: {
  id: string
  species_id: number
  name_fr: string
  level: number
  nature: Nature
  ivs: StatBlock
  type1: PokemonType
  type2: PokemonType | null
  base_hp: number
  base_atk: number
  base_def: number
  base_spatk: number
  base_spdef: number
  base_speed: number
  moves: CombatMove[]
  sprite_url: string
  sprite_shiny_url?: string
  is_shiny: boolean
  item?: EquippedItem | null
  item_name_fr?: string
}): CombatPokemon {
  const max_hp = calcHP(params.base_hp, params.ivs.hp, params.level)

  // Base stats before item
  const base_stats = {
    hp: max_hp,
    atk: calcStat(params.base_atk, params.ivs.atk, params.level, getNatureModifier(params.nature, 'atk')),
    def: calcStat(params.base_def, params.ivs.def, params.level, getNatureModifier(params.nature, 'def')),
    spatk: calcStat(params.base_spatk, params.ivs.spatk, params.level, getNatureModifier(params.nature, 'spatk')),
    spdef: calcStat(params.base_spdef, params.ivs.spdef, params.level, getNatureModifier(params.nature, 'spdef')),
    speed: calcStat(params.base_speed, params.ivs.speed, params.level, getNatureModifier(params.nature, 'speed')),
  }

  // Apply item stat multipliers
  const effective_stats = applyItemStatMultipliers(base_stats, params.item ?? null)

  return {
    ...params,
    max_hp,
    current_hp: max_hp,
    effective_atk: effective_stats.atk,
    effective_def: effective_stats.def,
    effective_spatk: effective_stats.spatk,
    effective_spdef: effective_stats.spdef,
    effective_speed: effective_stats.speed,
    status: null,
    confusion: null,
    stat_modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, evasion: 0, accuracy: 0 },
    current_move_index: 0,
    pp_remaining: params.moves.map((m) => m.pp),
    next_action_at: 0,
    equipped_item: params.item ?? null,
    item_used: false,
    choice_locked_move: null,
    air_balloon_intact: params.item?.effect_type === 'air_balloon',
    actions_taken: 0,
    item_name_fr: params.item_name_fr,
  }
}

/**
 * Calcule le délai avant la prochaine action en ms.
 * Formule révisée — cap entre 500ms et 2000ms :
 * - speed=50  → ~1500ms (baseline confortable)
 * - speed=100 → ~750ms  (rapide)
 * - speed=150 → ~500ms  (très rapide, min)
 * - speed=12  → 2000ms  (bas niveau, plafonné)
 * Paralysie : speed effective ÷ 2
 */
export function calcActionDelay(pokemon: CombatPokemon): number {
  let speed = pokemon.effective_speed * getStageMultiplier(pokemon.stat_modifiers.speed)
  if (pokemon.status?.type === 'paralysis') speed *= 0.5
  speed = Math.max(1, speed)
  const raw = Math.round((1500 * 50) / speed)
  return Math.min(1200, Math.max(300, raw))
}

// ─── Sélection du move ───────────────────────────────────────────────────────

/**
 * Move Lutte (struggle) — utilisé quand tous les PP sont épuisés
 */
export const STRUGGLE_MOVE: CombatMove = {
  id: -1,
  name_fr: 'Lutte',
  type: 'normal',
  category: 'physical',
  power: 50,
  accuracy: null,
  pp: 999,
  priority: 0,
  effect: null,
}

/**
 * Sélectionne le prochain move valide pour ce Pokémon.
 * Ordre fixe M1→M2→M3→M4, skip si PP=0.
 * Si tous les PP sont 0 → Lutte.
 */
export function selectNextMove(pokemon: CombatPokemon): { move: CombatMove; index: number } {
  const moveCount = pokemon.moves.length
  if (moveCount === 0) return { move: STRUGGLE_MOVE, index: -1 }

  // Vérifier si tous les PP sont vides → reset rotation (GDD §5)
  const allEmpty = pokemon.pp_remaining.every((pp) => pp <= 0)
  if (allEmpty) {
    // Recharger les PP depuis pp_max (valeur stockée dans moves[i].pp)
    pokemon.pp_remaining = pokemon.moves.map((m) => m.pp)
  }

  // Choice lock: if locked to a move, only use that move
  if (pokemon.choice_locked_move !== null && pokemon.choice_locked_move !== undefined) {
    const locked_idx = pokemon.moves.findIndex(m => m.id === pokemon.choice_locked_move)
    if (locked_idx >= 0 && pokemon.pp_remaining[locked_idx] > 0) {
      return { move: pokemon.moves[locked_idx], index: locked_idx }
    }
    // PP empty on locked move → Struggle
    return { move: STRUGGLE_MOVE, index: -1 }
  }

  // Chercher le prochain move avec PP
  for (let attempts = 0; attempts < moveCount; attempts++) {
    const idx = (pokemon.current_move_index + attempts) % moveCount
    if (pokemon.pp_remaining[idx] > 0) {
      return { move: pokemon.moves[idx], index: idx }
    }
  }

  return { move: STRUGGLE_MOVE, index: -1 }
}

// ─── DPS estimé (pour calcul offline) ───────────────────────────────────────

/**
 * Estimation du DPS moyen d'un Pokémon sur un étage.
 * Utilisé pour le calcul des gains offline.
 */
export function estimatePokemonDPS(
  pokemon: CombatPokemon,
  enemyDefStat: number,
  enemySpdefStat: number
): number {
  if (pokemon.moves.length === 0) return 0

  // Moyenne des dégâts de chaque move
  let totalDps = 0
  let moveCount = 0

  for (let i = 0; i < pokemon.moves.length; i++) {
    const move = pokemon.moves[i]
    if (!move.power || move.category === 'status') continue

    const stat_off = move.category === 'physical' ? pokemon.effective_atk : pokemon.effective_spatk
    const stat_def = move.category === 'physical' ? enemyDefStat : enemySpdefStat
    const stab = move.type === pokemon.type1 || move.type === pokemon.type2 ? 1.5 : 1

    const avg_damage =
      ((((2 * pokemon.level) / 5 + 2) * move.power * (stat_off / stat_def)) / 50 + 2) *
      stab *
      0.925 // avg random 92.5%

    const delay_ms = calcActionDelay(pokemon)
    const actions_per_sec = 1000 / delay_ms

    // DPS = damage par action × actions par seconde
    totalDps += avg_damage * actions_per_sec
    moveCount++
  }

  return moveCount > 0 ? totalDps / moveCount : 0
}
