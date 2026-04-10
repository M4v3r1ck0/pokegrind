import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface DropItem {
  item_name_fr: string
  quantity: number
}

export default class OfflineReport extends BaseModel {
  static table = 'offline_reports'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerId: string

  @column()
  declare goldEarned: number

  @column()
  declare xpEarned: number

  @column()
  declare kills: number

  @column()
  declare hatches: number

  @column()
  declare dropsJson: DropItem[]

  @column()
  declare absenceSeconds: number

  @column()
  declare floorFarmed: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
