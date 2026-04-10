import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Player from '#models/player'
import JwtService from '#services/JwtService'

const ALL_ADMIN_ROLES = ['admin', 'mod', 'support'] as const
type AdminRole = (typeof ALL_ADMIN_ROLES)[number]

export default class AdminAuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    roles: AdminRole[] = [...ALL_ADMIN_ROLES]
  ) {
    const authHeader = ctx.request.header('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.response.unauthorized({ message: 'Token manquant' })
    }

    const token = authHeader.slice(7)

    let payload
    try {
      payload = JwtService.verifyAccessToken(token)
    } catch {
      return ctx.response.unauthorized({ message: 'Token invalide ou expiré' })
    }

    // Vérifier que le rôle est dans la liste admin globale
    if (!ALL_ADMIN_ROLES.includes(payload.role as AdminRole)) {
      return ctx.response.forbidden({ message: 'Accès interdit : rôle insuffisant' })
    }

    // Vérifier que le rôle satisfait les exigences de cette route
    if (!roles.includes(payload.role as AdminRole)) {
      return ctx.response.forbidden({
        message: `Accès interdit : rôle requis parmi [${roles.join(', ')}]`,
      })
    }

    const player = await Player.find(payload.sub)
    if (!player) {
      return ctx.response.unauthorized({ message: 'Joueur introuvable' })
    }

    ctx.player = player
    await next()
  }
}
