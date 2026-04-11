import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const auth = useAuthStore()

  // Lire directement localStorage en cas de store pas encore hydraté
  const hasToken = auth.accessToken
    || (import.meta.client && localStorage.getItem('pg_access_token'))

  if (!hasToken) {
    return navigateTo(
      `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`,
      { redirectCode: 302 }
    )
  }

  // Si token présent mais player absent → tenter fetchMe silencieux
  if (hasToken && !auth.player) {
    try {
      if (!auth.accessToken) {
        auth.accessToken = localStorage.getItem('pg_access_token')
        auth.isAuthenticated = true
      }
      await auth.fetchMe()
    } catch {
      // fetchMe gère déjà le refresh — si ça échoue = vraiment expiré
      return navigateTo(
        `/auth/login?redirect=${encodeURIComponent(to.fullPath)}`,
        { redirectCode: 302 }
      )
    }
  }
})
