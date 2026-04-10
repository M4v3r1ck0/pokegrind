import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ── Suivi Pokédex Living ──────────────────────────────────────────────────
    this.schema.createTable('player_living_dex', (table) => {
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('species_id').references('id').inTable('pokemon_species').notNullable()
      table.string('form_key', 64).defaultTo('default').notNullable()
      table.boolean('has_shiny').defaultTo(false).notNullable()
      table.uuid('pokemon_id').references('id').inTable('player_pokemon').onDelete('SET NULL').nullable()
      table.timestamp('updated_at').defaultTo(this.db.rawQuery('NOW()').knexQuery).notNullable()
      table.primary(['player_id', 'species_id', 'form_key'])
    })

    // ── Objectifs Pokédex Living ──────────────────────────────────────────────
    this.schema.createTable('living_dex_objectives', (table) => {
      table.increments('id')
      table.string('name_fr', 128).notNullable()
      table.text('description_fr').nullable()
      // condition_type: species_count | shiny_count | form_count | full_gen | gmax_count
      table.string('condition_type', 32).notNullable()
      table.integer('condition_value').notNullable()
      table.integer('gems_reward').defaultTo(0).notNullable()
      table.string('cosmetic_reward', 128).nullable()
      table.timestamps(true, true)
    })

    // ── Progression objectifs joueur ──────────────────────────────────────────
    this.schema.createTable('player_living_dex_objectives', (table) => {
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('objective_id').references('id').inTable('living_dex_objectives').notNullable()
      table.boolean('completed').defaultTo(false).notNullable()
      table.boolean('claimed').defaultTo(false).notNullable()
      table.timestamp('completed_at').nullable()
      table.primary(['player_id', 'objective_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('player_living_dex_objectives')
    this.schema.dropTableIfExists('living_dex_objectives')
    this.schema.dropTableIfExists('player_living_dex')
  }
}
