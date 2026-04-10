FROM alpine:3.19

RUN apk add --no-cache postgresql16-client redis dcron

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Cron toutes les heures
RUN echo "0 * * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
    | crontab -

VOLUME ["/backups"]

CMD ["crond", "-f", "-l", "2"]
