import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type PlayerPokemon from '#models/player_pokemon'
import type Move from '#models/move'

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

  @belongsTo(() => import('#models/player_pokemon').then((m) => m.default) as unknown as typeof PlayerPokemon, {
    foreignKey: 'playerPokemonId',
  })
  declare playerPokemon: BelongsTo<typeof PlayerPokemon>

  @belongsTo(() => import('#models/move').then((m) => m.default) as unknown as typeof Move, {
    foreignKey: 'moveId',
  })
  declare move: BelongsTo<typeof Move>
}
