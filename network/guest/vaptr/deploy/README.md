# Self-hosting the interactsh OAST server

vmvapt confirms blind vulnerabilities (SSRF, blind RCE/SQLi, XXE) out-of-band: a
payload makes the *target* call back to an interactsh server you control. Using
your **own** server keeps every interaction on your infrastructure instead of a
public one. These artifacts reproduce the deployment (example host:
`fapstaff.com` @ `82.180.132.123`; substitute your own).

## Hard requirement: authoritative DNS

interactsh is the authoritative DNS server for its zone. You need:
- a VPS with a **public IP** and **port 53 free on that public IP** (a
  loopback-only `systemd-resolved` on `127.0.0.53` is fine — bind interactsh to
  the *specific* public IP, never `0.0.0.0`);
- a subdomain delegated to it in your registrar/DNS panel (see step 5).

## 1. Binary

```bash
mkdir -p /opt/interactsh && cd /opt/interactsh
URL=$(curl -s https://api.github.com/repos/projectdiscovery/interactsh/releases/latest \
  | grep -oE '"browser_download_url": *"[^"]*interactsh-server[^"]*linux_amd64\.zip"' \
  | head -1 | sed -E 's/.*"(https[^"]*)"/\1/')
curl -sL -o is.zip "$URL" && unzip -o is.zip && chmod +x interactsh-server && rm is.zip
```

## 2. Auth token (kept out of git and the unit file)

```bash
umask 077
printf 'INTERACTSH_TOKEN=%s\n' "$(openssl rand -hex 24)" > /opt/interactsh/interactsh.env
chmod 600 /opt/interactsh/interactsh.env
```

## 3. systemd service

Copy `interactsh-server.service` to `/etc/systemd/system/`, edit the `-domain` /
`-ip` / `-listen-ip` for your host, then:

```bash
systemctl daemon-reload && systemctl enable --now interactsh-server
systemctl is-active interactsh-server
ss -lntup | grep -E "<PUBLIC_IP>:(53|8071)"     # DNS on :53, HTTP on :8071
dig +short @<PUBLIC_IP> probe.oast.fapstaff.com A   # should return <PUBLIC_IP>
```

## 4. Firewall

```bash
ufw allow 53/tcp && ufw allow 53/udp
```

## 5. DNS delegation (in your registrar/DNS panel)

In the `fapstaff.com` zone:

| Type | Name | Value |
|------|------|-------|
| A    | `ns1`  | `82.180.132.123` |
| NS   | `oast` | `ns1.fapstaff.com` |

The A record is the glue that lets resolvers find `ns1`; the NS record delegates
`oast.fapstaff.com` (and everything under it) to interactsh.

**If your DNS panel has no `NS` record type** (e.g. Hostinger's basic editor),
you can't delegate the zone — but a **wildcard A** gets you HTTP/HTTPS OAST:

| Type | Name | Value |
|------|------|-------|
| A    | `*.oast` | `82.180.132.123` |
| A    | `oast`   | `82.180.132.123` |

Every `<id>.oast.fapstaff.com` then resolves to the box, so **HTTP/HTTPS**
callbacks reach interactsh (via the nginx vhost). The limit: **DNS-based OAST
won't work** — those lookups are answered by your DNS host, not interactsh. For
full DNS OAST you need real delegation (move the domain's DNS to a provider that
supports subdomain NS, e.g. Cloudflare, or point a spare domain's nameservers at
the box). This wildcard setup is live and proven for fapstaff.com.

## 6. nginx + TLS (Full DNS + HTTP/S)

Copy `oast.nginx` to `/etc/nginx/sites-available/oast.<domain>`, symlink into
`sites-enabled`, `mkdir -p /var/www/certbot`, then `nginx -t && systemctl reload
nginx`. **After** the DNS delegation (step 5) has propagated:

```bash
certbot --nginx -d oast.fapstaff.com          # base-domain HTTPS for client polling
```

HTTPS OAST *callbacks* to `*.oast.fapstaff.com` need a wildcard cert via a DNS-01
challenge (registrar API or manual TXT). DNS and HTTP OAST — the bulk of
blind-vuln detection — work without it.

## 7. Point vmvapt at it

`configs/example.oast.json`:

```json
"oast": { "server": "https://oast.fapstaff.com", "token_env": "VMVAPT_OAST_TOKEN" }
```

```bash
export VMVAPT_OAST_TOKEN="$(ssh root@82.180.132.123 cat /opt/interactsh/interactsh.env | cut -d= -f2)"
vaptr scan -config configs/example.oast.json
```

nuclei then routes OAST payloads through your server (`-interactsh-server` /
`-interactsh-token`) and correlates callbacks in-scan. See [../docs/OAST.md](../docs/OAST.md).
