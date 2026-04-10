import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'moves'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.integer('id').primary()
      table.string('name_fr', 64).notNullable()
      table.string('name_en', 64).notNullable()
      table.string('type', 16).notNullable()
      table.string('category', 16).notNullable()
      table.integer('power').nullable()
      table.integer('accuracy').nullable()
      table.integer('pp').nullable()
      table.integer('priority').defaultTo(0)
      table
        .integer('effect_id')
        .unsigned()
        .references('id')
        .inTable('move_effects')
        .nullable()
        .onDelete('SET NULL')
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
