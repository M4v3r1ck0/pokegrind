import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('bf_rotations', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.string('mode', 32).notNullable()
      table.jsonb('tier_restriction').defaultTo('{}')
      table.jsonb('rules_json').defaultTo('{}')
      table.timestamp('start_at', { useTz: false }).notNullable()
      table.timestamp('end_at', { useTz: false }).notNullable()
    })

    this.schema.createTable('bf_leaderboard', (table) => {
      table
        .uuid('rotation_id')
        .notNullable()
        .references('id')
        .inTable('bf_rotations')
        .onDelete('CASCADE')
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table.integer('score').defaultTo(0)
      table.integer('rank').nullable()
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
      table.primary(['rotation_id', 'player_id'])
    })

    this.schema.raw(
      'CREATE INDEX idx_bf_leaderboard_rotation ON bf_leaderboard(rotation_id, score DESC)'
    )
  }

  async down() {
    this.schema.dropTable('bf_leaderboard')
    this.schema.dropTable('bf_rotations')
  }
}
