import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class BfBattle extends BaseModel {
  static table = 'bf_battles'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare sessionId: string

  @column()
  declare battleNumber: number

  @column()
  declare opponentSnapshot: Record<string, unknown>[]

  @column()
  declare result: 'win' | 'loss'

  @column()
  declare durationSeconds: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
