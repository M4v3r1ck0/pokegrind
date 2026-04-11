import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import env from '#start/env'
import type { PlayerRole } from '@pokegrind/shared'

const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 jours

export interface JwtPayload {
  sub: string
  role: PlayerRole
}

export default class JwtService {
  /**
   * Génère un access token JWT (expire 24h)
   */
  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, env.get('JWT_SECRET'), { expiresIn: '24h' })
  }

  /**
   * Génère un refresh token UUID, le stocke en Redis (TTL 30 jours)
   */
  static async generateRefreshToken(playerId: string): Promise<string> {
    const token = randomUUID()
    await redis.setex(`refresh:${token}`, REFRESH_TTL_SECONDS, playerId)
    return token
  }

  /**
   * Vérifie un access token JWT et retourne le payload
   */
  static verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, env.get('JWT_SECRET')) as JwtPayload
  }

  /**
   * Vérifie un refresh token en Redis et retourne le player_id
   * Retourne null si invalide ou expiré
   */
  static async verifyRefreshToken(token: string): Promise<string | null> {
    const playerId = await redis.get(`refresh:${token}`)
    return playerId
  }

  /**
   * Invalide un refresh token (blacklist — suppression de Redis)
   */
  static async revokeRefreshToken(token: string): Promise<void> {
    await redis.del(`refresh:${token}`)
  }
}
