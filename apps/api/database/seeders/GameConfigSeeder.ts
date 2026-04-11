import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'

const DEFAULT_CONFIG = [
  // Combat
  { key: 'combat.boss_timer_seconds',       value: 90,     description_fr: 'Timer boss combat idle (secondes)' },
  { key: 'combat.tower_boss_timer_seconds', value: 120,    description_fr: 'Timer boss Tour Infinie (secondes)' },
  { key: 'combat.offline_cap_hours',        value: 24,     description_fr: 'Cap calcul offline (heures)' },

  // Gacha
  { key: 'gacha.legendary_pity',            value: 200,    description_fr: 'Pity légendaire de base' },
  { key: 'gacha.epic_pity',                 value: 50,     description_fr: 'Pity épique' },
  { key: 'gacha.shiny_rate',                value: 8192,   description_fr: 'Dénominateur taux shiny (1/N)' },
  { key: 'gacha.pull_cost_gold',            value: 1000,   description_fr: "Coût d'un pull (or)" },

  // Pension
  { key: 'daycare.base_slots',              value: 5,      description_fr: 'Slots pension de base' },
  { key: 'daycare.hidden_talent_rate',      value: 200,    description_fr: 'Dénominateur Talent Caché (1/N)' },
  { key: 'daycare.shiny_5star_rate',        value: 200,    description_fr: 'Taux shiny à 5★ (1/N)' },

  // Raids
  { key: 'raid.attack_cooldown_hours',      value: 4,      description_fr: 'Cooldown attaque Raid (heures)' },
  { key: 'raid.auto_schedule_days',         value: 3,      description_fr: 'Fréquence auto des Raids (jours)' },

  // PvP
  { key: 'pvp.season_duration_days',        value: 90,     description_fr: 'Durée des saisons PvP (jours)' },
  { key: 'pvp.elo_start',                   value: 1000,   description_fr: 'ELO de départ' },
  { key: 'pvp.attack_cooldown_hours',       value: 4,      description_fr: 'Cooldown attaque même joueur' },

  // Économie
  { key: 'economy.gems_boss_first',         value: 2,      description_fr: 'Gems boss 1ère victoire' },
  { key: 'economy.gems_region_complete',    value: 10,     description_fr: 'Gems région complétée' },
  { key: 'economy.gems_pokedex_gen',        value: 15,     description_fr: 'Gems Pokédex gen complété' },

  // Maintenance
  { key: 'system.maintenance_mode',         value: false,  description_fr: 'Mode maintenance actif' },
  { key: 'system.maintenance_message',      value: 'Maintenance en cours, retour imminent.', description_fr: 'Message maintenance' },
  { key: 'system.max_players_online',       value: 10000,  description_fr: 'Limite joueurs connectés simultanément' },
]

export default class GameConfigSeeder extends BaseSeeder {
  async run() {
    for (const cfg of DEFAULT_CONFIG) {
      await db.rawQuery(
        `INSERT INTO game_config (key, value, description_fr, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (key) DO NOTHING`,
        [cfg.key, JSON.stringify(cfg.value), cfg.description_fr, new Date()]
      )
    }

    console.log(`[GameConfigSeeder] ${DEFAULT_CONFIG.length} clés de configuration insérées`)
  }
}
