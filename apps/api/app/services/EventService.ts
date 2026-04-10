/**
 * EventService — Gestion des events saisonniers.
 * Pure functions déléguées à EventFormulas.ts (testables sans AdonisJS).
 */

import db from '@adonisjs/lucid/services/db'
import redis from '@adonisjs/redis/services/main'

// Re-export pure functions for convenience
export {
  applyGemBoost,
  applyXpBoost,
  calcShinyRate,
  isMaintenanceActive,
  type EventConfig,
} from '#services/EventFormulas'

import { isMaintenanceActive, type EventConfig } from '#services/EventFormulas'

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventType = 'gem_boost' | 'xp_boost' | 'shiny_boost' | 'banner' | 'custom'

export interface ActiveEvent {
  id: string
  name_fr: string
  event_type: EventType
  config_json: EventConfig
  end_at: Date
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

export const EVENT_KEYS = {
  gem_boost: 'event:gem_boost',
  xp_boost: 'event:xp_boost',
  shiny_boost: 'event:shiny_boost',
  banner: 'event:banner',
  maintenance: 'maintenance_mode',
} as const

// ─── Service DB ───────────────────────────────────────────────────────────────

class EventServiceClass {
  /**
   * Récupère la config d'un event actif depuis Redis.
   * Retourne null si pas d'event actif de ce type.
   */
  async getActiveEventConfig(event_type: keyof typeof EVENT_KEYS): Promise<EventConfig | null> {
    const key = EVENT_KEYS[event_type]
    const raw = await redis.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  /**
   * Active un event dans Redis avec TTL jusqu'à end_at.
   */
  async activateEvent(event: {
    id: string
    event_type: EventType
    config_json: EventConfig
    end_at: Date
  }): Promise<void> {
    const key = EVENT_KEYS[event.event_type as keyof typeof EVENT_KEYS]
    if (!key || event.event_type === 'custom') return // custom n'a pas d'effet Redis

    const ttl_s = Math.max(1, Math.floor((event.end_at.getTime() - Date.now()) / 1000))
    await redis.set(key, JSON.stringify({ ...event.config_json, event_id: event.id }), 'EX', ttl_s)
  }

  /**
   * Désactive un event Redis.
   */
  async deactivateEvent(event_type: EventType): Promise<void> {
    const key = EVENT_KEYS[event_type as keyof typeof EVENT_KEYS]
    if (!key) return
    await redis.del(key)
  }

  /**
   * Scanne les events à activer/désactiver selon l'heure actuelle.
   * Appelé par le scheduler toutes les 5 minutes.
   * Retourne { activated, deactivated }.
   */
  async processEvents(): Promise<{ activated: string[]; deactivated: string[] }> {
    const now = new Date()
    const activated: string[] = []
    const deactivated: string[] = []

    // Activer les events dont start_at est passé
    const to_activate = await db
      .from('events')
      .where('is_active', false)
      .where('start_at', '<=', now)
      .where('end_at', '>', now)
      .select('*')

    for (const ev of to_activate) {
      await db.from('events').where('id', ev.id).update({ is_active: true })
      await this.activateEvent({
        id: ev.id,
        event_type: ev.event_type as EventType,
        config_json: typeof ev.config_json === 'string' ? JSON.parse(ev.config_json) : ev.config_json,
        end_at: new Date(ev.end_at),
      })
      activated.push(ev.name_fr)
    }

    // Désactiver les events expirés
    const to_deactivate = await db
      .from('events')
      .where('is_active', true)
      .where('end_at', '<=', now)
      .select('*')

    for (const ev of to_deactivate) {
      await db.from('events').where('id', ev.id).update({ is_active: false })
      await this.deactivateEvent(ev.event_type as EventType)
      deactivated.push(ev.name_fr)
    }

    return { activated, deactivated }
  }

  /**
   * Recharge tous les events actifs en Redis au démarrage du serveur.
   */
  async reloadActiveEventsIntoRedis(): Promise<void> {
    const now = new Date()
    const active = await db
      .from('events')
      .where('is_active', true)
      .where('end_at', '>', now)
      .select('*')

    for (const ev of active) {
      await this.activateEvent({
        id: ev.id,
        event_type: ev.event_type as EventType,
        config_json: typeof ev.config_json === 'string' ? JSON.parse(ev.config_json) : ev.config_json,
        end_at: new Date(ev.end_at),
      })
    }
  }

  /**
   * Active le mode maintenance.
   */
  async enableMaintenance(message_fr: string, duration_minutes: number): Promise<void> {
    const ends_at = new Date(Date.now() + duration_minutes * 60 * 1000)
    await redis.set(
      EVENT_KEYS.maintenance,
      JSON.stringify({ active: true, message_fr, ends_at: ends_at.toISOString() }),
      'EX',
      duration_minutes * 60 + 60 // TTL légèrement plus long que la durée
    )
  }

  /**
   * Désactive le mode maintenance.
   */
  async disableMaintenance(): Promise<void> {
    await redis.del(EVENT_KEYS.maintenance)
  }

  /**
   * Vérifie si le mode maintenance est actif.
   */
  async getMaintenanceStatus(): Promise<{ active: boolean; message_fr?: string; ends_at?: string }> {
    const raw = await redis.get(EVENT_KEYS.maintenance)
    if (!raw) return { active: false }
    try {
      const config = JSON.parse(raw)
      if (!isMaintenanceActive(config)) {
        await redis.del(EVENT_KEYS.maintenance)
        return { active: false }
      }
      return config
    } catch {
      return { active: false }
    }
  }
}

const eventService = new EventServiceClass()
export default eventService
export { EventServiceClass }
