import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type PokemonSpecies from '#models/pokemon_species'
import type Move from '#models/move'

export default class PokemonLearnset extends BaseModel {
  static table = 'pokemon_learnset'
  static primaryKey = 'species_id'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare speciesId: number

  @column({ isPrimary: true })
  declare moveId: number

  @column({ isPrimary: true })
  declare learnMethod: string

  @column()
  declare levelLearnedAt: number | null

  @belongsTo(() => import('#models/pokemon_species').then((m) => m.default) as unknown as typeof PokemonSpecies, {
    foreignKey: 'speciesId',
  })
  declare species: BelongsTo<typeof PokemonSpecies>

  @belongsTo(() => import('#models/move').then((m) => m.default) as unknown as typeof Move, {
    foreignKey: 'moveId',
  })
  declare move: BelongsTo<typeof Move>
}
