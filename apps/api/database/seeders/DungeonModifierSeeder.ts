import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const MODIFIERS = [
  // Buffs
  {
    name_fr: 'Adrénaline',
    modifier_type: 'buff',
    effect_json: { all_speed_mult: 1.3 },
    description_fr: 'Toute ton équipe agit 30% plus vite.',
  },
  {
    name_fr: 'Totem de Feu',
    modifier_type: 'buff',
    effect_json: { type_boost: 'fire', mult: 1.5 },
    description_fr: 'Les moves Feu infligent 50% de dégâts supplémentaires.',
  },
  {
    name_fr: 'Ancrage',
    modifier_type: 'buff',
    effect_json: { all_def_mult: 1.4 },
    description_fr: "DEF et SP.DEF de toute l'équipe ×1.4.",
  },
  {
    name_fr: 'Berserker',
    modifier_type: 'buff',
    effect_json: { all_atk_mult: 1.5, all_def_mult: 0.7 },
    description_fr: 'ATK et SP.ATK ×1.5, mais DEF et SP.DEF ×0.7.',
  },
  {
    name_fr: 'Sang-Froid',
    modifier_type: 'buff',
    effect_json: { crit_rate_mult: 3.0 },
    description_fr: 'Taux de coup critique × 3.',
  },
  {
    name_fr: 'Vitalité',
    modifier_type: 'buff',
    effect_json: { all_hp_mult: 1.25 },
    description_fr: 'HP max de toute l\'équipe +25%.',
  },
  // Debuffs
  {
    name_fr: 'Épuisement',
    modifier_type: 'debuff',
    effect_json: { pp_reduction: 0.5 },
    description_fr: 'Tous les PP sont réduits de moitié au début.',
  },
  {
    name_fr: 'Malédiction',
    modifier_type: 'debuff',
    effect_json: { all_hp_mult: 0.75 },
    description_fr: 'HP max de toute l\'équipe -25%.',
  },
  {
    name_fr: 'Brume Toxique',
    modifier_type: 'debuff',
    effect_json: { poison_on_start: true },
    description_fr: 'Tous les Pokémon commencent empoisonnés.',
  },
  {
    name_fr: 'Lenteur',
    modifier_type: 'debuff',
    effect_json: { all_speed_mult: 0.6 },
    description_fr: "Toute l'équipe agit 40% plus lentement.",
  },
  {
    name_fr: 'Anti-Type',
    modifier_type: 'debuff',
    effect_json: { random_type_blocked: true },
    description_fr: 'Un type aléatoire inflige 0 dégâts ce run.',
  },
  // Neutres
  {
    name_fr: 'Brouillard',
    modifier_type: 'neutral',
    effect_json: { accuracy_mult: 0.8 },
    description_fr: 'Précision de tous les moves -20%.',
  },
  {
    name_fr: 'Gravité',
    modifier_type: 'neutral',
    effect_json: { flying_grounded: true },
    description_fr: 'Les Pokémon Vol ne sont plus immunisés au Sol.',
  },
  {
    name_fr: 'Torrent',
    modifier_type: 'neutral',
    effect_json: { type_boost: 'water', enemy_boost: true },
    description_fr: 'Les moves Eau ennemis infligent 50% de plus.',
  },
]

export default class extends BaseSeeder {
  async run() {
    for (const mod of MODIFIERS) {
      await db.rawQuery(
        `INSERT INTO dungeon_modifiers (name_fr, description_fr, modifier_type, effect_json, is_active)
         VALUES (?, ?, ?, ?::jsonb, true)
         ON CONFLICT DO NOTHING`,
        [mod.name_fr, mod.description_fr, mod.modifier_type, JSON.stringify(mod.effect_json)]
      )
    }
    console.log(`[DungeonModifierSeeder] ${MODIFIERS.length} modificateurs insérés`)
  }
}
