import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_banned').defaultTo(false).notNullable()
      table.timestamp('banned_at').nullable()
      table.text('ban_reason').nullable()
      table.timestamp('ban_until').nullable() // NULL = ban permanent
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_banned')
      table.dropColumn('banned_at')
      table.dropColumn('ban_reason')
      table.dropColumn('ban_until')
    })
  }
}
