import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('player_pokemon', (table) => {
      table.string('nature_mint_override', 32).nullable()
    })
  }

  async down() {
    this.schema.alterTable('player_pokemon', (table) => {
      table.dropColumn('nature_mint_override')
    })
  }
}
