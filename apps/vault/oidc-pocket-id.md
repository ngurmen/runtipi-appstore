# Vault UI login with Pocket ID passkeys

Use [Pocket ID](../pocket-id/) as the OIDC provider so the Vault web UI signs in with a passkey instead of the root token.

OIDC does **not** unseal Vault. After every container restart you still unseal with Shamir keys (or auto-unseal). OIDC only replaces the **login** step once Vault is unsealed.

Replace the placeholders:

| Placeholder | Meaning |
| --- | --- |
| `<runtipi-root>` | Runtipi install directory (contains `app-data/` and `user-config/`) |
| `<app-store>` | Store slug from Settings → App Stores |
| `https://id.example.com` | Pocket ID **Application URL** (HTTPS) |
| `https://vault.example.com` | Vault public HTTPS URL (Traefik domain, no `:8200`) |

Confirm container names with `docker ps`. They follow `{app-id}_<app-store>-{service}-1`.

## 1. Prerequisites

1. Pocket ID is installed, exposed on HTTPS, and you can sign in at `https://id.example.com`.
2. Vault is installed, **initialized**, **unsealed**, and exposed on HTTPS at `https://vault.example.com/ui`.
3. You still have a **root token** for this one-time setup. Keep it offline after you are done.
4. From a browser, both URLs load without certificate warnings. Passkeys need a trusted HTTPS origin.

Check that Vault can reach Pocket ID discovery (the Vault **server** fetches this, not only your browser):

```bash
curl -fsS https://id.example.com/.well-known/openid-configuration | head
```

You should see `"issuer": "https://id.example.com"`. If this fails from the host but works in the browser, fix DNS/hairpin or TLS before continuing.

## 2. Create a Pocket ID group (optional but recommended)

In Pocket ID: **User Groups** → create `vault-admins`. Add the users who may operate Vault.

You will restrict the OIDC client to this group in the next step so random Pocket ID users cannot authorize Vault.

## 3. Register a Vault OIDC client in Pocket ID

1. Sign in to Pocket ID as admin.
2. **OIDC Clients** → **Add OIDC Client**.
3. Set:

   | Field | Value |
   | --- | --- |
   | Name | `Vault` |
   | Public client | **Off** (Vault stores a client secret) |
   | PKCE | **On** (Vault’s OIDC flow uses PKCE) |
   | Callback URLs | see below |
   | Launch URL | `https://vault.example.com/ui` (optional) |
   | Restrict to groups | **On**, allow `vault-admins` |

   Callback URLs (exact match, no trailing slash):

   ```text
   https://vault.example.com/ui/vault/auth/oidc/oidc/callback
   http://localhost:8250/oidc/callback
   ```

   The first is the **UI**. The second is optional, for `vault login -method=oidc` on your laptop.

4. Save. Copy **Client ID** and **Client Secret**. The secret is shown once.

If you later change the Vault domain, update both Pocket ID callback URLs and the Vault role `allowed_redirect_uris`.

## 4. Create a Vault policy

On the Runtipi host, with Vault unsealed. Paste your root token when asked (or export `VAULT_TOKEN`).

This policy is a homelab operator policy (almost root). Tighten it later.

```bash
docker exec -i -e VAULT_TOKEN \
  vault_<app-store>-vault-1 \
  vault policy write pocket-id-admin - <<'EOF'
# Homelab operator — not a substitute for real least-privilege.
path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
EOF
```

If `VAULT_TOKEN` is not in your shell:

```bash
export VAULT_TOKEN='hvs....'   # root token
```

## 5. Enable and configure the OIDC auth method

Still on the host:

```bash
docker exec -e VAULT_TOKEN vault_<app-store>-vault-1 \
  vault auth enable oidc
```

If you see `path is already in use`, it is already enabled — continue.

Configure the provider. Use the Pocket ID **Application URL** as the discovery URL (no `/.well-known/...` suffix):

```bash
docker exec -e VAULT_TOKEN vault_<app-store>-vault-1 \
  vault write auth/oidc/config \
    oidc_discovery_url="https://id.example.com" \
    oidc_client_id="PASTE_CLIENT_ID" \
    oidc_client_secret="PASTE_CLIENT_SECRET" \
    default_role="admin" \
    bound_issuer="https://id.example.com"
```

Create the role the UI will use. `allowed_redirect_uris` must be the same URLs you entered in Pocket ID:

```bash
docker exec -e VAULT_TOKEN vault_<app-store>-vault-1 \
  vault write auth/oidc/role/admin \
    role_type="oidc" \
    user_claim="sub" \
    oidc_scopes="profile,email,groups" \
    groups_claim="groups" \
    bound_audiences="PASTE_CLIENT_ID" \
    allowed_redirect_uris="https://vault.example.com/ui/vault/auth/oidc/oidc/callback" \
    allowed_redirect_uris="http://localhost:8250/oidc/callback" \
    token_policies="pocket-id-admin" \
    token_ttl="8h"
```

`user_claim=sub` is stable (Pocket ID user id). The Vault entity name will be that UUID. To show the Pocket ID username instead, use `user_claim="preferred_username"` (requires the `profile` scope, already listed).

## 6. Sign in through the Vault UI

1. Open `https://vault.example.com/ui`. Unseal if Vault is sealed.
2. Method: **OIDC**. Role: leave empty (uses `default_role=admin`) or type `admin`. Mount path: `oidc`.
3. **Sign in with OIDC Provider**.
4. Complete the Pocket ID passkey prompt.
5. You should land in the Vault UI with the `pocket-id-admin` policy.

Do not use the root token for daily UI login after this works. Store the root token offline for break-glass (policy changes, auth method repair).

## 7. Optional: bind the role to the Pocket ID group

Pocket ID group restriction already blocks unauthorized users at the IdP. To also enforce it in Vault:

```bash
docker exec -e VAULT_TOKEN vault_<app-store>-vault-1 \
  vault write auth/oidc/role/admin \
    role_type="oidc" \
    user_claim="sub" \
    oidc_scopes="profile,email,groups" \
    groups_claim="groups" \
    bound_audiences="PASTE_CLIENT_ID" \
    bound_claims_type="string" \
    bound_claims='{"groups":"vault-admins"}' \
    allowed_redirect_uris="https://vault.example.com/ui/vault/auth/oidc/oidc/callback" \
    allowed_redirect_uris="http://localhost:8250/oidc/callback" \
    token_policies="pocket-id-admin" \
    token_ttl="8h"
```

`vault write` on a role replaces the whole role — repeat every field you still want.

## 8. Optional: CLI login

From a machine with the Vault CLI and `VAULT_ADDR=https://vault.example.com`:

```bash
vault login -method=oidc role=admin
```

That uses `http://localhost:8250/oidc/callback`, which must be in both Pocket ID and the Vault role.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Passkey will not register / prompt never appears | Vault or Pocket ID not on trusted HTTPS, or Application URL ≠ browser URL |
| `unauthorized redirect_uri` in Vault logs | Callback URL mismatch. Compare Pocket ID callbacks with `allowed_redirect_uris`. Traefik URLs have **no** `:8200`. |
| OIDC button does nothing / empty `auth_url` | Role missing the UI callback `.../ui/vault/auth/oidc/oidc/callback` |
| `error connecting to oidc discovery` / TLS errors | Vault container cannot reach `https://id.example.com`. Hairpin NAT, DNS, or untrusted Traefik CA. Test discovery with `curl` from the host; for a private CA, set `oidc_discovery_ca_pem` on `auth/oidc/config`. |
| Issuer mismatch | `oidc_discovery_url` / `bound_issuer` must equal Pocket ID **Application URL** exactly (scheme + host, no trailing slash) |
| Login works but no permission | Role `token_policies` does not include `pocket-id-admin`, or you are not in `vault-admins` |
| Still prompted for root token only | Auth method not enabled, or UI method is still **Token**. Choose **OIDC**. |
| After restart, OIDC login fails immediately | Vault is **sealed**. Unseal first; OIDC cannot unseal. |

Useful reads:

```bash
docker exec -e VAULT_TOKEN vault_<app-store>-vault-1 vault read auth/oidc/config
docker exec -e VAULT_TOKEN vault_<app-store>-vault-1 vault read auth/oidc/role/admin
docker logs vault_<app-store>-vault-1 2>&1 | tail
```

## References

- [Vault JWT/OIDC auth](https://developer.hashicorp.com/vault/docs/auth/jwt)
- [Vault OIDC tutorial](https://developer.hashicorp.com/vault/tutorials/auth-methods/oidc-auth)
- [Pocket ID](https://pocket-id.org/docs/setup/installation)
- [Pocket ID environment variables](https://pocket-id.org/docs/configuration/environment-variables)
