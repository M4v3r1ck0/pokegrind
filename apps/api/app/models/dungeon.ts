import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Dungeon extends BaseModel {
  static table = 'dungeons'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare region: string

  @column()
  declare descriptionFr: string | null

  @column()
  declare minPrestige: number

  @column()
  declare floorCount: number

  @column()
  declare difficulty: string

  @column()
  declare enemyTypes: string[]

  @column()
  declare bossSpeciesId: number | null

  @column()
  declare bossLevel: number

  @column()
  declare rewardsPool: object

  @column()
  declare spriteUrl: string | null

  @column()
  declare isActive: boolean
}
