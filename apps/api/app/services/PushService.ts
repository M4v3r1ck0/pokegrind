/**
 * PushService — Notifications push Web API
 * Utilise les clés VAPID configurées dans .env.
 * Fallback console.log si pas configuré.
 */

import db from '@adonisjs/lucid/services/db'
import type { ReadySlot } from '#services/DaycareService'

// web-push est optionnel : si pas installé ou VAPID manquants, on log seulement
let webpush: any = null

async function getWebPush(): Promise<any> {
  if (webpush) return webpush
  try {
    const mod = await import('web-push')
    webpush = mod.default ?? mod
    const vapid_public = process.env.VAPID_PUBLIC_KEY
    const vapid_private = process.env.VAPID_PRIVATE_KEY
    const vapid_subject = process.env.VAPID_SUBJECT
    if (vapid_public && vapid_private && vapid_subject) {
      webpush.setVapidDetails(vapid_subject, vapid_public, vapid_private)
    } else {
      webpush = null  // VAPID manquants → mode console
    }
    return webpush
  } catch {
    return null  // web-push non installé
  }
}

export default class PushService {
  /**
   * Notifie le joueur qu'un slot de pension est prêt à éclore.
   */
  static async notifyHatchReady(player_id: string, ready_slots: ReadySlot[]): Promise<void> {
    if (ready_slots.length === 0) return

    const wp = await getWebPush()
    const names = ready_slots.map((s) => s.pokemon_name_fr).join(', ')

    if (!wp) {
      // Mode console — pas de VAPID configuré
      console.log(
        `[PushService] Éclosion prête pour ${player_id}: slots ${ready_slots.map((s) => s.slot_number).join(', ')} (${names})`
      )
      return
    }

    // Récupérer les abonnements push du joueur avec la préférence 'hatch_ready'
    const subscriptions = await db
      .from('push_subscriptions')
      .where('player_id', player_id)
      .select('id', 'endpoint', 'keys', 'notification_prefs_json')

    for (const sub of subscriptions) {
      const prefs = typeof sub.notification_prefs_json === 'string'
        ? JSON.parse(sub.notification_prefs_json)
        : (sub.notification_prefs_json ?? {})

      // Vérifier la préférence (true par défaut si non défini)
      if (prefs.hatch_ready === false) continue

      const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys

      const payload = JSON.stringify({
        title: 'PokeGrind — Éclosion prête !',
        body: `${ready_slots.length} slot(s) prêt(s) : ${names} 🥚`,
        icon: '/icons/egg-icon.png',
        data: { url: '/jeu/pension' },
      })

      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys }, payload)
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          // Abonnement expiré → supprimer
          await db.from('push_subscriptions').where('id', sub.id).delete()
        } else {
          console.error('[PushService] Erreur envoi push:', err?.message)
        }
      }
    }
  }

  /**
   * Envoie une notification générique à un joueur (vérifie ses préférences).
   */
  static async notify(
    player_id: string,
    pref_key: string,
    payload: { title: string; body: string; icon?: string; url?: string }
  ): Promise<void> {
    const wp = await getWebPush()
    if (!wp) {
      console.log(`[PushService] ${payload.title}: ${payload.body}`)
      return
    }

    const subscriptions = await db
      .from('push_subscriptions')
      .where('player_id', player_id)
      .select('id', 'endpoint', 'keys', 'notification_prefs_json')

    for (const sub of subscriptions) {
      const prefs = typeof sub.notification_prefs_json === 'string'
        ? JSON.parse(sub.notification_prefs_json)
        : (sub.notification_prefs_json ?? {})

      if (prefs[pref_key] === false) continue

      const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
      const push_payload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? '/icons/pokeball.png',
        data: { url: payload.url ?? '/' },
      })

      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys }, push_payload)
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.from('push_subscriptions').where('id', sub.id).delete()
        } else {
          console.error('[PushService] Erreur envoi push:', err?.message)
        }
      }
    }
  }

  /**
   * Notifie un boss milestone atteint.
   */
  static async notifyBossMilestone(player_id: string, floor: number): Promise<void> {
    const wp = await getWebPush()
    const body = `L'étage ${floor} est débloqué — Boss disponible !`

    if (!wp) {
      console.log(`[PushService] Boss milestone: ${body}`)
      return
    }

    await PushService.notify(player_id, 'boss_milestone', {
      title: 'PokeGrind — Boss débloqué !',
      body,
      icon: '/icons/sword-icon.png',
      url: '/jeu/combat',
    })
  }

  /**
   * Notifie une nouvelle rotation Battle Frontier (stub — log console pour l'instant).
   */
  static async notifyBfRotation(player_ids: string[], rotation_mode: string): Promise<void> {
    console.log(
      `[PushService] Nouvelle rotation Battle Frontier (${rotation_mode}) pour ${player_ids.length} joueurs — stub`
    )
    // TODO Sprint 7 : implémentation complète quand BF est disponible
  }

  /**
   * Notifie un événement limité actif (stub — log console pour l'instant).
   */
  static async notifyEventActive(player_ids: string[], event_name: string): Promise<void> {
    console.log(`[PushService] Événement actif: ${event_name} pour ${player_ids.length} joueurs — stub`)
    // TODO Sprint 7
  }

  /**
   * Notifie une éclosion effectuée.
   */
  static async notifyHatched(
    player_id: string,
    pokemon_name_fr: string,
    is_shiny: boolean,
    has_hidden_talent: boolean
  ): Promise<void> {
    const wp = await getWebPush()
    let body = `${pokemon_name_fr} est éclos !`
    if (is_shiny) body += ' ✨ SHINY !'
    if (has_hidden_talent) body += ' 🌟 Talent Caché !'

    if (!wp) {
      console.log(`[PushService] ${body}`)
      return
    }

    const subscriptions = await db
      .from('push_subscriptions')
      .where('player_id', player_id)
      .select('id', 'endpoint', 'keys', 'notification_prefs_json')

    for (const sub of subscriptions) {
      const prefs = typeof sub.notification_prefs_json === 'string'
        ? JSON.parse(sub.notification_prefs_json)
        : (sub.notification_prefs_json ?? {})

      if (prefs.hatch_ready === false) continue

      const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
      const payload = JSON.stringify({
        title: 'PokeGrind — Éclosion !',
        body,
        icon: '/icons/pokeball.png',
        data: { url: '/jeu/pension' },
      })

      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys }, payload)
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.from('push_subscriptions').where('id', sub.id).delete()
        }
      }
    }
  }

  /**
   * Notifie le démarrage d'un nouveau Raid Mondial.
   */
  static async notifyRaidStart(player_ids: string[], boss_name_fr: string, ends_at: string): Promise<void> {
    console.log(`[PushService] Nouveau Raid: ${boss_name_fr} pour ${player_ids.length} joueurs`)
    // Batch push — simplifié : log seulement si pas de VAPID
    const wp = await getWebPush()
    if (!wp) return

    const payload = JSON.stringify({
      title: `🌍 Nouveau Raid — ${boss_name_fr} !`,
      body: `Rejoins le combat coopératif ! Jusqu'au ${new Date(ends_at).toLocaleString('fr-FR')}.`,
      icon: '/icons/pokeball.png',
      data: { url: '/jeu/raids' },
    })

    const subscriptions = await db
      .from('push_subscriptions')
      .whereIn('player_id', player_ids)
      .select('id', 'endpoint', 'keys', 'notification_prefs_json')

    for (const sub of subscriptions) {
      const prefs = typeof sub.notification_prefs_json === 'string'
        ? JSON.parse(sub.notification_prefs_json)
        : (sub.notification_prefs_json ?? {})
      if (prefs.raids === false) continue
      const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys }, payload)
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.from('push_subscriptions').where('id', sub.id).delete()
        }
      }
    }
  }

  /**
   * Notifie les participants qu'un Raid est vaincu.
   */
  static async notifyRaidDefeated(player_ids: string[], boss_name_fr: string): Promise<void> {
    console.log(`[PushService] Raid vaincu: ${boss_name_fr} pour ${player_ids.length} participants`)
    const wp = await getWebPush()
    if (!wp) return

    const payload = JSON.stringify({
      title: `🎉 Raid victorieux — ${boss_name_fr} est vaincu !`,
      body: `Tes récompenses t'attendent.`,
      icon: '/icons/pokeball.png',
      data: { url: '/jeu/raids' },
    })

    const subscriptions = await db
      .from('push_subscriptions')
      .whereIn('player_id', player_ids)
      .select('id', 'endpoint', 'keys', 'notification_prefs_json')

    for (const sub of subscriptions) {
      const prefs = typeof sub.notification_prefs_json === 'string'
        ? JSON.parse(sub.notification_prefs_json)
        : (sub.notification_prefs_json ?? {})
      if (prefs.raids === false) continue
      const keys = typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys
      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys }, payload)
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.from('push_subscriptions').where('id', sub.id).delete()
        }
      }
    }
  }

  /**
   * Notifie le défenseur qu'il a été attaqué en PvP.
   */
  static async notifyPvpAttacked(
    defender_id: string,
    attacker_username: string,
    result: 'attacker_win' | 'defender_win',
    elo_change: number
  ): Promise<void> {
    const icon = result === 'defender_win' ? '🛡️' : '⚔️'
    const elo_str = elo_change >= 0 ? `+${elo_change}` : `${elo_change}`
    const message = result === 'defender_win'
      ? `Ta défense a repoussé ${attacker_username} ! ${elo_str} ELO`
      : `${attacker_username} a vaincu ta défense... ${elo_str} ELO`

    await PushService.notify(defender_id, 'pvp_result', {
      title: 'PokeGrind — Attaque PvP !',
      body: `${icon} ${message}`,
      icon: '/icons/pvp-icon.png',
      url: '/jeu/pvp',
    })
  }
}
