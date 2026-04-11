import vine from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'
import Player from '#models/player'
import PlayerUpgrade from '#models/player_upgrade'
import JwtService from '#services/JwtService'
import StarterService, { ALL_STARTER_IDS } from '#services/StarterService'
import { OfflineQueue } from '#jobs/OfflineQueue'
import { buildMinimalTeamSnapshot } from '#jobs/HeartbeatScheduler'
import { calcAbsenceSeconds } from '#services/OfflineFormulas'

// ─── Validators ──────────────────────────────────────────────────────────────

const registerValidator = vine.compile(
  vine.object({
    username: vine
      .string()
      .minLength(3)
      .maxLength(32)
      .regex(/^[a-zA-Z0-9-_]+$/),
    email: vine.string().email(),
    password: vine.string().minLength(8),
    starter_id: vine.number().positive(),
  })
)

const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string(),
  })
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function buildTokenResponse(
  player: Player,
  ctx: HttpContext
): Promise<{ access_token: string }> {
  const accessToken = JwtService.generateAccessToken({
    sub: player.id,
    role: player.role,
  })
  const refreshToken = await JwtService.generateRefreshToken(player.id)

  ctx.response.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/api/auth/refresh',
  })

  return { access_token: accessToken }
}

function serializePlayer(player: Player, upgrades: string[] = []) {
  return {
    id: player.id,
    username: player.username,
    email: player.email,
    discord_id: player.discordId,
    role: player.role,
    gems: player.gems,
    gold: player.gold,
    frontier_points: player.frontierPoints,
    current_floor: player.currentFloor,
    created_at: player.createdAt,
    upgrades,
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

export default class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(registerValidator)

    // Valider le starter
    if (!ALL_STARTER_IDS.includes(data.starter_id)) {
      return ctx.response.unprocessableEntity({
        message: 'starter_id invalide',
      })
    }

    // Unicité username / email
    const existingUsername = await Player.query()
      .where('username', data.username)
      .first()
    if (existingUsername) {
      return ctx.response.unprocessableEntity({ message: 'Ce pseudo est déjà utilisé' })
    }

    const existingEmail = await Player.query()
      .where('email', data.email)
      .first()
    if (existingEmail) {
      return ctx.response.unprocessableEntity({ message: 'Cet email est déjà utilisé' })
    }

    const player = await Player.create({
      username: data.username,
      email: data.email,
      // Le withAuthFinder hook hache le mot de passe automatiquement avant save
      passwordHash: data.password,
      role: 'player',
      gems: 0,
      gold: 5000, // Or de départ pour permettre quelques pulls
      frontierPoints: 0,
      currentFloor: 1,
      pityEpic: 0,
      pityLegendary: 0,
      totalPulls: 0,
    })

    // Créer le starter
    await StarterService.createStarterForPlayer(player.id, data.starter_id)

    // Créer les 5 slots daycare vides
    await StarterService.createDaycareSlots(player.id)

    const tokens = await buildTokenResponse(player, ctx)

    return ctx.response.created({
      ...tokens,
      player: serializePlayer(player),
    })
  }

  /**
   * POST /api/auth/login
   */
  async login(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(loginValidator)

    let player: Player
    try {
      player = await Player.verifyCredentials(data.email, data.password)
    } catch {
      return ctx.response.unauthorized({ message: 'Email ou mot de passe incorrect' })
    }

    // Déclencher le calcul offline si absent depuis > 5 min
    const absence = calcAbsenceSeconds(player.lastSeenAt?.toISO() ?? null)
    if (absence !== null) {
      const team_snapshot = await buildMinimalTeamSnapshot(player.id)
      OfflineQueue.add('calculate-offline', {
        player_id: player.id,
        last_seen_at: player.lastSeenAt!.toISO()!,
        floor_number: player.currentFloor ?? 1,
        team_snapshot,
      }).catch((err) => console.error('[OfflineQueue] add error:', err.message))
    }

    const { DateTime } = await import('luxon')
    await player.merge({ lastSeenAt: DateTime.now() }).save()

    const tokens = await buildTokenResponse(player, ctx)

    return ctx.response.ok({
      ...tokens,
      player: serializePlayer(player),
    })
  }

  /**
   * POST /api/auth/refresh
   */
  async refresh(ctx: HttpContext) {
    const refreshToken = ctx.request.cookie('refresh_token')

    if (!refreshToken) {
      return ctx.response.unauthorized({ message: 'Refresh token manquant' })
    }

    const playerId = await JwtService.verifyRefreshToken(refreshToken)
    if (!playerId) {
      return ctx.response.unauthorized({ message: 'Refresh token invalide ou expiré' })
    }

    const player = await Player.find(playerId)
    if (!player) {
      return ctx.response.unauthorized({ message: 'Joueur introuvable' })
    }

    // Rotation du refresh token
    await JwtService.revokeRefreshToken(refreshToken)
    const tokens = await buildTokenResponse(player, ctx)

    return ctx.response.ok(tokens)
  }

  /**
   * POST /api/auth/logout
   */
  async logout(ctx: HttpContext) {
    const refreshToken = ctx.request.cookie('refresh_token')

    if (refreshToken) {
      await JwtService.revokeRefreshToken(refreshToken)
    }

    ctx.response.clearCookie('refresh_token', { path: '/api/auth/refresh' })

    return ctx.response.ok({ message: 'Déconnecté' })
  }

  /**
   * GET /api/auth/discord
   */
  async discordRedirect(ctx: HttpContext) {
    return ctx.ally.use('discord').redirect()
  }

  /**
   * GET /api/auth/discord/callback
   */
  async discordCallback(ctx: HttpContext) {
    const discord = ctx.ally.use('discord')

    if (await discord.accessDenied()) {
      return ctx.response.badRequest({ message: 'Accès Discord refusé' })
    }
    if (await discord.hasError()) {
      return ctx.response.badRequest({ message: 'Erreur OAuth Discord' })
    }

    const discordUser = await discord.user()

    // Chercher un joueur existant par discord_id
    let player = await Player.query()
      .where('discord_id', discordUser.id)
      .first()

    if (!player) {
      // Chercher par email si disponible
      if (discordUser.email) {
        player = await Player.query().where('email', discordUser.email).first()
        if (player) {
          await player.merge({ discordId: discordUser.id }).save()
        }
      }
    }

    if (!player) {
      // Créer un nouveau compte
      let username = discordUser.nickName || discordUser.name || `user_${discordUser.id.slice(-6)}`
      username = username.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 32)

      // S'assurer que le username est unique
      const existing = await Player.query().where('username', username).first()
      if (existing) {
        username = `${username.slice(0, 26)}_${Math.floor(Math.random() * 9999)}`
      }

      player = await Player.create({
        username,
        email: discordUser.email || `discord_${discordUser.id}@pokegrind.local`,
        discordId: discordUser.id,
        passwordHash: null,
        role: 'player',
        gems: 0,
        gold: 5000,
        frontierPoints: 0,
        currentFloor: 1,
        pityEpic: 0,
        pityLegendary: 0,
        totalPulls: 0,
      })

      // Créer les 5 slots daycare vides
      await StarterService.createDaycareSlots(player.id)

      // Rediriger vers le choix du starter
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
      return ctx.response.redirect(`${frontendUrl}/auth/choix-starter?player_id=${player.id}`)
    }

    // Déclencher calcul offline si nécessaire
    const absence = calcAbsenceSeconds(player.lastSeenAt?.toISO() ?? null)
    if (absence !== null) {
      const team_snapshot = await buildMinimalTeamSnapshot(player.id)
      OfflineQueue.add('calculate-offline', {
        player_id: player.id,
        last_seen_at: player.lastSeenAt!.toISO()!,
        floor_number: player.currentFloor ?? 1,
        team_snapshot,
      }).catch((err) => console.error('[OfflineQueue] add error:', err.message))
    }

    const { DateTime } = await import('luxon')
    await player.merge({ lastSeenAt: DateTime.now() }).save()

    const tokens = await buildTokenResponse(player, ctx)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

    return ctx.response.redirect(
      `${frontendUrl}/auth/discord/success?token=${tokens.access_token}`
    )
  }

  /**
   * GET /api/auth/me  (auth requise)
   */
  async me(ctx: HttpContext) {
    const player = ctx.player

    const upgradeRows = await PlayerUpgrade.query()
      .where('player_id', player.id)
      .preload('upgrade')

    const upgradeEffects = upgradeRows.map((pu) => pu.upgrade?.effectType ?? '').filter(Boolean)

    return ctx.response.ok(serializePlayer(player, upgradeEffects))
  }
}
