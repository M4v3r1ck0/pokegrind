import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface ProfileMove {
  slot: number
  move_id: number
}

export default class PokemonMovesetProfile extends BaseModel {
  static table = 'pokemon_moveset_profiles'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerPokemonId: string

  @column()
  declare profileSlot: number

  @column()
  declare nameFr: string

  @column()
  declare movesJson: ProfileMove[]
}
