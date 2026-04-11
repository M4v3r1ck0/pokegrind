import router from '@adonisjs/core/services/router'
import app from '@adonisjs/core/services/app'
import { middleware } from '#start/kernel'

const HealthController = () => import('#controllers/health_controller')
const DevController = () => import('#controllers/dev_controller')
const AuthController = () => import('#controllers/AuthController')
const StarterController = () => import('#controllers/StarterController')
const GachaController = () => import('#controllers/GachaController')
const InventoryController = () => import('#controllers/InventoryController')
const CombatController = () => import('#controllers/CombatController')
const DaycareController = () => import('#controllers/DaycareController')
const PlayerController = () => import('#controllers/PlayerController')
const ShopController = () => import('#controllers/ShopController')
const PokedexController = () => import('#controllers/PokedexController')
const SavedTeamController = () => import('#controllers/SavedTeamController')
const AdminController = () => import('#controllers/AdminController')
const BfController = () => import('#controllers/BfController')
const PvpController = () => import('#controllers/PvpController')
const ItemController = () => import('#controllers/ItemController')
const GoldShopController = () => import('#controllers/GoldShopController')
const FormsController = () => import('#controllers/FormsController')
const AdminV2Controller = () => import('#controllers/AdminV2Controller')
const PrestigeController = () => import('#controllers/PrestigeController')
const TowerController = () => import('#controllers/TowerController')
const DungeonController = () => import('#controllers/DungeonController')
const RaidController = () => import('#controllers/RaidController')
const AdminRaidController = () => import('#controllers/AdminRaidController')
const GigantamaxController = () => import('#controllers/GigantamaxController')
const AdminV3Controller = () => import('#controllers/AdminV3Controller')
const SwaggerController = () => import('#controllers/SwaggerController')
const TeamController = () => import('#controllers/TeamController')

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/
router.get('/health', [HealthController, 'index'])

// ── Swagger / OpenAPI (dev only) ─────────────────────────────────────────────
router.get('/api/docs', [SwaggerController, 'index'])
router.get('/api/docs/spec', [SwaggerController, 'spec'])

/*
|--------------------------------------------------------------------------
| Dev routes (non-production uniquement)
|--------------------------------------------------------------------------
*/
if (!app.inProduction) {
  router.get('/dev/stats', [DevController, 'stats'])
}

/*
|--------------------------------------------------------------------------
| API routes
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    // ── Auth (publique) ────────────────────────────────────────────────
    router
      .group(() => {
        router.post('/register', [AuthController, 'register'])
        router.post('/login', [AuthController, 'login'])
        router.post('/refresh', [AuthController, 'refresh'])
        router.post('/logout', [AuthController, 'logout'])
        router.get('/discord', [AuthController, 'discordRedirect'])
        router.get('/discord/callback', [AuthController, 'discordCallback'])
        router.get('/me', [AuthController, 'me']).use(middleware.auth())
      })
      .prefix('/auth')

    // ── Starters (publique) ────────────────────────────────────────────
    router.get('/starters', [StarterController, 'index'])

    // ── Gacha (auth requise) ───────────────────────────────────────────
    router
      .group(() => {
        router.post('/pull', [GachaController, 'pull'])
        router.get('/pity', [GachaController, 'pity'])
      })
      .prefix('/gacha')
      .use(middleware.auth())

    // ── Combat (auth requise) ──────────────────────────────────────────
    router
      .group(() => {
        router.get('/state', [CombatController, 'state'])
        router.post('/start', [CombatController, 'start'])
        router.post('/move-to-floor', [CombatController, 'moveToFloor'])
        router.get('/floors', [CombatController, 'floors'])
        router.get('/offline/check', [CombatController, 'checkOffline'])
        router.post('/offline/apply', [CombatController, 'applyOfflineGains'])
      })
      .prefix('/combat')
      .use(middleware.auth())

    // ── Pension (auth requise) ─────────────────────────────────────────
    router
      .group(() => {
        router.get('/', [DaycareController, 'index'])
        router.post('/deposit', [DaycareController, 'deposit'])
        router.post('/withdraw', [DaycareController, 'withdraw'])
        router.post('/hatch', [DaycareController, 'hatch'])
        router.get('/compatible/:pokemon_id', [DaycareController, 'compatible'])
        router.get('/queue', [DaycareController, 'queue'])
        router.post('/queue/add', [DaycareController, 'queueAdd'])
        router.delete('/queue/:position', [DaycareController, 'queueRemove'])
      })
      .prefix('/player/daycare')
      .use(middleware.auth())

    // ── Inventaire joueur (auth requise) ───────────────────────────────
    router
      .group(() => {
        router.get('/pokemon', [InventoryController, 'index'])
        router.post('/pokemon/sell', [InventoryController, 'sell'])
        router.get('/pokemon/:id', [InventoryController, 'show'])
        router.post('/pokemon/:id/assign-team', [InventoryController, 'assignTeam'])
        router.get('/team', [InventoryController, 'team'])
      })
      .prefix('/player')
      .use(middleware.auth())

    // ── Gestion équipe + movesets (auth requise) ──────────────────────
    router
      .group(() => {
        router.get('/', [TeamController, 'index'])
        router.post('/slot', [TeamController, 'setSlot'])
        router.get('/:id/moves', [TeamController, 'availableMoves'])
        router.put('/:id/moves', [TeamController, 'updateMoves'])
      })
      .prefix('/team')
      .use(middleware.auth())

    // ── Boutique gems (auth requise) ───────────────────────────────────
    router
      .group(() => {
        router.get('/', [ShopController, 'index'])
        router.post('/purchase', [ShopController, 'purchase'])
      })
      .prefix('/player/shop')
      .use(middleware.auth())

    // ── Pokédex (auth requise) ─────────────────────────────────────────
    router
      .group(() => {
        router.get('/', [PokedexController, 'index'])
        router.get('/:species_id', [PokedexController, 'show'])
      })
      .prefix('/player/pokedex')
      .use(middleware.auth())

    // ── Équipes sauvegardées (auth requise) ────────────────────────────
    router
      .group(() => {
        router.get('/', [SavedTeamController, 'index'])
        router.post('/:slot/save', [SavedTeamController, 'save'])
        router.post('/:slot/load', [SavedTeamController, 'load'])
        router.put('/:slot/rename', [SavedTeamController, 'rename'])
        router.post('/:slot/swap-pokemon', [SavedTeamController, 'swapPokemon'])
      })
      .prefix('/player/saved-teams')
      .use(middleware.auth())

    // ── Profils moveset (auth requise) ─────────────────────────────────
    router
      .group(() => {
        router.get('/:id/moveset-profiles', [SavedTeamController, 'movesetProfiles'])
        router.post('/:id/moveset-profiles/:slot/save', [SavedTeamController, 'saveProfile'])
        router.post('/:id/moveset-profiles/:slot/load', [SavedTeamController, 'loadProfile'])
        router.put('/:id/moveset-profiles/:slot/rename', [SavedTeamController, 'renameProfile'])
      })
      .prefix('/player/pokemon')
      .use(middleware.auth())

    // ── Admin (rôle admin/mod/support requis) ─────────────────────────
    router
      .group(() => {
        // Dashboard — tous les rôles admin
        router.get('/dashboard', [AdminController, 'dashboard'])

        // Joueurs — admin + mod
        router.get('/players', [AdminController, 'players'])
        router.get('/players/:id', [AdminController, 'playerDetail'])

        // Pokémon + items joueur
        router.get('/players/:id/pokemon', [AdminController, 'playerPokemon'])
        router.put('/players/:id/pokemon/:pokemon_id', [AdminController, 'editPokemon']).use(middleware.adminAuth(['admin']))
        router.get('/players/:id/items', [AdminController, 'playerItems'])
        router.post('/players/:id/items', [AdminController, 'grantItems']).use(middleware.adminAuth(['admin']))
        router.get('/items', [AdminController, 'itemsList'])

        // Actions sur joueurs — admin uniquement
        router.post('/players/:id/ban', [AdminController, 'banPlayer']).use(middleware.adminAuth(['admin']))
        router.post('/players/:id/unban', [AdminController, 'unbanPlayer']).use(middleware.adminAuth(['admin']))
        router.post('/players/:id/gems', [AdminController, 'grantGems']).use(middleware.adminAuth(['admin']))
        router.post('/players/:id/gold', [AdminController, 'grantGold']).use(middleware.adminAuth(['admin']))
        router.post('/players/:id/force-disconnect', [AdminController, 'forceDisconnect'])

        // Audit gems — admin uniquement
        router.get('/gems-audit', [AdminController, 'gemsAudit']).use(middleware.adminAuth(['admin']))
        router.get('/gems-audit/stats', [AdminController, 'gemsAuditStats']).use(middleware.adminAuth(['admin']))

        // Logs admin
        router.get('/audit-log', [AdminController, 'auditLog'])

        // Stats
        router.get('/stats/combat', [AdminController, 'statsCombat'])
        router.get('/stats/gacha', [AdminController, 'statsGacha'])
        router.get('/stats/economy', [AdminController, 'statsEconomy'])
      })
      .prefix('/admin')
      .use(middleware.adminAuth())

    // ── Battle Frontier (auth requise) ────────────────────────────────
    router
      .group(() => {
        router.get('/current', [BfController, 'current'])
        router.get('/rotations', [BfController, 'rotations'])
        router.get('/leaderboard/:rotation_id', [BfController, 'leaderboard'])
        router.get('/my-session', [BfController, 'mySession'])
        router.post('/join', [BfController, 'join'])
        router.post('/battle', [BfController, 'battle'])
        router.post('/abandon', [BfController, 'abandon'])
        router.get('/shop', [BfController, 'shop'])
        router.post('/shop/purchase', [BfController, 'shopPurchase'])
        router.post('/shop/use-capsule', [BfController, 'useCapsule'])
        router.post('/shop/use-mint', [BfController, 'useMint'])
        router.get('/achievements', [BfController, 'achievements'])
      })
      .prefix('/bf')
      .use(middleware.auth())

    // ── PvP stratégique (auth requise) ───────────────────────────────────
    router
      .group(() => {
        router.get('/season',                   [PvpController, 'season'])
        router.get('/opponent',                 [PvpController, 'opponent'])
        router.post('/attack',                  [PvpController, 'attack'])
        router.get('/replay/:battle_id',        [PvpController, 'replay'])
        router.get('/history',                  [PvpController, 'history'])
        router.get('/leaderboard',              [PvpController, 'leaderboard'])
        router.get('/notifications',            [PvpController, 'notifications'])
        router.post('/notifications/read',      [PvpController, 'markRead'])
        router.post('/defense-team',            [PvpController, 'setDefenseTeam'])
        router.get('/defense-team',             [PvpController, 'getDefenseTeam'])
        router.get('/defense-team/:player_id',  [PvpController, 'getOpponentDefenseTeam'])
      })
      .prefix('/pvp')
      .use(middleware.auth())

    // ── Heartbeat + rapport offline (auth requise) ─────────────────────
    router
      .group(() => {
        router.post('/heartbeat', [PlayerController, 'heartbeat'])
        router.get('/offline-report/pending', [PlayerController, 'pendingReport'])
        router.post('/offline-report/collect', [PlayerController, 'collectReport'])
        router.get('/offline-reports', [PlayerController, 'reportHistory'])
        // Push notifications
        router.get('/push/vapid-key', [PlayerController, 'vapidKey'])
        router.post('/push/subscribe', [PlayerController, 'pushSubscribe'])
        router.post('/push/unsubscribe', [PlayerController, 'pushUnsubscribe'])
        router.get('/push/preferences', [PlayerController, 'pushPreferences'])
        router.put('/push/preferences', [PlayerController, 'updatePushPreferences'])
      })
      .prefix('/player')
      .use(middleware.auth())

    // ── Items — catalogue public ────────────────────────────────────────
    router
      .group(() => {
        router.get('/catalog',              [ItemController, 'catalog'])
        router.get('/catalog/:category',    [ItemController, 'catalogByCategory'])
      })
      .prefix('/items')

    // ── Items — inventaire + équipement (auth) ──────────────────────────
    router
      .group(() => {
        router.get('/items',                      [ItemController, 'inventory'])
        router.get('/items/:item_id',             [ItemController, 'inventoryItem'])
        router.post('/pokemon/:id/equip',         [ItemController, 'equip'])
        router.post('/pokemon/:id/unequip',       [ItemController, 'unequip'])
      })
      .prefix('/player')
      .use(middleware.auth())

    // ── Boutique or ────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/', [GoldShopController, 'getShop'])
        router.post('/purchase', [GoldShopController, 'purchase'])
      })
      .prefix('/shop/gold')
      .use(middleware.auth())

    // ── Prestige (auth requise) ──────────────────────────────────────────────
    router
      .group(() => {
        router.get('/',           [PrestigeController, 'status'])
        router.get('/history',    [PrestigeController, 'history'])
        router.get('/levels',     [PrestigeController, 'levels'])
        router.post('/perform',   [PrestigeController, 'perform'])
      })
      .prefix('/player/prestige')
      .use(middleware.auth())

    // Classement prestige (public)
    router.get('/prestige/leaderboard', [PrestigeController, 'leaderboard'])

    // ── Tour Infinie (auth requise pour les routes joueur) ───────────────────
    router
      .group(() => {
        router.get('/status',     [TowerController, 'status'])
        router.post('/start',     [TowerController, 'start'])
        router.post('/stop',      [TowerController, 'stop'])
        router.get('/state',      [TowerController, 'state'])
        router.post('/abandon',   [TowerController, 'abandon'])
      })
      .prefix('/tower')
      .use(middleware.auth())

    // Tour routes publiques
    router.get('/tower/season',         [TowerController, 'index'])
    router.get('/tower/seasons',        [TowerController, 'seasons'])
    router.get('/tower/leaderboard',    [TowerController, 'leaderboard'])
    router.get('/tower/milestones',     [TowerController, 'milestones'])
    router.get('/tower/bosses',         [TowerController, 'bosses'])
    router.get('/tower/boss/:floor',    [TowerController, 'boss'])
    router.get('/tower/floor/:number',  [TowerController, 'floor'])

    // ── Donjons Ancestraux (auth requise) ────────────────────────────────────
    router
      .group(() => {
        router.get('/',                             [DungeonController, 'index'])
        router.get('/rewards',                      [DungeonController, 'rewards'])
        router.get('/history',                      [DungeonController, 'history'])
        router.get('/run/current',                  [DungeonController, 'currentRun'])
        router.get('/:id',                          [DungeonController, 'show'])
        router.post('/:id/start',                   [DungeonController, 'start'])
        router.post('/run/:id/room/:number',        [DungeonController, 'resolveRoom'])
        router.post('/run/:id/shop/buy',            [DungeonController, 'shopBuy'])
        router.post('/run/:id/abandon',             [DungeonController, 'abandon'])
        router.post('/rewards/:id/collect',         [DungeonController, 'collectReward'])
      })
      .prefix('/dungeons')
      .use(middleware.auth())

    // ── Raids Mondiaux (auth requise) ────────────────────────────────────────
    router
      .group(() => {
        router.get('/active',                       [RaidController, 'active'])
        router.get('/history',                      [RaidController, 'history'])
        router.get('/rewards',                      [RaidController, 'rewards'])
        router.get('/my-contribution/:id',          [RaidController, 'myContribution'])
        router.get('/:id',                          [RaidController, 'show'])
        router.post('/:id/attack',                  [RaidController, 'attack'])
        router.get('/:id/leaderboard',              [RaidController, 'leaderboard'])
        router.post('/rewards/:id/collect',         [RaidController, 'collectReward'])
      })
      .prefix('/raids')
      .use(middleware.auth())

    // ── Gigantamax & Living Dex (auth requise) ────────────────────────────────
    router
      .group(() => {
        router.get('/unlocked',   [GigantamaxController, 'unlocked'])
        router.get('/available',  [GigantamaxController, 'available'])
      })
      .prefix('/gigantamax')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('/cosmetic/:species_id',       [GigantamaxController, 'cosmeticForms'])
      })
      .prefix('/pokemon-forms')

    router
      .group(() => {
        router.post('/:id/cosmetic-form',         [GigantamaxController, 'changeCosmeticForm'])
        router.delete('/:id/cosmetic-form',       [GigantamaxController, 'resetCosmeticForm'])
        router.post('/:id/use-candy',             [GigantamaxController, 'useCandy'])
        router.post('/:id/evolve',                [GigantamaxController, 'evolve'])
      })
      .prefix('/player/pokemon')
      .use(middleware.auth())

    router
      .group(() => {
        router.get('/',                           [GigantamaxController, 'livingDex'])
        router.get('/objectives',                 [GigantamaxController, 'livingDexObjectives'])
        router.get('/missing',                    [GigantamaxController, 'missingSpecies'])
        router.post('/objectives/:id/claim',      [GigantamaxController, 'claimObjective'])
      })
      .prefix('/player/living-dex')
      .use(middleware.auth())

    // ── Formes régionales & Méga-Évolutions (public) ────────────────────────
    router.get('/pokemon-forms',                [FormsController, 'index'])
    router.get('/pokemon-forms/:species_id',    [FormsController, 'forSpecies'])
    router.get('/mega-evolutions',              [FormsController, 'megaIndex'])
    router.get('/mega-evolutions/:species_id',  [FormsController, 'megaForSpecies'])
    router.get('/gacha/banners',                [FormsController, 'gachaBanners'])

    // ── Admin V2 (admin/mod only) ────────────────────────────────────────────
    router
      .group(() => {
        // Anti-cheat
        router.get('/anticheat/alerts',                [AdminV2Controller, 'getAlerts'])
        router.get('/anticheat/alerts/:id',            [AdminV2Controller, 'getAlert'])
        router.post('/anticheat/alerts/:id/resolve',   [AdminV2Controller, 'resolveAlert'])
        router.post('/anticheat/check/:player_id',     [AdminV2Controller, 'triggerCheck'])
        router.get('/anticheat/stats',                 [AdminV2Controller, 'getAnticheatStats'])
        // Events
        router.get('/events',                          [AdminV2Controller, 'getEvents'])
        router.post('/events',                         [AdminV2Controller, 'createEvent'])
        router.put('/events/:id',                      [AdminV2Controller, 'updateEvent'])
        router.delete('/events/:id',                   [AdminV2Controller, 'deleteEvent'])
        router.post('/events/:id/activate',            [AdminV2Controller, 'activateEvent'])
        router.post('/events/:id/deactivate',          [AdminV2Controller, 'deactivateEvent'])
        // Économie
        router.get('/economy/overview',                [AdminV2Controller, 'economyOverview'])
        router.get('/economy/player/:id',              [AdminV2Controller, 'playerEconomy'])
        router.get('/economy/alerts',                  [AdminV2Controller, 'economyAlerts'])
        // PvP
        router.get('/pvp/seasons',                     [AdminV2Controller, 'pvpSeasons'])
        router.post('/pvp/seasons',                    [AdminV2Controller, 'createPvpSeason'])
        router.put('/pvp/seasons/:id',                 [AdminV2Controller, 'updatePvpSeason'])
        router.post('/pvp/seasons/:id/end',            [AdminV2Controller, 'endPvpSeason'])
        router.get('/pvp/leaderboard',                 [AdminV2Controller, 'pvpLeaderboard'])
        router.get('/pvp/stats',                       [AdminV2Controller, 'pvpStats'])
        // Battle Frontier
        router.get('/bf/rotations',                    [AdminV2Controller, 'bfRotations'])
        router.post('/bf/rotations',                   [AdminV2Controller, 'createBfRotation'])
        router.put('/bf/rotations/:id',                [AdminV2Controller, 'updateBfRotation'])
        router.post('/bf/rotations/:id/end',           [AdminV2Controller, 'endBfRotation'])
        router.get('/bf/stats',                        [AdminV2Controller, 'bfStats'])
        // Notes modérateur
        router.get('/players/:id/notes',               [AdminV2Controller, 'getNotes'])
        router.post('/players/:id/notes',              [AdminV2Controller, 'addNote'])
        router.put('/players/:id/notes/:note_id',      [AdminV2Controller, 'updateNote'])
        router.delete('/players/:id/notes/:note_id',   [AdminV2Controller, 'deleteNote'])
        // Raids Mondiaux — admin
        router.get('/raids',                           [AdminRaidController, 'index'])
        router.post('/raids/start',                    [AdminRaidController, 'start'])
        router.post('/raids/:id/end',                  [AdminRaidController, 'end'])
        router.get('/raids/:id/stats',                 [AdminRaidController, 'stats'])
        // Broadcast & maintenance
        router.post('/broadcast',                      [AdminV2Controller, 'broadcast'])
        router.post('/system/maintenance/enable',      [AdminV2Controller, 'enableMaintenance'])
        router.post('/system/maintenance/disable',     [AdminV2Controller, 'disableMaintenance'])
        router.get('/system/status',                   [AdminV2Controller, 'systemStatus'])

        // ── Admin V3 — Config globale ────────────────────────────────────────
        router.get('/config',                          [AdminV3Controller, 'getConfig'])
        router.put('/config/:key',                     [AdminV3Controller, 'setConfig'])
        router.post('/config/reset/:key',              [AdminV3Controller, 'resetConfig'])

        // ── Admin V3 — Diagnostics système ──────────────────────────────────
        router.get('/system/health',                   [AdminV3Controller, 'systemHealth'])
        router.get('/system/active-sessions',          [AdminV3Controller, 'activeSessions'])
        router.post('/system/cache-flush/:pattern',    [AdminV3Controller, 'cacheFlush'])

        // ── Admin V3 — Export CSV ────────────────────────────────────────────
        router.get('/export/players',                  [AdminV3Controller, 'exportPlayers'])
        router.get('/export/gems-audit',               [AdminV3Controller, 'exportGemsAudit'])
        router.get('/export/economy-report',           [AdminV3Controller, 'exportEconomyReport'])

        // ── Admin V3 — Rapports économiques ─────────────────────────────────
        router.get('/economy/reports',                 [AdminV3Controller, 'economyReports'])

        // ── Admin V3 — Donjons ───────────────────────────────────────────────
        router.get('/dungeons',                        [AdminV3Controller, 'getDungeons'])
        router.post('/dungeons/:id/toggle',            [AdminV3Controller, 'toggleDungeon'])
        router.get('/dungeons/stats',                  [AdminV3Controller, 'dungeonStats'])

        // ── Admin V3 — Tour Infinie ──────────────────────────────────────────
        router.get('/tower',                           [AdminV3Controller, 'getTower'])
        router.post('/tower/season/end',               [AdminV3Controller, 'endTowerSeason'])

        // ── Admin V3 — Migrations one-shot ──────────────────────────────────
        router.post('/migrate-starter-moves',          [AdminV3Controller, 'migrateStarterMoves'])
      })
      .prefix('/admin')
      .use(middleware.adminAuth())
  })
  .prefix('/api')
