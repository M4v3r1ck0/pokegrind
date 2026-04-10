import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import type PokemonLearnset from '#models/pokemon_learnset'

export default class PokemonSpecies extends BaseModel {
  static table = 'pokemon_species'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare nameFr: string

  @column()
  declare nameEn: string

  // Colonnes sans underscore — columnName explicite pour éviter la conversion camelCase→snake_case
  @column({ columnName: 'type1' })
  declare type1: string

  @column({ columnName: 'type2' })
  declare type2: string | null

  @column()
  declare baseHp: number | null

  @column()
  declare baseAtk: number | null

  @column()
  declare baseDef: number | null

  @column()
  declare baseSpatk: number | null

  @column()
  declare baseSpdef: number | null

  @column()
  declare baseSpeed: number | null

  @column()
  declare rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

  @column()
  declare tier: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'

  @column()
  declare generation: number

  @column()
  declare captureRate: number | null

  @column()
  declare eggGroups: string[]

  @column()
  declare evolvesFromId: number | null

  @column()
  declare spriteUrl: string | null

  // DB: sprite_shiny_url — spriteShinUrl serait mappé sprite_shin_url, donc on force le columnName
  @column({ columnName: 'sprite_shiny_url' })
  declare spriteShinyUrl: string | null

  @column()
  declare spriteFallbackUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => PokemonSpecies, { foreignKey: 'evolvesFromId' })
  declare evolvesFrom: BelongsTo<typeof PokemonSpecies>

  @hasMany(
    () =>
      import('#models/pokemon_learnset').then((m) => m.default) as unknown as typeof PokemonLearnset,
    { foreignKey: 'speciesId' }
  )
  declare learnset: HasMany<typeof PokemonLearnset>
}
