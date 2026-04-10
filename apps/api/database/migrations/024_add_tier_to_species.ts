import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Tier column on pokemon_species
    this.schema.alterTable('pokemon_species', (table) => {
      table.string('tier', 8).defaultTo('C').notNullable()
    })

    // Manual override table
    this.schema.createTable('pokemon_tiers', (table) => {
      table.integer('species_id').primary().references('id').inTable('pokemon_species').onDelete('CASCADE')
      table.string('tier', 8).notNullable()
      table.text('tier_reason').nullable()
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('pokemon_tiers')
    this.schema.alterTable('pokemon_species', (table) => {
      table.dropColumn('tier')
    })
  }
}
