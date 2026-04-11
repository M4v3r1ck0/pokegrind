/**
 * useHeartbeat — Appelle POST /api/player/heartbeat toutes les 2 minutes
 * si la page est visible. Met à jour last_seen_at pour le calcul offline.
 */

export function useHeartbeat() {
  let interval: ReturnType<typeof setInterval> | null = null

  function start() {
    if (interval) return  // déjà démarré

    interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const { $api } = useNuxtApp() as any
        await $api.post('/player/heartbeat')
      } catch {
        // Ignorer silencieusement (offline, token expiré, etc.)
      }
    }, 2 * 60 * 1000)
  }

  function stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  return { start, stop }
}
