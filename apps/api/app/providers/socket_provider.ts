import type { ApplicationService } from '@adonisjs/core/types'
import { Server as SocketServer } from 'socket.io'

export default class SocketProvider {
  constructor(protected app: ApplicationService) {}

  async ready() {
    if (this.app.getEnvironment() === 'web') {
      const { default: server } = await import('@adonisjs/core/services/server')
      const { initSocket } = await import('#start/socket')
      const nodeServer = server.getNodeServer()
      if (nodeServer) {
        initSocket(nodeServer as import('node:http').Server)
      }
    }
  }
}
