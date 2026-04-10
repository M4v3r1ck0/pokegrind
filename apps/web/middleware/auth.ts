import { defineNuxtRouteMiddleware, navigateTo } from '#app'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const auth = useAuthStore()

  if (!auth.isAuthenticated || !auth.accessToken) {
    return navigateTo(`/auth/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
