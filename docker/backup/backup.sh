#!/bin/sh
# backup.sh — Sauvegarde PostgreSQL + Redis vers /backups
# Tournant toutes les heures via cron dans le container backup

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
KEEP_DAYS="${KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

echo "[backup] $TIMESTAMP — Démarrage sauvegarde"

# ── PostgreSQL ──────────────────────────────────────────────────────────────
PG_FILE="$BACKUP_DIR/pg_${TIMESTAMP}.sql.gz"
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "$POSTGRES_HOST" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  | gzip > "$PG_FILE"
echo "[backup] PostgreSQL → $PG_FILE ($(du -sh "$PG_FILE" | cut -f1))"

# ── Redis (BGSAVE + copy RDB) ────────────────────────────────────────────────
redis-cli -h "$REDIS_HOST" BGSAVE > /dev/null
sleep 2
REDIS_FILE="$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
cp /redis-data/dump.rdb "$REDIS_FILE" 2>/dev/null || echo "[backup] Redis RDB introuvable, ignoré"

# ── Rotation : supprimer les backups > KEEP_DAYS jours ───────────────────────
find "$BACKUP_DIR" -name "pg_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "redis_*.rdb" -mtime +"$KEEP_DAYS" -delete

echo "[backup] $TIMESTAMP — Terminé. $(ls "$BACKUP_DIR" | wc -l) fichiers conservés."
