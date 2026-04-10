import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class BfCreateRotation extends BaseCommand {
  static commandName = 'bf:create-rotation'
  static description = 'Crée manuellement une nouvelle rotation Battle Frontier'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: battleFrontierService } = await import('#services/BattleFrontierService')

    this.logger.info('Création d\'une nouvelle rotation Battle Frontier...')

    const rotation = await battleFrontierService.createNewRotation()

    this.logger.success(`Rotation créée :`)
    this.logger.info(`  ID      : ${rotation.id}`)
    this.logger.info(`  Nom     : ${rotation.nameFr}`)
    this.logger.info(`  Mode    : ${rotation.mode}`)
    this.logger.info(`  Challenge : ${rotation.challengeType}`)
    this.logger.info(`  Début   : ${rotation.startAt.toISO()}`)
    this.logger.info(`  Fin     : ${rotation.endAt.toISO()}`)
  }
}
