import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type Move from '#models/move'

export default class MoveEffect extends BaseModel {
  static table = 'move_effects'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare effectType: string | null

  @column()
  declare statTarget: string | null

  @column()
  declare statChange: number | null

  @column()
  declare target: string | null

  @column()
  declare durationMin: number | null

  @column()
  declare durationMax: number | null

  @column()
  declare chancePercent: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @hasMany(() => import('#models/move').then((m) => m.default) as unknown as typeof Move)
  declare moves: HasMany<typeof Move>
}
