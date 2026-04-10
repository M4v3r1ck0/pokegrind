import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_upgrades'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table
        .integer('upgrade_id')
        .notNullable()
        .references('id')
        .inTable('shop_upgrades')
      table.timestamp('purchased_at', { useTz: false }).defaultTo(this.now())
      table.primary(['player_id', 'upgrade_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
