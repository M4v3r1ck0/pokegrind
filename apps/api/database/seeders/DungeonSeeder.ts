import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

// Types de salles
const ROOM_TYPES = [
  { type: 'combat',   name_fr: 'Salle de Combat',   description_fr: 'Un groupe d\'ennemis vous attend.', weight: 50 },
  { type: 'elite',    name_fr: 'Salle Élite',        description_fr: 'Un ennemi puissant avec une meilleure récompense.', weight: 15 },
  { type: 'rest',     name_fr: 'Salle de Repos',     description_fr: 'Restaure 30% des PV de votre équipe.', weight: 15 },
  { type: 'treasure', name_fr: 'Salle au Trésor',    description_fr: 'Un item aléatoire du donjon vous attend.', weight: 10 },
  { type: 'shop',     name_fr: 'Salle Marchande',    description_fr: 'Achetez des items avec l\'or collecté.', weight: 5 },
  { type: 'trap',     name_fr: 'Salle Piégée',       description_fr: 'Un modificateur négatif est appliqué.', weight: 5 },
  { type: 'boss',     name_fr: 'Salle du Boss',      description_fr: 'Le boss du donjon vous attend.', weight: 0 },
]

// 9 donjons thématiques — un par région
const DUNGEONS = [
  {
    name_fr: 'Ruines de Pierre — Kanto',
    region: 'kanto',
    description_fr: 'Les ruines de l\'ancien Kanto, gardées par des créatures rocheuses implacables.',
    min_prestige: 0,
    difficulty: 'normal',
    enemy_types: JSON.stringify(['rock', 'ground', 'normal']),
    boss_species_id: 112,
    boss_level: 60,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 15 }],
      random: [
        { type: 'item', item_name: 'Vie-Orbe', weight: 20 },
        { type: 'item', item_name: 'Expert Ceinture', weight: 30 },
        { type: 'ct', move_id: 89, weight: 25 },
        { type: 'pokemon', species_id: 111, weight: 25 },
      ],
    }),
  },
  {
    name_fr: 'Sanctuaire des Eaux — Johto',
    region: 'johto',
    description_fr: 'Un temple immergé peuplé de créatures aquatiques mystérieuses.',
    min_prestige: 0,
    difficulty: 'normal',
    enemy_types: JSON.stringify(['water', 'ice', 'dragon']),
    boss_species_id: 230,
    boss_level: 70,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 15 }],
      random: [
        { type: 'item', item_name: 'Choix Lunettes', weight: 20 },
        { type: 'ct', move_id: 57, weight: 30 },
        { type: 'pokemon', species_id: 147, weight: 25 },
        { type: 'item', item_name: 'Restes', weight: 25 },
      ],
    }),
  },
  {
    name_fr: 'Volcan Ardent — Hoenn',
    region: 'hoenn',
    description_fr: 'Les profondeurs du volcan Hoenn, où les créatures de feu régnent en maîtres.',
    min_prestige: 1,
    difficulty: 'normal',
    enemy_types: JSON.stringify(['fire', 'rock', 'steel']),
    boss_species_id: 323,
    boss_level: 80,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 20 }],
      random: [
        { type: 'item', item_name: 'Choix Scarf', weight: 20 },
        { type: 'ct', move_id: 53, weight: 30 },
        { type: 'pokemon', species_id: 228, weight: 25 },
        { type: 'item', item_name: 'Vie-Orbe', weight: 25 },
      ],
    }),
  },
  {
    name_fr: 'Pic Glacé — Sinnoh',
    region: 'sinnoh',
    description_fr: 'Les sommets enneigés de Sinnoh où règnent les Pokémon Glace et Spectre.',
    min_prestige: 2,
    difficulty: 'hard',
    enemy_types: JSON.stringify(['ice', 'psychic', 'ghost']),
    boss_species_id: 473,
    boss_level: 90,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 25 }],
      random: [
        { type: 'item', item_name: 'Mégacaillou Gardevoir', weight: 15 },
        { type: 'ct', move_id: 59, weight: 25 },
        { type: 'pokemon', species_id: 443, weight: 30 },
        { type: 'item', item_name: 'Écaille Bleue', weight: 30 },
      ],
    }),
  },
  {
    name_fr: 'Tour des Ombres — Unova',
    region: 'unova',
    description_fr: 'Une tour maudite où les Pokémon Spectre et Ténèbres conspirent dans l\'obscurité.',
    min_prestige: 3,
    difficulty: 'hard',
    enemy_types: JSON.stringify(['ghost', 'dark', 'psychic']),
    boss_species_id: 635,
    boss_level: 95,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 30 }],
      random: [
        { type: 'item', item_name: 'Mégacaillou Absol', weight: 20 },
        { type: 'pokemon', species_id: 633, weight: 25 },
        { type: 'item', item_name: 'Orbe Toxique', weight: 25 },
        { type: 'ct', move_id: 247, weight: 30 },
      ],
    }),
  },
  {
    name_fr: 'Forêt des Fées — Kalos',
    region: 'kalos',
    description_fr: 'Une forêt enchantée de Kalos où les Fées dansent parmi les fleurs éternelles.',
    min_prestige: 4,
    difficulty: 'hard',
    enemy_types: JSON.stringify(['fairy', 'grass', 'flying']),
    boss_species_id: 671,
    boss_level: 95,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 30 }],
      random: [
        { type: 'item', item_name: 'Mégacaillou Gardevoir', weight: 20 },
        { type: 'pokemon', species_id: 669, weight: 30 },
        { type: 'item', item_name: 'Choix Lunettes', weight: 25 },
        { type: 'ct', move_id: 585, weight: 25 },
      ],
    }),
  },
  {
    name_fr: 'Sanctuaire Ultraviolet — Alola',
    region: 'alola',
    description_fr: 'Les Ruines Ultraviolettes d\'Alola, là où les Ultra-Chimères s\'éveillent.',
    min_prestige: 5,
    difficulty: 'legendary',
    enemy_types: JSON.stringify(['psychic', 'electric', 'dragon']),
    boss_species_id: 791,
    boss_level: 100,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 40 }, { type: 'pokemon', species_id: 789, weight: 100 }],
      random: [
        { type: 'item', item_name: 'Mégacaillou Lucario', weight: 30 },
        { type: 'item', item_name: 'Orbe Flamme', weight: 35 },
        { type: 'pokemon', species_id: 788, weight: 35 },
      ],
    }),
  },
  {
    name_fr: 'Château des Champions — Galar',
    region: 'galar',
    description_fr: 'Le château légendaire de Galar, gardé par les souverains Pokémon Épée et Bouclier.',
    min_prestige: 7,
    difficulty: 'legendary',
    enemy_types: JSON.stringify(['dragon', 'steel', 'dark']),
    boss_species_id: 888,
    boss_level: 100,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 50 }],
      random: [
        { type: 'pokemon', species_id: 888, weight: 10 },
        { type: 'pokemon', species_id: 889, weight: 10 },
        { type: 'item', item_name: 'Choix Scarf', weight: 40 },
        { type: 'item', item_name: 'Vie-Orbe', weight: 40 },
      ],
    }),
  },
  {
    name_fr: 'Abîme du Paradoxe — Paldea',
    region: 'paldea',
    description_fr: 'Les profondeurs interdites de Paldea où le temps et l\'espace se brisent.',
    min_prestige: 10,
    difficulty: 'legendary',
    enemy_types: JSON.stringify(['dragon', 'psychic', 'fairy']),
    boss_species_id: 1007,
    boss_level: 100,
    rewards_pool: JSON.stringify({
      guaranteed: [{ type: 'gems', amount: 60 }],
      random: [
        { type: 'pokemon', species_id: 1007, weight: 10 },
        { type: 'pokemon', species_id: 1008, weight: 10 },
        { type: 'item', item_name: 'Mégacaillou Carchacrok', weight: 40 },
        { type: 'item', item_name: 'Écaille Bleue', weight: 40 },
      ],
    }),
  },
]

export default class extends BaseSeeder {
  async run() {
    // Room types
    for (const rt of ROOM_TYPES) {
      await db.rawQuery(
        `INSERT INTO dungeon_room_types (type, name_fr, description_fr, weight)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (type) DO NOTHING`,
        [rt.type, rt.name_fr, rt.description_fr, rt.weight]
      )
    }
    console.log(`[DungeonSeeder] ${ROOM_TYPES.length} types de salles insérés`)

    // Dungeons
    for (const d of DUNGEONS) {
      await db.rawQuery(
        `INSERT INTO dungeons
          (name_fr, region, description_fr, min_prestige, difficulty, enemy_types,
           boss_species_id, boss_level, rewards_pool, is_active)
         VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, true)
         ON CONFLICT DO NOTHING`,
        [
          d.name_fr, d.region, d.description_fr, d.min_prestige, d.difficulty,
          d.enemy_types, d.boss_species_id, d.boss_level, d.rewards_pool,
        ]
      )
    }
    console.log(`[DungeonSeeder] ${DUNGEONS.length} donjons insérés`)
  }
}
