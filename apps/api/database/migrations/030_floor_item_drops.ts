import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('floor_item_drops', (table) => {
      table.integer('floor_id').notNullable().references('id').inTable('floors').onDelete('CASCADE')
      table.integer('item_id').notNullable().references('id').inTable('items').onDelete('CASCADE')
      table.decimal('drop_rate', 5, 4).notNullable()
      table.integer('drop_quantity_min').notNullable().defaultTo(1)
      table.integer('drop_quantity_max').notNullable().defaultTo(1)
      table.primary(['floor_id', 'item_id'])
    })
  }

  async down() {
    this.schema.dropTable('floor_item_drops')
  }
}
