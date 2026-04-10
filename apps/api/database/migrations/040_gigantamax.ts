import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ── Formes Gigantamax ─────────────────────────────────────────────────────
    this.schema.createTable('gigantamax_forms', (table) => {
      table.increments('id')
      table.integer('species_id').references('id').inTable('pokemon_species').notNullable()
      table.string('gmax_name_fr', 64).notNullable()
      table.integer('gmax_move_id').references('id').inTable('moves').nullable()
      table.decimal('gmax_hp_mult', 4, 2).defaultTo(1.5).notNullable()
      table.decimal('gmax_atk_mult', 4, 2).defaultTo(1.2).notNullable()
      table.decimal('gmax_def_mult', 4, 2).defaultTo(1.2).notNullable()
      table.decimal('gmax_spatk_mult', 4, 2).defaultTo(1.2).notNullable()
      table.decimal('gmax_spdef_mult', 4, 2).defaultTo(1.2).notNullable()
      table.decimal('gmax_speed_mult', 4, 2).defaultTo(0.8).notNullable()
      table.string('sprite_url', 512).nullable()
      table.string('sprite_shiny_url', 512).nullable()
      table.string('obtain_method', 32).defaultTo('raid').notNullable()  // raid|tower|dungeon
      table.unique(['species_id'])
      table.timestamps(true, true)
    })

    // ── Gigantamax débloqués par joueur ───────────────────────────────────────
    this.schema.createTable('player_gigantamax', (table) => {
      table.uuid('player_id').references('id').inTable('players').onDelete('CASCADE').notNullable()
      table.integer('species_id').references('id').inTable('pokemon_species').notNullable()
      table.timestamp('unlocked_at').defaultTo(this.db.rawQuery('NOW()').knexQuery).notNullable()
      table.primary(['player_id', 'species_id'])
    })

    // ── Formes cosmétiques ────────────────────────────────────────────────────
    this.schema.createTable('pokemon_cosmetic_forms', (table) => {
      table.increments('id')
      table.integer('species_id').references('id').inTable('pokemon_species').notNullable()
      table.string('form_name_fr', 64).notNullable()
      table.string('form_key', 64).notNullable()
      table.string('sprite_url', 512).nullable()
      table.string('sprite_shiny_url', 512).nullable()
      table.string('obtain_method', 32).notNullable()  // item|region|default
      table.unique(['species_id', 'form_key'])
      table.timestamps(true, true)
    })

    // ── Forme cosmétique active sur player_pokemon ────────────────────────────
    this.schema.table('player_pokemon', (table) => {
      table.integer('active_cosmetic_form_id')
        .references('id').inTable('pokemon_cosmetic_forms').nullable()
    })

    // ── XP individuel des Pokémon (pour Bonbons Exp.) ─────────────────────────
    this.schema.table('player_pokemon', (table) => {
      table.bigInteger('xp').defaultTo(0).notNullable()
    })
  }

  async down() {
    this.schema.table('player_pokemon', (table) => {
      table.dropColumn('active_cosmetic_form_id')
      table.dropColumn('xp')
    })
    this.schema.dropTableIfExists('pokemon_cosmetic_forms')
    this.schema.dropTableIfExists('player_gigantamax')
    this.schema.dropTableIfExists('gigantamax_forms')
  }
}
