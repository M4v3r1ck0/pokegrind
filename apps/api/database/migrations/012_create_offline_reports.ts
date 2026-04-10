import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'offline_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table.bigInteger('gold_earned').defaultTo(0)
      table.bigInteger('xp_earned').defaultTo(0)
      table.integer('kills').defaultTo(0)
      table.integer('hatches').defaultTo(0)
      table.jsonb('drops_json').defaultTo('[]')
      table.integer('absence_seconds').defaultTo(0)
      table.integer('floor_farmed').defaultTo(1)
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })

    this.schema.raw(
      'CREATE INDEX idx_offline_reports_player_id ON offline_reports(player_id, created_at DESC)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
