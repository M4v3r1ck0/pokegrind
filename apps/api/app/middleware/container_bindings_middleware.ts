import { NextFn } from '@adonisjs/core/types/http'
import { HttpContext } from '@adonisjs/core/http'

/**
 * The container bindings middleware binds classes to their
 * IoC container counterparts.
 */
export default class ContainerBindingsMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    ctx.containerResolver.bindValue(HttpContext, ctx)
    return next()
  }
}
