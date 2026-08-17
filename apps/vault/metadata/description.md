# HashiCorp Vault

Identity-based secrets and encryption management using the [official Docker image](https://hub.docker.com/r/hashicorp/vault) (Community 2.0.4). Single-node [Raft integrated storage](https://developer.hashicorp.com/vault/docs/configuration/storage/raft) with the [web UI](https://developer.hashicorp.com/vault/docs/ui) enabled.

This is **not** a dev server. Vault starts uninitialized and sealed. The first visit to `/ui` walks you through init (key shares + threshold), download of the root token and shares, then unseal. After every restart you unseal again in the same UI unless you configure [auto-unseal](#auto-unseal).

## Defaults

| Setting | Value |
| --- | --- |
| Image | `hashicorp/vault:2.0.4` |
| Host port | `8200` |
| Container port | `8200` |
| Storage | Raft at `/vault/data` |
| UI | Enabled at `/ui` |
| TLS (in-container) | Disabled — Traefik terminates TLS when exposed |
| Process user | Runtipi `${UID}:${GID}` (bind mounts; no `chown`) |

| Host path (under app data) | Container | Purpose |
| --- | --- | --- |
| `data` | `/vault/data` | Raft storage |
| `logs` | `/vault/logs` | Audit logs (after you enable a file audit device) |
| `config` | `/vault/config` | Generated `local.json` plus any extra `.hcl` / `.json` you add |

Timezone follows Runtipi `TZ`.

## First start — initialize and unseal

Do this in the **UI**. Open the app (Runtipi Open, or `http://HOST:8200/ui`). Vault 2.x serves the GUI on the same listener as the API; `/` redirects to `/ui`.

1. **Initialize.** The first screen asks for Shamir **key shares** (how many pieces to split the unseal key into) and **key threshold** (how many pieces are required to unseal). Defaults are 5 shares / 3 threshold; a homelab can use `1` / `1` if a single operator holds the only key. Optional: encrypt shares and/or the root token with PGP before they are shown.
2. Click **Initialize**. The next screen shows the **unseal key shares** and the **initial root token**. Copy them and use **Download keys** before you leave the page. Vault does not store these values; they cannot be recovered.
3. **Unseal.** Continue in the UI and paste distinct shares until the progress reaches the threshold (for example 3 of 5). Order does not matter.
4. **Sign in** with the initial root token.

Keep the downloaded keys and root token off this server (password manager, printed paper, offline disk).

After every container restart, `/ui` shows the unseal screen again. Enter the threshold of shares, then sign in. Skip this only if you set up [auto-unseal](#auto-unseal).

### CLI alternative

Same operations, if you prefer the container CLI (`VAULT_ADDR` is already `http://127.0.0.1:8200` inside the container). Runtipi names containers `{app-id}_<app-store>-{service}-1`:

```bash
docker exec -it vault_<app-store>-vault-1 vault operator init
docker exec -it vault_<app-store>-vault-1 vault operator unseal   # repeat to threshold
```

Confirm with `docker ps`.

## Connect

| From | URL |
| --- | --- |
| Browser (Open port / local domain) | `http://HOST:8200/ui` |
| Other containers on the Runtipi network | `http://vault_<app-store>-vault-1:8200` |

## Security notes

- Prefer **local domain / VPN** over exposing Vault to the public internet. If you do expose it, use Traefik HTTPS and lock down who can reach `/ui` and the API.
- Do not commit unseal keys or the root token to git, user-config, or `app.env`.
- Create a limited admin policy and revoke the root token after initial setup: [Root tokens](https://developer.hashicorp.com/vault/docs/concepts/tokens#root-tokens).
- In-container TLS is off because Runtipi/Traefik handles HTTPS at the edge. Native Vault TLS belongs in **user-config**.

## Raft snapshots

```bash
docker exec -it vault_<app-store>-vault-1 vault operator raft snapshot save /vault/data/backup.snap
```

Copy `backup.snap` off the host. Restore with `vault operator raft snapshot restore`.

## Auto-unseal

This package uses Shamir unseal on purpose. Auto-unseal needs an external KMS, HSM, or a **second** Vault, so it belongs in [user-config](https://runtipi.io/docs/guides/customize-app-config).

HashiCorp auto-unseal options: [AWS KMS](https://developer.hashicorp.com/vault/docs/configuration/seal/awskms), [GCP Cloud KMS](https://developer.hashicorp.com/vault/docs/configuration/seal/gcpckms), [Azure Key Vault](https://developer.hashicorp.com/vault/docs/configuration/seal/azurekeyvault), [Transit](https://developer.hashicorp.com/vault/docs/configuration/seal/transit) (another Vault), [PKCS#11](https://developer.hashicorp.com/vault/docs/configuration/seal/pkcs11) (HSM).

A script that reads Shamir keys from a file on this host is **not** auto-unseal — the keys sit next to the data they protect.

If the KMS key (or transit Vault) is deleted or permanently unreachable, this Vault cannot be unsealed, **including from Raft snapshots**. Keep recovery keys offline.

### New install

Add the `seal` stanza **before** the first init (UI or CLI). Init then returns **recovery keys** (not unseal keys). Store those the same way you would Shamir shares — they are still required for generate-root and similar operations. Later restarts unseal without the UI prompt.

### Existing Shamir install (migrate)

Downtime is required. Take a [Raft snapshot](#raft-snapshots) first.

1. Add the `seal` stanza via user-config and restart the app. Vault stays sealed.
2. Migrate with the old Shamir keys (threshold times, default 3):

```bash
docker exec -it vault_<app-store>-vault-1 vault operator unseal -migrate
```

3. After migration, later restarts auto-unseal. Keep the new **recovery keys** offline.

See [seal migration](https://developer.hashicorp.com/vault/docs/concepts/seal#seal-migration).

### User-config overlay

Mount extra HCL and pass KMS/transit credentials as environment variables (do not put secrets in `extra.hcl`). Example (`<runtipi-root>/user-config/<app-store>/vault/docker-compose.yml`):

```yaml
services:
  vault:
    volumes:
      - ${APP_DATA_DIR}/data:/vault/data
      - ${APP_DATA_DIR}/logs:/vault/logs
      - ${APP_DATA_DIR}/config:/vault/config
      - <runtipi-root>/user-config/<app-store>/vault/extra.hcl:/vault/config/extra.hcl:ro
    environment:
      - AWS_ACCESS_KEY_ID=AKIA...
      - AWS_SECRET_ACCESS_KEY=...
      # Transit only — do not set VAULT_TOKEN here; it would override the local CLI token.
      # - VAULT_TRANSIT_SEAL_TOKEN=hvs....
```

`extra.hcl` (AWS KMS):

```hcl
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "alias/vault-unseal"
}
```

`extra.hcl` (Transit — a **different** Vault; this app’s `VAULT_ADDR` is localhost, so set `address` here):

```hcl
seal "transit" {
  address         = "http://other-vault:8200"
  token           = "env://VAULT_TRANSIT_SEAL_TOKEN"
  key_name        = "autounseal"
  mount_path      = "transit/"
  tls_skip_verify = "true"
}
```

The transit token needs `update` on `transit/encrypt/<key>` and `transit/decrypt/<key>`. Use an orphan periodic token so expiry of a parent token does not reseal this Vault.

Enable user-config for the app, then restart.

Vault loads every `.hcl` / `.json` in `/vault/config`. Do not replace `local.json` — it is rewritten from `VAULT_LOCAL_CONFIG` on each start.

## Links

- [Vault 2.x documentation](https://developer.hashicorp.com/vault/docs)
- [Vault UI](https://developer.hashicorp.com/vault/docs/ui)
- [Initialize (`operator init`)](https://developer.hashicorp.com/vault/docs/commands/operator/init)
- [Seal / auto-unseal](https://developer.hashicorp.com/vault/docs/concepts/seal)
- [2.x release notes](https://developer.hashicorp.com/vault/docs/updates/release-notes)
- [Official image](https://hub.docker.com/r/hashicorp/vault)
- [Runtipi user-config](https://runtipi.io/docs/guides/customize-app-config)
