import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'

const APP_ROOT = new URL('../', import.meta.url)

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.initiating(() => {
      app.useConfig({
        appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT}`,
      })
    })
  })
  .testRunner()
  .configure(async () => {
    const { configure, processCLIArgs } = await import('@japa/runner')
    const { assert } = await import('@japa/assert')

    processCLIArgs(process.argv.splice(2))
    configure({
      plugins: [assert()],
      suites: [
        {
          name: 'unit',
          files: ['tests/unit/**/*.spec.ts'],
          timeout: 2000,
        },
        {
          name: 'functional',
          files: ['tests/functional/**/*.spec.ts'],
          timeout: 30000,
        },
      ],
    })
  })
  .run(async () => {
    const { run } = await import('@japa/runner')
    run()
  })
  .catch(prettyPrintError)
