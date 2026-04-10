import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // Notes modérateur
    this.schema.createTable('moderator_notes', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').notNullable().references('id').inTable('players').onDelete('CASCADE')
      table.uuid('admin_id').notNullable().references('id').inTable('players')
      table.text('note').notNullable()
      table.boolean('is_flagged').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable().defaultTo(this.now())
    })

    // Events saisonniers
    this.schema.createTable('events', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('name_fr', 128).notNullable()
      table.text('description_fr').nullable()
      table.string('event_type', 32).notNullable() // gem_boost|xp_boost|shiny_boost|banner|custom
      table.jsonb('config_json').notNullable().defaultTo('{}')
      table.timestamp('start_at').notNullable()
      table.timestamp('end_at').notNullable()
      table.boolean('is_active').notNullable().defaultTo(false)
      table.uuid('created_by').nullable().references('id').inTable('players')
      table.timestamp('created_at').notNullable().defaultTo(this.now())
    })

    // Alertes anti-cheat
    this.schema.createTable('anticheat_alerts', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('player_id').notNullable().references('id').inTable('players')
      table.string('alert_type', 64).notNullable()  // dps_anomaly|gems_anomaly|kill_rate_anomaly
      table.string('severity', 16).notNullable()    // low|medium|high|critical
      table.jsonb('details').notNullable().defaultTo('{}')
      table.boolean('is_resolved').notNullable().defaultTo(false)
      table.uuid('resolved_by').nullable().references('id').inTable('players')
      table.timestamp('resolved_at').nullable()
      table.text('resolution_note').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.now())
    })

    // Broadcast messages
    this.schema.createTable('broadcast_messages', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.string('title_fr', 128).notNullable()
      table.text('body_fr').notNullable()
      table.string('type', 16).notNullable().defaultTo('info') // info|warning|maintenance
      table.uuid('sent_by').notNullable().references('id').inTable('players')
      table.timestamp('sent_at').notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable('broadcast_messages')
    this.schema.dropTable('anticheat_alerts')
    this.schema.dropTable('events')
    this.schema.dropTable('moderator_notes')
  }
}
