# Vouch - Ubuntu deploy

Production deploy of the Vouch merchant-console. Mock or live 0G is chosen at
runtime via `ZG_COMPUTE_MODE` (see section 6). The receipt feed is in-memory.

**Target host:** Ubuntu 22.04+ with Docker + Docker Compose installed.
**Required externally:** a DNS A-record pointing your domain at this server.

### Two ways to run

- **Host already runs Caddy (what vouch.unitynodes.com uses).** The console
  runs on a loopback port and your existing Caddy reverse-proxies to it. Use
  `deploy/docker-compose.caddy.yml` + `deploy/Dockerfile.merchant-console.live`.
  No nginx, no certbot. See `docker-compose.caddy.yml` for the Caddy site block.
- **Fresh server, no reverse proxy yet.** Use the bundled nginx + Let's Encrypt
  stack below (`deploy/docker-compose.yml`).

The rest of this guide covers the fresh-server (nginx) path.

---

## 0. Prerequisites on the host

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin certbot
sudo systemctl enable --now docker
sudo usermod -aG docker $USER && newgrp docker
```

Verify: `docker --version`, `docker compose version`, `certbot --version`.

---

## 1. Clone + env

```bash
git clone https://github.com/UnityNodes/Vouch.git ~/vouch
cd ~/vouch
cp .env.example .env
nano .env
# set VOUCH_DOMAIN and MERCHANT_ADDRESS (certbot email is passed on the CLI in step 2)
```

---

## 2. First-time HTTPS cert (one-shot certbot)

The nginx config expects a Let's Encrypt cert at `/etc/letsencrypt/live/$VOUCH_DOMAIN/`. Issue it with standalone certbot **before** starting docker compose (because nginx in compose will refuse to start without the cert files):

```bash
# stop anything already on :80
sudo systemctl stop nginx 2>/dev/null || true

# issue cert (replace domain + email)
sudo certbot certonly --standalone \
  -d vouch.example.com \
  --email ops@example.com \
  --agree-tos --no-eff-email
```

Cert files land in `/etc/letsencrypt/live/<domain>/`. docker-compose mounts that path read-only into the nginx container.

---

## 3. Build + start

```bash
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
```

First build is ~3-5 min (pnpm install + Next.js build inside the container). Subsequent builds with no dep changes are ~30s thanks to layer caching.

Verify:

```bash
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f merchant-console
curl -sI https://vouch.example.com    # expect: HTTP/2 200
```

Open `https://vouch.example.com` - explorer should load.

---

## 4. Cert renewal (twice a year minimum)

certbot writes a cron timer by default. Verify with `systemctl status certbot.timer`. After each renewal you need to ask nginx to reload:

```bash
# add to /etc/letsencrypt/renewal-hooks/deploy/vouch-reload.sh
#!/bin/sh
docker compose -f /home/$USER/vouch/deploy/docker-compose.yml exec nginx nginx -s reload
```

Make it executable: `sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/vouch-reload.sh`.

---

## 5. Updates

To deploy a new commit:

```bash
cd ~/vouch
git pull
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
```

`up -d --build` rebuilds the merchant-console image and rolls it without downtime (Next.js standalone server is stateless - in-memory receipts reset, which is acceptable in mock mode).

---

## 6. Switching to live 0G Compute (post-funding)

When you have ≥ 5 OG on `PRIMARY_PRIVATE_KEY` and Galileo-deployed contracts:

```bash
# in .env on the host:
ZG_COMPUTE_MODE=live
ZG_STORAGE_MODE=live
PRIMARY_PRIVATE_KEY=0x...
GALILEO_ATOKEN_ADDRESS=0x...
GALILEO_GATEWAY_ADDRESS=0x...

# rebuild + restart
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build
```

The container reads these env vars at startup; no other config changes needed. Same nginx, same domain, real TEE attestations now flowing.

> **Note:** in live mode the in-memory receipt store still resets on container restart. For a proper persistent audit trail point a SQLite or KV adapter at `lib/zg.ts`'s `MemoryStore` - out of scope for the group-stage demo.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `nginx: [emerg] cannot load certificate` | Cert not issued yet - re-run step 2 |
| `bind: address already in use :80` | Stop host nginx: `sudo systemctl stop nginx` |
| `merchant-console exited 1` on startup | Check `docker compose logs merchant-console` - usually missing workspace dep, rerun `--build` |
| Explorer loads but Trigger paid/blocked do nothing | Check browser network tab - `/api/demo/run` should 200. If 502, container died |
| 502 Bad Gateway from nginx | merchant-console container not running yet; wait ~10s after `up -d` |
