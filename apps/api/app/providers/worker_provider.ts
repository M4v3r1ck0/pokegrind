/**
 * WorkerProvider — Démarre le worker BullMQ offline au boot AdonisJS.
 * Enregistre également le scheduler horaire.
 */

import type { ApplicationService } from '@adonisjs/core/types'

export default class WorkerProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    if (this.app.getEnvironment() !== 'web') return

    // ── Worker offline ──────────────────────────────────────────────────────
    const { startOfflineWorker } = await import('#jobs/OfflineCalculationJob')
    startOfflineWorker()

    // ── Scheduler horaire ───────────────────────────────────────────────────
    const { checkAbsentPlayers } = await import('#jobs/HeartbeatScheduler')

    // Exécuter toutes les heures (3600 secondes)
    const HOUR_MS = 60 * 60 * 1000
    setInterval(() => {
      checkAbsentPlayers().catch((err) => {
        console.error('[HeartbeatScheduler] Error:', err.message)
      })
    }, HOUR_MS)

    // Exécution immédiate au démarrage pour rattraper les absences
    setTimeout(() => {
      checkAbsentPlayers().catch((err) => {
        console.error('[HeartbeatScheduler] Error (startup):', err.message)
      })
    }, 10_000) // 10 secondes après le boot

    // ── Scheduler BF Rotation (toutes les heures pour vérifier) ────────────
    const { processBfRotations } = await import('#jobs/BfRotationJob')

    setInterval(() => {
      processBfRotations().catch((err) => {
        console.error('[BfRotationJob] Error:', err.message)
      })
    }, HOUR_MS)

    // Vérification au démarrage (15s après le boot)
    setTimeout(() => {
      processBfRotations().catch((err) => {
        console.error('[BfRotationJob] Error (startup):', err.message)
      })
    }, 15_000)

    // ── Scheduler PvP : recalc rangs + fin de saison (toutes les heures) ───
    const { processPvpSeason } = await import('#jobs/PvpSeasonEndJob')
    const pvpService = (await import('#services/PvpService')).default

    setInterval(async () => {
      try {
        await processPvpSeason()
        const season = await pvpService.getActiveSeason()
        if (season) await pvpService.recalcRanks(season.id)
      } catch (err: any) {
        console.error('[PvpScheduler] Error:', err.message)
      }
    }, HOUR_MS)

    // Vérification initiale (20s après le boot)
    setTimeout(async () => {
      try {
        await processPvpSeason()
        const season = await pvpService.getActiveSeason()
        if (season) await pvpService.recalcRanks(season.id)
      } catch (err: any) {
        console.error('[PvpScheduler] Error (startup):', err.message)
      }
    }, 20_000)

    // ── Scheduler Boutique Or : refresh rotation hebdo si lundi ────────────
    const { refreshWeeklyRotationIfNeeded } = await import('#services/GoldShopService')

    setInterval(() => {
      refreshWeeklyRotationIfNeeded().catch((err: any) => {
        console.error('[GoldShopScheduler] Error:', err.message)
      })
    }, HOUR_MS)

    // ── Scheduler Events : activer/désactiver toutes les 5 minutes ──────────
    const { default: eventService } = await import('#services/EventService')

    // Charger les events actifs en Redis au démarrage
    eventService.reloadActiveEventsIntoRedis().catch((err: any) => {
      console.error('[EventScheduler] Erreur reload:', err.message)
    })

    const FIVE_MIN_MS = 5 * 60 * 1000
    setInterval(async () => {
      try {
        const result = await eventService.processEvents()
        if (result.activated.length > 0) {
          console.log('[EventScheduler] Activés:', result.activated.join(', '))
        }
        if (result.deactivated.length > 0) {
          console.log('[EventScheduler] Désactivés:', result.deactivated.join(', '))
        }
      } catch (err: any) {
        console.error('[EventScheduler] Error:', err.message)
      }
    }, FIVE_MIN_MS)

    // ── Economy Report : rapport quotidien à 3h du matin ────────────────────
    const { generateDailyEconomyReport } = await import('#jobs/EconomyReportJob')

    const scheduleAt3AM = () => {
      const now = new Date()
      const next3AM = new Date(now)
      next3AM.setHours(3, 0, 0, 0)
      if (next3AM <= now) next3AM.setDate(next3AM.getDate() + 1)
      return next3AM.getTime() - now.getTime()
    }

    const scheduleDailyReport = () => {
      setTimeout(async () => {
        try {
          await generateDailyEconomyReport()
          console.log('[EconomyReport] Rapport quotidien généré')
        } catch (err: any) {
          console.error('[EconomyReport] Erreur:', err.message)
        }
        scheduleDailyReport() // reprogrammer pour le lendemain
      }, scheduleAt3AM())
    }

    scheduleDailyReport()

    // ── Scheduler Anti-cheat : check gems toutes les 4h ─────────────────────
    const { default: anticheatService } = await import('#services/AnticheatService')

    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000

    setInterval(async () => {
      try {
        const count = await anticheatService.checkGemsAnomalies()
        if (count > 0) console.warn(`[Anticheat] ${count} alerte(s) gems créée(s)`)
      } catch (err: any) {
        console.error('[Anticheat] Gems check error:', err.message)
      }
    }, FOUR_HOURS_MS)

    setInterval(async () => {
      try {
        const count = await anticheatService.checkKillRateAnomalies()
        if (count > 0) console.warn(`[Anticheat] ${count} alerte(s) kill rate créée(s)`)
      } catch (err: any) {
        console.error('[Anticheat] Kill rate check error:', err.message)
      }
    }, TWO_HOURS_MS)
  }
}
