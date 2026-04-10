import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('pokemon_forms', (table) => {
      table.increments('id')
      table.integer('base_species_id').notNullable().references('id').inTable('pokemon_species').onDelete('CASCADE')
      table.integer('form_species_id').notNullable().references('id').inTable('pokemon_species').onDelete('CASCADE')
      table.string('form_type', 32).notNullable() // 'regional' | 'mega' | 'gigantamax' | 'special'
      table.string('region', 32).nullable()       // 'alola' | 'galar' | 'hisui' | 'paldea'
      table.string('form_name_fr', 64).notNullable()
      table.unique(['base_species_id', 'form_species_id', 'form_type'])
    })

    this.schema.createTable('mega_evolutions', (table) => {
      table.increments('id')
      table.integer('species_id').notNullable().references('id').inTable('pokemon_species').onDelete('CASCADE')
      table.integer('mega_stone_item_id').nullable().references('id').inTable('items')
      table.string('mega_name_fr', 64).notNullable()
      table.string('mega_type1', 16).notNullable()
      table.string('mega_type2', 16).nullable()
      table.integer('mega_hp').notNullable()
      table.integer('mega_atk').notNullable()
      table.integer('mega_def').notNullable()
      table.integer('mega_spatk').notNullable()
      table.integer('mega_spdef').notNullable()
      table.integer('mega_speed').notNullable()
      table.string('sprite_url', 512).nullable()
      table.string('sprite_shiny_url', 512).nullable()
      table.unique(['species_id', 'mega_name_fr'])
    })
  }

  async down() {
    this.schema.dropTable('mega_evolutions')
    this.schema.dropTable('pokemon_forms')
  }
}
