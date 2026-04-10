# PokeGrind

Jeu idle Pokémon jouable en navigateur.

## Prérequis

- [Node.js 20+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) (`npm install -g pnpm` ou `curl -fsSL https://get.pnpm.io/install.sh | sh -`)
- [Docker](https://www.docker.com/) + Docker Compose

## Installation

### 1. Cloner et installer les dépendances

```bash
git clone <repo>
cd pokegrind
pnpm install
```

### 2. Configurer les variables d'environnement

```bash
cp apps/api/.env.example apps/api/.env
```

Éditer `apps/api/.env` et remplir :
- `APP_KEY` — `openssl rand -hex 32`
- `JWT_SECRET` — `openssl rand -hex 32`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — depuis https://discord.com/developers/applications
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — `npx web-push generate-vapid-keys`

### 3. Démarrer l'environnement complet (Docker)

```bash
pnpm dev
```

Cela démarre :
- PostgreSQL 16 sur `localhost:5432`
- Redis 7 sur `localhost:6379`
- API AdonisJS sur `http://localhost:3333`
- Frontend Nuxt sur `http://localhost:3000`
- Panel Admin Vue sur `http://localhost:3001`

### 4. Alternative — Démarrer les apps individuellement (sans Docker)

Démarrer d'abord PostgreSQL et Redis (via Docker ou nativement), puis :

```bash
# Dans des terminaux séparés
pnpm dev:api     # AdonisJS — http://localhost:3333
pnpm dev:web     # Nuxt 3   — http://localhost:3000
pnpm dev:admin   # Admin    — http://localhost:3001
```

## URLs

| Service | URL |
|---------|-----|
| Jeu (frontend) | http://localhost:3000 |
| Panel Admin | http://localhost:3001 |
| API | http://localhost:3333 |
| Health check | http://localhost:3333/health |

## Commandes utiles

```bash
# Migrations base de données
pnpm db:migrate

# Seed initial
pnpm db:seed

# Vérification TypeScript
pnpm typecheck
```

## Structure du projet

```
pokegrind/
├── apps/
│   ├── api/        # AdonisJS 6 backend (TypeScript)
│   ├── web/        # Nuxt 3 frontend jeu
│   └── admin/      # Vue 3 + Vuestic Admin panel
├── packages/
│   └── shared/     # Types TypeScript partagés
├── docker/         # Docker Compose + nginx
├── docs/           # GDD et documentation
└── scripts/        # Scripts utilitaires (import PokéAPI...)
```

## Roadmap

Voir [CLAUDE.md](./CLAUDE.md) section 9.

| Sprint | Statut | Contenu |
|--------|--------|---------|
| S0 | ✅ | Scaffold technique |
| S1 | — | Import PokéAPI |
| S2 | — | Authentification |
| S3 | — | Combat idle |
| S4 | — | Pension |
| S5 | — | Offline + Push |
| S6 | — | Boutique gems |
| S7 | — | Panel admin + déploiement |
