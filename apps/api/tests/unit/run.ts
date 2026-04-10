/**
 * Point d'entrée direct pour exécuter les tests unitaires sans boot AdonisJS.
 * Usage: node --import=tsx/esm tests/unit/run.ts
 */
import { configure, processCLIArgs, run } from '@japa/runner'
import { assert } from '@japa/assert'

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
      name: 'integration',
      files: ['tests/integration/**/*.spec.ts'],
      timeout: 5000,
    },
  ],
  forceExit: true,
})

run()
