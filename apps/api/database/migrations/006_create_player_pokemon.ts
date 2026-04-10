import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_pokemon'

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
        .integer('species_id')
        .notNullable()
        .references('id')
        .inTable('pokemon_species')
      table.string('nickname', 32).nullable()
      table.integer('level').defaultTo(1)
      table.boolean('is_shiny').defaultTo(false)
      table.integer('stars').defaultTo(0)
      table.string('nature', 32).notNullable()
      table.integer('iv_hp').nullable()
      table.integer('iv_atk').nullable()
      table.integer('iv_def').nullable()
      table.integer('iv_spatk').nullable()
      table.integer('iv_spdef').nullable()
      table.integer('iv_speed').nullable()
      table.integer('equipped_item_id').nullable()
      table
        .integer('slot_team')
        .nullable()
        .checkBetween([1, 6], 'chk_slot_team_range')
      table
        .integer('slot_daycare')
        .nullable()
        .checkBetween([1, 10], 'chk_slot_daycare_range')
      table
        .integer('hidden_talent_move_id')
        .references('id')
        .inTable('moves')
        .nullable()
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
    })

    this.schema.raw(
      'CREATE INDEX idx_player_pokemon_player_id ON player_pokemon(player_id)'
    )
    this.schema.raw(
      'CREATE INDEX idx_player_pokemon_species_id ON player_pokemon(species_id)'
    )
    this.schema.raw(
      'CREATE INDEX idx_player_pokemon_slot_team ON player_pokemon(player_id, slot_team) WHERE slot_team IS NOT NULL'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
