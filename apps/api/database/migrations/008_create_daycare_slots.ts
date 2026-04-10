import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'daycare_slots'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table
        .integer('slot_number')
        .notNullable()
        .checkBetween([1, 10], 'chk_daycare_slot_range')
      table
        .uuid('player_pokemon_id')
        .nullable()
        .references('id')
        .inTable('player_pokemon')
        .onDelete('SET NULL')
      table
        .uuid('partner_pokemon_id')
        .nullable()
        .references('id')
        .inTable('player_pokemon')
        .onDelete('SET NULL')
      table.bigInteger('damage_accumulated').defaultTo(0)
      table.timestamp('started_at', { useTz: false }).nullable()
      table.unique(['player_id', 'slot_number'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
