import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daycare_queue'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table.integer('position').notNullable()
      table
        .uuid('pokemon_id')
        .notNullable()
        .references('id')
        .inTable('player_pokemon')
        .onDelete('CASCADE')
      table
        .uuid('partner_id')
        .nullable()
        .references('id')
        .inTable('player_pokemon')
        .onDelete('SET NULL')
      table.integer('target_slot').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.index(['player_id', 'position'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
