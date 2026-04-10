import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
])

router.use([() => import('@adonisjs/core/bodyparser_middleware')])

export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  adminAuth: () => import('#middleware/admin_auth_middleware'),
})

declare module '@adonisjs/core/types/http' {
  interface NamedMiddleware {
    adminAuth: (roles?: string[]) => void
  }
}
