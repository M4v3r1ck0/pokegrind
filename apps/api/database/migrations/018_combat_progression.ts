import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Colonnes supplémentaires sur players
    this.schema.alterTable('players', (table) => {
      table.integer('max_floor_reached').defaultTo(1).notNullable()
      table.bigInteger('total_kills').defaultTo(0).notNullable()
      table.bigInteger('total_gold_earned').defaultTo(0).notNullable()
    })

    // Suivi de progression par étage
    this.schema.createTable('player_floor_progress', (table) => {
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE')
      table.integer('floor_number').references('floor_number').inTable('floors')
      table.timestamp('boss_defeated_at', { useTz: true }).nullable()
      table.boolean('gems_claimed').defaultTo(false)
      table.primary(['player_id', 'floor_number'])
    })
  }

  async down() {
    this.schema.dropTable('player_floor_progress')
    this.schema.alterTable('players', (table) => {
      table.dropColumn('max_floor_reached')
      table.dropColumn('total_kills')
      table.dropColumn('total_gold_earned')
    })
  }
}
