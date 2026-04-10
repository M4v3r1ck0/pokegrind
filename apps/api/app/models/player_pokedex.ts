import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class PlayerPokedex extends BaseModel {
  static table = 'player_pokedex'

  @column({ isPrimary: true })
  declare playerId: string

  @column({ isPrimary: true })
  declare speciesId: number

  @column.dateTime({ autoCreate: true })
  declare firstObtainedAt: DateTime

  @column()
  declare totalObtained: number

  @column()
  declare bestIvTotal: number

  @column()
  declare totalHatched: number

  @column()
  declare hasShiny: boolean
}
