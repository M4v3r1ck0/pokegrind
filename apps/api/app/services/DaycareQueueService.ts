/**
 * DaycareQueueService — File d'attente pension
 * Actif uniquement si le joueur a acheté l'upgrade 'daycare_queue'.
 */

import db from '@adonisjs/lucid/services/db'
import daycareService, { hasUpgrade } from '#services/DaycareService'
import type { Server as SocketServer } from 'socket.io'

let io: SocketServer | null = null

export function setIO(socket_io: SocketServer): void {
  io = socket_io
}

export default class DaycareQueueService {
  /**
   * Quand un slot se libère, dépôt automatique du premier élément de la file.
   */
  static async processQueue(player_id: string, freed_slot: number): Promise<void> {
    const queue_active = await hasUpgrade(player_id, 'daycare_queue')
    if (!queue_active) return

    // Prendre le premier élément de la file (position la plus basse)
    const item = await db
      .from('daycare_queue')
      .where('player_id', player_id)
      .orderBy('position', 'asc')
      .first()

    if (!item) return

    const target_slot = item.target_slot ?? freed_slot

    try {
      await daycareService.depositPokemon(
        player_id,
        item.pokemon_id,
        target_slot,
        item.partner_id ?? undefined
      )

      // Retirer l'élément de la file
      await db.from('daycare_queue').where('id', item.id).delete()

      // Réordonner la file
      await DaycareQueueService.reorderQueue(player_id)

      // Émettre event Socket.io si disponible
      if (io) {
        io.to(`combat:${player_id}`).emit('daycare:queue_deposited', {
          slot_number: target_slot,
          pokemon_id: item.pokemon_id,
          remaining_queue_size: await DaycareQueueService.getQueueSize(player_id),
        })
      }
    } catch (err) {
      // Le dépôt a échoué (slot non libre ou Pokémon invalide) → retirer quand même l'élément
      console.warn(`[DaycareQueueService] Échec dépôt auto slot ${target_slot}:`, err)
      await db.from('daycare_queue').where('id', item.id).delete()
      await DaycareQueueService.reorderQueue(player_id)
    }
  }

  static async addToQueue(
    player_id: string,
    pokemon_id: string,
    partner_id?: string,
    target_slot?: number
  ): Promise<void> {
    const queue_active = await hasUpgrade(player_id, 'daycare_queue')
    if (!queue_active) {
      throw new Error('L\'upgrade File d\'attente n\'est pas débloquée')
    }

    // Vérifier que le Pokémon appartient au joueur
    const exists = await db
      .from('player_pokemon')
      .where('id', pokemon_id)
      .where('player_id', player_id)
      .first()
    if (!exists) throw new Error('Pokémon introuvable')

    // Calculer la prochaine position
    const max_pos = await db
      .from('daycare_queue')
      .where('player_id', player_id)
      .max('position as max')
      .first()

    const next_position = (max_pos?.max ?? 0) + 1

    await db.table('daycare_queue').insert({
      id: crypto.randomUUID(),
      player_id,
      position: next_position,
      pokemon_id,
      partner_id: partner_id ?? null,
      target_slot: target_slot ?? null,
      created_at: new Date(),
    })
  }

  static async removeFromQueue(player_id: string, position: number): Promise<void> {
    await db
      .from('daycare_queue')
      .where('player_id', player_id)
      .where('position', position)
      .delete()
    await DaycareQueueService.reorderQueue(player_id)
  }

  static async getQueue(player_id: string): Promise<any[]> {
    return db
      .from('daycare_queue')
      .where('player_id', player_id)
      .join('player_pokemon as pp', 'pp.id', 'daycare_queue.pokemon_id')
      .join('pokemon_species as ps', 'ps.id', 'pp.species_id')
      .select(
        'daycare_queue.id',
        'daycare_queue.position',
        'daycare_queue.pokemon_id',
        'daycare_queue.partner_id',
        'daycare_queue.target_slot',
        'ps.name_fr as pokemon_name_fr',
        'ps.sprite_url',
        'ps.rarity'
      )
      .orderBy('daycare_queue.position', 'asc')
  }

  private static async reorderQueue(player_id: string): Promise<void> {
    const items = await db
      .from('daycare_queue')
      .where('player_id', player_id)
      .orderBy('position', 'asc')
      .select('id')

    for (let i = 0; i < items.length; i++) {
      await db.from('daycare_queue').where('id', items[i].id).update({ position: i + 1 })
    }
  }

  private static async getQueueSize(player_id: string): Promise<number> {
    const result = await db
      .from('daycare_queue')
      .where('player_id', player_id)
      .count('id as count')
      .first()
    return Number(result?.count ?? 0)
  }
}
