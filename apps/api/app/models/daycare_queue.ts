import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class DaycareQueue extends BaseModel {
  static table = 'daycare_queue'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerId: string

  @column()
  declare position: number

  @column()
  declare pokemonId: string

  @column()
  declare partnerId: string | null

  @column()
  declare targetSlot: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
