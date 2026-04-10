import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

interface FloorData {
  floor_number: number
  region: string
  name_fr: string
  min_level: number
  max_level: number
  gold_base: number
  xp_base: number
  enemy_types: string[]
  boss_trainer_name: string | null
  boss_team: object | null
  is_milestone: boolean
  unlock_floor: number
}

// Boss teams référençant des species_id réels (Gen 1 starters + pokemon emblématiques)
// Salamèche=4, Carapuce=7, Bulbizarre=1, Pikachu=25, Racaillou=74, Rocher=75, Grolem=76
// Staross=120, Hypocéan=121, Tentacool=72, Stari=121, Tentacruel=73
// Herbizarre=2, Florizarre=3, Dracaufeu=6, Blastoise=9
// Lokhlass=131, Noadkoko=113, Kangourex=115, Leviator=130
// Artikodin=144, Electhor=145, Sulfura=146, Mewtwo=150, Lugia=249 (Gen 2)
// Lance: Dracolosse=149, Draco=147, Dracoair=148, Osselait=104, Ossatueur=105

const BOSS_TEAMS: Record<number, { trainer: string; team: object }> = {
  10: {
    trainer: 'Sacha',
    team: [
      { species_id: 25, level: 18, moves: [] },   // Pikachu
      { species_id: 4, level: 15, moves: [] },    // Salamèche
      { species_id: 7, level: 15, moves: [] },    // Carapuce
      { species_id: 1, level: 15, moves: [] },    // Bulbizarre
    ],
  },
  20: {
    trainer: 'Ondine',
    team: [
      { species_id: 121, level: 35, moves: [] },  // Hypocéan
      { species_id: 120, level: 32, moves: [] },  // Staross
      { species_id: 73, level: 33, moves: [] },   // Tentacruel
      { species_id: 55, level: 30, moves: [] },   // Aligatueur → utilise Caninos (58) à la place
    ],
  },
  30: {
    trainer: 'Pierre',
    team: [
      { species_id: 76, level: 50, moves: [] },   // Grolem
      { species_id: 75, level: 48, moves: [] },   // Rocher
      { species_id: 95, level: 47, moves: [] },   // Onix
      { species_id: 111, level: 45, moves: [] },  // Rhinocorne
    ],
  },
  40: {
    trainer: 'Christophe',
    team: [
      { species_id: 130, level: 60, moves: [] },  // Leviator
      { species_id: 131, level: 58, moves: [] },  // Lokhlass
      { species_id: 55, level: 56, moves: [] },   // Akwakwak
      { species_id: 134, level: 55, moves: [] },  // Aquali
    ],
  },
  50: {
    trainer: 'Lugia',
    team: [
      { species_id: 249, level: 70, moves: [] },  // Lugia
      { species_id: 245, level: 65, moves: [] },  // Suicune
      { species_id: 144, level: 60, moves: [] },  // Artikodin
    ],
  },
  60: {
    trainer: 'Cynthia',
    team: [
      { species_id: 445, level: 78, moves: [] },  // Carchacrok
      { species_id: 442, level: 74, moves: [] },  // Mimigal
      { species_id: 437, level: 72, moves: [] },  // Bronzong
      { species_id: 428, level: 72, moves: [] },  // Lockpin
      { species_id: 448, level: 76, moves: [] },  // Lucario
    ],
  },
  70: {
    trainer: 'Red',
    team: [
      { species_id: 25, level: 88, moves: [] },   // Pikachu
      { species_id: 6, level: 84, moves: [] },    // Dracaufeu
      { species_id: 9, level: 84, moves: [] },    // Blastoise
      { species_id: 3, level: 84, moves: [] },    // Florizarre
      { species_id: 143, level: 82, moves: [] },  // Ronflex
    ],
  },
  80: {
    trainer: 'Steven',
    team: [
      { species_id: 376, level: 88, moves: [] },  // Métalosse
      { species_id: 227, level: 85, moves: [] },  // Airmure
      { species_id: 306, level: 85, moves: [] },  // Trioxhydre
      { species_id: 344, level: 83, moves: [] },  // Clayclam
      { species_id: 302, level: 83, moves: [] },  // Mysdibule
    ],
  },
  90: {
    trainer: 'Iris',
    team: [
      { species_id: 612, level: 95, moves: [] },  // Drakkar
      { species_id: 635, level: 93, moves: [] },  // Hydragon
      { species_id: 611, level: 91, moves: [] },  // Fraxure → Haxorus
      { species_id: 160, level: 90, moves: [] },  // Aligatueur
      { species_id: 230, level: 88, moves: [] },  // Hyporoi
    ],
  },
  100: {
    trainer: 'Lance',
    team: [
      { species_id: 149, level: 100, moves: [] }, // Dracolosse
      { species_id: 149, level: 100, moves: [] }, // Dracolosse ×2
      { species_id: 148, level: 96, moves: [] },  // Dracoair
      { species_id: 148, level: 96, moves: [] },  // Dracoair ×2
      { species_id: 142, level: 90, moves: [] },  // Ptera
      { species_id: 105, level: 88, moves: [] },  // Ossatueur
    ],
  },
}

// Données de région
const REGIONS = [
  {
    name: 'kanto',
    floors: [1, 20],
    minLevelBase: 1,
    levelPerFloor: 1.5,
    goldBase: 10,
    goldPerFloor: 2,
    xpBase: 8,
    xpPerFloor: 1.5,
    types: [
      ['normal'],
      ['fire', 'normal'],
      ['water', 'normal'],
      ['grass', 'bug'],
      ['electric', 'normal'],
      ['psychic', 'normal'],
      ['rock', 'ground'],
      ['poison', 'bug'],
      ['water', 'ice'],
      ['fire', 'flying'],
    ],
    names: [
      'Route 1 — Jadielle', 'Route 2 — Argenta', 'Forêt de Jade', 'Route 3 — Parmanie',
      'Mt. Moon', 'Route 4 — Azuria', 'Grotte Azuria', 'Route 5 — Carmin', 'Tour Pokémon',
      'Route 6 — Cramoisîle', 'Route 7 — Céladopolis', 'Parc Safari', 'Route 8 — Fuchsia',
      'Route 9 — Poudre', 'Route 10 — Cramoisîle', 'Route 11 — Cramoisîle', 'Chemin Victoire I',
      'Chemin Victoire II', 'Chemin Victoire III', 'Ligue Kanto',
    ],
  },
  {
    name: 'johto',
    floors: [21, 40],
    minLevelBase: 25,
    levelPerFloor: 1.25,
    goldBase: 40,
    goldPerFloor: 4,
    xpBase: 30,
    xpPerFloor: 3,
    types: [
      ['normal', 'water'],
      ['ghost', 'poison'],
      ['ice', 'water'],
      ['electric', 'flying'],
      ['fire', 'grass'],
      ['rock', 'ground'],
      ['psychic', 'normal'],
      ['dark', 'ghost'],
      ['fighting', 'normal'],
      ['dragon', 'water'],
    ],
    names: [
      'Route 29 — Bourg Palette', 'Route 30 — Ecorcia', 'Forêt de Viridain', 'Tour Ectoplasma',
      'Lac Colère', 'Route 33 — Azaclée', 'Mt. Mortar', 'Route 36 — Doublonville',
      'Bois aux Farfadet', 'Route 39 — Oliville', 'Route 40 — Doublonville', 'Grotte de l\'Ours',
      'Route 42 — Oliville', 'Route 44 — Safrania', 'Grotte du Dragon', 'Mt. Argenté',
      'Chemin Victoire Johto I', 'Chemin Victoire Johto II', 'Chemin Victoire Johto III', 'Ligue Johto',
    ],
  },
  {
    name: 'hoenn',
    floors: [41, 60],
    minLevelBase: 45,
    levelPerFloor: 1.25,
    goldBase: 100,
    goldPerFloor: 7.5,
    xpBase: 75,
    xpPerFloor: 5,
    types: [
      ['water', 'normal'],
      ['fire', 'ground'],
      ['electric', 'steel'],
      ['grass', 'poison'],
      ['rock', 'steel'],
      ['ghost', 'dark'],
      ['psychic', 'grass'],
      ['water', 'flying'],
      ['dragon', 'flying'],
      ['fire', 'psychic'],
    ],
    names: [
      'Route 101 — Bourg-en-Vol', 'Bois aux Bois', 'Route 103 — Jadielle', 'Mt. Rocs',
      'Route 111 — Feuillade', 'Désert de Sable', 'Route 113 — Falaise', 'Route 114 — Falaise',
      'Cratère Magma', 'Profondeurs Aqua', 'Route 120 — Feuillade', 'Caverne Sauvage',
      'Route 123 — Lilycove', 'Tour de la Falaise', 'Espace Abandonné', 'Tunnel Aqua',
      'Chemin Victoire Hoenn I', 'Chemin Victoire Hoenn II', 'Chemin Victoire Hoenn III', 'Ligue Hoenn',
    ],
  },
  {
    name: 'sinnoh',
    floors: [61, 80],
    minLevelBase: 65,
    levelPerFloor: 1.0,
    goldBase: 220,
    goldPerFloor: 11.5,
    xpBase: 160,
    xpPerFloor: 8,
    types: [
      ['steel', 'rock'],
      ['ghost', 'dark'],
      ['ice', 'water'],
      ['psychic', 'fighting'],
      ['dragon', 'ground'],
      ['grass', 'ice'],
      ['fire', 'electric'],
      ['water', 'steel'],
      ['dark', 'fighting'],
      ['dragon', 'flying'],
    ],
    names: [
      'Route 201 — Bonaugure', 'Bois aux Cartouches', 'Route 206 — Vestigion', 'Mt. Couronné',
      'Lac Valeur', 'Lac Bravoure', 'Lac Acuité', 'Tour Perdue', 'Ruines Acier',
      'Grotte du Lac', 'Route 214 — Jubilife', 'Chemin des Désolés', 'Pic Ombrageux',
      'Pic Tempétueux', 'Arène de la Frontière', 'Domaine Survivant',
      'Chemin Victoire Sinnoh I', 'Chemin Victoire Sinnoh II', 'Chemin Victoire Sinnoh III', 'Ligue Sinnoh',
    ],
  },
  {
    name: 'unova',
    floors: [81, 100],
    minLevelBase: 80,
    levelPerFloor: 1.0,
    goldBase: 400,
    goldPerFloor: 20,
    xpBase: 290,
    xpPerFloor: 14,
    types: [
      ['dark', 'fighting'],
      ['fire', 'dragon'],
      ['electric', 'steel'],
      ['grass', 'bug'],
      ['ice', 'ghost'],
      ['dragon', 'dark'],
      ['psychic', 'fairy'],
      ['fire', 'fighting'],
      ['dragon', 'ice'],
      ['dragon', 'fire'],
    ],
    names: [
      'Route 1 — Nuvema', 'Forêt de Pinecap', 'Route 4 — Nimbasa', 'Désert Difficile',
      'Route 6 — Driftsveil', 'Pont Poubelle', 'Route 8 — Icirrus', 'Marais Gel',
      'Grotte Gifted', 'Tour du Paradoxe', 'Lande Abandonnée', 'Route 13 — Lacunosa',
      'Chemin du Sanctuaire', 'Village du Sanctuaire', 'Château Pokémon I', 'Château Pokémon II',
      'Chemin Victoire Unova I', 'Chemin Victoire Unova II', 'Chemin Victoire Unova III', 'Ligue Unova',
    ],
  },
]

export default class FloorSeeder extends BaseSeeder {
  async run() {
    const floors: FloorData[] = []

    for (const region of REGIONS) {
      const [startFloor, endFloor] = region.floors
      const count = endFloor - startFloor + 1

      for (let i = 0; i < count; i++) {
        const floorNumber = startFloor + i
        const localIndex = i  // 0-based within region

        const minLevel = Math.round(region.minLevelBase + localIndex * region.levelPerFloor)
        const maxLevel = Math.min(100, Math.round(minLevel + 5))
        const goldBase = Math.round(region.goldBase + localIndex * region.goldPerFloor)
        const xpBase = Math.round(region.xpBase + localIndex * region.xpPerFloor)
        const enemyTypes = region.types[localIndex % region.types.length]

        const boss = BOSS_TEAMS[floorNumber]
        const isMilestone = floorNumber === 50 || floorNumber === 100

        floors.push({
          floor_number: floorNumber,
          region: region.name,
          name_fr: region.names[localIndex] ?? `Étage ${floorNumber}`,
          min_level: minLevel,
          max_level: maxLevel,
          gold_base: goldBase,
          xp_base: xpBase,
          enemy_types: enemyTypes,
          boss_trainer_name: boss?.trainer ?? null,
          boss_team: boss?.team ?? null,
          is_milestone: isMilestone,
          unlock_floor: floorNumber === 1 ? 1 : floorNumber - 1,
        })
      }
    }

    for (const floor of floors) {
      const row = {
        ...floor,
        enemy_types: JSON.stringify(floor.enemy_types),
        boss_team: floor.boss_team ? JSON.stringify(floor.boss_team) : null,
      }
      await db.knexQuery().table('floors').insert(row).onConflict('floor_number').merge()
    }
    console.log(`[FloorSeeder] ${floors.length} étages insérés/mis à jour.`)
  }
}
