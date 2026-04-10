import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class PlayerFloorProgress extends BaseModel {
  static table = 'player_floor_progress'

  // Composite PK — Lucid ne supporte pas nativement, on utilise query() pour lookups
  @column()
  declare playerId: string

  @column()
  declare floorNumber: number

  @column.dateTime()
  declare bossDefeatedAt: DateTime | null

  @column()
  declare gemsClaimed: boolean
}
