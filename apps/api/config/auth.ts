import { defineConfig } from '@adonisjs/auth'
import { tokensGuard, tokensUserProvider } from '@adonisjs/auth/access_tokens'

/**
 * Auth configuration — Sprint 2 will fully implement this.
 * Placeholder guard referencing the future Player model.
 */
const authConfig = defineConfig({
  default: 'api',
  guards: {
    api: tokensGuard({
      provider: tokensUserProvider({
        tokens: 'accessTokens',
        model: () => import('#models/player'),
      }),
    }),
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
