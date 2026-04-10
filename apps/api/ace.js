#!/usr/bin/env node
/*
|--------------------------------------------------------------------------
| Ace entry point
|--------------------------------------------------------------------------
|
| This file is the entry point for running ace commands. It bootstraps
| the application and forwards the command to the ace runner.
|
*/

import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

/**
 * URL to the application root.
 */
const APP_ROOT = new URL('./', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('./start/env.js')
    })
  })
  .ace()
  .handle(process.argv.splice(2))
