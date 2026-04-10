import env from '#start/env'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  default: 'app',
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME', 'pokegrind'),
      level: env.get('NODE_ENV') === 'development' ? 'debug' : 'info',
      transport: {
        targets: targets()
          .pushIf(!env.get('APP_NAME'), targets.pretty())
          .pushIf(env.get('NODE_ENV') === 'production', targets.file({ destination: 1 }))
          .toArray(),
      },
    },
  },
})

export default loggerConfig

declare module '@adonisjs/core/types' {
  interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
