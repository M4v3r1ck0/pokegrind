import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const OBJECTIVES = [
  { name_fr: 'Collection Débutant',    description_fr: 'Possède 50 espèces différentes en même temps.',            condition_type: 'species_count', condition_value: 50,   gems_reward: 5 },
  { name_fr: 'Collection Avancée',     description_fr: 'Possède 150 espèces différentes en même temps.',           condition_type: 'species_count', condition_value: 150,  gems_reward: 10 },
  { name_fr: 'Collection Complète',    description_fr: 'Possède 500 espèces différentes en même temps.',           condition_type: 'species_count', condition_value: 500,  gems_reward: 20 },
  { name_fr: 'Pokédex National',       description_fr: 'Possède les 1025 espèces connues en même temps.',          condition_type: 'species_count', condition_value: 1025, gems_reward: 50 },
  { name_fr: 'Chasseur Shiny I',       description_fr: 'Possède 10 Pokémon Shiny en même temps.',                  condition_type: 'shiny_count',   condition_value: 10,   gems_reward: 10 },
  { name_fr: 'Chasseur Shiny II',      description_fr: 'Possède 50 Pokémon Shiny en même temps.',                  condition_type: 'shiny_count',   condition_value: 50,   gems_reward: 25 },
  { name_fr: 'Chasseur Shiny III',     description_fr: 'Possède 151 Pokémon Shiny en même temps.',                 condition_type: 'shiny_count',   condition_value: 151,  gems_reward: 50 },
  { name_fr: 'Formes de Kanto',        description_fr: 'Possède tous les Pokémon de Kanto (Gén. 1).',              condition_type: 'full_gen',      condition_value: 1,    gems_reward: 15 },
  { name_fr: 'Formes de Johto',        description_fr: 'Possède tous les Pokémon de Johto (Gén. 2).',              condition_type: 'full_gen',      condition_value: 2,    gems_reward: 15 },
  { name_fr: 'Formes de Hoenn',        description_fr: 'Possède tous les Pokémon de Hoenn (Gén. 3).',              condition_type: 'full_gen',      condition_value: 3,    gems_reward: 15 },
  { name_fr: 'Formes de Sinnoh',       description_fr: 'Possède tous les Pokémon de Sinnoh (Gén. 4).',             condition_type: 'full_gen',      condition_value: 4,    gems_reward: 15 },
  { name_fr: 'Formes de Unys',         description_fr: 'Possède tous les Pokémon d\'Unys (Gén. 5).',               condition_type: 'full_gen',      condition_value: 5,    gems_reward: 15 },
  { name_fr: 'Formes de Kalos',        description_fr: 'Possède tous les Pokémon de Kalos (Gén. 6).',              condition_type: 'full_gen',      condition_value: 6,    gems_reward: 15 },
  { name_fr: 'Formes de Alola',        description_fr: 'Possède tous les Pokémon d\'Alola (Gén. 7).',              condition_type: 'full_gen',      condition_value: 7,    gems_reward: 15 },
  { name_fr: 'Formes de Galar',        description_fr: 'Possède tous les Pokémon de Galar (Gén. 8).',              condition_type: 'full_gen',      condition_value: 8,    gems_reward: 15 },
  { name_fr: 'Formes de Paldea',       description_fr: 'Possède tous les Pokémon de Paldea (Gén. 9).',             condition_type: 'full_gen',      condition_value: 9,    gems_reward: 15 },
  { name_fr: 'Toutes les Régions',     description_fr: 'Possède tous les Pokémon de toutes les régions.',          condition_type: 'full_gen',      condition_value: 99,   gems_reward: 100 },
  { name_fr: 'Collectionneur GMax',    description_fr: 'Débloques 10 formes Gigantamax différentes.',              condition_type: 'gmax_count',    condition_value: 10,   gems_reward: 20 },
  { name_fr: 'Maître GMax',            description_fr: 'Débloques toutes les formes Gigantamax disponibles.',      condition_type: 'gmax_count',    condition_value: 25,   gems_reward: 50 },
  { name_fr: 'Collectionneur Formes',  description_fr: 'Possède 50 formes cosmétiques différentes.',               condition_type: 'form_count',    condition_value: 50,   gems_reward: 15 },
]

export default class LivingDexObjectivesSeeder extends BaseSeeder {
  async run() {
    let inserted = 0
    for (const obj of OBJECTIVES) {
      const existing = await db
        .from('living_dex_objectives')
        .where({ name_fr: obj.name_fr })
        .first()

      if (!existing) {
        await db.table('living_dex_objectives').insert({
          ...obj,
          created_at: new Date(),
          updated_at: new Date(),
        })
        inserted++
      }
    }
    console.log(`[LivingDexObjectivesSeeder] ${inserted} objectifs insérés (${OBJECTIVES.length} total).`)
  }
}
