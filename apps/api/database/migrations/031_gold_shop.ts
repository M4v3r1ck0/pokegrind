import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('gold_shop_items', (table) => {
      table.increments('id')
      table.integer('item_id').notNullable().references('id').inTable('items').onDelete('CASCADE')
      table.integer('cost_gold').notNullable()
      table.string('stock_type', 16).notNullable().defaultTo('unlimited') // unlimited/weekly
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable('gold_shop_items')
  }
}
