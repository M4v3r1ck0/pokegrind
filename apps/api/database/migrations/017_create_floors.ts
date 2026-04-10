import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'floors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('floor_number').unique().notNullable()
      table.string('region', 32).notNullable()
      table.string('name_fr', 64).notNullable()
      table.integer('min_level').notNullable()
      table.integer('max_level').notNullable()
      table.integer('gold_base').notNullable()
      table.integer('xp_base').notNullable()
      table.jsonb('enemy_types').notNullable()
      table.string('boss_trainer_name', 64).nullable()
      table.jsonb('boss_team').nullable()
      table.boolean('is_milestone').defaultTo(false)
      table.integer('unlock_floor').defaultTo(1)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
