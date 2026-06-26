default:
    @just --list

start:
    docker compose up --build -d

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
    docker compose exec -T backup sh -c \
        "aws s3 cp s3://cleareye-workapp-db-backup/backups/{{file}} - \
            --profile cleareye-workapp-account --region us-east-1 --no-progress \
            | gunzip | psql \$DATABASE_URL"
