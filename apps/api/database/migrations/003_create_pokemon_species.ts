import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'pokemon_species'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').primary()
      table.string('name_fr', 64).notNullable()
      table.string('name_en', 64).notNullable()
      table.string('type1', 16).notNullable()
      table.string('type2', 16).nullable()
      table.integer('base_hp').nullable()
      table.integer('base_atk').nullable()
      table.integer('base_def').nullable()
      table.integer('base_spatk').nullable()
      table.integer('base_spdef').nullable()
      table.integer('base_speed').nullable()
      table.string('rarity', 16).notNullable()
      table.integer('generation').notNullable()
      table.integer('capture_rate').nullable()
      table.jsonb('egg_groups').defaultTo('[]')
      table
        .integer('evolves_from_id')
        .references('id')
        .inTable('pokemon_species')
        .nullable()
        .onDelete('SET NULL')
      table.string('sprite_url', 512).nullable()
      table.string('sprite_shiny_url', 512).nullable()
      table.string('sprite_fallback_url', 512).nullable()
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
