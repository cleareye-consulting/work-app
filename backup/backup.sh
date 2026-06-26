#!/bin/sh
set -e

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
FILENAME="workapp_${TIMESTAMP}.sql.gz"
S3_URI="s3://cleareye-workapp-db-backup/backups/${FILENAME}"
TMPFILE=$(mktemp)

trap 'rm -f "$TMPFILE"' EXIT

echo "[$(date -u)] Starting backup: ${FILENAME}"

pg_dump "${DATABASE_URL}" > "$TMPFILE"
gzip -c "$TMPFILE" | aws s3 cp - "${S3_URI}" \
    --profile cleareye-workapp-account \
    --region us-east-1 \
    --no-progress

echo "[$(date -u)] Backup complete: ${S3_URI}"
