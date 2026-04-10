import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class BfShopItem extends BaseModel {
  static table = 'bf_shop_items'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare descriptionFr: string | null

  @column()
  declare costPf: number

  @column()
  declare itemType: 'ct_exclusive' | 'iv_capsule' | 'nature_mint' | 'cosmetic'

  @column()
  declare itemData: Record<string, unknown>

  @column()
  declare stockPerRotation: number | null

  @column()
  declare isActive: boolean
}
