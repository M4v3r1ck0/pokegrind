#!/usr/bin/env bash
# deploy.sh — Déploiement PokeGrind en production
# Usage : ./scripts/deploy.sh [branch]
# Prérequis : docker, docker compose, git, .env.prod dans apps/api/

set -euo pipefail

BRANCH="${1:-main}"
COMPOSE="docker compose -f docker/docker-compose.prod.yml --env-file apps/api/.env.prod"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== PokeGrind Deploy — branche: $BRANCH — $TIMESTAMP ==="

# 1. Pull du dernier code
echo "→ Pull $BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 2. Sauvegarde avant déploiement
echo "→ Sauvegarde pré-déploiement..."
$COMPOSE exec -T backup /usr/local/bin/backup.sh || echo "  Avertissement: sauvegarde ignorée (service non actif)"

# 3. Build des images
echo "→ Build des images..."
$COMPOSE build --no-cache api web admin

# 4. Migrations base de données
echo "→ Application des migrations..."
$COMPOSE run --rm api node bin/console.js migration:run --force

# 5. Rolling restart : zero-downtime si possible
echo "→ Redémarrage des services..."
$COMPOSE up -d --no-deps api
$COMPOSE up -d --no-deps web
$COMPOSE up -d --no-deps admin

# 6. Healthcheck
echo "→ Vérification de l'état des services..."
sleep 5
$COMPOSE ps

echo "=== Déploiement terminé : $TIMESTAMP ==="
echo "    Rollback : ./scripts/rollback.sh"
