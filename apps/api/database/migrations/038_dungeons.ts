import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Définition des donjons
    this.schema.createTable('dungeons', (table) => {
      table.increments('id')
      table.string('name_fr', 64).notNullable()
      table.string('region', 32).notNullable()
      table.text('description_fr').nullable()
      table.integer('min_prestige').defaultTo(0).notNullable()
      table.integer('floor_count').defaultTo(10).notNullable()
      table.string('difficulty', 16).notNullable()   // normal | hard | legendary
      table.jsonb('enemy_types').notNullable()
      table.integer('boss_species_id').references('id').inTable('pokemon_species').nullable()
      table.integer('boss_level').notNullable()
      table.jsonb('rewards_pool').notNullable()
      table.string('sprite_url', 256).nullable()
      table.boolean('is_active').defaultTo(true).notNullable()
    })

    // Types de salles disponibles
    this.schema.createTable('dungeon_room_types', (table) => {
      table.increments('id')
      table.string('type', 32).notNullable().unique()
      table.string('name_fr', 64).notNullable()
      table.text('description_fr').nullable()
      table.integer('weight').defaultTo(10).notNullable()
    })

    // Modificateurs de run (buffs/debuffs aléatoires)
    this.schema.createTable('dungeon_modifiers', (table) => {
      table.increments('id')
      table.string('name_fr', 64).notNullable()
      table.text('description_fr').notNullable()
      table.string('modifier_type', 32).notNullable()   // buff | debuff | neutral
      table.jsonb('effect_json').notNullable()
      table.boolean('is_active').defaultTo(true).notNullable()
    })

    // Runs de donjon d'un joueur
    this.schema.createTable('dungeon_runs', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('dungeon_id').references('id').inTable('dungeons').notNullable()
      table.integer('season_week').notNullable()  // semaine ISO
      table.string('status', 16).defaultTo('active').notNullable()  // active | completed | failed
      table.integer('current_room').defaultTo(1).notNullable()
      table.jsonb('team_snapshot').notNullable()
      table.jsonb('active_modifiers').defaultTo('[]').notNullable()
      table.jsonb('rooms_layout').notNullable()
      table.integer('gold_collected').defaultTo(0).notNullable()
      table.jsonb('items_collected').defaultTo('[]').notNullable()
      table.timestamp('started_at', { useTz: true }).defaultTo(this.raw('NOW()')).notNullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
    })

    // Récompenses de runs complétés
    this.schema.createTable('dungeon_rewards', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('dungeon_id').references('id').inTable('dungeons').notNullable()
      table.uuid('run_id').references('id').inTable('dungeon_runs').onDelete('CASCADE').notNullable()
      table.string('reward_type', 32).notNullable()  // item | pokemon | gems | ct
      table.jsonb('reward_data').notNullable()
      table.boolean('collected').defaultTo(false).notNullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.raw('NOW()')).notNullable()
    })
  }

  async down() {
    this.schema.dropTable('dungeon_rewards')
    this.schema.dropTable('dungeon_runs')
    this.schema.dropTable('dungeon_modifiers')
    this.schema.dropTable('dungeon_room_types')
    this.schema.dropTable('dungeons')
  }
}
