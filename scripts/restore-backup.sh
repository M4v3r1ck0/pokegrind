#!/usr/bin/env bash
# restore-backup.sh — Restauration d'une sauvegarde PostgreSQL
# Usage : ./scripts/restore-backup.sh /opt/pokegrind/backups/pg_20240101_120000.sql.gz

set -euo pipefail

BACKUP_FILE="${1:-}"
COMPOSE="docker compose -f docker/docker-compose.prod.yml"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage : $0 <chemin_vers_backup.sql.gz>"
  echo ""
  echo "Sauvegardes disponibles :"
  ls -lh /opt/pokegrind/backups/pg_*.sql.gz 2>/dev/null || echo "  Aucune sauvegarde trouvée dans /opt/pokegrind/backups/"
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Erreur : fichier introuvable : $BACKUP_FILE"
  exit 1
fi

echo "=== Restauration depuis : $BACKUP_FILE ==="
echo "ATTENTION : Cette opération remplace toutes les données actuelles."
read -r -p "Confirmer ? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 0; }

# Arrêter l'API pour éviter les écritures concurrentes
echo "→ Arrêt de l'API..."
$COMPOSE stop api web admin

# Restaurer la base
echo "→ Restauration PostgreSQL..."
POSTGRES_USER="${POSTGRES_USER:-pokegrind}"
POSTGRES_DB="${POSTGRES_DB:-pokegrind}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

# Drop + recreate
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
$COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -c "CREATE DATABASE ${POSTGRES_DB};"

# Restore
gunzip -c "$BACKUP_FILE" | $COMPOSE exec -T postgres psql \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "→ Redémarrage des services..."
$COMPOSE up -d api web admin

echo "=== Restauration terminée. ==="
