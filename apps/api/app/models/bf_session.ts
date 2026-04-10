import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type BfRotation from '#models/bf_rotation'
import type BfBattle from '#models/bf_battle'

export default class BfSession extends BaseModel {
  static table = 'bf_sessions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerId: string

  @column()
  declare rotationId: string

  @column()
  declare mode: 'tower' | 'factory' | 'arena'

  @column()
  declare currentStreak: number

  @column()
  declare bestStreak: number

  @column()
  declare frontierPointsEarned: number

  @column()
  declare status: 'active' | 'completed' | 'abandoned'

  @column()
  declare teamSnapshot: Record<string, unknown>

  @column()
  declare factoryPool: Record<string, unknown>[] | null

  @column.dateTime({ autoCreate: true })
  declare startedAt: DateTime

  @column.dateTime()
  declare endedAt: DateTime | null

  @belongsTo(
    () => import('#models/bf_rotation').then(m => m.default) as unknown as typeof BfRotation,
    { foreignKey: 'rotationId' }
  )
  declare rotation: BelongsTo<typeof BfRotation>

  @hasMany(
    () => import('#models/bf_battle').then(m => m.default) as unknown as typeof BfBattle,
    { foreignKey: 'sessionId' }
  )
  declare battles: HasMany<typeof BfBattle>
}
