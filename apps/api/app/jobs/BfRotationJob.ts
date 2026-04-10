/**
 * BfRotationJob — Gestion automatique des rotations Battle Frontier.
 * Toutes les 48h : clôture la rotation courante + distribue les récompenses + crée la suivante.
 * Déclenché via setInterval dans WorkerProvider.
 */

import battleFrontierService from '#services/BattleFrontierService'

/**
 * Vérifie si une rotation active vient d'expirer et la remplace.
 * Appelé toutes les heures par le scheduler.
 */
export async function processBfRotations(): Promise<void> {
  try {
    const current = await battleFrontierService.getCurrentRotation()

    // Aucune rotation active — en créer une immédiatement
    if (!current) {
      console.log('[BfRotationJob] Aucune rotation active — création d\'une nouvelle rotation')
      const rotation = await battleFrontierService.createNewRotation()
      console.log(`[BfRotationJob] Rotation créée : ${rotation.nameFr} (${rotation.mode}) → fin ${rotation.endAt.toISO()}`)
      return
    }

    // La rotation expire dans moins d'1h → distribuer les récompenses et créer la suivante
    const now = new Date()
    const end = current.endAt.toJSDate()
    const ms_remaining = end.getTime() - now.getTime()
    const ONE_HOUR_MS = 60 * 60 * 1000

    if (ms_remaining <= 0) {
      // Rotation expirée
      console.log(`[BfRotationJob] Rotation ${current.id} expirée — distribution des récompenses`)
      await battleFrontierService.distributeRotationRewards(current.id)

      const next = await battleFrontierService.createNewRotation()
      console.log(`[BfRotationJob] Nouvelle rotation : ${next.nameFr} (${next.mode})`)
    } else if (ms_remaining <= ONE_HOUR_MS) {
      // Moins d'1h — notifier les joueurs du compte à rebours
      console.log(`[BfRotationJob] Rotation ${current.id} se termine dans ${Math.round(ms_remaining / 60000)} min`)
    }
  } catch (err: any) {
    console.error('[BfRotationJob] Erreur:', err.message)
  }
}
