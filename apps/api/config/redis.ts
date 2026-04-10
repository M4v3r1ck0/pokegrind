import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      host: new URL(env.get('REDIS_URL')).hostname,
      port: Number(new URL(env.get('REDIS_URL')).port) || 6379,
      password: new URL(env.get('REDIS_URL')).password || undefined,
      db: 0,
      keyPrefix: 'pokegrind:',
    },
  },
})

export default redisConfig
