import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Saisons Tour Infinie
    this.schema.createTable('tower_seasons', (table) => {
      table.increments('id')
      table.string('name_fr', 64).notNullable()
      table.timestamp('start_at', { useTz: true }).notNullable()
      table.timestamp('end_at', { useTz: true }).notNullable()
      table.boolean('is_active').defaultTo(false).notNullable()
    })

    // Progression joueur par saison
    this.schema.createTable('tower_progress', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('season_id').references('id').inTable('tower_seasons').onDelete('CASCADE').notNullable()
      table.integer('current_floor').defaultTo(1).notNullable()
      table.integer('max_floor_reached').defaultTo(0).notNullable()
      table.bigInteger('total_kills_tower').defaultTo(0).notNullable()
      table.integer('gems_earned_this_season').defaultTo(0).notNullable()
      table.timestamp('last_active_at', { useTz: true }).defaultTo(this.raw('NOW()'))
      table.unique(['player_id', 'season_id'])
    })

    // Classement Tour Infinie par saison
    this.schema.createTable('tower_leaderboard', (table) => {
      table.integer('season_id').references('id').inTable('tower_seasons').onDelete('CASCADE').notNullable()
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('max_floor').defaultTo(0).notNullable()
      table.integer('rank').nullable()
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.raw('NOW()'))
      table.primary(['season_id', 'player_id'])
    })

    // Boss spéciaux tous les 25 étages
    this.schema.createTable('tower_bosses', (table) => {
      table.integer('floor_number').primary()
      table.string('name_fr', 64).notNullable()
      table.text('description_fr').nullable()
      table.string('mechanic_type', 32).notNullable()
      table.jsonb('mechanic_config').notNullable()
      table.jsonb('team_json').notNullable()
      table.integer('gems_reward').defaultTo(5).notNullable()
      table.integer('cosmetic_reward_id').nullable()
    })

    // Paliers de récompenses gems
    this.schema.createTable('tower_milestones', (table) => {
      table.integer('floor_number').primary()
      table.integer('gems_reward').notNullable()
      table.string('name_fr', 64).nullable()
    })
  }

  async down() {
    this.schema.dropTable('tower_milestones')
    this.schema.dropTable('tower_bosses')
    this.schema.dropTable('tower_leaderboard')
    this.schema.dropTable('tower_progress')
    this.schema.dropTable('tower_seasons')
  }
}
