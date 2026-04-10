import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ShopUpgrade from '#models/shop_upgrade'

export default class PlayerUpgrade extends BaseModel {
  static table = 'player_upgrades'

  @column({ isPrimary: true })
  declare playerId: string

  @column({ isPrimary: true })
  declare upgradeId: number

  @column.dateTime({ autoCreate: true })
  declare purchasedAt: DateTime

  @belongsTo(() => ShopUpgrade, { foreignKey: 'upgradeId' })
  declare upgrade: BelongsTo<typeof ShopUpgrade>
}
