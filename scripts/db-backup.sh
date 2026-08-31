#!/bin/bash
# Hapanamy.lk Production Database Daily Backup Script
# Creates a compressed PostgreSQL dump and prunes files older than 30 days

# Load variables
DB_NAME=${DB_NAME:-hapanamy_mlm}
DB_USER=${DB_USER:-hapanamy_admin}
BACKUP_DIR="/var/backups/hapanamy"
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${DATE}.sql.gz"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

echo "Starting database backup for ${DB_NAME} at $(date)..."

# Run pg_dump inside docker container and compress
docker-compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "🎉 Database backup successfully created: ${BACKUP_FILE}"
else
    echo "❌ ERROR: Database backup failed!" >&2
    exit 1
fi

# Prune old backups (> 30 days)
echo "Pruning database backups older than 30 days..."
find "$BACKUP_DIR" -type f -name "${DB_NAME}_backup_*.sql.gz" -mtime +30 -delete

echo "Database backup routine completed successfully at $(date)."
