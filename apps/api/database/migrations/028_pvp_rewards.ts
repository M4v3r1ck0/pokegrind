import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('pvp_season_rewards', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.integer('season_id').notNullable().references('id').inTable('pvp_seasons')
      table.string('tier', 16).notNullable()
      table.integer('elo_final').notNullable()
      table.integer('gems_awarded').defaultTo(0)
      table.integer('cosmetic_awarded_id').nullable()
      table.timestamp('awarded_at', { useTz: false }).defaultTo(this.now())
      table.unique(['player_id', 'season_id'])
    })
  }

  async down() {
    this.schema.dropTable('pvp_season_rewards')
  }
}
