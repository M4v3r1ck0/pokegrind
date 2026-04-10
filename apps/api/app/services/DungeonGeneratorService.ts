/**
 * DungeonGeneratorService — Fonctions pures pour les Donjons Ancestraux.
 * Pas de dépendances AdonisJS — importable dans les tests unitaires.
 */

import { createSeededRng } from '#services/TowerGeneratorService'

// ─── Types exportés ───────────────────────────────────────────────────────────

export interface DungeonModifierEffect {
  all_speed_mult?: number
  all_atk_mult?: number
  all_def_mult?: number
  all_hp_mult?: number
  pp_reduction?: number
  poison_on_start?: boolean
  crit_rate_mult?: number
  type_boost?: string
  mult?: number
  enemy_boost?: boolean
  random_type_blocked?: boolean
  accuracy_mult?: number
  flying_grounded?: boolean
  blocked_type?: string
}

export interface DungeonModifier {
  id: number
  name_fr: string
  description_fr: string
  modifier_type: 'buff' | 'debuff' | 'neutral'
  effect_json: DungeonModifierEffect
}

export interface RoomLayout {
  room_number: number
  type: 'combat' | 'elite' | 'rest' | 'treasure' | 'shop' | 'trap' | 'boss'
  completed: boolean
  result?: 'victory' | 'defeat' | 'completed' | 'skipped'
  gold_earned?: number
  item_found?: object | null
}

export interface DungeonPokemonSnapshot {
  player_pokemon_id: string
  species_id: number
  name_fr: string
  level: number
  current_hp: number
  max_hp: number
  sprite_url: string
  is_shiny: boolean
  nature: string
  ivs: { hp: number; atk: number; def: number; spatk: number; spdef: number; speed: number }
  base_hp: number
  base_atk: number
  base_def: number
  base_spatk: number
  base_spdef: number
  base_speed: number
  type1: string
  type2: string | null
  moves: Array<{
    id: number
    name_fr: string
    type: string
    category: string
    power: number | null
    accuracy: number | null
    pp: number
    pp_remaining: number
    priority: number
    effect: object | null
  }>
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROOM_WEIGHTS: Record<string, number> = {
  combat:   50,
  elite:    15,
  rest:     15,
  treasure: 10,
  shop:      5,
  trap:      5,
}

// ─── Fonctions pures ─────────────────────────────────────────────────────────

/**
 * Hash simple d'une chaîne → entier positif.
 */
export function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

/**
 * Numéro de semaine courant (depuis l'epoch Unix).
 */
export function currentWeekNumber(): number {
  return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
}

/**
 * Sélection pondérée à partir d'un objet {clé → poids}.
 */
export function weightedRandom(weights: Record<string, number>, rng: () => number): string {
  const total = Object.values(weights).reduce((s, w) => s + w, 0)
  let r = rng() * total
  for (const [key, w] of Object.entries(weights)) {
    r -= w
    if (r <= 0) return key
  }
  return Object.keys(weights)[0]
}

/**
 * Génère le layout des 10 salles pour un run donné.
 * Semi-déterministe : propre à chaque joueur (player_id + semaine + donjon).
 * Salle 1 = combat, Salle 10 = boss, salles 2-9 = pondérées.
 */
export function generateRoomLayout(
  dungeon_id: number,
  player_id: string,
  week: number
): RoomLayout[] {
  const seed = dungeon_id * 10000 + hashString(player_id) + week
  const rng  = createSeededRng(seed)

  const rooms: RoomLayout[] = []

  rooms.push({ room_number: 1, type: 'combat', completed: false })

  for (let i = 2; i <= 9; i++) {
    const type = weightedRandom(ROOM_WEIGHTS, rng) as RoomLayout['type']
    rooms.push({ room_number: i, type, completed: false })
  }

  rooms.push({ room_number: 10, type: 'boss', completed: false })

  return rooms
}

/**
 * Calcule le nombre de modificateurs à tirer selon la difficulté.
 */
export function modifierCountForDifficulty(difficulty: string): number {
  if (difficulty === 'legendary') return 3
  if (difficulty === 'hard') return 2
  return 1
}

/**
 * Applique les modificateurs de donjon à une copie du snapshot de l'équipe.
 * Retourne un nouveau tableau (ne mute pas l'original).
 */
export function applyDungeonModifiers(
  team: DungeonPokemonSnapshot[],
  modifiers: DungeonModifier[]
): DungeonPokemonSnapshot[] {
  return team.map((poke) => {
    const p = { ...poke, moves: poke.moves.map((m) => ({ ...m })) }

    for (const mod of modifiers) {
      const e = mod.effect_json

      if (e.all_speed_mult !== undefined) {
        p.base_speed = Math.max(1, Math.floor(p.base_speed * e.all_speed_mult))
      }
      if (e.all_atk_mult !== undefined) {
        p.base_atk   = Math.max(1, Math.floor(p.base_atk   * e.all_atk_mult))
        p.base_spatk = Math.max(1, Math.floor(p.base_spatk * e.all_atk_mult))
      }
      if (e.all_def_mult !== undefined) {
        p.base_def   = Math.max(1, Math.floor(p.base_def   * e.all_def_mult))
        p.base_spdef = Math.max(1, Math.floor(p.base_spdef * e.all_def_mult))
      }
      if (e.all_hp_mult !== undefined) {
        p.max_hp     = Math.max(1, Math.floor(p.max_hp * e.all_hp_mult))
        p.current_hp = Math.min(p.current_hp, p.max_hp)
      }
      if (e.pp_reduction !== undefined) {
        p.moves = p.moves.map((m) => ({
          ...m,
          pp_remaining: Math.max(1, Math.floor(m.pp_remaining * e.pp_reduction!)),
        }))
      }
    }

    return p
  })
}

/**
 * Calcule les HP restaurés par la salle de repos (30% du max, sans dépasser le max).
 */
export function calcRestHealing(team: DungeonPokemonSnapshot[]): Record<string, number> {
  const healed: Record<string, number> = {}
  for (const poke of team) {
    if (poke.current_hp <= 0) continue
    const restore = Math.floor(poke.max_hp * 0.30)
    const actual  = Math.min(restore, poke.max_hp - poke.current_hp)
    healed[poke.player_pokemon_id] = actual
  }
  return healed
}

/**
 * Tire un item aléatoire du pool de récompenses du donjon.
 */
export function drawRandomReward(pool: object[], rng: () => number): object | null {
  if (pool.length === 0) return null
  const total = pool.reduce((s: number, r: any) => s + (r.weight ?? 1), 0)
  let rand = rng() * total
  for (const reward of pool as any[]) {
    rand -= (reward.weight ?? 1)
    if (rand <= 0) return reward
  }
  return pool[0] as object
}
