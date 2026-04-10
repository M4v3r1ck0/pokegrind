import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('items', (table) => {
      table.increments('id')
      table.string('name_fr', 128).notNullable()
      table.text('description_fr')
      table.string('category', 32).notNullable() // offensive/defensive/utility/passive
      table.string('effect_type', 64).notNullable()
      table.jsonb('effect_value').notNullable().defaultTo('{}')
      table.string('sprite_url', 512)
      table.jsonb('obtain_method').notNullable().defaultTo('{}')
      table.string('rarity', 16).notNullable().defaultTo('common')
      table.timestamps(true, true)
    })

    this.schema.createTable('player_items', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.integer('item_id').notNullable().references('id').inTable('items').onDelete('CASCADE')
      table.integer('quantity').notNullable().defaultTo(1)
      table.timestamp('obtained_at').notNullable().defaultTo(this.now())
      table.unique(['player_id', 'item_id'])
    })

    // Add FK constraint on player_pokemon.equipped_item_id
    this.schema.alterTable('player_pokemon', (table) => {
      table.foreign('equipped_item_id').references('id').inTable('items')
    })
  }

  async down() {
    this.schema.alterTable('player_pokemon', (table) => {
      table.dropForeign(['equipped_item_id'])
    })
    this.schema.dropTable('player_items')
    this.schema.dropTable('items')
  }
}
