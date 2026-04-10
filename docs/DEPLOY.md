# Guide de déploiement PokeGrind

## Prérequis

- Proxmox VE avec un CT (LXC) ou VM sous Debian 12 / Ubuntu 22.04
- Docker 24+ et Docker Compose v2 installés
- Domaines `pokegrind.fr` et `admin.pokegrind.fr` pointant vers l'IP du serveur
- Certificats TLS (Let's Encrypt ou autre) dans `docker/nginx/certs/`

---

## 1. Première installation

### 1.1 Cloner le dépôt

```bash
git clone https://github.com/yourorg/pokegrind.git /opt/pokegrind
cd /opt/pokegrind
```

### 1.2 Configurer les variables d'environnement

```bash
cp apps/api/.env.prod.example apps/api/.env.prod
```

Éditer `apps/api/.env.prod` :
- Générer `APP_KEY` et `JWT_SECRET` : `openssl rand -hex 32`
- Renseigner `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, identifiants Discord OAuth, clés VAPID

Créer également `docker/.env.prod` pour les variables du compose :

```bash
cat > docker/.env.prod << 'EOF'
POSTGRES_USER=pokegrind
POSTGRES_DB=pokegrind
POSTGRES_PASSWORD=CHANGE_ME
REDIS_PASSWORD=CHANGE_ME
EOF
```

### 1.3 Certificats TLS

Placer les certificats dans `docker/nginx/certs/` :
```
docker/nginx/certs/
├── pokegrind.fr.crt
├── pokegrind.fr.key
├── admin.pokegrind.fr.crt
└── admin.pokegrind.fr.key
```

Activer HTTPS dans `docker/nginx/nginx.conf` (décommenter les blocs SSL).

### 1.4 Démarrer les services

```bash
cd /opt/pokegrind
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d --build
```

### 1.5 Migrations initiales

```bash
docker compose -f docker/docker-compose.prod.yml exec api node ace migration:run --force
```

### 1.6 Seed des données de base (shop upgrades, espèces Pokémon)

```bash
# Import PokéAPI (une seule fois)
docker compose -f docker/docker-compose.prod.yml exec api node --import=tsx/esm scripts/import-pokeapi.ts

# Seed shop upgrades
docker compose -f docker/docker-compose.prod.yml exec api node ace db:seed
```

### 1.7 Créer le premier compte admin

```bash
docker compose -f docker/docker-compose.prod.yml exec api node ace tinker
```

```typescript
// Dans le REPL AdonisJS :
const { default: Player } = await import('#models/player')
const { default: hash } = await import('@adonisjs/core/services/hash')
await Player.create({
  username: 'admin',
  email: 'admin@pokegrind.fr',
  passwordHash: await hash.make('votre_mot_de_passe'),
  role: 'admin',
  gems: 0,
  gold: 0n,
})
```

---

## 2. Déploiements suivants

```bash
cd /opt/pokegrind
./scripts/deploy.sh main
```

Le script :
1. Pull la branche `main`
2. Crée une sauvegarde PostgreSQL
3. Rebuild les images modifiées
4. Applique les nouvelles migrations
5. Redémarre les services un par un

---

## 3. Rollback

```bash
# Rollback vers le commit précédent
./scripts/rollback.sh

# Rollback vers un commit spécifique
./scripts/rollback.sh abc1234
```

---

## 4. Restauration d'une sauvegarde

Les sauvegardes sont créées automatiquement toutes les heures par le service `backup` dans `/opt/pokegrind/backups/`.

```bash
# Lister les sauvegardes disponibles
ls -lh /opt/pokegrind/backups/

# Restaurer une sauvegarde
./scripts/restore-backup.sh /opt/pokegrind/backups/pg_20240101_120000.sql.gz
```

---

## 5. Surveillance

### Logs en temps réel

```bash
# Tous les services
docker compose -f docker/docker-compose.prod.yml logs -f

# API seulement
docker compose -f docker/docker-compose.prod.yml logs -f api
```

### État des services

```bash
docker compose -f docker/docker-compose.prod.yml ps
```

### Utilisation des ressources

```bash
docker stats
```

---

## 6. Panel admin

URL : `https://admin.pokegrind.fr`

Recommandation : restreindre l'accès par IP dans `docker/nginx/nginx.conf` (décommenter les lignes `allow`/`deny`).

---

## 7. Structure des volumes Docker

| Volume | Contenu | Localisation hôte |
|--------|---------|-------------------|
| `postgres_data` | Base de données | Docker managed |
| `redis_data` | Cache Redis | Docker managed |
| `/opt/pokegrind/backups` | Sauvegardes SQL | Hôte (persistant) |

---

## 8. Renouvellement des certificats Let's Encrypt

```bash
# Avec certbot standalone (arrêter nginx temporairement)
docker compose -f docker/docker-compose.prod.yml stop nginx
certbot renew
docker compose -f docker/docker-compose.prod.yml start nginx
```

Ou configurer un cron mensuel.

---

## 9. Variables d'environnement de référence

Voir `apps/api/.env.prod.example` pour la liste complète avec descriptions.
