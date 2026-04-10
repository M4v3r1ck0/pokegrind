/**
 * GoldShopService — Boutique or avec rotation hebdomadaire.
 */

import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

const WEEKLY_ROTATION_KEY = 'gold_shop:weekly_rotation'
const WEEKLY_ITEM_COUNT = 3

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMondayMidnightTTL(): number {
  const now = new Date()
  const next_monday = new Date(now)
  const days_until_monday = (8 - now.getDay()) % 7 || 7
  next_monday.setDate(now.getDate() + days_until_monday)
  next_monday.setHours(0, 0, 0, 0)
  return Math.floor((next_monday.getTime() - now.getTime()) / 1000)
}

async function getOrSetWeeklyRotation(): Promise<number[]> {
  const cached = await redis.get(WEEKLY_ROTATION_KEY)
  if (cached) {
    try {
      return JSON.parse(cached) as number[]
    } catch {}
  }

  // Pick random weekly items
  const weekly_shop_items = await db
    .from('gold_shop_items')
    .where('stock_type', 'weekly')
    .where('is_active', true)
    .select('id')

  const shuffled = weekly_shop_items.sort(() => Math.random() - 0.5)
  const selected_ids = shuffled.slice(0, WEEKLY_ITEM_COUNT).map((r: any) => r.id)

  const ttl = getMondayMidnightTTL()
  await redis.setex(WEEKLY_ROTATION_KEY, Math.max(ttl, 3600), JSON.stringify(selected_ids))

  return selected_ids
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GoldShopService {
  async getShop() {
    const weekly_ids = await getOrSetWeeklyRotation()

    const permanent = await db
      .from('gold_shop_items as gsi')
      .join('items as i', 'i.id', 'gsi.item_id')
      .where('gsi.stock_type', 'unlimited')
      .where('gsi.is_active', true)
      .select(
        'gsi.id as shop_id',
        'i.id as item_id',
        'i.name_fr',
        'i.description_fr',
        'i.category',
        'i.effect_type',
        'i.effect_value',
        'i.sprite_url',
        'i.rarity',
        'gsi.cost_gold',
        db.raw("'unlimited' as stock_type")
      )
      .orderBy('gsi.cost_gold', 'asc')

    const weekly = weekly_ids.length > 0
      ? await db
          .from('gold_shop_items as gsi')
          .join('items as i', 'i.id', 'gsi.item_id')
          .whereIn('gsi.id', weekly_ids)
          .where('gsi.is_active', true)
          .select(
            'gsi.id as shop_id',
            'i.id as item_id',
            'i.name_fr',
            'i.description_fr',
            'i.category',
            'i.effect_type',
            'i.effect_value',
            'i.sprite_url',
            'i.rarity',
            'gsi.cost_gold',
            db.raw("'weekly' as stock_type")
          )
      : []

    const ttl = getMondayMidnightTTL()

    return {
      permanent,
      weekly,
      rotation_resets_in_seconds: ttl,
    }
  }

  async purchaseItem(player_id: string, item_id: number, quantity: number) {
    // Load shop entry
    const shop_entry = await db
      .from('gold_shop_items')
      .where('item_id', item_id)
      .where('is_active', true)
      .first()

    if (!shop_entry) {
      throw new Error('Item non disponible dans la boutique')
    }

    const total_cost = shop_entry.cost_gold * quantity

    await db.transaction(async (trx) => {
      // Check player gold
      const player = await trx.from('players').where('id', player_id).select('gold').first()
      if (!player || player.gold < total_cost) {
        throw new Error('Or insuffisant')
      }

      // Deduct gold
      await trx.from('players').where('id', player_id).decrement('gold', total_cost)

      // Upsert player_items
      await trx.rawQuery(`
        INSERT INTO player_items (id, player_id, item_id, quantity, obtained_at)
        VALUES (gen_random_uuid(), ?, ?, ?, NOW())
        ON CONFLICT (player_id, item_id) DO UPDATE SET quantity = player_items.quantity + EXCLUDED.quantity
      `, [player_id, item_id, quantity])
    })

    return { item_id, quantity, gold_spent: total_cost }
  }
}

export async function refreshWeeklyRotationIfNeeded(): Promise<void> {
  const cached = await redis.get(WEEKLY_ROTATION_KEY)
  if (!cached) {
    await getOrSetWeeklyRotation()
  }
}

export default new GoldShopService()
