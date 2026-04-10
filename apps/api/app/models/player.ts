import { DateTime } from 'luxon'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { compose } from '@adonisjs/core/helpers'
import hash from '@adonisjs/core/services/hash'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type PlayerPokemon from '#models/player_pokemon'
import type { PlayerRole } from '@pokegrind/shared'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['email'],
  passwordColumnName: 'passwordHash',
})

export default class Player extends compose(BaseModel, AuthFinder) {
  static table = 'players'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare username: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare passwordHash: string | null

  @column()
  declare discordId: string | null

  @column()
  declare role: PlayerRole

  @column()
  declare gems: number

  @column()
  declare gold: number

  @column()
  declare frontierPoints: number

  @column()
  declare currentFloor: number

  @column()
  declare maxFloorReached: number

  @column()
  declare totalKills: number

  @column()
  declare totalGoldEarned: number

  @column()
  declare pityEpic: number

  @column()
  declare pityLegendary: number

  @column()
  declare totalPulls: number

  @column()
  declare isBanned: boolean

  @column.dateTime()
  declare bannedAt: DateTime | null

  @column()
  declare banReason: string | null

  @column.dateTime()
  declare banUntil: DateTime | null

  @column.dateTime()
  declare lastSeenAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(
    () =>
      import('#models/player_pokemon').then((m) => m.default) as unknown as typeof PlayerPokemon,
    { foreignKey: 'playerId' }
  )
  declare pokemon: HasMany<typeof PlayerPokemon>

  static accessTokens = DbAccessTokensProvider.forModel(Player)
}
