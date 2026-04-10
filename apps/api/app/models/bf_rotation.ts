import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type BfSession from '#models/bf_session'

export default class BfRotation extends BaseModel {
  static table = 'bf_rotations'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare mode: 'tower' | 'factory' | 'arena'

  @column()
  declare nameFr: string | null

  @column()
  declare descriptionFr: string | null

  @column()
  declare challengeType: string

  @column()
  declare tierRestriction: string[] | null

  @column()
  declare rulesJson: Record<string, unknown>

  @column()
  declare rewardCosmeticId: number | null

  @column.dateTime()
  declare startAt: DateTime

  @column.dateTime()
  declare endAt: DateTime

  @hasMany(
    () => import('#models/bf_session').then(m => m.default) as unknown as typeof BfSession,
    { foreignKey: 'rotationId' }
  )
  declare sessions: HasMany<typeof BfSession>
}
