# Checklist Release V3 — PokeGrind

> Dernière mise à jour : 2026-04-10 (Sprint 18 — Panel Admin V3)
> Prochaine étape : Sprint 19 (Visual Polish uniquement — aucun backend ne sera modifié)

---

## Backend

- [x] Toutes les migrations appliquées (042 au total — `042_admin_v3.ts`)
- [x] Tous les seeders exécutés (`GameConfigSeeder`, `GigantamaxSeeder`, `CosmeticFormSeeder`, `LivingDexObjectivesSeeder`, `ItemSeeder`, `DungeonSeeder`, `RaidBossSeeder`, `TowerBossSeeder`, `TowerMilestoneSeeder`, `TowerSeasonSeeder`, `PrestigeLevelSeeder`, `PvpSeasonSeeder`, `shop_upgrades_seeder`, `FloorSeeder`, `FloorItemDropSeeder`, `GoldShopSeeder`, `BfShopSeeder`, `BfAchievementsSeeder`, `BfMegaStonesSeeder`, `GachaBannerSeeder`, `TierSeeder`, `DungeonModifierSeeder`)
- [x] Suite de régression complète : **494 tests, tous verts** (428 unitaires S17 + 60 nouveaux S18 intégration + 6 config service)
- [x] Pas de `any` TypeScript dans le code de production (sauf imports dynamiques techniques)
- [x] Toutes les routes documentées (Swagger sur `GET /api/docs` en dev)
- [x] Toutes les transactions gems passent par `GemsService`
- [x] Anti-cheat opérationnel (3 types de détection : DPS, kills, gems)

---

## Sécurité

- [x] Middleware `auth` sur toutes les routes `/api/player/*` et `/api/game/*`
- [x] Middleware `adminAuth` sur toutes les routes `/api/admin/*`
- [x] Rate limiting Redis sur login, gacha, raids
- [ ] **CORS configuré pour pokegrind.fr uniquement** *(à configurer en prod via FRONTEND_URL env)*
- [ ] **Clés VAPID en prod configurées** *(générer avec `npx web-push generate-vapid-keys`)*
- [ ] **ADMIN_IP_WHITELIST configurée en prod** *(recommandé — non implémenté dans le code actuel)*
- [x] Pas de logs sensibles (passwords, tokens) dans les fichiers log
- [x] Swagger désactivé en production (`NODE_ENV === 'production'`)

---

## Performance

- [x] Index BDD créés (migrations incluent les index critiques)
- [x] Cache Redis opérationnel (`GameConfigService` cache 5min, `PlayerUpgradeService`, leaderboards)
- [x] HP Raids via Redis atomique (DECRBY — pas via BDD directe)
- [x] Sync Redis → BDD toutes les 60s pour les Raids
- [x] `GameConfigService` : lecture Redis → BDD → hard defaults (fallback triple)

---

## Nouvelles fonctionnalités S18

- [x] **Migration 042** : `game_config`, `economy_reports`, `admin_sessions`
- [x] **GameConfigSeeder** : 21 clés de configuration par défaut
- [x] **GameConfigService** : cache Redis 5min + BDD + hard defaults
- [x] **Routes config admin** : GET/PUT/POST `/api/admin/config/*`
- [x] **Outils diagnostic** : `GET /api/admin/system/health` (API, DB, Redis, BullMQ, WS, Game)
- [x] **Sessions actives** : `GET /api/admin/system/active-sessions`
- [x] **Flush cache Redis** : `POST /api/admin/system/cache-flush/:pattern`
- [x] **Export CSV joueurs** : `GET /api/admin/export/players`
- [x] **Export CSV gems audit** : `GET /api/admin/export/gems-audit`
- [x] **Export CSV rapports économiques** : `GET /api/admin/export/economy-report`
- [x] **Rapports économiques quotidiens** : `GET /api/admin/economy/reports`
- [x] **Donjons admin** : GET/POST `/api/admin/dungeons/*`
- [x] **Tour Infinie admin** : GET/POST `/api/admin/tower/*`
- [x] **Job économique quotidien** à 3h du matin (`EconomyReportJob`)
- [x] **Swagger UI** : `GET /api/docs` + `GET /api/docs/spec` (dev uniquement)
- [x] **Page admin Donjons** (`DonjonAdminPage.vue`)
- [x] **Page admin Tour Infinie** (`TowerAdminPage.vue`)
- [x] **Page admin Économie V3** (`EconomyV3Page.vue`) avec onglets
- [x] **Page admin Santé Système** (`SystemHealthPage.vue`)
- [x] **Page admin Config** (`GameConfigPage.vue`)
- [x] **Dashboard admin enrichi** : raids actifs, santé système, config rapide, nouvelles actions

---

## Deploy

- [x] `docker-compose.prod.yml` testé (Sprint 7)
- [ ] **HTTPS fonctionnel sur pokegrind.fr** *(à valider en déploiement)*
- [ ] **Backups automatiques configurés** *(à configurer via `docker-compose.prod.yml` et cron système)*
- [ ] **Monitoring : alertes 5xx configurées** *(Prometheus / Grafana recommandé post-S19)*
- [ ] **Variables d'environnement prod complètes** *(voir `CLAUDE.md §11`)*

---

## Contenu

- [x] 1025 espèces importées (+ formes régionales et régionaux)
- [x] 34+ Méga-Évolutions seedées
- [x] 24 formes Gigantamax seedées (S17)
- [x] 9 Donjons seedés (S15)
- [x] 5 boss Raid seedés (S16)
- [x] 50 niveaux de Prestige seedés (S13)
- [x] Boutique gems : 18 upgrades (S6)
- [x] Items : 50+ items dans le catalogue (S10)
- [x] Tour Infinie : 20 boss seedés (étages 25-500) (S14)
- [x] 21 clés de configuration globale seedées (S18)

---

## État du projet par sprint

| Sprint | Statut | Tests |
|--------|--------|-------|
| S0 — Scaffold | ✅ Complet | — |
| S1 — Import PokéAPI | ✅ Complet | — |
| S2 — Auth + Gacha | ✅ Complet | 14 |
| S3 — Combat idle | ✅ Complet | 43 |
| S4 — Pension | ✅ Complet | 62 |
| S5 — Offline + Push | ✅ Complet | 81 |
| S6 — Boutique gems | ✅ Complet | 116 |
| S7 — Admin V1 + Docker | ✅ Complet | 116 |
| S9 — PvP ELO | ✅ Complet | 164 |
| S10 — Items équipables | ✅ Complet | 194 |
| S11 — Formes régionales + Méga | ✅ Complet | 212 |
| S12 — Anti-cheat + Events | ✅ Complet | 240 |
| S13 — Prestige 50 niveaux | ✅ Complet | 265 |
| S14 — Tour Infinie | ✅ Complet | 300 |
| S15 — Donjons Ancestraux | ✅ Complet | 348 |
| S16 — Raids Mondiaux | ✅ Complet | 386 |
| S17 — Gigantamax + Living Dex | ✅ Complet | 428 |
| **S18 — Admin V3** | ✅ **Complet** | **494** |
| S19 — Visual Polish | ⏳ Prochain | — |

---

## Notes pour Sprint 19

Le Sprint 19 ne doit modifier **aucun fichier backend**. Seuls les fichiers suivants peuvent être créés/modifiés :

- `apps/web/assets/css/design-tokens.css` — palette de couleurs
- `apps/web/components/ui/*.vue` — composants UI design system
- `apps/web/pages/**/*.vue` — refonte visuelle des pages existantes
- `apps/web/public/` — assets statiques

**Aucune nouvelle route, migration, ou service ne doit être créé en S19.**
