import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RaidStart extends BaseCommand {
  static commandName = 'raid:start'
  static description = 'Démarre manuellement un Raid Mondial'

  @args.string({ description: 'ID du boss (--boss=1 pour Mewtwo)', required: false })
  declare boss: string | undefined

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { default: raidService } = await import('#services/RaidService')

    // Si pas de boss spécifié, utiliser le boss_id=1 (Mewtwo)
    const boss_id = this.boss ? parseInt(this.boss, 10) : 1

    this.logger.info(`Démarrage du Raid boss_id=${boss_id}...`)

    try {
      const raid = await raidService.startRaid(boss_id) as any
      this.logger.success(`Raid créé avec succès !`)
      this.logger.info(`  ID Raid  : ${raid.id}`)
      this.logger.info(`  Boss     : ${raid.boss?.name_fr ?? raid.boss_id}`)
      this.logger.info(`  HP Total : ${Number(raid.hp_total).toLocaleString('fr-FR')}`)
      this.logger.info(`  Fin le   : ${new Date(raid.ends_at).toLocaleString('fr-FR')}`)
    } catch (err: any) {
      this.logger.error(`Erreur : ${err.message}`)
    }
  }
}
