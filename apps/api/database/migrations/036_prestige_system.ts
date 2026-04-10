import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Niveaux de prestige (catalogue)
    this.schema.createTable('prestige_levels', (table) => {
      table.integer('level').primary()
      table.string('name_fr', 64).notNullable()
      table.text('description_fr').nullable()
      table.integer('required_floor').notNullable()
      table.decimal('gold_multiplier', 4, 2).defaultTo(1.00).notNullable()
      table.decimal('xp_multiplier', 4, 2).defaultTo(1.00).notNullable()
      table.integer('gem_bonus_per_boss').defaultTo(0).notNullable()
      table.decimal('daycare_speed_bonus', 4, 2).defaultTo(1.00).notNullable()
      table.string('badge_name_fr', 64).nullable()
      table.string('badge_sprite_url', 256).nullable()
      table.integer('gems_reward').defaultTo(0).notNullable()
    })

    // Historique des prestiges par joueur
    this.schema.createTable('player_prestiges', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('prestige_level').references('level').inTable('prestige_levels').notNullable()
      table.integer('floor_at_prestige').notNullable()
      table.bigInteger('total_kills_at_prestige').nullable()
      table.bigInteger('gold_at_prestige').nullable()
      table.integer('pokemon_count_at_prestige').nullable()
      table.timestamp('prestiged_at', { useTz: true }).defaultTo(this.raw('NOW()'))
    })

    // Colonnes prestige sur players
    this.schema.alterTable('players', (table) => {
      table.integer('prestige_level').defaultTo(0).notNullable()
      table.integer('total_prestiges').defaultTo(0).notNullable()
      table.decimal('prestige_gold_mult', 4, 2).defaultTo(1.00).notNullable()
      table.decimal('prestige_xp_mult', 4, 2).defaultTo(1.00).notNullable()
      table.integer('prestige_gem_bonus').defaultTo(0).notNullable()
      table.decimal('prestige_daycare_mult', 4, 2).defaultTo(1.00).notNullable()
    })
  }

  async down() {
    this.schema.alterTable('players', (table) => {
      table.dropColumn('prestige_level')
      table.dropColumn('total_prestiges')
      table.dropColumn('prestige_gold_mult')
      table.dropColumn('prestige_xp_mult')
      table.dropColumn('prestige_gem_bonus')
      table.dropColumn('prestige_daycare_mult')
    })
    this.schema.dropTable('player_prestiges')
    this.schema.dropTable('prestige_levels')
  }
}
