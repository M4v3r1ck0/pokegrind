/**
 * Tests fonctionnels — Panel Admin
 *
 * Prérequis : node ace test --suite=functional
 * Ces tests nécessitent une base de données de test (DATABASE_URL pointe vers une DB test).
 *
 * Les tests couvrent :
 * 1.  Accès refusé sans token
 * 2.  Accès refusé avec token joueur normal
 * 3.  Login admin réussi
 * 4.  Dashboard admin accessible
 * 5.  Liste joueurs paginée
 * 6.  Recherche joueur par username
 * 7.  Fiche joueur détaillée
 * 8.  Ban joueur (crée audit log)
 * 9.  Unban joueur (lève le ban)
 * 10. Grant gems (crée gems_audit)
 */

import { test } from '@japa/runner'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function loginAs(client: any, email: string, password: string): Promise<string> {
  const res = await client.post('/api/auth/login').json({ email, password })
  res.assertStatus(200)
  return res.body().access_token as string
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

test.group('Admin — auth guards', (group) => {
  group.tap((t) => t.tags(['admin']))

  test('GET /admin/dashboard sans token → 401', async ({ client }) => {
    const res = await client.get('/api/admin/dashboard')
    res.assertStatus(401)
  })

  test('GET /admin/dashboard avec token joueur → 403', async ({ client }) => {
    // Un joueur normal (role=player) ne devrait pas accéder
    const token = await loginAs(client, 'player_test@pokegrind.fr', 'password')
    const res = await client
      .get('/api/admin/dashboard')
      .header('Authorization', `Bearer ${token}`)
    res.assertStatus(403)
  })
})

test.group('Admin — dashboard', (group) => {
  let admin_token = ''

  group.setup(async ({ client }: any) => {
    admin_token = await loginAs(client, 'admin@pokegrind.fr', 'admin_password')
  })

  test('GET /admin/dashboard retourne les stats attendues', async ({ client, assert }) => {
    const res = await client
      .get('/api/admin/dashboard')
      .header('Authorization', `Bearer ${admin_token}`)
    res.assertStatus(200)
    const body = res.body()
    assert.properties(body, ['players', 'economy', 'combat', 'daycare', 'server'])
    assert.isNumber(body.players.total)
    assert.isNumber(body.economy.total_gems_in_circulation)
    assert.isNumber(body.server.uptime_seconds)
  })
})

test.group('Admin — gestion joueurs', (group) => {
  let admin_token = ''
  let target_player_id = ''

  group.setup(async ({ client }: any) => {
    admin_token = await loginAs(client, 'admin@pokegrind.fr', 'admin_password')
  })

  test('GET /admin/players retourne une liste paginée', async ({ client, assert }) => {
    const res = await client
      .get('/api/admin/players')
      .header('Authorization', `Bearer ${admin_token}`)
    res.assertStatus(200)
    const body = res.body()
    assert.properties(body, ['data', 'meta'])
    assert.isArray(body.data)
    assert.properties(body.meta, ['total', 'page', 'limit', 'last_page'])
    if (body.data.length > 0) {
      target_player_id = body.data[0].id
    }
  })

  test('GET /admin/players?search=admin filtre par username', async ({ client, assert }) => {
    const res = await client
      .get('/api/admin/players')
      .qs({ search: 'admin' })
      .header('Authorization', `Bearer ${admin_token}`)
    res.assertStatus(200)
    const body = res.body()
    assert.isArray(body.data)
    // Tous les résultats doivent contenir "admin" dans username ou email
    for (const p of body.data) {
      const match =
        (p.username as string).toLowerCase().includes('admin') ||
        (p.email as string).toLowerCase().includes('admin')
      assert.isTrue(match, `Le joueur ${p.username} ne correspond pas au filtre "admin"`)
    }
  })

  test('GET /admin/players/:id retourne la fiche complète', async ({ client, assert }) => {
    if (!target_player_id) return
    const res = await client
      .get(`/api/admin/players/${target_player_id}`)
      .header('Authorization', `Bearer ${admin_token}`)
    res.assertStatus(200)
    const body = res.body()
    assert.properties(body, ['player', 'team', 'stats', 'recent_gems_audit'])
    assert.equal(body.player.id, target_player_id)
  })
})

test.group('Admin — ban / unban', (group) => {
  let admin_token = ''
  let target_id = ''

  group.setup(async ({ client }: any) => {
    admin_token = await loginAs(client, 'admin@pokegrind.fr', 'admin_password')
    // Récupérer un joueur normal (non admin) à bannir
    const res = await client
      .get('/api/admin/players')
      .qs({ role: 'player', limit: 1 })
      .header('Authorization', `Bearer ${admin_token}`)
    const body = res.body()
    if (body.data.length > 0) {
      target_id = body.data[0].id
    }
  })

  test('POST /admin/players/:id/ban banne le joueur (ban temporaire 24h)', async ({ client, assert }) => {
    if (!target_id) return
    const res = await client
      .post(`/api/admin/players/${target_id}/ban`)
      .header('Authorization', `Bearer ${admin_token}`)
      .json({ reason: 'Test fonctionnel ban', duration_hours: 24 })
    res.assertStatus(200)
    const body = res.body()
    assert.isTrue(body.player.is_banned)
    assert.isNotNull(body.player.ban_until)
  })

  test('POST /admin/players/:id/unban lève le ban', async ({ client, assert }) => {
    if (!target_id) return
    const res = await client
      .post(`/api/admin/players/${target_id}/unban`)
      .header('Authorization', `Bearer ${admin_token}`)
    res.assertStatus(200)
    const body = res.body()
    assert.isFalse(body.player.is_banned)
  })
})

test.group('Admin — grant gems', (group) => {
  let admin_token = ''
  let target_id = ''
  let gems_before = 0

  group.setup(async ({ client }: any) => {
    admin_token = await loginAs(client, 'admin@pokegrind.fr', 'admin_password')
    const res = await client
      .get('/api/admin/players')
      .qs({ role: 'player', limit: 1 })
      .header('Authorization', `Bearer ${admin_token}`)
    const body = res.body()
    if (body.data.length > 0) {
      target_id = body.data[0].id
      gems_before = body.data[0].gems
    }
  })

  test('POST /admin/players/:id/gems accorde des gems et crée un audit', async ({ client, assert }) => {
    if (!target_id) return
    const res = await client
      .post(`/api/admin/players/${target_id}/gems`)
      .header('Authorization', `Bearer ${admin_token}`)
      .json({ amount: 10, reason: 'Test fonctionnel grant gems' })
    res.assertStatus(200)

    // Vérifier que les gems ont bien été ajoutés
    const detail = await client
      .get(`/api/admin/players/${target_id}`)
      .header('Authorization', `Bearer ${admin_token}`)
    detail.assertStatus(200)
    assert.equal(detail.body().player.gems, gems_before + 10)

    // Vérifier que l'audit est présent
    const audit = detail.body().recent_gems_audit as any[]
    const entry = audit.find((a: any) => a.reason === 'Test fonctionnel grant gems')
    assert.isDefined(entry, 'Entrée gems_audit introuvable')
    assert.equal(entry.amount, 10)
  })
})
