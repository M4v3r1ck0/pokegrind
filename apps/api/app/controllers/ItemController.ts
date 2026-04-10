/**
 * ItemController — Catalogue items + inventaire joueur + équipement.
 */

import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'

const equip_validator = vine.compile(
  vine.object({
    item_id: vine.number().min(1),
  })
)

export default class ItemController {
  // GET /api/items/catalog
  async catalog({ request, response }: HttpContext) {
    const page = Math.max(1, Number(request.qs().page ?? 1))
    const per_page = Math.min(50, Number(request.qs().per_page ?? 20))

    const query = db.from('items').orderBy('category', 'asc').orderBy('rarity', 'asc').orderBy('name_fr', 'asc')
    const total = await db.from('items').count('* as count').first()
    const items = await query.limit(per_page).offset((page - 1) * per_page)

    return response.ok({
      data: items,
      meta: {
        total: Number(total?.count ?? 0),
        page,
        per_page,
        last_page: Math.ceil(Number(total?.count ?? 0) / per_page),
      },
    })
  }

  // GET /api/items/catalog/:category
  async catalogByCategory({ params, response }: HttpContext) {
    const items = await db
      .from('items')
      .where('category', params.category)
      .orderBy('rarity', 'asc')
      .orderBy('name_fr', 'asc')

    return response.ok({ data: items })
  }

  // GET /api/player/items
  async inventory({ player, request, response }: HttpContext) {
    const page = Math.max(1, Number(request.qs().page ?? 1))
    const per_page = Math.min(50, Number(request.qs().per_page ?? 20))

    const count_row = await db
      .from('player_items')
      .where('player_id', player.id)
      .count('* as count')
      .first()

    const items = await db
      .from('player_items as pi')
      .join('items as i', 'i.id', 'pi.item_id')
      .where('pi.player_id', player.id)
      .select(
        'pi.id as player_item_id',
        'i.id as item_id',
        'i.name_fr',
        'i.description_fr',
        'i.category',
        'i.effect_type',
        'i.effect_value',
        'i.sprite_url',
        'i.rarity',
        'pi.quantity',
        'pi.obtained_at'
      )
      .orderBy('i.category', 'asc')
      .orderBy('i.name_fr', 'asc')
      .limit(per_page)
      .offset((page - 1) * per_page)

    return response.ok({
      data: items,
      meta: {
        total: Number(count_row?.count ?? 0),
        page,
        per_page,
        last_page: Math.ceil(Number(count_row?.count ?? 0) / per_page),
      },
    })
  }

  // GET /api/player/items/:item_id
  async inventoryItem({ player, params, response }: HttpContext) {
    const item = await db
      .from('player_items as pi')
      .join('items as i', 'i.id', 'pi.item_id')
      .where('pi.player_id', player.id)
      .where('pi.item_id', params.item_id)
      .select('pi.*', 'i.name_fr', 'i.description_fr', 'i.category', 'i.effect_type', 'i.effect_value', 'i.sprite_url', 'i.rarity')
      .first()

    if (!item) return response.notFound({ message: 'Item non trouvé' })
    return response.ok(item)
  }

  // POST /api/player/pokemon/:id/equip
  async equip({ player, params, request, response }: HttpContext) {
    const pokemon_id = params.id
    const { item_id } = await request.validateUsing(equip_validator)

    // Validate pokemon belongs to player
    const pokemon = await db
      .from('player_pokemon')
      .where('id', pokemon_id)
      .where('player_id', player.id)
      .select('id', 'equipped_item_id')
      .first()

    if (!pokemon) return response.notFound({ message: 'Pokémon non trouvé' })

    // Validate player has item
    const player_item = await db
      .from('player_items')
      .where('player_id', player.id)
      .where('item_id', item_id)
      .first()

    if (!player_item || player_item.quantity < 1) {
      return response.unprocessableEntity({ message: 'Item non disponible dans votre inventaire' })
    }

    await db.transaction(async (trx) => {
      // Return old item to inventory if equipped
      if (pokemon.equipped_item_id && pokemon.equipped_item_id !== item_id) {
        await trx.rawQuery(`
          INSERT INTO player_items (id, player_id, item_id, quantity, obtained_at)
          VALUES (gen_random_uuid(), ?, ?, 1, NOW())
          ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_items.quantity + 1
        `, [player.id, pokemon.equipped_item_id])
      }

      // Decrement new item quantity
      await trx
        .from('player_items')
        .where('player_id', player.id)
        .where('item_id', item_id)
        .decrement('quantity', 1)

      // Delete if quantity reaches 0
      await trx
        .from('player_items')
        .where('player_id', player.id)
        .where('item_id', item_id)
        .where('quantity', '<=', 0)
        .delete()

      // Update pokemon equipped_item_id
      await trx
        .from('player_pokemon')
        .where('id', pokemon_id)
        .update({ equipped_item_id: item_id })
    })

    return response.ok({ message: 'Item équipé avec succès' })
  }

  // POST /api/player/pokemon/:id/unequip
  async unequip({ player, params, response }: HttpContext) {
    const pokemon_id = params.id

    const pokemon = await db
      .from('player_pokemon')
      .where('id', pokemon_id)
      .where('player_id', player.id)
      .select('id', 'equipped_item_id')
      .first()

    if (!pokemon) return response.notFound({ message: 'Pokémon non trouvé' })
    if (!pokemon.equipped_item_id) return response.unprocessableEntity({ message: 'Aucun item équipé' })

    await db.transaction(async (trx) => {
      // Return item to inventory
      await trx.rawQuery(`
        INSERT INTO player_items (id, player_id, item_id, quantity, obtained_at)
        VALUES (gen_random_uuid(), ?, ?, 1, NOW())
        ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_items.quantity + 1
      `, [player.id, pokemon.equipped_item_id])

      // Remove equipped item from pokemon
      await trx
        .from('player_pokemon')
        .where('id', pokemon_id)
        .update({ equipped_item_id: null })
    })

    return response.ok({ message: 'Item retiré avec succès' })
  }
}
