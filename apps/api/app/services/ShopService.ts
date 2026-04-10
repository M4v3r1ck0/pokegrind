/**
 * ShopService — Boutique gems : achat, état, effets.
 */

import db from '@adonisjs/lucid/services/db'
import ShopUpgrade from '#models/shop_upgrade'
import gemsService from '#services/GemsService'
import playerUpgradeService from '#services/PlayerUpgradeService'
import { validatePurchase } from '#services/ShopFormulas'

export interface ShopUpgradeWithStatus {
  id: number
  category: string
  name_fr: string
  description_fr: string | null
  cost_gems: number
  effect_type: string
  requires_upgrade_id: number | null
  requires_name_fr: string | null
  is_purchased: boolean
  is_available: boolean
}

export interface ShopState {
  categories: {
    pension: ShopUpgradeWithStatus[]
    gacha: ShopUpgradeWithStatus[]
    combat: ShopUpgradeWithStatus[]
    cosmetic: ShopUpgradeWithStatus[]
  }
  player_gems: number
}

export interface PurchaseResult {
  success: true
  upgrade: ShopUpgrade
  gems_remaining: number
}

class ShopService {
  // ─── État complet de la boutique ──────────────────────────────────────────

  async getShopState(player_id: string): Promise<ShopState> {
    const all_upgrades = await ShopUpgrade.query().orderBy('id', 'asc')
    const upgrade_map = new Map(all_upgrades.map((u) => [u.id, u]))

    const owned_rows = await db
      .from('player_upgrades')
      .where('player_id', player_id)
      .select('upgrade_id')
    const owned_ids = new Set(owned_rows.map((r: any) => Number(r.upgrade_id)))

    const player_row = await db.from('players').where('id', player_id).select('gems').first()
    const player_gems = Number(player_row?.gems ?? 0)

    const toStatus = (u: ShopUpgrade): ShopUpgradeWithStatus => {
      const is_purchased = owned_ids.has(u.id)

      // Vérifier prérequis
      let has_prereq = true
      if (u.requiresUpgradeId !== null) {
        // Cas spécial file d'attente (id:5) : nécessite id:3 ET id:4
        if (u.id === 5) {
          has_prereq = owned_ids.has(3) && owned_ids.has(4)
        } else {
          has_prereq = owned_ids.has(u.requiresUpgradeId)
        }
      }

      const prereq = u.requiresUpgradeId ? upgrade_map.get(u.requiresUpgradeId) : null

      return {
        id: u.id,
        category: u.category,
        name_fr: u.nameFr,
        description_fr: u.descriptionFr,
        cost_gems: u.costGems,
        effect_type: u.effectType,
        requires_upgrade_id: u.requiresUpgradeId,
        requires_name_fr: prereq?.nameFr ?? null,
        is_purchased,
        is_available: !is_purchased && has_prereq,
      }
    }

    const pension = all_upgrades.filter((u) => u.category === 'pension').map(toStatus)
    const gacha = all_upgrades.filter((u) => u.category === 'gacha').map(toStatus)
    const combat = all_upgrades.filter((u) => u.category === 'combat').map(toStatus)
    const cosmetic = all_upgrades.filter((u) => u.category === 'cosmetic').map(toStatus)

    return { categories: { pension, gacha, combat, cosmetic }, player_gems }
  }

  // ─── Achat d'une upgrade ──────────────────────────────────────────────────

  async purchaseUpgrade(player_id: string, upgrade_id: number): Promise<PurchaseResult> {
    // 1. L'upgrade existe ?
    const upgrade = await ShopUpgrade.find(upgrade_id)
    if (!upgrade) throw new Error('Amélioration introuvable')

    // Cosmétiques → stub pour l'instant
    if (upgrade.category === 'cosmetic') {
      throw new Error('Les cosmétiques ne sont pas encore disponibles')
    }

    // 2. Déjà acheté ?
    const existing = await db
      .from('player_upgrades')
      .where('player_id', player_id)
      .where('upgrade_id', upgrade_id)
      .first()
    if (existing) throw new Error('Vous possédez déjà cette amélioration')

    // 3. Prérequis
    let has_prereq = true
    if (upgrade.requiresUpgradeId !== null) {
      if (upgrade.id === 5) {
        // File d'attente : nécessite Auto-collect (id:3) ET Slot #8 (id:4)
        const has3 = await db.from('player_upgrades').where('player_id', player_id).where('upgrade_id', 3).first()
        const has4 = await db.from('player_upgrades').where('player_id', player_id).where('upgrade_id', 4).first()
        has_prereq = !!has3 && !!has4
      } else {
        const prereq_row = await db
          .from('player_upgrades')
          .where('player_id', player_id)
          .where('upgrade_id', upgrade.requiresUpgradeId)
          .first()
        has_prereq = !!prereq_row
      }
    }

    // 4. Gems suffisants
    const player_row = await db.from('players').where('id', player_id).select('gems').first()
    const player_gems = Number(player_row?.gems ?? 0)

    const validation = validatePurchase(
      {
        id: upgrade.id,
        cost_gems: upgrade.costGems,
        name_fr: upgrade.nameFr,
        effect_type: upgrade.effectType,
        requires_upgrade_id: upgrade.requiresUpgradeId,
        category: upgrade.category,
      },
      player_gems,
      false,
      has_prereq
    )

    if (!validation.valid) throw new Error(validation.error)

    // 5. Transaction : dépenser gems + insérer player_upgrade
    await gemsService.spendGems(player_id, upgrade.costGems, `Achat: ${upgrade.nameFr}`, 'shop_purchase')

    await db.table('player_upgrades').insert({
      player_id,
      upgrade_id,
      purchased_at: new Date(),
    })

    // 6. Invalider le cache upgrades
    await playerUpgradeService.invalidateCache(player_id)

    // 7. Appliquer l'effet immédiat
    await this.applyUpgradeEffect(player_id, upgrade)

    const new_gems = player_gems - upgrade.costGems

    return { success: true, upgrade, gems_remaining: new_gems }
  }

  // ─── Effets immédiats ─────────────────────────────────────────────────────

  private async applyUpgradeEffect(player_id: string, upgrade: ShopUpgrade): Promise<void> {
    switch (upgrade.effectType) {
      case 'daycare_slot':
        // Pas d'effet BDD immédiat — DaycareService recalcule depuis les upgrades
        break

      case 'auto_collect':
        // Rien à faire — DaycareService lit via PlayerUpgradeService
        break

      case 'daycare_queue':
        // Rien à faire — DaycareQueueService lit via PlayerUpgradeService
        break

      case 'saved_teams': {
        // Créer 5 emplacements vides
        const existing_slots = await db
          .from('player_saved_teams')
          .where('player_id', player_id)
          .select('slot')
        const existing_slot_nums = existing_slots.map((r: any) => Number(r.slot))

        for (let slot = 1; slot <= 5; slot++) {
          if (!existing_slot_nums.includes(slot)) {
            await db.table('player_saved_teams').insert({
              id: crypto.randomUUID(),
              player_id,
              slot,
              name_fr: `Équipe ${slot}`,
              team_json: null,
              created_at: new Date(),
              updated_at: new Date(),
            })
          }
        }
        break
      }

      case 'pity_legendary':
      case 'move_slot_5':
      case 'sell_filter':
      case 'advanced_sort':
      case 'extended_dex':
      case 'pull_history':
      case 'dps_simulator':
      case 'moveset_profiles':
      case 'quick_swap':
      case 'auto_farm':
        // Effets lus dynamiquement depuis les upgrades — rien à faire ici
        break

      default:
        // Effet inconnu — log et continuer
        console.warn(`[ShopService] Effet inconnu: ${upgrade.effectType}`)
    }
  }
}

const shopService = new ShopService()
export default shopService
