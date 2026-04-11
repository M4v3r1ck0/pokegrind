import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Player from '#models/player'

export default class BfLeaderboard extends BaseModel {
  static table = 'bf_leaderboard'
  static primaryKey = 'rotation_id'

  @column({ isPrimary: true })
  declare rotationId: string

  @column({ isPrimary: true })
  declare playerId: string

  @column()
  declare score: number

  @column()
  declare rank: number | null

  @column.dateTime()
  declare updatedAt: DateTime

  @belongsTo(() => Player, { foreignKey: 'playerId' })
  declare player: BelongsTo<typeof Player>
}
