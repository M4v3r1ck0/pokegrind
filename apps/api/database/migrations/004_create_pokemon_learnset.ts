import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pokemon_learnset'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('species_id')
        .notNullable()
        .references('id')
        .inTable('pokemon_species')
        .onDelete('CASCADE')
      table
        .integer('move_id')
        .notNullable()
        .references('id')
        .inTable('moves')
        .onDelete('CASCADE')
      table.string('learn_method', 16).notNullable()
      table.integer('level_learned_at').nullable()
      table.primary(['species_id', 'move_id', 'learn_method'])
    })

    this.schema.raw(
      'CREATE INDEX idx_pokemon_learnset_species ON pokemon_learnset(species_id)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
