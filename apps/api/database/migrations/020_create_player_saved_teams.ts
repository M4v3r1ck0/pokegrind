import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'player_saved_teams'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table
        .uuid('player_id')
        .notNullable()
        .references('id')
        .inTable('players')
        .onDelete('CASCADE')
      table.integer('slot').notNullable().checkBetween([1, 5])
      table.string('name_fr', 32).defaultTo('Équipe')
      table.jsonb('team_json').nullable()
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
      table.unique(['player_id', 'slot'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
