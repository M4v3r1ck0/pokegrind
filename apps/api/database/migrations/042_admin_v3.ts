import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ── game_config — configuration globale modifiable depuis l'admin ──────
    this.schema.createTable('game_config', (table) => {
      table.string('key', 128).primary()
      table.jsonb('value').notNullable()
      table.text('description_fr').nullable()
      table.uuid('updated_by').nullable().references('id').inTable('players').onDelete('SET NULL')
      table.timestamp('updated_at').defaultTo(this.now())
    })

    // ── economy_reports — snapshots économiques quotidiens ─────────────────
    this.schema.createTable('economy_reports', (table) => {
      table.increments('id')
      table.date('report_date').unique().notNullable()
      table.jsonb('data_json').notNullable()
      table.timestamp('generated_at').defaultTo(this.now())
    })

    // ── admin_sessions — sessions admin actives (audit) ────────────────────
    this.schema.createTable('admin_sessions', (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()'))
      table.uuid('admin_id').nullable().references('id').inTable('players').onDelete('SET NULL')
      table.string('ip_address', 64).nullable()
      table.text('user_agent').nullable()
      table.timestamp('started_at').defaultTo(this.now())
      table.timestamp('last_active_at').defaultTo(this.now())
      table.timestamp('ended_at').nullable()
    })

    this.schema.raw('CREATE INDEX idx_admin_sessions_admin ON admin_sessions (admin_id)')
    this.schema.raw('CREATE INDEX idx_admin_sessions_active ON admin_sessions (ended_at) WHERE ended_at IS NULL')
    this.schema.raw('CREATE INDEX idx_economy_reports_date ON economy_reports (report_date DESC)')
  }

  async down() {
    this.schema.dropTableIfExists('admin_sessions')
    this.schema.dropTableIfExists('economy_reports')
    this.schema.dropTableIfExists('game_config')
  }
}
