import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  // Méga-Stones are items with category='mega_stone' (already supported by items table).
  // This migration adds the gacha_banners table for regional banner pulls.
  async up() {
    this.schema.createTable('gacha_banners', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name_fr', 64).notNullable()
      table.string('region', 32).nullable()
      table.jsonb('species_pool').notNullable().defaultTo('[]')
      table.jsonb('rate_up_species').notNullable().defaultTo('[]')
      table.timestamp('start_at').nullable()
      table.timestamp('end_at').nullable()
      table.boolean('is_active').notNullable().defaultTo(true)
      table.timestamps(true, true)
    })
  }

  async down() {
    this.schema.dropTable('gacha_banners')
  }
}
