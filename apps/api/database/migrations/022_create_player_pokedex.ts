import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_pokedex'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table
        .integer('species_id')
        .notNullable()
        .references('id')
        .inTable('pokemon_species')
        .onDelete('CASCADE')
      table.timestamp('first_obtained_at', { useTz: false }).defaultTo(this.now())
      table.integer('total_obtained').defaultTo(1)
      table.integer('best_iv_total').defaultTo(0)
      table.integer('total_hatched').defaultTo(0)
      table.boolean('has_shiny').defaultTo(false)
      table.primary(['player_id', 'species_id'])
    })

    this.schema.raw(
      'CREATE INDEX idx_player_pokedex_player ON player_pokedex(player_id)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
