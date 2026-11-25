#!/usr/bin/env bash
# Logical backup of the PostgreSQL database (orders, products, settings, audit logs…).
#   DATABASE_URL=postgresql://... ./scripts/backup.sh
# Schedule it (cron / a private CI job) and copy the file to ENCRYPTED, access-controlled storage.
# Backups contain customer data (names, phones, addresses): never commit or publish them.
# On Supabase also enable the built-in daily backups / PITR (Project Settings → Database → Backups).
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
FILE="$OUT_DIR/koshary-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$FILE"
chmod 600 "$FILE"
echo "Backup written: $FILE"

# keep the newest 14 local backups
ls -1t "$OUT_DIR"/koshary-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
