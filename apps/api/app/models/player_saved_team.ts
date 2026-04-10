import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface SavedTeamSlot {
  slot: number
  pokemon_id: string
}

export default class PlayerSavedTeam extends BaseModel {
  static table = 'player_saved_teams'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare playerId: string

  @column()
  declare slot: number

  @column()
  declare nameFr: string

  @column()
  declare teamJson: SavedTeamSlot[] | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
