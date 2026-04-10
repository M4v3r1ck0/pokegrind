import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Extend bf_rotations
    this.schema.alterTable('bf_rotations', (table) => {
      table.string('name_fr', 128).nullable()
      table.text('description_fr').nullable()
      table.string('challenge_type', 32).defaultTo('standard')
      table.integer('reward_cosmetic_id').nullable()
    })

    // BF Sessions
    this.schema.createTable('bf_sessions', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.uuid('rotation_id').notNullable().references('id').inTable('bf_rotations').onDelete('CASCADE')
      table.string('mode', 32).notNullable()
      table.integer('current_streak').defaultTo(0)
      table.integer('best_streak').defaultTo(0)
      table.integer('frontier_points_earned').defaultTo(0)
      table.string('status', 16).defaultTo('active')
      table.jsonb('team_snapshot').notNullable()
      table.jsonb('factory_pool').nullable()
      table.timestamp('started_at', { useTz: false }).defaultTo(this.now())
      table.timestamp('ended_at', { useTz: false }).nullable()
      table.unique(['player_id', 'rotation_id'])
    })

    // BF Battles
    this.schema.createTable('bf_battles', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('session_id').notNullable().references('id').inTable('bf_sessions').onDelete('CASCADE')
      table.integer('battle_number').notNullable()
      table.jsonb('opponent_snapshot').notNullable()
      table.string('result', 8).notNullable()
      table.integer('duration_seconds').nullable()
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })

    // BF Shop items
    this.schema.createTable('bf_shop_items', (table) => {
      table.increments('id').primary()
      table.string('name_fr', 128).notNullable()
      table.text('description_fr').nullable()
      table.integer('cost_pf').notNullable()
      table.string('item_type', 32).notNullable()
      table.jsonb('item_data').notNullable()
      table.integer('stock_per_rotation').nullable()
      table.boolean('is_active').defaultTo(true)
    })

    // BF Shop purchases
    this.schema.createTable('bf_shop_purchases', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.integer('item_id').notNullable().references('id').inTable('bf_shop_items')
      table.uuid('rotation_id').nullable().references('id').inTable('bf_rotations')
      table.integer('quantity').defaultTo(1)
      table.integer('pf_spent').notNullable()
      table.boolean('used').defaultTo(false)
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })

    // BF Achievements
    this.schema.createTable('bf_achievements', (table) => {
      table.increments('id').primary()
      table.string('name_fr', 128).notNullable()
      table.text('description_fr').nullable()
      table.string('condition_type', 32).notNullable()
      table.integer('condition_value').notNullable()
      table.string('mode', 16).nullable()
      table.integer('gems_reward').defaultTo(0)
    })

    // BF Player achievements
    this.schema.createTable('bf_player_achievements', (table) => {
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.integer('achievement_id').notNullable().references('id').inTable('bf_achievements')
      table.timestamp('unlocked_at', { useTz: false }).defaultTo(this.now())
      table.primary(['player_id', 'achievement_id'])
    })

    this.schema.raw('CREATE INDEX idx_bf_sessions_player ON bf_sessions(player_id, status)')
    this.schema.raw('CREATE INDEX idx_bf_battles_session ON bf_battles(session_id, created_at DESC)')
  }

  async down() {
    this.schema.dropTable('bf_player_achievements')
    this.schema.dropTable('bf_achievements')
    this.schema.dropTable('bf_shop_purchases')
    this.schema.dropTable('bf_shop_items')
    this.schema.dropTable('bf_battles')
    this.schema.dropTable('bf_sessions')
    this.schema.alterTable('bf_rotations', (table) => {
      table.dropColumn('name_fr')
      table.dropColumn('description_fr')
      table.dropColumn('challenge_type')
      table.dropColumn('reward_cosmetic_id')
    })
  }
}
