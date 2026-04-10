/**
 * PlayerUpgradeService — Cache Redis des upgrades joueur (TTL 5 min).
 * Évite une requête BDD à chaque action de combat.
 */

import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'
import {
  calcMaxDaycareSlots,
  calcLegendaryPity,
  DEFAULT_DAYCARE_SLOTS,
  DEFAULT_LEGENDARY_PITY,
} from '#services/ShopFormulas'

const CACHE_TTL = 300 // 5 minutes

class PlayerUpgradeService {
  private cacheKey(player_id: string): string {
    return `upgrades:${player_id}`
  }

  /**
   * Retourne les effect_types des upgrades possédées par un joueur.
   * Utilise un cache Redis de 5 minutes.
   */
  async getUpgrades(player_id: string): Promise<string[]> {
    const key = this.cacheKey(player_id)
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)

    const rows = await db
      .from('player_upgrades')
      .join('shop_upgrades', 'shop_upgrades.id', 'player_upgrades.upgrade_id')
      .where('player_upgrades.player_id', player_id)
      .select('shop_upgrades.effect_type', 'shop_upgrades.id')

    const effect_types = rows.map((r: any) => r.effect_type as string)
    await redis.setex(key, CACHE_TTL, JSON.stringify(effect_types))

    return effect_types
  }

  /**
   * Retourne les IDs des upgrades possédées.
   */
  async getUpgradeIds(player_id: string): Promise<number[]> {
    const rows = await db
      .from('player_upgrades')
      .where('player_id', player_id)
      .select('upgrade_id')
    return rows.map((r: any) => Number(r.upgrade_id))
  }

  /**
   * Vérifie si un joueur possède une upgrade par son effect_type.
   */
  async hasUpgrade(player_id: string, effect_type: string): Promise<boolean> {
    const upgrades = await this.getUpgrades(player_id)
    return upgrades.includes(effect_type)
  }

  /**
   * Nombre max de slots pension (5 par défaut, jusqu'à 10 avec upgrades).
   */
  async getMaxDaycareSlots(player_id: string): Promise<number> {
    const ids = await this.getUpgradeIds(player_id)
    return calcMaxDaycareSlots(ids)
  }

  /**
   * Seuil de pity légendaire (200 ou 180 avec upgrade).
   */
  async getLegendaryPityThreshold(player_id: string): Promise<number> {
    const upgrades = await this.getUpgrades(player_id)
    return calcLegendaryPity(upgrades)
  }

  /**
   * Vérifie si le joueur a le 5ème slot de move.
   */
  async hasMove5Slot(player_id: string): Promise<boolean> {
    return this.hasUpgrade(player_id, 'move_slot_5')
  }

  /**
   * Invalide le cache pour un joueur (après achat).
   */
  async invalidateCache(player_id: string): Promise<void> {
    await redis.del(this.cacheKey(player_id))
  }
}

const playerUpgradeService = new PlayerUpgradeService()
export default playerUpgradeService
