import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ── Définition des bosses de raid ─────────────────────────────────────────
    this.schema.createTable('raid_bosses', (table) => {
      table.increments('id')
      table.integer('species_id').references('id').inTable('pokemon_species').notNullable()
      table.string('name_fr', 64).notNullable()
      table.text('description_fr').nullable()
      table.string('difficulty', 16).notNullable()      // normal | hard | extreme
      table.bigInteger('total_hp').notNullable()
      table.integer('level').notNullable()
      table.jsonb('moves').notNullable()                // array d'IDs de moves
      table.integer('duration_hours').defaultTo(24).notNullable()
      table.integer('min_players').defaultTo(1).notNullable()
      table.jsonb('rewards_tiers').notNullable()        // tiers de récompenses
      table.string('sprite_url', 256).nullable()
      table.boolean('is_active').defaultTo(false).notNullable()
      table.timestamps(true, true)
    })

    // ── Instances de raid actives ──────────────────────────────────────────────
    this.schema.createTable('raid_instances', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.integer('boss_id').references('id').inTable('raid_bosses').notNullable()
      table.bigInteger('hp_remaining').notNullable()
      table.bigInteger('hp_total').notNullable()
      table.string('status', 16).defaultTo('active').notNullable()  // active | defeated | expired
      table.timestamp('started_at').notNullable()
      table.timestamp('ends_at').notNullable()
      table.timestamp('defeated_at').nullable()
      table.integer('total_participants').defaultTo(0).notNullable()
      table.bigInteger('total_damage_dealt').defaultTo(0).notNullable()
      table.timestamps(true, true)
    })

    // ── Contributions individuelles ────────────────────────────────────────────
    this.schema.createTable('raid_contributions', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('raid_id').references('id').inTable('raid_instances').onDelete('CASCADE').notNullable()
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.bigInteger('damage_dealt').defaultTo(0).notNullable()
      table.integer('attacks_count').defaultTo(0).notNullable()
      table.timestamp('last_attack_at').nullable()
      table.string('reward_tier', 16).nullable()
      table.boolean('rewards_claimed').defaultTo(false).notNullable()
      table.timestamp('joined_at').defaultTo(this.db.rawQuery('NOW()').knexQuery).notNullable()
      table.unique(['raid_id', 'player_id'])
      table.timestamps(true, true)
    })

    // ── Récompenses Raid à collecter ──────────────────────────────────────────
    this.schema.createTable('raid_rewards', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.uuid('raid_id').references('id').inTable('raid_instances').onDelete('CASCADE').notNullable()
      table.string('reward_type', 32).notNullable()    // gems | pokemon | item | gold
      table.jsonb('reward_data').notNullable()
      table.boolean('collected').defaultTo(false).notNullable()
      table.timestamp('created_at').defaultTo(this.db.rawQuery('NOW()').knexQuery).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists('raid_rewards')
    this.schema.dropTableIfExists('raid_contributions')
    this.schema.dropTableIfExists('raid_instances')
    this.schema.dropTableIfExists('raid_bosses')
  }
}
