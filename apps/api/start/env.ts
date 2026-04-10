import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for @adonisjs/lucid
  |----------------------------------------------------------
  */
  DATABASE_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for @adonisjs/redis
  |----------------------------------------------------------
  */
  REDIS_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for @adonisjs/auth
  |----------------------------------------------------------
  */
  JWT_SECRET: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for @adonisjs/ally (Discord)
  |----------------------------------------------------------
  */
  DISCORD_CLIENT_ID: Env.schema.string(),
  DISCORD_CLIENT_SECRET: Env.schema.string(),
  DISCORD_CALLBACK_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for Web Push
  |----------------------------------------------------------
  */
  VAPID_PUBLIC_KEY: Env.schema.string(),
  VAPID_PRIVATE_KEY: Env.schema.string(),
  VAPID_SUBJECT: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for CORS
  |----------------------------------------------------------
  */
  FRONTEND_URL: Env.schema.string(),
  ADMIN_URL: Env.schema.string(),
})
