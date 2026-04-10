/**
 * GameConfigService — Configuration globale du jeu.
 * Lit depuis Redis (cache 5min), fallback BDD, fallback valeur par défaut.
 * Toute modification admin invalide le cache Redis.
 */

import redis from '@adonisjs/redis/services/main'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'

const CACHE_TTL_SECONDS = 300 // 5 minutes

/** Valeurs par défaut de secours (si BDD inaccessible) */
const HARD_DEFAULTS: Record<string, unknown> = {
  'combat.boss_timer_seconds':       90,
  'combat.tower_boss_timer_seconds': 120,
  'combat.offline_cap_hours':        24,
  'gacha.legendary_pity':            200,
  'gacha.epic_pity':                 50,
  'gacha.shiny_rate':                8192,
  'gacha.pull_cost_gold':            1000,
  'daycare.base_slots':              5,
  'daycare.hidden_talent_rate':      200,
  'daycare.shiny_5star_rate':        200,
  'raid.attack_cooldown_hours':      4,
  'raid.auto_schedule_days':         3,
  'pvp.season_duration_days':        90,
  'pvp.elo_start':                   1000,
  'pvp.attack_cooldown_hours':       4,
  'economy.gems_boss_first':         2,
  'economy.gems_region_complete':    10,
  'economy.gems_pokedex_gen':        15,
  'system.maintenance_mode':         false,
  'system.maintenance_message':      'Maintenance en cours, retour imminent.',
  'system.max_players_online':       10000,
}

class GameConfigService {
  private cacheKey(key: string) {
    return `game_config:${key}`
  }

  /**
   * Lire une valeur de configuration.
   * Ordre de priorité : Redis → BDD → default_value
   */
  async get<T>(key: string, default_value: T): Promise<T> {
    try {
      const cached = await redis.get(this.cacheKey(key))
      if (cached !== null) {
        return JSON.parse(cached) as T
      }
    } catch (err: any) {
      logger.warn(`[GameConfig] Redis read error for key=${key}: ${err.message}`)
    }

    try {
      const row = await db.from('game_config').where('key', key).first()
      if (row) {
        const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
        // Stocker en cache
        await redis.setex(this.cacheKey(key), CACHE_TTL_SECONDS, JSON.stringify(value)).catch(() => {})
        return value as T
      }
    } catch (err: any) {
      logger.warn(`[GameConfig] DB read error for key=${key}: ${err.message}`)
    }

    // Fallback hard default si pas de valeur par défaut explicite
    if (key in HARD_DEFAULTS) {
      return HARD_DEFAULTS[key] as T
    }

    return default_value
  }

  /**
   * Modifier une valeur de configuration (par un admin).
   */
  async set(key: string, value: unknown, admin_id: string): Promise<void> {
    await db.table('game_config').insert({
      key,
      value: JSON.stringify(value),
      updated_by: admin_id,
      updated_at: new Date(),
    }).onConflict('key').merge(['value', 'updated_by', 'updated_at'])

    await this.invalidate(key)
    logger.info(`[GameConfig] key=${key} updated to ${JSON.stringify(value)} by admin ${admin_id}`)
  }

  /**
   * Invalider le cache Redis pour une clé.
   */
  async invalidate(key: string): Promise<void> {
    try {
      await redis.del(this.cacheKey(key))
    } catch { /* ignore */ }
  }

  /**
   * Remettre à la valeur par défaut (hardcodée).
   */
  async reset(key: string, admin_id: string): Promise<void> {
    const default_value = HARD_DEFAULTS[key]
    if (default_value === undefined) {
      throw new Error(`Aucune valeur par défaut pour la clé : ${key}`)
    }
    await this.set(key, default_value, admin_id)
  }

  /**
   * Lister toutes les clés de configuration avec leur valeur actuelle.
   */
  async getAll(): Promise<Array<{ key: string; value: unknown; description_fr: string | null; updated_at: Date }>> {
    const rows = await db.from('game_config').orderBy('key')
    return rows.map((row) => ({
      key: row.key,
      value: typeof row.value === 'string' ? JSON.parse(row.value) : row.value,
      description_fr: row.description_fr,
      updated_at: row.updated_at,
    }))
  }
}

export default new GameConfigService()
