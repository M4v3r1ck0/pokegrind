import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'players'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('pity_epic').defaultTo(0).notNullable()
      table.integer('pity_legendary').defaultTo(0).notNullable()
      table.integer('total_pulls').defaultTo(0).notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pity_epic')
      table.dropColumn('pity_legendary')
      table.dropColumn('total_pulls')
    })
  }
}
