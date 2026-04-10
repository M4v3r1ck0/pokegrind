import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type Player from '#models/player'
import type PokemonSpecies from '#models/pokemon_species'
import type PlayerPokemonMove from '#models/player_pokemon_move'
import type { Nature } from '@pokegrind/shared'

export default class PlayerPokemon extends BaseModel {
  static table = 'player_pokemon'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerId: string

  @column()
  declare speciesId: number

  @column()
  declare nickname: string | null

  @column()
  declare level: number

  @column()
  declare isShiny: boolean

  @column()
  declare stars: number

  @column()
  declare nature: Nature

  @column()
  declare ivHp: number | null

  @column()
  declare ivAtk: number | null

  @column()
  declare ivDef: number | null

  @column()
  declare ivSpatk: number | null

  @column()
  declare ivSpdef: number | null

  @column()
  declare ivSpeed: number | null

  @column()
  declare equippedItemId: number | null

  @column()
  declare slotTeam: number | null

  @column()
  declare slotDaycare: number | null

  @column()
  declare hiddenTalentMoveId: number | null

  @column()
  declare natureMintOverride: Nature | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => import('#models/player').then((m) => m.default) as unknown as typeof Player, {
    foreignKey: 'playerId',
  })
  declare player: BelongsTo<typeof Player>

  @belongsTo(() => import('#models/pokemon_species').then((m) => m.default) as unknown as typeof PokemonSpecies, {
    foreignKey: 'speciesId',
  })
  declare species: BelongsTo<typeof PokemonSpecies>

  @hasMany(() => import('#models/player_pokemon_move').then((m) => m.default) as unknown as typeof PlayerPokemonMove, {
    foreignKey: 'playerPokemonId',
  })
  declare moves: HasMany<typeof PlayerPokemonMove>
}
