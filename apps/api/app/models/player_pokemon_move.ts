import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PlayerPokemon from '#models/player_pokemon'
import Move from '#models/move'

export default class PlayerPokemonMove extends BaseModel {
  static table = 'player_pokemon_moves'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerPokemonId: string

  @column()
  declare slot: number

  @column()
  declare moveId: number

  @column()
  declare ppCurrent: number

  @column()
  declare ppMax: number

  @belongsTo(() => PlayerPokemon, {
    foreignKey: 'playerPokemonId',
  })
  declare playerPokemon: BelongsTo<typeof PlayerPokemon>

  @belongsTo(() => Move, {
    foreignKey: 'moveId',
  })
  declare move: BelongsTo<typeof Move>
}
