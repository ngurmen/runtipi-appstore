# PostgreSQL 18

Standalone [PostgreSQL](https://www.postgresql.org/) 18 database server using the [official Docker image](https://hub.docker.com/_/postgres).

## Defaults

| Setting | Value |
| --- | --- |
| Image | `postgres:18.6` |
| Host port | `5433` (avoid clashing with Runtipi’s own Postgres) |
| Container port | `5432` |
| Data volume | `${APP_DATA_DIR}/data` → `/var/lib/postgresql` (Postgres 18+ layout) |

Enable **Open port** at install if LAN clients should connect to `HOST:5433`.

Timezone follows Runtipi `TZ` (`PGTZ`).

## Connect

From another container on the Runtipi network:

```text
postgresql://USER:PASSWORD@postgresql-gurmen:5432/DATABASE
```

(Service DNS name may vary slightly by store slug; check `docker network inspect` if unsure.)

From the host / LAN (with open port):

```bash
psql "postgresql://USER:PASSWORD@HOST:5433/DATABASE"
```

## Custom `postgresql.conf` / `pg_hba.conf`

Baseline image defaults are used on purpose. Host-specific tuning belongs in **user-config**, not the store package.

Example overlay (`user-config/gurmen/postgresql/docker-compose.yml`):

```yaml
services:
  postgresql:
    volumes:
      - ${APP_DATA_DIR}/data:/var/lib/postgresql
      - /media/runtipi/user-config/gurmen/postgresql/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - /media/runtipi/user-config/gurmen/postgresql/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
    command:
      - postgres
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - hba_file=/etc/postgresql/pg_hba.conf
```

Place your conf files next to that compose file, enable user-config for the app, then restart.

Tip: start from the image sample:

```bash
docker run --rm postgres:18.6 cat /usr/share/postgresql/postgresql.conf.sample > postgresql.conf
```

## Notes

- Do not mount the legacy `/var/lib/postgresql/data` path — Postgres 18 expects `/var/lib/postgresql`.
- `POSTGRES_*` values apply on **first init** only; changing them later does not alter an existing data dir.
- `shm_size` is set to `256mb` for better sort/hash performance.

## Links

- [PostgreSQL docs](https://www.postgresql.org/docs/18/)
- [Official image](https://hub.docker.com/_/postgres)
- [Runtipi user-config](https://runtipi.io/docs/guides/customize-app-config)
