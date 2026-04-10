import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'gems_audit'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table.integer('amount').notNullable()
      table.string('reason', 128).notNullable()
      table.string('source', 64).nullable()
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })

    this.schema.raw(
      'CREATE INDEX idx_gems_audit_player_id ON gems_audit(player_id, created_at DESC)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
