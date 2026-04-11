import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const RAID_BOSSES = [
  {
    species_id: 150,
    name_fr: 'Raid Légendaire — Mewtwo',
    description_fr: 'Le clone génétique ultime. Ses pouvoirs psychiques peuvent anéantir une armée.',
    difficulty: 'hard',
    total_hp: 10_000_000_000,
    level: 100,
    moves: JSON.stringify([94, 56, 244, 53]),
    duration_hours: 24,
    min_players: 5,
    rewards_tiers: JSON.stringify({
      legend:   { min_percent: 5.0,  rewards: ['legendary_pokemon', 'gems_50', 'mega_stone_random'] },
      champion: { min_percent: 2.0,  rewards: ['legendary_pokemon', 'gems_30'] },
      hero:     { min_percent: 0.5,  rewards: ['rare_pokemon', 'gems_15'] },
      fighter:  { min_percent: 0.1,  rewards: ['gems_10'] },
      support:  { min_percent: 0.01, rewards: ['gems_5'] },
    }),
    sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png',
    is_active: true,
  },
  {
    species_id: 249,
    name_fr: 'Raid Légendaire — Lugia',
    description_fr: 'Le gardien des mers. Un battement de ses ailes peut déclencher des tempêtes de 40 jours.',
    difficulty: 'hard',
    total_hp: 8_000_000_000,
    level: 100,
    moves: JSON.stringify([57, 63, 241, 403]),
    duration_hours: 24,
    min_players: 5,
    rewards_tiers: JSON.stringify({
      legend:   { min_percent: 5.0,  rewards: ['lugia_guaranteed', 'gems_50'] },
      champion: { min_percent: 2.0,  rewards: ['lugia_rare', 'gems_30'] },
      hero:     { min_percent: 0.5,  rewards: ['gems_20'] },
      fighter:  { min_percent: 0.1,  rewards: ['gems_10'] },
      support:  { min_percent: 0.01, rewards: ['gems_5'] },
    }),
    sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/249.png',
    is_active: true,
  },
  {
    species_id: 384,
    name_fr: 'Raid Légendaire — Rayquaza',
    description_fr: 'Le dragon du ciel. Il habite dans la stratosphère et est la menace ultime.',
    difficulty: 'extreme',
    total_hp: 25_000_000_000,
    level: 100,
    moves: JSON.stringify([337, 349, 246, 89]),
    duration_hours: 48,
    min_players: 20,
    rewards_tiers: JSON.stringify({
      legend:   { min_percent: 3.0,  rewards: ['rayquaza_guaranteed', 'gems_80', 'mega_stone_rayquaza'] },
      champion: { min_percent: 1.0,  rewards: ['rayquaza_rare', 'gems_50'] },
      hero:     { min_percent: 0.2,  rewards: ['gems_25'] },
      fighter:  { min_percent: 0.05, rewards: ['gems_15'] },
      support:  { min_percent: 0.01, rewards: ['gems_5'] },
    }),
    sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/384.png',
    is_active: true,
  },
  {
    species_id: 483,
    name_fr: 'Raid Cosmique — Dialga',
    description_fr: 'Le maître du temps. Sa respiration fait avancer ou reculer le temps.',
    difficulty: 'extreme',
    total_hp: 20_000_000_000,
    level: 100,
    moves: JSON.stringify([430, 337, 540, 89]),
    duration_hours: 48,
    min_players: 15,
    rewards_tiers: JSON.stringify({
      legend:   { min_percent: 3.0, rewards: ['dialga_guaranteed', 'gems_75'] },
      champion: { min_percent: 1.0, rewards: ['dialga_rare', 'gems_40'] },
      hero:     { min_percent: 0.2, rewards: ['gems_20'] },
      fighter:  { min_percent: 0.05, rewards: ['gems_10'] },
      support:  { min_percent: 0.01, rewards: ['gems_5'] },
    }),
    sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/483.png',
    is_active: true,
  },
  {
    species_id: 716,
    name_fr: 'Raid Mythique — Xerneas',
    description_fr: 'Le Pokémon de la Vie. Ses bois brillent de mille couleurs et peuvent octroyer la vie éternelle.',
    difficulty: 'normal',
    total_hp: 5_000_000_000,
    level: 100,
    moves: JSON.stringify([585, 241, 95, 204]),
    duration_hours: 24,
    min_players: 3,
    rewards_tiers: JSON.stringify({
      legend:   { min_percent: 5.0, rewards: ['xerneas_guaranteed', 'gems_40'] },
      champion: { min_percent: 2.0, rewards: ['xerneas_rare', 'gems_25'] },
      hero:     { min_percent: 0.5, rewards: ['gems_15'] },
      fighter:  { min_percent: 0.1, rewards: ['gems_8'] },
      support:  { min_percent: 0.01, rewards: ['gems_3'] },
    }),
    sprite_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/716.png',
    is_active: true,
  },
]

export default class RaidBossSeeder extends BaseSeeder {
  async run() {
    for (const boss of RAID_BOSSES) {
      const existing = await db
        .from('raid_bosses')
        .where('species_id', boss.species_id)
        .first()

      if (!existing) {
        await db.table('raid_bosses').insert({
          ...boss,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }
    }
    console.log(`[RaidBossSeeder] ${RAID_BOSSES.length} raid bosses seedés.`)
  }
}
