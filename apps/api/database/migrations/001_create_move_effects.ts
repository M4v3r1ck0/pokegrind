import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'move_effects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').primary()
      table.string('effect_type', 32).nullable()
      table.string('stat_target', 16).nullable()
      table.integer('stat_change').nullable()
      table.string('target', 16).nullable()
      table.integer('duration_min').nullable()
      table.integer('duration_max').nullable()
      table.integer('chance_percent').defaultTo(100)
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
