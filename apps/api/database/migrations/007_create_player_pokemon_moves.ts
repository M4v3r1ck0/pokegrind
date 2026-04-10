import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_pokemon_moves'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_pokemon_id')
        .notNullable()
        .references('id')
        .inTable('player_pokemon')
        .onDelete('CASCADE')
      table.integer('slot').notNullable().checkBetween([1, 5], 'chk_move_slot_range')
      table.integer('move_id').notNullable().references('id').inTable('moves')
      table.integer('pp_current').notNullable()
      table.integer('pp_max').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
