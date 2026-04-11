import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import MoveEffect from '#models/move_effect'

export default class Move extends BaseModel {
  static table = 'moves'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare nameEn: string

  @column()
  declare type: string

  @column()
  declare category: 'physical' | 'special' | 'status'

  @column()
  declare power: number | null

  @column()
  declare accuracy: number | null

  @column()
  declare pp: number | null

  @column()
  declare priority: number

  @column()
  declare effectId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => MoveEffect, {
    foreignKey: 'effectId',
  })
  declare effect: BelongsTo<typeof MoveEffect>
}
