# HashiCorp Vault

Identity-based secrets and encryption management using the [official Docker image](https://hub.docker.com/r/hashicorp/vault). Single-node [Raft integrated storage](https://developer.hashicorp.com/vault/docs/configuration/storage/raft) with the web UI enabled.

This is **not** a dev server. Vault starts sealed. You must initialize it once, store the unseal keys and root token offline, and unseal after every restart.

## Defaults

| Setting | Value |
| --- | --- |
| Image | `hashicorp/vault:2.0.4` |
| Host port | `8200` |
| Container port | `8200` |
| Storage | Raft at `/vault/data` |
| UI | Enabled at `/ui` |
| TLS (in-container) | Disabled — Traefik terminates TLS when exposed |

| Host path (under app data) | Container | Purpose |
| --- | --- | --- |
| `data` | `/vault/data` | Raft storage |
| `logs` | `/vault/logs` | Audit logs (after you enable a file audit device) |
| `config` | `/vault/config` | Generated `local.json` plus any extra `.hcl` / `.json` you add |

Timezone follows Runtipi `TZ`.

## First start — initialize and unseal

1. Install and start the app. The UI will load but Vault is uninitialized / sealed.
2. From the host, initialize (default Shamir: 5 shares, threshold 3):

```bash
docker exec -it vault-<appstore-slug> vault operator init
```

Replace `<appstore-slug>` with your store name (e.g. `gurmen`). Check `docker ps` if unsure.

3. Save the **unseal keys** and **initial root token** somewhere that is not this server (password manager, printed paper, offline disk). Vault cannot recover them.
4. Unseal with any 3 of the 5 keys:

```bash
docker exec -it vault-<appstore-slug> vault operator unseal
```

Repeat until `Sealed` is `false`. Then log into the UI with the root token.

After every container restart you must unseal again unless you add auto-unseal via user-config.

## Connect

UI / API via Runtipi (Open port or local domain):

```text
http://HOST:8200/ui
```

From another container on the Runtipi network:

```text
http://vault-<appstore-slug>:8200
```

CLI inside the container already has `VAULT_ADDR=http://127.0.0.1:8200`.

## Security notes

- Prefer **local domain / VPN** over exposing Vault to the public internet. If you do expose it, use Traefik HTTPS and lock down who can reach `/ui` and the API.
- Do not commit unseal keys or the root token to git, user-config, or `app.env`.
- Create a limited admin policy and revoke the root token after initial setup: [Root tokens](https://developer.hashicorp.com/vault/docs/concepts/tokens#root-tokens).
- In-container TLS is off because Runtipi/Traefik handles HTTPS at the edge. Native Vault TLS belongs in **user-config**.

## Raft snapshots

```bash
docker exec -it vault-<appstore-slug> vault operator raft snapshot save /vault/data/backup.snap
```

Copy `backup.snap` off the host. Restore with `vault operator raft snapshot restore`.

## User-config overlays

Host-specific TLS, auto-unseal, extra listeners, or audit devices belong in [user-config](https://runtipi.io/docs/guides/customize-app-config), not this store package.

Example (`user-config/<appstore-slug>/vault/docker-compose.yml`) to mount extra HCL next to the generated config:

```yaml
services:
  vault:
    volumes:
      - ${APP_DATA_DIR}/data:/vault/data
      - ${APP_DATA_DIR}/logs:/vault/logs
      - ${APP_DATA_DIR}/config:/vault/config
      - /media/runtipi/user-config/<appstore-slug>/vault/extra.hcl:/vault/config/extra.hcl:ro
```

Vault loads every `.hcl` / `.json` in `/vault/config`. Do not replace `local.json` — it is rewritten from `VAULT_LOCAL_CONFIG` on each start.

## Links

- [Vault documentation](https://developer.hashicorp.com/vault/docs)
- [Run Vault on Docker](https://developer.hashicorp.com/vault/docs/deploy/run-on-docker)
- [Official image](https://hub.docker.com/r/hashicorp/vault)
- [Runtipi user-config](https://runtipi.io/docs/guides/customize-app-config)
