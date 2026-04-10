import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type Player from '#models/player'
import type PlayerPokemon from '#models/player_pokemon'

export default class DaycareSlot extends BaseModel {
  static table = 'daycare_slots'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerId: string

  @column()
  declare slotNumber: number

  @column()
  declare playerPokemonId: string | null

  @column()
  declare partnerPokemonId: string | null

  @column()
  declare damageAccumulated: number

  @column.dateTime()
  declare startedAt: DateTime | null

  @belongsTo(
    () => import('#models/player').then((m) => m.default) as unknown as typeof Player,
    { foreignKey: 'playerId' }
  )
  declare player: BelongsTo<typeof Player>

  @belongsTo(
    () => import('#models/player_pokemon').then((m) => m.default) as unknown as typeof PlayerPokemon,
    { foreignKey: 'playerPokemonId' }
  )
  declare pokemon: BelongsTo<typeof PlayerPokemon>

  @belongsTo(
    () => import('#models/player_pokemon').then((m) => m.default) as unknown as typeof PlayerPokemon,
    { foreignKey: 'partnerPokemonId' }
  )
  declare partner: BelongsTo<typeof PlayerPokemon>
}
