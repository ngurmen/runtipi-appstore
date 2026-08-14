# Apprise

Lightweight HTTP API for [Apprise](https://github.com/caronc/apprise) — send notifications to 100+ services (Discord, Slack, email, SMS, Home Assistant, and more).

## Architecture

This app runs two containers:

1. **apprise** (`caronc/apprise`) — Apprise API on port 8000  
2. **nginx** — reverse proxy on port 80 that requires an API key before forwarding

Timezone follows your Runtipi `TZ` setting.

## Authentication

API paths (`/notify`, `/add`, `/get`, `/del`, `/cfg`) require the **API Key** you set at install, sent as the `X-API-Key` header. The web UI under `/` is not API-key gated (restrict exposure with Open port / Traefik as needed).

Example:

```bash
curl -X POST "http://HOST:8743/notify/myhome" \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"Backup finished","title":"Homelab"}'
```

## Persistent data

| Host path (under app data) | Container | Purpose |
| --- | --- | --- |
| `data/config` | `/config` | Stateful notification configs |
| `data/plugin` | `/plugin` | Custom Apprise plugins |
| `data/attach` | `/attach` | File attachments |

Stateful mode defaults to **simple** (`{KEY}.cfg` / `{KEY}.yml` on disk).

## Customizing nginx

The shipped template is `nginx/default.conf.template`. To override it, use Runtipi [user-config](https://runtipi.io/docs/guides/customize-app-config) and mount your own template over `/etc/nginx/templates/default.conf.template`.

## Links

- [Apprise API docs](https://appriseit.com/getting-started/)
- [GitHub](https://github.com/caronc/apprise-api)
- [Supported services](https://github.com/caronc/apprise/wiki)
