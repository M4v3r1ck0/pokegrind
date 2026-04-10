import type Player from '#models/player'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    player: Player
  }
}
