FROM postgres:17-alpine

RUN apk add --no-cache aws-cli

COPY backup.sh restore.sh /
COPY crontab /etc/crontabs/root

RUN chmod +x /backup.sh /restore.sh

CMD ["crond", "-f", "-l", "2"]
