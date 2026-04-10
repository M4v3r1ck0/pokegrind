import { defineConfig, drivers } from '@adonisjs/core/hash'

const hashConfig = defineConfig({
  default: 'argon',
  list: {
    argon: drivers.argon2({
      version: 0x13,
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 4,
      saltSize: 16,
      hashLength: 32,
    }),

    bcrypt: drivers.bcrypt({
      rounds: 10,
    }),
  },
})

export default hashConfig

declare module '@adonisjs/core/types' {
  interface HashersList extends InferHashers<typeof hashConfig> {}
}
