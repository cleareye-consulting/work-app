FROM postgres:17-alpine

RUN apk add --no-cache aws-cli

COPY backup.sh /backup.sh
COPY crontab /etc/crontabs/root

RUN chmod +x /backup.sh

CMD ["crond", "-f", "-l", "2"]
