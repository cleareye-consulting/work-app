FROM alpine:3.20

RUN apk add --no-cache postgresql-client aws-cli

COPY backup.sh /backup.sh
COPY crontab /etc/crontabs/root

RUN chmod +x /backup.sh

CMD ["crond", "-f", "-l", "2"]
