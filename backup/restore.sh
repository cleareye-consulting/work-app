#!/bin/sh
set -e

if [ -z "$1" ]; then
    echo "Usage: restore.sh <filename>"
    exit 1
fi

FILE="$1"
S3_URI="s3://cleareye-workapp-db-backup/backups/${FILE}"
MAINTENANCE_URL="${DATABASE_URL%workapp}postgres"

echo "[$(date -u)] Dropping and recreating database..."
psql "$MAINTENANCE_URL" -c "DROP DATABASE IF EXISTS workapp;"
psql "$MAINTENANCE_URL" -c "CREATE DATABASE workapp OWNER workapp;"

echo "[$(date -u)] Restoring: ${FILE}"
aws s3 cp "${S3_URI}" - \
    --profile cleareye-workapp-account \
    --region us-east-1 \
    --no-progress \
    | gunzip | psql "$DATABASE_URL"

echo "[$(date -u)] Restore complete."
