# Garage

Single-node [Garage](https://garagehq.deuxfleurs.fr/) S3 API using [`dxflrs/garage:v2.4.1`](https://hub.docker.com/r/dxflrs/garage). Object data lives under the app data directory. There is one copy of each object: a disk failure loses it.

## Expose

Set the domain to `s3.gurmen.net` (or change **S3 root domain** to match). Runtipi's Traefik route terminates Let's Encrypt and forwards to container port `3900`.

Clients use path-style URLs:

```text
https://s3.gurmen.net/<bucket>/<key>
```

Region is `garage`. Virtual-host URLs such as `https://<bucket>.s3.gurmen.net` need a wildcard certificate, which this domain does not have. Set the client to path-style addressing.

The admin API stays on `127.0.0.1:3903` inside the container. Traefik does not publish it.

## Defaults

| Setting | Value |
| --- | --- |
| Image | `dxflrs/garage:v2.4.1` |
| S3 port | `3900` |
| Region | `garage` |
| Root domain | `.s3.gurmen.net` |
| Bucket | `default` |
| Metadata | SQLite in `${APP_DATA_DIR}/meta` |
| Objects | `${APP_DATA_DIR}/data` |

Install generates hex secrets. The S3 key ID is `GK` plus the access-key suffix. The full pair is written to:

```text
<runtipi-root>/app-data/<app-store>/garage/config/s3-credentials.txt
```

The bucket, access key, and secret key apply on **first start** only. Changing the access key, secret key, or RPC secret later makes Garage refuse to start or leaves existing data unreachable.

## Connect

From another container on the Runtipi network (path-style, HTTP, no TLS):

```text
http://garage_<app-store>-garage-1:3900
```

Confirm the name with `docker ps`.

From anywhere that can resolve the public name:

```bash
export AWS_ACCESS_KEY_ID=GK<suffix>
export AWS_SECRET_ACCESS_KEY=<secret>
export AWS_DEFAULT_REGION=garage
aws s3 ls --endpoint-url https://s3.gurmen.net
```

AWS CLI v2 needs path-style for a custom endpoint:

```ini
[default]
region = garage
s3 =
    addressing_style = path
```

## Admin CLI

```bash
docker exec -it garage_<app-store>-garage-1 /garage status
```

## Links

- [Quick start](https://garagehq.deuxfleurs.fr/documentation/quick-start/)
- [Reverse proxy](https://garagehq.deuxfleurs.fr/documentation/cookbook/reverse-proxy/)
- [Configuration](https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/)
