import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Saisons PvP
    this.schema.createTable('pvp_seasons', (table) => {
      table.increments('id').primary()
      table.string('name_fr', 64).notNullable()
      table.timestamp('start_at', { useTz: false }).notNullable()
      table.timestamp('end_at', { useTz: false }).notNullable()
      table.boolean('is_active').defaultTo(false)
      table.jsonb('rewards_json').defaultTo('[]')
    })

    // Classement ELO par saison
    this.schema.createTable('pvp_rankings', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.integer('season_id').notNullable().references('id').inTable('pvp_seasons')
      table.integer('elo').defaultTo(1000)
      table.integer('wins').defaultTo(0)
      table.integer('losses').defaultTo(0)
      table.integer('win_streak').defaultTo(0)
      table.integer('best_elo').defaultTo(1000)
      table.string('tier', 16).defaultTo('bronze')
      table.integer('rank').nullable()
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
      table.unique(['player_id', 'season_id'])
    })

    // Équipe de défense du joueur
    this.schema.createTable('pvp_defense_teams', (table) => {
      table.uuid('player_id').primary().references('id').inTable('players').onDelete('CASCADE')
      table.jsonb('team_json').notNullable()
      table.timestamp('updated_at', { useTz: false }).defaultTo(this.now())
    })

    // Historique des combats PvP
    this.schema.createTable('pvp_battles', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.integer('season_id').notNullable().references('id').inTable('pvp_seasons')
      table.uuid('attacker_id').notNullable().references('id').inTable('players')
      table.uuid('defender_id').notNullable().references('id').inTable('players')
      table.jsonb('attacker_team_json').notNullable()
      table.jsonb('defender_team_json').notNullable()
      table.string('result', 16).notNullable()
      table.integer('elo_change_attacker').notNullable()
      table.integer('elo_change_defender').notNullable()
      table.integer('attacker_elo_after').notNullable()
      table.integer('defender_elo_after').notNullable()
      table.jsonb('actions_replay').notNullable()
      table.integer('duration_simulated_ms').nullable()
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })

    // Notifications PvP (attaques reçues)
    this.schema.createTable('pvp_notifications', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.uuid('battle_id').notNullable().references('id').inTable('pvp_battles').onDelete('CASCADE')
      table.boolean('is_read').defaultTo(false)
      table.timestamp('created_at', { useTz: false }).defaultTo(this.now())
    })

    this.schema.raw('CREATE INDEX idx_pvp_rankings_season_elo ON pvp_rankings(season_id, elo DESC)')
    this.schema.raw('CREATE INDEX idx_pvp_battles_attacker ON pvp_battles(attacker_id, created_at DESC)')
    this.schema.raw('CREATE INDEX idx_pvp_battles_defender ON pvp_battles(defender_id, created_at DESC)')
    this.schema.raw('CREATE INDEX idx_pvp_notifs_player ON pvp_notifications(player_id, is_read)')
  }

  async down() {
    this.schema.dropTable('pvp_notifications')
    this.schema.dropTable('pvp_battles')
    this.schema.dropTable('pvp_defense_teams')
    this.schema.dropTable('pvp_rankings')
    this.schema.dropTable('pvp_seasons')
  }
}
