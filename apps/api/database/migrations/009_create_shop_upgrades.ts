import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shop_upgrades'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('category', 32).notNullable()
      table.string('name_fr', 128).notNullable()
      table.text('description_fr').nullable()
      table.integer('cost_gems').notNullable()
      table.string('effect_type', 64).notNullable()
      table.jsonb('effect_value').defaultTo('{}')
      table
        .integer('requires_upgrade_id')
        .references('id')
        .inTable('shop_upgrades')
        .nullable()
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
