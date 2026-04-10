import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AdminAuditLog extends BaseModel {
  static table = 'admin_audit_log'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare adminId: string

  @column()
  declare action: string

  @column()
  declare targetType: string | null

  @column()
  declare targetId: string | null

  @column()
  declare payload: Record<string, unknown>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
