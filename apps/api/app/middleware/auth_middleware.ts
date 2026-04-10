import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Player from '#models/player'
import JwtService from '#services/JwtService'

export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
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

    const player = await Player.find(payload.sub)
    if (!player) {
      return ctx.response.unauthorized({ message: 'Joueur introuvable' })
    }

    // Vérification du ban
    if (player.isBanned) {
      const isPermanent = player.banUntil === null
      const isActive = isPermanent || player.banUntil!.toJSDate() > new Date()

      if (isActive) {
        return ctx.response.forbidden({
          error: 'Compte suspendu',
          reason: player.banReason,
          until: player.banUntil?.toISO() ?? null,
        })
      } else {
        // Ban expiré → lever automatiquement
        await player.merge({
          isBanned: false,
          bannedAt: null,
          banReason: null,
          banUntil: null,
        }).save()
      }
    }

    ctx.player = player

    // Vérification du mode maintenance (admins passent toujours)
    if (!player.role || player.role === 'player') {
      try {
        const { default: eventService } = await import('#services/EventService')
        const maintenance = await eventService.getMaintenanceStatus()
        if (maintenance.active) {
          return ctx.response.serviceUnavailable({
            error: 'maintenance',
            message_fr: maintenance.message_fr ?? 'Le serveur est en maintenance.',
            ends_at: maintenance.ends_at ?? null,
          })
        }
      } catch { /* ignore */ }
    }

    await next()
  }
}
