import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface BossTeamEntry {
  species_id: number
  level: number
  moves: number[]
}

export default class Floor extends BaseModel {
  static table = 'floors'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare floorNumber: number

  @column()
  declare region: string

  @column()
  declare nameFr: string

  @column()
  declare minLevel: number

  @column()
  declare maxLevel: number

  @column()
  declare goldBase: number

  @column()
  declare xpBase: number

  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare enemyTypes: string[]

  @column()
  declare bossTrainerName: string | null

  @column({
    prepare: (value) => JSON.stringify(value),
    consume: (value) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare bossTeam: BossTeamEntry[] | null

  @column()
  declare isMilestone: boolean

  @column()
  declare unlockFloor: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
