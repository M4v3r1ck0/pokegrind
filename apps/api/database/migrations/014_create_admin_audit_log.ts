import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admin_audit_log'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('admin_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table.string('action', 128).notNullable()
      table.string('target_type', 32).nullable()
      table.string('target_id', 64).nullable()
      table.jsonb('payload').defaultTo('{}')
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
