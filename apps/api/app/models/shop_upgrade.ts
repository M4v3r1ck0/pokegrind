import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ShopUpgrade extends BaseModel {
  static table = 'shop_upgrades'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare category: string

  @column()
  declare nameFr: string

  @column()
  declare descriptionFr: string | null

  @column()
  declare costGems: number

  @column()
  declare effectType: string

  @column()
  declare effectValue: Record<string, unknown>

  @column()
  declare requiresUpgradeId: number | null
}
