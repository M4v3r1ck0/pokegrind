import axios from 'axios'
import { defineNuxtPlugin } from '#app'
import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()

  const api = axios.create({
    baseURL: config.public.apiBase as string,
    withCredentials: true,
  })

  // Intercepteur de requête : ajouter le Bearer token
  api.interceptors.request.use((req) => {
    if (import.meta.client) {
      const auth = useAuthStore()
      if (auth.accessToken) {
        req.headers.Authorization = `Bearer ${auth.accessToken}`
      }
    }
    return req
  })

  // Intercepteur de réponse : auto-refresh si 401
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config

      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        import.meta.client
      ) {
        originalRequest._retry = true

        try {
          const auth = useAuthStore()
          await auth.refreshToken()

          if (auth.accessToken) {
            originalRequest.headers.Authorization = `Bearer ${auth.accessToken}`
          }

          return api(originalRequest)
        } catch {
          const auth = useAuthStore()
          auth.clearSession()
          navigateTo('/auth/login')
        }
      }

      return Promise.reject(error)
    }
  )

  nuxtApp.provide('api', api)
})
