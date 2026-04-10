import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))

configure({
  plugins: [assert()],
  suites: [
    {
      name: 'unit',
      files: ['tests/unit/**/*.spec.ts'],
      timeout: 2000,
    },
  ],
})

run()
