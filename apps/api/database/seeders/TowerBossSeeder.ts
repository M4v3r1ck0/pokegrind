import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

// 20 boss : étages 25 à 500 (tous les 25 étages)
const TOWER_BOSSES = [
  {
    floor_number: 25,
    name_fr: 'Gardien de Pierre',
    description_fr: 'Un titan terreux qui entre en furie sous les 30% de vie.',
    mechanic_type: 'enrage',
    mechanic_config: { threshold: 0.30, damage_mult: 2.0 },
    team_json: [
      { species_id: 68,  level: 30, moves: [7, 8, 9, 207] },
      { species_id: 94,  level: 30, moves: [94, 50, 60, 247] },
      { species_id: 130, level: 32, moves: [82, 127, 56, 44] },
    ],
    gems_reward: 5,
  },
  {
    floor_number: 50,
    name_fr: 'Titan Régénérant',
    description_fr: 'Régénère 5% de ses PV à chaque action. Éliminez-le vite !',
    mechanic_type: 'regen',
    mechanic_config: { heal_per_action: 0.05 },
    team_json: [
      { species_id: 248, level: 55, moves: [242, 89, 157, 212] },
      { species_id: 149, level: 55, moves: [82, 245, 63, 200] },
    ],
    gems_reward: 10,
  },
  {
    floor_number: 75,
    name_fr: 'Miroir d\'Acier',
    description_fr: 'Renvoie 30% des dégâts physiques reçus à l\'attaquant.',
    mechanic_type: 'reflect',
    mechanic_config: { reflect_percent: 0.30, move_categories: ['physical'] },
    team_json: [
      { species_id: 208, level: 75, moves: [232, 231, 442, 334] },
      { species_id: 303, level: 74, moves: [262, 428, 430, 232] },
      { species_id: 302, level: 74, moves: [212, 185, 247, 124] },
    ],
    gems_reward: 15,
  },
  {
    floor_number: 100,
    name_fr: 'Illusionniste Maudit',
    description_fr: 'Crée 2 clones à 40% de ses PV. Trouvez le vrai !',
    mechanic_type: 'clone',
    mechanic_config: { clone_count: 2, clone_hp_percent: 0.40 },
    team_json: [
      { species_id: 150, level: 100, moves: [94, 56, 244, 53] },
    ],
    gems_reward: 20,
  },
  {
    floor_number: 125,
    name_fr: 'Tempête Berserk',
    description_fr: 'Vitesse d\'action ×2.5 après 10 secondes de combat.',
    mechanic_type: 'berserk',
    mechanic_config: { action_speed_mult: 2.5, trigger_ms: 10000 },
    team_json: [
      { species_id: 384, level: 110, moves: [337, 349, 246, 82] },
    ],
    gems_reward: 25,
  },
  {
    floor_number: 150,
    name_fr: 'Sentinelle Ardente',
    mechanic_type: 'enrage',
    mechanic_config: { threshold: 0.50, damage_mult: 1.8 },
    team_json: [
      { species_id: 6,   level: 120, moves: [53, 394, 403, 369] },
      { species_id: 257, level: 120, moves: [394, 67, 68, 83] },
      { species_id: 392, level: 122, moves: [394, 26, 264, 68] },
    ],
    gems_reward: 25,
  },
  {
    floor_number: 175,
    name_fr: 'Léviathan de l\'Abîsse',
    mechanic_type: 'regen',
    mechanic_config: { heal_per_action: 0.08 },
    team_json: [
      { species_id: 9,   level: 125, moves: [56, 58, 352, 392] },
      { species_id: 230, level: 125, moves: [56, 349, 240, 127] },
    ],
    gems_reward: 25,
  },
  {
    floor_number: 200,
    name_fr: 'Spectre Triplant',
    mechanic_type: 'clone',
    mechanic_config: { clone_count: 3, clone_hp_percent: 0.30 },
    team_json: [
      { species_id: 483, level: 130, moves: [430, 337, 428, 50] },
    ],
    gems_reward: 30,
  },
  {
    floor_number: 225,
    name_fr: 'Griffe du Néant',
    mechanic_type: 'reflect',
    mechanic_config: { reflect_percent: 0.40, move_categories: ['physical', 'special'] },
    team_json: [
      { species_id: 487, level: 135, moves: [89, 337, 399, 338] },
    ],
    gems_reward: 30,
  },
  {
    floor_number: 250,
    name_fr: 'Avatar Furieux',
    mechanic_type: 'berserk',
    mechanic_config: { action_speed_mult: 3.0, trigger_ms: 8000 },
    team_json: [
      { species_id: 249, level: 140, moves: [56, 240, 349, 65] },
      { species_id: 250, level: 140, moves: [396, 53, 241, 14] },
    ],
    gems_reward: 35,
  },
  {
    floor_number: 275,
    name_fr: 'Colossus Régénéré',
    mechanic_type: 'regen',
    mechanic_config: { heal_per_action: 0.10 },
    team_json: [
      { species_id: 242, level: 145, moves: [241, 135, 113, 208] },
      { species_id: 143, level: 148, moves: [205, 34, 196, 133] },
    ],
    gems_reward: 35,
  },
  {
    floor_number: 300,
    name_fr: 'Dieu de l\'Abîme',
    mechanic_type: 'enrage',
    mechanic_config: { threshold: 0.40, damage_mult: 2.5 },
    team_json: [
      { species_id: 490, level: 150, moves: [294, 289, 127, 333] },
      { species_id: 491, level: 150, moves: [399, 94, 273, 420] },
    ],
    gems_reward: 40,
  },
  {
    floor_number: 325,
    name_fr: 'Écho de Cristal',
    mechanic_type: 'clone',
    mechanic_config: { clone_count: 2, clone_hp_percent: 0.60 },
    team_json: [
      { species_id: 493, level: 150, moves: [449, 238, 337, 427] },
    ],
    gems_reward: 40,
  },
  {
    floor_number: 350,
    name_fr: 'Vortex Berserk',
    mechanic_type: 'berserk',
    mechanic_config: { action_speed_mult: 3.5, trigger_ms: 6000 },
    team_json: [
      { species_id: 644, level: 155, moves: [552, 432, 97, 246] },
      { species_id: 646, level: 158, moves: [354, 432, 337, 89] },
    ],
    gems_reward: 45,
  },
  {
    floor_number: 375,
    name_fr: 'Miroir Divin',
    mechanic_type: 'reflect',
    mechanic_config: { reflect_percent: 0.50, move_categories: ['physical', 'special'] },
    team_json: [
      { species_id: 718, level: 160, moves: [616, 430, 337, 89] },
    ],
    gems_reward: 45,
  },
  {
    floor_number: 400,
    name_fr: 'Phoenix Éternel',
    mechanic_type: 'regen',
    mechanic_config: { heal_per_action: 0.12 },
    team_json: [
      { species_id: 800, level: 165, moves: [722, 430, 337, 247] },
    ],
    gems_reward: 50,
  },
  {
    floor_number: 425,
    name_fr: 'Chaos Quadruplant',
    mechanic_type: 'clone',
    mechanic_config: { clone_count: 4, clone_hp_percent: 0.25 },
    team_json: [
      { species_id: 888, level: 168, moves: [782, 232, 103, 337] },
    ],
    gems_reward: 50,
  },
  {
    floor_number: 450,
    name_fr: 'Foudre du Destin',
    mechanic_type: 'enrage',
    mechanic_config: { threshold: 0.50, damage_mult: 3.0 },
    team_json: [
      { species_id: 889, level: 172, moves: [784, 232, 276, 337] },
    ],
    gems_reward: 50,
  },
  {
    floor_number: 475,
    name_fr: 'Tempête Ultime',
    mechanic_type: 'berserk',
    mechanic_config: { action_speed_mult: 4.0, trigger_ms: 5000 },
    team_json: [
      { species_id: 895, level: 178, moves: [812, 337, 430, 89] },
      { species_id: 896, level: 178, moves: [813, 432, 246, 337] },
    ],
    gems_reward: 50,
  },
  {
    floor_number: 500,
    name_fr: 'Origine du Monde',
    description_fr: 'Le boss ultime de la première ère. Toutes les mécaniques combinées.',
    mechanic_type: 'enrage',
    mechanic_config: { threshold: 0.35, damage_mult: 3.5 },
    team_json: [
      { species_id: 493, level: 180, moves: [449, 238, 337, 427] },
      { species_id: 800, level: 180, moves: [722, 430, 337, 247] },
      { species_id: 898, level: 185, moves: [826, 573, 94, 337] },
    ],
    gems_reward: 75,
  },
]

export default class extends BaseSeeder {
  async run() {
    for (const boss of TOWER_BOSSES) {
      await db.rawQuery(
        `INSERT INTO tower_bosses
          (floor_number, name_fr, description_fr, mechanic_type, mechanic_config, team_json, gems_reward)
         VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?)
         ON CONFLICT (floor_number) DO NOTHING`,
        [
          boss.floor_number,
          boss.name_fr,
          boss.description_fr ?? null,
          boss.mechanic_type,
          JSON.stringify(boss.mechanic_config),
          JSON.stringify(boss.team_json),
          boss.gems_reward,
        ]
      )
    }
    console.log(`[TowerBossSeeder] ${TOWER_BOSSES.length} boss insérés`)
  }
}
