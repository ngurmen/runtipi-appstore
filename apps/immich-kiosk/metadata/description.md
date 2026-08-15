# Immich Kiosk

Highly configurable slideshows for displaying Immich assets on browsers and devices.

> This project is not affiliated with Immich.

## Requirements

- A reachable Immich server running **v3.0.0** or above
- An Immich API key with the permissions documented at [docs.immichkiosk.app](https://docs.immichkiosk.app/)

## Configuration

At install time you provide:

- **Immich URL** — how Kiosk reaches Immich (use the Docker service name or host IP)
- **Immich API Key** — created in Immich → Account Settings → API Keys
- **Immich External URL** (optional) — public URL for image links / QR codes
- **Language** — defaults to `en_US`

Timezone follows your Runtipi `TZ` setting.

Container name: `immich-kiosk_<app-store>-immich-kiosk-1` (`{app-id}_<app-store>-{service}-1`). Confirm with `docker ps`.

Advanced options can be set by editing `config.yaml` in the app data directory, or via [URL query parameters](https://docs.immichkiosk.app/configuration/url-parameters/). Persistent data (including offline assets) lives under the app's data folder.

## Common use cases

- Fullscreen slideshow on a tablet or TV (`layout=single`, `image_fit=cover`)
- Holiday album on a Raspberry Pi: `?album=ALBUM_ID&transition=none&show_time=false`
- Specific people: `?person=PERSON_1_ID&person=PERSON_2_ID&transition=fade`

## Links

- [Documentation](https://docs.immichkiosk.app/)
- [GitHub](https://github.com/damongolding/immich-kiosk)
- [Demo](https://demo.immichkiosk.app/)
