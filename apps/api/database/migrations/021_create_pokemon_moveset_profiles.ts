import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pokemon_moveset_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_pokemon_id')
        .notNullable()
        .references('id')
        .inTable('player_pokemon')
        .onDelete('CASCADE')
      table.integer('profile_slot').notNullable().checkBetween([1, 3])
      table.string('name_fr', 32).defaultTo('Profil')
      table.jsonb('moves_json').notNullable()
      table.unique(['player_pokemon_id', 'profile_slot'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
