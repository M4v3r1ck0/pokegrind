/**
 * GemsService — Source unique de vérité pour toutes les transactions gems.
 * RÈGLE ABSOLUE : toute attribution de gems passe par awardGems().
 * Toute dépense passe par spendGems().
 * Aucune modification directe du champ gems sans entrée dans gems_audit.
 */

import db from '@adonisjs/lucid/services/db'
import type { GemSource } from '#services/ShopFormulas'
import { applyGemBoost } from '#services/EventFormulas'

class GemsService {
  /**
   * Attribue des gems à un joueur et crée l'entrée d'audit.
   * Utiliser pour TOUS les gains de gems (boss, région, milestone, etc.)
   */
  async awardGems(
    player_id: string,
    amount: number,
    reason: string,
    source: GemSource
  ): Promise<void> {
    if (amount <= 0) throw new Error('amount doit être positif')

    // Appliquer le gem_boost event si actif
    try {
      const { default: eventService } = await import('#services/EventService')
      const config = await eventService.getActiveEventConfig('gem_boost')
      amount = applyGemBoost(amount, source, config)
    } catch { /* ignore if eventService unavailable */ }

    await db.transaction(async (trx) => {
      await trx.from('players').where('id', player_id).increment('gems', amount)
      await trx.table('gems_audit').insert({
        id: crypto.randomUUID(),
        player_id,
        amount,
        reason,
        source,
        created_at: new Date(),
      })
    })
  }

  /**
   * Déduit des gems d'un joueur et crée l'entrée d'audit.
   * Utiliser pour TOUTES les dépenses de gems (achat boutique, etc.)
   * Lance une erreur si gems insuffisants.
   */
  async spendGems(
    player_id: string,
    amount: number,
    reason: string,
    source: GemSource = 'shop_purchase'
  ): Promise<void> {
    if (amount <= 0) throw new Error('amount doit être positif')

    await db.transaction(async (trx) => {
      // Vérifier gems disponibles avec SELECT FOR UPDATE
      const player = await trx.from('players').where('id', player_id).forUpdate().first()
      if (!player) throw new Error('Joueur introuvable')
      if (Number(player.gems) < amount) {
        throw new Error(`Gems insuffisants (${player.gems} disponibles, ${amount} requis)`)
      }

      await trx.from('players').where('id', player_id).decrement('gems', amount)
      await trx.table('gems_audit').insert({
        id: crypto.randomUUID(),
        player_id,
        amount: -amount,
        reason,
        source,
        created_at: new Date(),
      })
    })
  }

  /**
   * Retourne le solde de gems actuel d'un joueur.
   */
  async getBalance(player_id: string): Promise<number> {
    const row = await db.from('players').where('id', player_id).select('gems').first()
    return Number(row?.gems ?? 0)
  }

  /**
   * Historique des transactions gems d'un joueur (paginé).
   */
  async getAuditLog(
    player_id: string | null,
    opts: { source?: string; from?: string; to?: string; page?: number }
  ): Promise<{ entries: any[]; total: number }> {
    const page = opts.page ?? 1
    const per_page = 50

    const applyFilters = (q: any) => {
      if (player_id) q = q.where('player_id', player_id)
      if (opts.source) q = q.where('source', opts.source)
      if (opts.from) q = q.where('created_at', '>=', opts.from)
      if (opts.to) q = q.where('created_at', '<=', opts.to)
      return q
    }

    const total_row = await applyFilters(db.from('gems_audit')).count('* as total').first()
    const entries = await applyFilters(db.from('gems_audit'))
      .orderBy('created_at', 'desc')
      .limit(per_page)
      .offset((page - 1) * per_page)

    return { entries, total: Number(total_row?.total ?? 0) }
  }
}

const gemsService = new GemsService()
export default gemsService
export { GemsService }
