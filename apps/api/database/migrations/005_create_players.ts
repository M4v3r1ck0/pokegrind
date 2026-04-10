import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('username', 32).unique().notNullable()
      table.string('email', 255).unique().notNullable()
      table.string('password_hash', 255).nullable()
      table.string('discord_id', 64).unique().nullable()
      table.string('role', 16).defaultTo('player')
      table.integer('gems').defaultTo(0)
      table.bigInteger('gold').defaultTo(0)
      table.integer('frontier_points').defaultTo(0)
      table.integer('current_floor').defaultTo(1)
      table.timestamp('last_seen_at', { useTz: false }).nullable()
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
