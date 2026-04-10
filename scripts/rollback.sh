#!/usr/bin/env bash
# rollback.sh — Rollback vers le commit précédent
# Usage : ./scripts/rollback.sh [commit_sha]
# Sans argument : rollback vers HEAD~1

set -euo pipefail

TARGET="${1:-HEAD~1}"
COMPOSE="docker compose -f docker/docker-compose.prod.yml"

echo "=== PokeGrind Rollback → $TARGET ==="

# Confirmation
read -r -p "Rollback vers '$TARGET' ? Cette opération redéploie l'ancienne version. [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 0; }

# 1. Sauvegarde d'urgence
echo "→ Sauvegarde d'urgence..."
$COMPOSE exec -T backup /usr/local/bin/backup.sh || true

# 2. Retour git
echo "→ git checkout $TARGET..."
git checkout "$TARGET"

# 3. Rebuild + restart
echo "→ Rebuild..."
$COMPOSE build --no-cache api web admin

echo "→ Redémarrage..."
$COMPOSE up -d --no-deps api web admin

echo "=== Rollback terminé. Vérifiez les logs : docker compose logs -f api ==="
