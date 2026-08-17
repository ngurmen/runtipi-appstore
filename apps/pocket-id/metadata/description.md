# Pocket ID

Lightweight [OpenID Connect Certified™](https://openid.net/certification/) and OAuth 2.0 provider using the [official Docker image](https://hub.docker.com/r/pocketid/pocket-id). Users sign in with passkeys only — no passwords, and no extra database container. SQLite lives in `data/` on the host.

This is an **identity provider**, not a reverse-proxy login gate like Authelia. Each app you want to protect must support OIDC and be registered as a client here.

## Defaults

| Setting | Value |
| --- | --- |
| Image | `pocketid/pocket-id:v2.13.0` |
| Host port | `1411` |
| Container port | `1411` |
| Database | SQLite (`pocket-id.db` + WAL) |
| Process user | Runtipi `${UID}:${GID}` via `PUID` / `PGID` |

App files live under `<runtipi-root>/app-data/<app-store>/pocket-id/` (`<runtipi-root>` is the Runtipi install directory; `<app-store>` is the store slug from Settings):

| Host path | Container | Purpose |
| --- | --- | --- |
| `app.env` | (not mounted) | Install form values, including the encryption key |
| `data/` | `/app/data` | Persistent volume |
| `data/pocket-id.db` (+ `-wal` / `-shm`) | `/app/data/pocket-id.db` | SQLite database |
| `data/uploads/` | `/app/data/uploads` | Uploaded files |

Timezone follows Runtipi `TZ`.

## Install

1. Enable **Reverse proxy** and set the domain you will use (for example `id.example.com`). Passkeys need HTTPS; `http://IP:1411` will not work except on exact `localhost`.
2. Set **Application URL** to that same URL, including `https://`. This value is the OIDC issuer, cookie domain, and WebAuthn relying party — changing it later breaks existing passkeys.
3. Leave **Trust Proxy** on so Traefik forwarded headers are honoured.
4. **Encryption Key** is generated for you. Back up `app.env` together with `data/` (the `.db`, `-wal`, `-shm`, and `uploads/` files).

## First start

Open `https://<your-domain>/setup` and register the first admin passkey.

Then in the admin UI, create an OIDC client per app (client ID, secret, callback URL). Point those apps at this issuer:

```text
https://<your-domain>
```

Discovery is at `https://<your-domain>/.well-known/openid-configuration`.

## Connect

| From | URL |
| --- | --- |
| Browser (exposed domain) | `https://<your-domain>` |
| Other containers on the Runtipi network | `http://pocket-id_<app-store>-pocket-id-1:1411` |

OIDC clients should still use the **public Application URL** as the issuer, not the Docker hostname. Browsers must reach the same host that issued the passkey. If other containers cannot hairpin to the public URL, set `INTERNAL_APP_URL` via [user-config](https://runtipi.io/docs/guides/customize-app-config) at `<runtipi-root>/user-config/<app-store>/pocket-id/`.

Container name is `{app-id}_<app-store>-{service}-1`. Confirm with `docker ps`.

## Notes

- Passkey-only: there is no password login. Keep a backup passkey (YubiKey or a second device) and know [account recovery](https://pocket-id.org/docs/troubleshooting/account-recovery).
- Do not change **Application URL** or **Encryption Key** after setup unless you follow upstream rotation docs.
- SQLite is enough for homelab. Postgres belongs in user-config if you outgrow it; do not put the SQLite file on NFS/SMB.
- Avoid `$` and `#` if you ever replace the encryption key by hand (Compose/env-file interpolation).

## Links

- [Documentation](https://pocket-id.org/docs/setup/installation)
- [Environment variables](https://pocket-id.org/docs/configuration/environment-variables)
- [GitHub](https://github.com/pocket-id/pocket-id)
- [Demo](https://demo.pocket-id.org)
