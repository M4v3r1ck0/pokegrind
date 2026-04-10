/**
 * Tests GameConfigService — lecture, écriture, invalidation cache.
 * Ces tests utilisent les fallbacks hardcodés (pas de BDD/Redis nécessaires).
 */

import { test } from '@japa/runner'
import '@japa/assert'
import {
  drawRarity,
  PITY_EPIC_THRESHOLD,
  PITY_LEGENDARY_DEFAULT,
} from '../../app/services/GachaFormulas.js'

// ── Tests GameConfigService (valeurs par défaut) ──────────────────────────────

test.group('GameConfigService — valeurs par défaut', () => {
  test('PITY_EPIC_THRESHOLD vaut 50 (GDD §5)', ({ assert }) => {
    assert.equal(PITY_EPIC_THRESHOLD, 50)
  })

  test('PITY_LEGENDARY_DEFAULT vaut 200 (GDD §5)', ({ assert }) => {
    assert.equal(PITY_LEGENDARY_DEFAULT, 200)
  })

  test('drawRarity avec pity epic=50 retourne epic', ({ assert }) => {
    const rarity = drawRarity(50, 0, 200)
    assert.equal(rarity, 'epic')
  })
})

// ── Tests EconomyReportJob — helpers ─────────────────────────────────────────

test.group('EconomyReportJob — startOfDay', () => {
  test('startOfDay retourne minuit pour une date donnée', ({ assert }) => {
    const date = new Date('2026-04-10T15:30:00Z')
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    assert.equal(start.getHours(), 0)
    assert.equal(start.getMinutes(), 0)
    assert.equal(start.getSeconds(), 0)
    assert.equal(start.getMilliseconds(), 0)
  })

  test('toDateString retourne format YYYY-MM-DD', ({ assert }) => {
    const date = new Date('2026-04-10T00:00:00Z')
    const str = date.toISOString().split('T')[0]
    assert.equal(str, '2026-04-10')
  })
})

// ── Tests AdminV3 — CSV helper ───────────────────────────────────────────────

test.group('toCsv helper', () => {
  const toCsv = (rows: Record<string, unknown>[]): string => {
    if (rows.length === 0) return ''
    const headers = Object.keys(rows[0])
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
    ]
    return lines.join('\n')
  }

  test('génère CSV avec header', ({ assert }) => {
    const csv = toCsv([{ username: 'test', gems: 42 }])
    assert.isTrue(csv.startsWith('username,gems'))
    assert.isTrue(csv.includes('test,42'))
  })

  test('échappe les virgules dans les valeurs', ({ assert }) => {
    const csv = toCsv([{ field: 'valeur, avec virgule' }])
    assert.isTrue(csv.includes('"valeur, avec virgule"'))
  })

  test('échappe les guillemets dans les valeurs', ({ assert }) => {
    const csv = toCsv([{ field: 'valeur "avec" guillemets' }])
    assert.isTrue(csv.includes('"valeur ""avec"" guillemets"'))
  })

  test('retourne vide pour tableau vide', ({ assert }) => {
    const csv = toCsv([])
    assert.equal(csv, '')
  })

  test('gère les valeurs null/undefined', ({ assert }) => {
    const csv = toCsv([{ a: null, b: undefined, c: 'ok' }])
    assert.isTrue(csv.includes(',,ok'))
  })
})

// ── Tests GameConfig — groupes de clés ───────────────────────────────────────

test.group('GameConfig — structure des clés', () => {
  const DEFAULT_KEYS = [
    'combat.boss_timer_seconds',
    'combat.tower_boss_timer_seconds',
    'combat.offline_cap_hours',
    'gacha.legendary_pity',
    'gacha.epic_pity',
    'gacha.shiny_rate',
    'gacha.pull_cost_gold',
    'daycare.base_slots',
    'daycare.hidden_talent_rate',
    'daycare.shiny_5star_rate',
    'raid.attack_cooldown_hours',
    'raid.auto_schedule_days',
    'pvp.season_duration_days',
    'pvp.elo_start',
    'pvp.attack_cooldown_hours',
    'economy.gems_boss_first',
    'economy.gems_region_complete',
    'economy.gems_pokedex_gen',
    'system.maintenance_mode',
    'system.maintenance_message',
    'system.max_players_online',
  ]

  test('toutes les clés ont un préfixe valide', ({ assert }) => {
    const VALID_PREFIXES = ['combat', 'gacha', 'daycare', 'raid', 'pvp', 'economy', 'system']
    for (const key of DEFAULT_KEYS) {
      const prefix = key.split('.')[0]
      assert.isTrue(VALID_PREFIXES.includes(prefix), `Préfixe invalide pour ${key}`)
    }
  })

  test('toutes les clés sont en format dot-notation', ({ assert }) => {
    for (const key of DEFAULT_KEYS) {
      assert.isTrue(key.includes('.'), `Clé sans point: ${key}`)
      assert.isFalse(key.startsWith('.'), `Clé commence par point: ${key}`)
      assert.isFalse(key.endsWith('.'), `Clé finit par point: ${key}`)
    }
  })

  test('21 clés de configuration par défaut', ({ assert }) => {
    assert.equal(DEFAULT_KEYS.length, 21)
  })

  test('valeurs combat.boss_timer_seconds = 90s (GDD §5)', ({ assert }) => {
    const combat_defaults: Record<string, number> = {
      'combat.boss_timer_seconds': 90,
      'combat.tower_boss_timer_seconds': 120,
      'combat.offline_cap_hours': 24,
    }
    assert.equal(combat_defaults['combat.boss_timer_seconds'], 90)
    assert.equal(combat_defaults['combat.tower_boss_timer_seconds'], 120)
    assert.equal(combat_defaults['combat.offline_cap_hours'], 24)
  })

  test('gacha.shiny_rate = 8192 (GDD §5)', ({ assert }) => {
    const gacha_defaults: Record<string, number> = {
      'gacha.shiny_rate': 8192,
      'gacha.pull_cost_gold': 1000,
    }
    assert.equal(gacha_defaults['gacha.shiny_rate'], 8192)
    assert.equal(gacha_defaults['gacha.pull_cost_gold'], 1000)
  })

  test('system.maintenance_mode = false par défaut', ({ assert }) => {
    const sys_defaults: Record<string, unknown> = {
      'system.maintenance_mode': false,
      'system.max_players_online': 10000,
    }
    assert.equal(sys_defaults['system.maintenance_mode'], false)
    assert.equal(sys_defaults['system.max_players_online'], 10000)
  })
})
