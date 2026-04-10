import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

function spriteUrl(id: number | string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
}

function spriteShinyUrl(id: number | string): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`
}

// ─── Toutes les formes cosmétiques ────────────────────────────────────────────
// Source : PokéAPI IDs officiels pour les formes

const COSMETIC_FORMS: Array<{
  species_id: number
  form_name_fr: string
  form_key: string
  sprite_id: number | string
  obtain_method: string
}> = [
  // ── Rotom (479) — 6 formes, IDs 10008–10012 dans PokéAPI ─────────────────
  { species_id: 479, form_name_fr: 'Rotom',        form_key: 'rotom-normal', sprite_id: 479,    obtain_method: 'default' },
  { species_id: 479, form_name_fr: 'Rotom-Chaleur', form_key: 'rotom-heat',  sprite_id: '479-heat',  obtain_method: 'item' },
  { species_id: 479, form_name_fr: 'Rotom-Lavage',  form_key: 'rotom-wash',  sprite_id: '479-wash',  obtain_method: 'item' },
  { species_id: 479, form_name_fr: 'Rotom-Frimas',  form_key: 'rotom-frost', sprite_id: '479-frost', obtain_method: 'item' },
  { species_id: 479, form_name_fr: 'Rotom-Hélice',  form_key: 'rotom-fan',   sprite_id: '479-fan',   obtain_method: 'item' },
  { species_id: 479, form_name_fr: 'Rotom-Tondeuse',form_key: 'rotom-mow',   sprite_id: '479-mow',   obtain_method: 'item' },

  // ── Oricorio (741) — 4 formes (types différents mais cosmétique ici) ──────
  { species_id: 741, form_name_fr: 'Oricorio-Baile',    form_key: 'oricorio-baile',   sprite_id: 741,         obtain_method: 'default' },
  { species_id: 741, form_name_fr: "Oricorio-Pom-Pom",  form_key: 'oricorio-pom-pom', sprite_id: '741-pompom', obtain_method: 'region' },
  { species_id: 741, form_name_fr: "Oricorio-Pa'u",      form_key: 'oricorio-pau',     sprite_id: '741-pau',    obtain_method: 'region' },
  { species_id: 741, form_name_fr: 'Oricorio-Sensu',    form_key: 'oricorio-sensu',   sprite_id: '741-sensu',  obtain_method: 'region' },

  // ── Flabébé (669) — 5 couleurs ────────────────────────────────────────────
  { species_id: 669, form_name_fr: 'Flabébé-Rouge',  form_key: 'flabebe-red',    sprite_id: 669,           obtain_method: 'default' },
  { species_id: 669, form_name_fr: 'Flabébé-Jaune',  form_key: 'flabebe-yellow', sprite_id: '669-yellow',   obtain_method: 'default' },
  { species_id: 669, form_name_fr: 'Flabébé-Orange', form_key: 'flabebe-orange', sprite_id: '669-orange',   obtain_method: 'default' },
  { species_id: 669, form_name_fr: 'Flabébé-Bleue',  form_key: 'flabebe-blue',   sprite_id: '669-blue',     obtain_method: 'default' },
  { species_id: 669, form_name_fr: 'Flabébé-Blanche',form_key: 'flabebe-white',  sprite_id: '669-white',    obtain_method: 'default' },

  // ── Vivaldaim / Sawsbuck (585, 586) — 4 saisons ───────────────────────────
  { species_id: 585, form_name_fr: 'Vivaldaim-Printemps', form_key: 'deerling-spring', sprite_id: 585,          obtain_method: 'default' },
  { species_id: 585, form_name_fr: 'Vivaldaim-Été',       form_key: 'deerling-summer', sprite_id: '585-summer', obtain_method: 'default' },
  { species_id: 585, form_name_fr: 'Vivaldaim-Automne',   form_key: 'deerling-autumn', sprite_id: '585-autumn', obtain_method: 'default' },
  { species_id: 585, form_name_fr: 'Vivaldaim-Hiver',     form_key: 'deerling-winter', sprite_id: '585-winter', obtain_method: 'default' },

  // ── Minior (774) — 7 couleurs (forme Noyau) ───────────────────────────────
  { species_id: 774, form_name_fr: 'Minior-Rouge',   form_key: 'minior-red',    sprite_id: '774-red-meteor',    obtain_method: 'default' },
  { species_id: 774, form_name_fr: 'Minior-Orange',  form_key: 'minior-orange', sprite_id: '774-orange-meteor', obtain_method: 'default' },
  { species_id: 774, form_name_fr: 'Minior-Jaune',   form_key: 'minior-yellow', sprite_id: '774-yellow-meteor', obtain_method: 'default' },
  { species_id: 774, form_name_fr: 'Minior-Vert',    form_key: 'minior-green',  sprite_id: '774-green-meteor',  obtain_method: 'default' },
  { species_id: 774, form_name_fr: 'Minior-Bleu',    form_key: 'minior-blue',   sprite_id: '774-blue-meteor',   obtain_method: 'default' },
  { species_id: 774, form_name_fr: 'Minior-Indigo',  form_key: 'minior-indigo', sprite_id: '774-indigo-meteor', obtain_method: 'default' },
  { species_id: 774, form_name_fr: 'Minior-Violet',  form_key: 'minior-violet', sprite_id: '774-violet-meteor', obtain_method: 'default' },

  // ── Alcremie (869) — 9 variantes de crème ────────────────────────────────
  { species_id: 869, form_name_fr: 'Alcremie-Vanille',    form_key: 'alcremie-vanilla',   sprite_id: 869,            obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Rubis',      form_key: 'alcremie-ruby',      sprite_id: '869-ruby-swirl', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Matcha',     form_key: 'alcremie-matcha',    sprite_id: '869-matcha-cream', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Menthe',     form_key: 'alcremie-mint',      sprite_id: '869-mint-cream', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Citron',     form_key: 'alcremie-lemon',     sprite_id: '869-lemon-cream', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Sel',        form_key: 'alcremie-salt',      sprite_id: '869-salted-cream', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Aquamarine', form_key: 'alcremie-aqua',      sprite_id: '869-aqua-swirl', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Caramel',    form_key: 'alcremie-caramel',   sprite_id: '869-caramel-swirl', obtain_method: 'default' },
  { species_id: 869, form_name_fr: 'Alcremie-Prune',      form_key: 'alcremie-plum',      sprite_id: '869-plum-swirl', obtain_method: 'default' },

  // ── Morpeko (877) — 2 modes ──────────────────────────────────────────────
  { species_id: 877, form_name_fr: 'Morpeko-Ventre-Plein',  form_key: 'morpeko-full-belly', sprite_id: 877,           obtain_method: 'default' },
  { species_id: 877, form_name_fr: 'Morpeko-Ventre-Vide',   form_key: 'morpeko-hangry',    sprite_id: '877-hangry',  obtain_method: 'default' },

  // ── Zarude (893) — 2 formes ───────────────────────────────────────────────
  { species_id: 893, form_name_fr: 'Zarude',        form_key: 'zarude',        sprite_id: 893,         obtain_method: 'default' },
  { species_id: 893, form_name_fr: 'Zarude-Parent', form_key: 'zarude-dada',   sprite_id: '893-dada',  obtain_method: 'item' },
]

export default class CosmeticFormSeeder extends BaseSeeder {
  async run() {
    let inserted = 0
    for (const form of COSMETIC_FORMS) {
      // Vérifier que l'espèce existe
      const species = await db.from('pokemon_species').where('id', form.species_id).first()
      if (!species) {
        console.warn(`[CosmeticFormSeeder] Espèce ${form.species_id} introuvable — ignoré.`)
        continue
      }

      const existing = await db
        .from('pokemon_cosmetic_forms')
        .where({ species_id: form.species_id, form_key: form.form_key })
        .first()

      if (!existing) {
        await db.table('pokemon_cosmetic_forms').insert({
          species_id: form.species_id,
          form_name_fr: form.form_name_fr,
          form_key: form.form_key,
          sprite_url: spriteUrl(form.sprite_id),
          sprite_shiny_url: spriteShinyUrl(form.sprite_id),
          obtain_method: form.obtain_method,
          created_at: new Date(),
          updated_at: new Date(),
        })
        inserted++
      }
    }
    console.log(`[CosmeticFormSeeder] ${inserted} formes cosmétiques insérées (${COSMETIC_FORMS.length} total).`)
  }
}
