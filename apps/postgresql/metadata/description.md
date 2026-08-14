# PostgreSQL 18

Standalone [PostgreSQL](https://www.postgresql.org/) 18 database server using the [official Docker image](https://hub.docker.com/_/postgres).

## Defaults

| Setting | Value |
| --- | --- |
| Image | `postgres:18.6` |
| Host port | `5433` (avoid clashing with Runtipi’s own Postgres) |
| Container port | `5432` |
| Data volume | `${APP_DATA_DIR}/data` → `/var/lib/postgresql` (Postgres 18+ layout) |

Install form fields map to `DB_PASSWORD` / `DB_USER` / `DB_NAME` (not `POSTGRES_*`) so they are not overridden by Runtipi’s internal database environment during Compose interpolation.

Enable **Open port** at install if LAN clients should connect to `HOST:5433`.

Timezone follows Runtipi `TZ` (`PGTZ`).

**Password tip:** Prefer passwords without `$` or `#` — those characters break unquoted env-file / Compose interpolation.

## Connect

From another container on the Runtipi network:

```text
postgresql://USER:PASSWORD@postgresql-<appstore-slug>:5432/DATABASE
```

(Service DNS name may vary slightly by store slug; check `docker network inspect` if unsure.)

From the host / LAN (with open port):

```bash
psql "postgresql://USER:PASSWORD@HOST:5433/DATABASE"
```

## Custom `postgresql.conf` / `pg_hba.conf` / SSL

Baseline image defaults are used on purpose. Host-specific tuning and TLS belong in **user-config**, not the store package.

### User-config overlay

Example (`user-config/<appstore-slug>/postgresql/docker-compose.yml`):

```yaml
services:
  postgresql:
    volumes:
      - ${APP_DATA_DIR}/data:/var/lib/postgresql
      - /media/runtipi/user-config/<appstore-slug>/postgresql/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - /media/runtipi/user-config/<appstore-slug>/postgresql/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
      - /media/runtipi/user-config/<appstore-slug>/postgresql/ssl:/etc/postgresql/ssl:ro
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - hba_file=/etc/postgresql/pg_hba.conf
```

Replace `<appstore-slug>` with your store name (e.g. `gurmen`). Place conf files and `ssl/server.crt` + `ssl/server.key` next to that compose file, enable user-config for the app, then restart.

Tip: start from the image sample:

```bash
docker run --rm postgres:18.6 cat /usr/share/postgresql/postgresql.conf.sample > postgresql.conf
```

### Enable SSL

Postgres does not create certs. Generate a self-signed pair whose **SAN** lists every hostname/IP clients will type as the host (not client subnets — those go in `pg_hba.conf`).

Example for `db.example.com` and LAN server `192.168.1.10` (clients on `192.168.1.0/24`):

```bash
openssl req -new -x509 -days 3650 -nodes \
  -subj "/CN=db.example.com" \
  -addext "subjectAltName=DNS:db.example.com,IP:192.168.1.10" \
  -keyout server.key -out server.crt
chmod 600 server.key && chown 999:999 server.crt server.key
```

Put `server.crt` / `server.key` under `user-config/<appstore-slug>/postgresql/ssl/`.

In `postgresql.conf`, set these three lines (paths must match the volume mount):

```
ssl = on
ssl_cert_file = '/etc/postgresql/ssl/server.crt'
ssl_key_file = '/etc/postgresql/ssl/server.key'
```

In `pg_hba.conf`, allow the client network over SSL:

```
hostssl all all 192.168.1.0/24 scram-sha-256
```

Clients / pgAdmin: **SSL mode** `verify-full`, **Root certificate** = `server.crt` (need to be copied to a place where client can find it), **Host** = `db.example.com` or `192.168.1.10` (must match a SAN entry).

Connect with:
```
# by name (DNS)
psql "host=db.example.com port=5433 dbname=postgres user=postgres sslmode=verify-full sslrootcert=/path/to/server.crt"

# by LAN IP
psql "host=192.168.1.10 port=5433 dbname=postgres user=postgres sslmode=verify-full sslrootcert=/path/to/server.crt"
```

## Notes

- Do not mount the legacy `/var/lib/postgresql/data` path — Postgres 18 expects `/var/lib/postgresql`.
- `POSTGRES_*` / form `DB_*` values apply on **first init** only; changing them later does not alter an existing data dir.
- `shm_size` is set to `256mb` for better sort/hash performance.

## Links

- [PostgreSQL docs](https://www.postgresql.org/docs/18/)
- [Official image](https://hub.docker.com/_/postgres)
- [Runtipi user-config](https://runtipi.io/docs/guides/customize-app-config)
