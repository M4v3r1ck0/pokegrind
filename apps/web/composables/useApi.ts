/**
 * useApi — Composable centralisé pour les appels API.
 * Lit NUXT_PUBLIC_API_BASE depuis runtimeConfig pour construire l'URL absolue.
 * Utilisé dans les composants Nuxt (pages, register.vue, etc.)
 * Pour les stores Pinia authentifiés, utiliser plutôt useNuxtApp().$api
 * qui gère l'injection du Bearer token et l'auto-refresh 401.
 */
export const useApi = () => {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  return <T = unknown>(path: string, options?: Parameters<typeof $fetch>[1]) =>
    $fetch<T>(`${apiBase}${path}`, options)
}
