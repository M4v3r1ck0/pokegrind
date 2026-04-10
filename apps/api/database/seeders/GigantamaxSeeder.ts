import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

// ─── Moves G-Max à insérer ────────────────────────────────────────────────────
// Ces moves n'existent pas dans PokéAPI standard — on les insère avec des IDs
// dans la plage 10000+ pour éviter les collisions avec les moves officiels.
const GMAX_MOVES = [
  { id: 10001, name_fr: 'G-Max-Feu',          name_en: 'G-Max Wildfire',    type: 'fire',     category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10002, name_fr: 'G-Max-Torrent',       name_en: 'G-Max Stonesurge',  type: 'water',    category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10003, name_fr: 'G-Max-Vigne',         name_en: 'G-Max Vine Lash',   type: 'grass',    category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10004, name_fr: 'G-Max-Voltage',       name_en: 'G-Max Volt Crash',  type: 'electric', category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10005, name_fr: 'G-Max-Bedtime',       name_en: 'G-Max Replenish',   type: 'normal',   category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10006, name_fr: 'G-Max-Repas',         name_en: 'G-Max Resonance',   type: 'ice',      category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10007, name_fr: 'G-Max-Feu-Extrême',   name_en: 'G-Max Fireball',    type: 'fire',     category: 'physical', power: 160, accuracy: 100, pp: 1, priority: 0 },
  { id: 10008, name_fr: 'G-Max-Drumbeat',      name_en: 'G-Max Drum Solo',   type: 'grass',    category: 'physical', power: 160, accuracy: 100, pp: 1, priority: 0 },
  { id: 10009, name_fr: 'G-Max-Fireball',      name_en: 'G-Max Fireball',    type: 'fire',     category: 'special',  power: 160, accuracy: 100, pp: 1, priority: 0 },
  { id: 10010, name_fr: 'G-Max-Foam',          name_en: 'G-Max Foam Burst',  type: 'water',    category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10011, name_fr: 'G-Max-Wind',          name_en: 'G-Max Wind Rage',   type: 'flying',   category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10012, name_fr: 'G-Max-Resonance',     name_en: 'G-Max Resonance',   type: 'ice',      category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10013, name_fr: 'G-Max-Hail',          name_en: 'G-Max Hailstorm',   type: 'ice',      category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10014, name_fr: 'G-Max-Stun',          name_en: 'G-Max Stun Shock',  type: 'electric', category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10015, name_fr: 'G-Max-Sweetness',     name_en: 'G-Max Sweetness',   type: 'grass',    category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10016, name_fr: 'G-Max-Malodo',        name_en: 'G-Max Malodor',     type: 'poison',   category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10017, name_fr: 'G-Max-Terror',        name_en: 'G-Max Terror',      type: 'ghost',    category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10018, name_fr: 'G-Max-Centiferno',    name_en: 'G-Max Centiferno',  type: 'fire',     category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10019, name_fr: 'G-Max-Smite',         name_en: 'G-Max Smite',       type: 'fairy',    category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10020, name_fr: 'G-Max-Snooze',        name_en: 'G-Max Snooze',      type: 'dark',     category: 'physical', power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10021, name_fr: 'G-Max-Finale',        name_en: 'G-Max Finale',      type: 'fairy',    category: 'special',  power: 150, accuracy: 100, pp: 1, priority: 0 },
  { id: 10022, name_fr: 'G-Max-Steelsurge',    name_en: 'G-Max Steelsurge',  type: 'steel',    category: 'physical', power: 160, accuracy: 100, pp: 1, priority: 0 },
  { id: 10023, name_fr: 'G-Max-Volt',          name_en: 'G-Max Volt Crash',  type: 'electric', category: 'physical', power: 160, accuracy: 100, pp: 1, priority: 0 },
  { id: 10024, name_fr: 'G-Max-Chi-Strike',    name_en: 'G-Max Chi Strike',  type: 'fighting', category: 'physical', power: 160, accuracy: 100, pp: 1, priority: 0 },
]

// ─── Formes Gigantamax ────────────────────────────────────────────────────────
const GIGANTAMAX_FORMS = [
  { species_id: 6,   gmax_name_fr: 'Gigantamax-Dracaufeu',    gmax_move_id: 10001, hp: 1.5, atk: 1.0, def: 1.0, spatk: 1.3, spdef: 1.0, speed: 0.8, obtain_method: 'raid' },
  { species_id: 9,   gmax_name_fr: 'Gigantamax-Tortank',      gmax_move_id: 10002, hp: 1.5, atk: 1.0, def: 1.3, spatk: 1.0, spdef: 1.3, speed: 0.8, obtain_method: 'raid' },
  { species_id: 3,   gmax_name_fr: 'Gigantamax-Florizarre',   gmax_move_id: 10003, hp: 1.5, atk: 1.0, def: 1.2, spatk: 1.2, spdef: 1.2, speed: 0.8, obtain_method: 'raid' },
  { species_id: 25,  gmax_name_fr: 'Gigantamax-Pikachu',      gmax_move_id: 10004, hp: 1.5, atk: 1.2, def: 1.0, spatk: 1.2, spdef: 1.0, speed: 1.0, obtain_method: 'raid' },
  { species_id: 143, gmax_name_fr: 'Gigantamax-Ronflex',      gmax_move_id: 10005, hp: 2.0, atk: 1.2, def: 1.2, spatk: 1.0, spdef: 1.2, speed: 0.6, obtain_method: 'raid' },
  { species_id: 131, gmax_name_fr: 'Gigantamax-Lokhlass',     gmax_move_id: 10006, hp: 1.8, atk: 1.0, def: 1.3, spatk: 1.3, spdef: 1.3, speed: 0.7, obtain_method: 'tower' },
  { species_id: 59,  gmax_name_fr: 'Gigantamax-Arcanin',      gmax_move_id: 10007, hp: 1.5, atk: 1.3, def: 1.0, spatk: 1.0, spdef: 1.0, speed: 1.0, obtain_method: 'tower' },
  { species_id: 812, gmax_name_fr: 'Gigantamax-Gorythmic',    gmax_move_id: 10008, hp: 1.5, atk: 1.3, def: 1.2, spatk: 1.0, spdef: 1.0, speed: 0.8, obtain_method: 'raid' },
  { species_id: 815, gmax_name_fr: 'Gigantamax-Laflèche',     gmax_move_id: 10009, hp: 1.5, atk: 1.0, def: 1.0, spatk: 1.4, spdef: 1.0, speed: 1.0, obtain_method: 'raid' },
  { species_id: 818, gmax_name_fr: 'Gigantamax-Oratouac',     gmax_move_id: 10010, hp: 1.5, atk: 1.0, def: 1.2, spatk: 1.3, spdef: 1.2, speed: 0.9, obtain_method: 'raid' },
  { species_id: 823, gmax_name_fr: 'Gigantamax-Corvaillus',   gmax_move_id: 10011, hp: 1.5, atk: 1.3, def: 1.2, spatk: 1.0, spdef: 1.0, speed: 1.0, obtain_method: 'tower' },
  { species_id: 826, gmax_name_fr: 'Gigantamax-Soukongue',    gmax_move_id: 10012, hp: 1.5, atk: 1.2, def: 1.0, spatk: 1.3, spdef: 1.0, speed: 0.9, obtain_method: 'dungeon' },
  { species_id: 834, gmax_name_fr: 'Gigantamax-Beldeneige',   gmax_move_id: 10013, hp: 1.6, atk: 1.0, def: 1.3, spatk: 1.0, spdef: 1.3, speed: 0.8, obtain_method: 'raid' },
  { species_id: 839, gmax_name_fr: 'Gigantamax-Stonjourner',  gmax_move_id: 10014, hp: 1.6, atk: 1.2, def: 1.3, spatk: 1.0, spdef: 1.0, speed: 0.7, obtain_method: 'tower' },
  { species_id: 841, gmax_name_fr: 'Gigantamax-Rosengel',     gmax_move_id: 10015, hp: 1.5, atk: 1.3, def: 1.0, spatk: 1.0, spdef: 1.2, speed: 0.9, obtain_method: 'dungeon' },
  { species_id: 842, gmax_name_fr: 'Gigantamax-Appletun',     gmax_move_id: 10015, hp: 1.6, atk: 1.0, def: 1.2, spatk: 1.3, spdef: 1.2, speed: 0.8, obtain_method: 'dungeon' },
  { species_id: 849, gmax_name_fr: 'Gigantamax-Ectoplasma',   gmax_move_id: 10017, hp: 1.5, atk: 1.3, def: 1.0, spatk: 1.0, spdef: 1.0, speed: 1.1, obtain_method: 'raid' },
  { species_id: 851, gmax_name_fr: 'Gigantamax-Scolocendre',  gmax_move_id: 10018, hp: 1.5, atk: 1.0, def: 1.0, spatk: 1.4, spdef: 1.0, speed: 0.9, obtain_method: 'dungeon' },
  { species_id: 858, gmax_name_fr: 'Gigantamax-Hatterene',    gmax_move_id: 10019, hp: 1.5, atk: 1.0, def: 1.2, spatk: 1.4, spdef: 1.2, speed: 0.7, obtain_method: 'tower' },
  { species_id: 861, gmax_name_fr: 'Gigantamax-Grimmsnarl',   gmax_move_id: 10020, hp: 1.6, atk: 1.4, def: 1.2, spatk: 1.0, spdef: 1.0, speed: 0.8, obtain_method: 'raid' },
  { species_id: 869, gmax_name_fr: 'Gigantamax-Alcremie',     gmax_move_id: 10021, hp: 1.5, atk: 1.0, def: 1.2, spatk: 1.4, spdef: 1.2, speed: 0.8, obtain_method: 'dungeon' },
  { species_id: 879, gmax_name_fr: 'Gigantamax-Coppajah',     gmax_move_id: 10022, hp: 1.7, atk: 1.3, def: 1.3, spatk: 1.0, spdef: 1.0, speed: 0.6, obtain_method: 'tower' },
  { species_id: 884, gmax_name_fr: 'Gigantamax-Drakövolt',    gmax_move_id: 10023, hp: 1.5, atk: 1.3, def: 1.0, spatk: 1.3, spdef: 1.0, speed: 0.9, obtain_method: 'raid' },
  { species_id: 892, gmax_name_fr: 'Gigantamax-Shifours',     gmax_move_id: 10024, hp: 1.5, atk: 1.4, def: 1.2, spatk: 1.0, spdef: 1.0, speed: 1.0, obtain_method: 'tower' },
]

export default class GigantamaxSeeder extends BaseSeeder {
  async run() {
    // 1. Insérer les moves G-Max
    for (const move of GMAX_MOVES) {
      const existing = await db.from('moves').where('id', move.id).first()
      if (!existing) {
        await db.table('moves').insert({
          id: move.id,
          name_fr: move.name_fr,
          name_en: move.name_en,
          type: move.type,
          category: move.category,
          power: move.power,
          accuracy: move.accuracy,
          pp: move.pp,
          priority: move.priority,
          created_at: new Date(),
        })
      }
    }
    console.log(`[GigantamaxSeeder] ${GMAX_MOVES.length} moves G-Max insérés/vérifiés.`)

    // 2. Insérer les formes Gigantamax
    let inserted = 0
    for (const gmax of GIGANTAMAX_FORMS) {
      // Vérifier que l'espèce existe
      const species = await db.from('pokemon_species').where('id', gmax.species_id).first()
      if (!species) {
        console.warn(`[GigantamaxSeeder] Espèce ${gmax.species_id} introuvable — ignoré.`)
        continue
      }

      // Générer sprite URL
      const sprite_url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${gmax.species_id}.png`
      const sprite_shiny_url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${gmax.species_id}.png`

      const existing = await db.from('gigantamax_forms').where('species_id', gmax.species_id).first()
      if (!existing) {
        await db.table('gigantamax_forms').insert({
          species_id: gmax.species_id,
          gmax_name_fr: gmax.gmax_name_fr,
          gmax_move_id: gmax.gmax_move_id,
          gmax_hp_mult: gmax.hp,
          gmax_atk_mult: gmax.atk,
          gmax_def_mult: gmax.def,
          gmax_spatk_mult: gmax.spatk,
          gmax_spdef_mult: gmax.spdef,
          gmax_speed_mult: gmax.speed,
          sprite_url,
          sprite_shiny_url,
          obtain_method: gmax.obtain_method,
          created_at: new Date(),
          updated_at: new Date(),
        })
        inserted++
      }
    }
    console.log(`[GigantamaxSeeder] ${inserted} formes Gigantamax insérées (${GIGANTAMAX_FORMS.length} total).`)
  }
}
