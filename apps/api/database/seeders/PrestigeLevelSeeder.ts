import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const TIER_NAMES = [
  'Étoilé', 'Astral', 'Céleste', 'Divin', 'Légendaire',
  'Mythique', 'Cosmique', 'Éternel', 'Transcendant', 'Ultime',
]
const LEVEL_NAMES = ['I', 'II', 'III', 'IV', 'V']

const PRESTIGE_LEVELS = Array.from({ length: 50 }, (_, i) => {
  const level = i + 1
  const gold_mult = 1 + Math.sqrt(level) * 0.08
  const xp_mult = 1 + Math.sqrt(level) * 0.06
  const dc_mult = 1 + Math.sqrt(level) * 0.04
  const gem_bonus = Math.floor(level / 5)
  const gems_gift = 10 + level * 2
  const tier = TIER_NAMES[Math.floor((level - 1) / 5)]
  const sub = LEVEL_NAMES[(level - 1) % 5]
  const name_fr = `${tier} ${sub}`

  return {
    level,
    name_fr,
    description_fr: `Prestige ${level} — ${name_fr}`,
    required_floor: 100,
    gold_multiplier: parseFloat(gold_mult.toFixed(2)),
    xp_multiplier: parseFloat(xp_mult.toFixed(2)),
    gem_bonus_per_boss: gem_bonus,
    daycare_speed_bonus: parseFloat(dc_mult.toFixed(2)),
    gems_reward: gems_gift,
    badge_name_fr: `Badge ${name_fr}`,
    badge_sprite_url: null,
  }
})

export default class extends BaseSeeder {
  async run() {
    for (const row of PRESTIGE_LEVELS) {
      await db.rawQuery(
        `INSERT INTO prestige_levels
          (level, name_fr, description_fr, required_floor, gold_multiplier, xp_multiplier,
           gem_bonus_per_boss, daycare_speed_bonus, gems_reward, badge_name_fr, badge_sprite_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (level) DO NOTHING`,
        [
          row.level, row.name_fr, row.description_fr, row.required_floor,
          row.gold_multiplier, row.xp_multiplier, row.gem_bonus_per_boss,
          row.daycare_speed_bonus, row.gems_reward, row.badge_name_fr, row.badge_sprite_url,
        ]
      )
    }
    console.log(`[PrestigeLevelSeeder] ${PRESTIGE_LEVELS.length} niveaux de prestige insérés`)
  }
}
