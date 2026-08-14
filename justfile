default:
    @just --list

start: _ensure-docker
    docker compose up --build -d

[private]
_ensure-docker:
    #!/usr/bin/env bash
    set -euo pipefail

    docker_is_ready() {
        timeout 5 docker info >/dev/null 2>&1
    }

    if docker_is_ready; then
        exit 0
    fi

    if [[ "$(uname -s)" != "Darwin" ]]; then
        echo "Docker is not running; start it and try again." >&2
        exit 1
    fi

    echo "Starting Docker Desktop..."
    if ! open -gj -a Docker; then
        echo "Could not launch Docker Desktop." >&2
        exit 1
    fi

    deadline=$((SECONDS + 120))

    while (( SECONDS < deadline )); do
        if docker_is_ready; then
            echo "Docker is ready."
            exit 0
        fi
        sleep 2
    done

    echo "Docker did not become ready within 2 minutes." >&2
    exit 1

stop:
    docker compose down

logs:
    docker compose logs -f

bucket-setup:
    #!/usr/bin/env sh
    set -e
    BUCKET=cleareye-workapp-db-backup
    PROFILE=cleareye-workapp-account
    REGION=us-east-1
    if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" 2>/dev/null; then
        echo "Bucket already exists, skipping creation."
    else
        aws s3api create-bucket --bucket "$BUCKET" --profile "$PROFILE" --region "$REGION"
        echo "Bucket created."
    fi
    aws s3api put-public-access-block --bucket "$BUCKET" --profile "$PROFILE" \
        --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --profile "$PROFILE" \
        --lifecycle-configuration '{"Rules":[{"ID":"expire-old-backups","Status":"Enabled","Filter":{"Prefix":"backups/"},"Expiration":{"Days":30}}]}'
    echo "Bucket configured."

db-backup: bucket-setup
    docker compose exec backup /backup.sh

db-list:
    docker compose exec backup aws s3 ls s3://cleareye-workapp-db-backup/backups/ \
        --profile cleareye-workapp-account --region us-east-1

db-restore file:
    docker compose exec -T backup /restore.sh {{file}}
