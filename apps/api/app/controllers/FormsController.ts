/**
 * FormsController — Formes régionales, Méga-Évolutions, bannières gacha.
 */

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class FormsController {
  // GET /api/pokemon-forms
  async index({ response }: HttpContext) {
    const forms = await db
      .from('pokemon_forms as pf')
      .join('pokemon_species as base', 'base.id', 'pf.base_species_id')
      .join('pokemon_species as form', 'form.id', 'pf.form_species_id')
      .select(
        'pf.id',
        'pf.base_species_id',
        'pf.form_species_id',
        'pf.form_type',
        'pf.region',
        'pf.form_name_fr',
        'base.name_fr as base_name_fr',
        'base.sprite_url as base_sprite_url',
        'form.name_fr as form_name_fr_species',
        'form.type1 as form_type1',
        'form.type2 as form_type2',
        'form.sprite_url as form_sprite_url',
        'form.sprite_shiny_url as form_sprite_shiny_url'
      )
      .orderBy('pf.base_species_id')
    return response.ok(forms)
  }

  // GET /api/pokemon-forms/:species_id
  async forSpecies({ params, response }: HttpContext) {
    const species_id = parseInt(params.species_id, 10)
    const forms = await db
      .from('pokemon_forms as pf')
      .join('pokemon_species as form', 'form.id', 'pf.form_species_id')
      .where('pf.base_species_id', species_id)
      .select(
        'pf.id',
        'pf.form_species_id',
        'pf.form_type',
        'pf.region',
        'pf.form_name_fr',
        'form.name_fr',
        'form.type1',
        'form.type2',
        'form.base_hp',
        'form.base_atk',
        'form.base_def',
        'form.base_spatk',
        'form.base_spdef',
        'form.base_speed',
        'form.sprite_url',
        'form.sprite_shiny_url'
      )
    return response.ok(forms)
  }

  // GET /api/mega-evolutions
  async megaIndex({ response }: HttpContext) {
    const megas = await db
      .from('mega_evolutions as me')
      .join('pokemon_species as s', 's.id', 'me.species_id')
      .leftJoin('items as i', 'i.id', 'me.mega_stone_item_id')
      .select(
        'me.id',
        'me.species_id',
        'me.mega_name_fr',
        'me.mega_type1',
        'me.mega_type2',
        'me.mega_hp',
        'me.mega_atk',
        'me.mega_def',
        'me.mega_spatk',
        'me.mega_spdef',
        'me.mega_speed',
        'me.sprite_url',
        'me.sprite_shiny_url',
        's.name_fr as base_name_fr',
        's.type1 as base_type1',
        's.type2 as base_type2',
        's.sprite_url as base_sprite_url',
        'i.id as stone_item_id',
        'i.name_fr as stone_name_fr'
      )
      .orderBy('me.species_id')
    return response.ok(megas)
  }

  // GET /api/mega-evolutions/:species_id
  async megaForSpecies({ params, response }: HttpContext) {
    const species_id = parseInt(params.species_id, 10)
    const megas = await db
      .from('mega_evolutions as me')
      .leftJoin('items as i', 'i.id', 'me.mega_stone_item_id')
      .where('me.species_id', species_id)
      .select(
        'me.*',
        'i.name_fr as stone_name_fr'
      )
    return response.ok(megas)
  }

  // GET /api/gacha/banners
  async gachaBanners({ response }: HttpContext) {
    const banners = await db
      .from('gacha_banners')
      .where('is_active', true)
      .select('id', 'name_fr', 'region', 'species_pool', 'rate_up_species', 'start_at', 'end_at')
      .orderBy('region')
    return response.ok(banners)
  }
}
