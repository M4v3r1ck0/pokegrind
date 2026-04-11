import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import PokemonSpecies from '#models/pokemon_species'
import Move from '#models/move'

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

  @belongsTo(() => PokemonSpecies, { foreignKey: 'speciesId' })
  declare species: BelongsTo<typeof PokemonSpecies>

  @belongsTo(() => Move, { foreignKey: 'moveId' })
  declare move: BelongsTo<typeof Move>
}
