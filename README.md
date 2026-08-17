# Gurmen Homelab App Store

Custom [Runtipi](https://runtipi.io) app store for the Gurmen homelab. Based on the [Runtipi example app store](https://github.com/runtipi/example-appstore) template.

Requires Runtipi **v4.0.0** or above. Apps using the current dynamic compose format need **v4.5.0+**.

## Apps

| App | Description |
| --- | --- |
| [Apprise](apps/apprise/) | Push notifications to 100+ services via a simple API (nginx API-key gate) |
| [HashiCorp Vault](apps/vault/) | Identity-based secrets and encryption management |
| [Immich Kiosk](apps/immich-kiosk/) | Configurable Immich photo/video slideshows for browsers and devices |
| [Pocket ID](apps/pocket-id/) | Passkey-only OpenID Connect / OAuth 2.0 provider (SQLite) |
| [PostgreSQL](apps/postgresql/) | Standalone PostgreSQL 18 database server |
| [Whoami](apps/whoami/) | Sample Traefik whoami app from the template |

## Repository structure

Each app lives under `apps/<app-id>/`:

- `config.json` — metadata, port, and install form fields
- `docker-compose.yml` — services with `x-runtipi` metadata (`schema_version: 2`)
- `metadata/description.md` — dashboard description
- `metadata/logo.jpg` — square app icon

Runtipi Compose container names are `{app-id}_<app-store>-{service}-1` (e.g. `vault_<app-store>-vault-1`, `postgresql_<app-store>-postgresql-1`). `{app}-{store}` is not a DNS name. Confirm with `docker ps`.

## Adding this store to Runtipi

1. Open **Settings → App Stores → Add App Store**
2. Paste the repository URL: `https://github.com/ngurmen/runtipi-appstore`
3. Give it a name (e.g. `Gurmen`)
4. After pulls/merges, use **Update App Stores** to refresh

See the [Create your own app store](https://runtipi.io/docs/guides/create-your-own-app-store) guide for details.

## Developing apps

```bash
bun install
bun test
```

Prefer `docker-compose.yml` with `x-runtipi` over legacy `docker-compose.json`. References:

- [config.json options](https://runtipi.io/docs/reference/config-json)
- [Dynamic compose](https://runtipi.io/docs/reference/dynamic-compose)

## Form field / password tips

- **`exposable`** in `config.json` controls Reverse proxy / Domain name / local domain toggles. Set `"exposable": true` only for HTTP apps meant for Traefik. Databases should use **Open port** instead (`exposable: false` is intentional for PostgreSQL).
- Avoid **`$`** and **`#`** in passwords (and other secrets written to `app.env`). Runtipi writes unquoted env values and Docker Compose interpolates `$…`, so those characters can truncate or alter the secret before the container sees it.
