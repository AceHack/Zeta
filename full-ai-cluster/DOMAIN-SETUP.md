# Domain setup — one machine, Namecheap, free, no Cloudflare

Get a domain serving your game servers + portal from a single-node cluster, with
DDNS keeping the name pointed at your (changing) home IP. Everything in the repo
is wired; this lists the handful of values to fill and the account/router actions
only you can do.

> ⚠️ DDNS keeps the name→IP mapping current. It is **not** DDoS protection, and
> there is no free DDoS shield for game UDP. Keep public game servers whitelisted
> until you add a paid relay/scrubber. (See chat history / the relay option.)

---

## What's already wired in the repo (done from the agent side)

| File | What it does |
|---|---|
| `k8s/applications/ddns/cronjob.yaml` | Namecheap DDNS updater (every 5 min, runs in-cluster so Namecheap sees your real public IP) |
| `k8s/applications/platform/gateway.yaml` | `zeta-gateway` — the LAN Cilium Gateway the portal publishes on (HTTP :80, any hostname) |
| `k8s/public-tls/` | install-time `platform-public-tls` Application: Let's Encrypt staging + prod issuers (HTTP-01, no DNS API / no Cloudflare), the `zeta-public-gateway` (:80 + :443) and the `portal-public` route |
| `k8s/applications/cert-manager/Application.yaml` | `enableGatewayAPI: true` so cert-manager can solve via the Gateway |
| `portal.yaml` / `controller.yaml` | `imagePullPolicy: Always` so a rollout pulls fresh `:latest` |

So the infra is all defined. The rest is your domain/email values + 3 real-world actions.

---

## The values to supply (none are files you edit)

Your **domain** and **ACME email** are install-time configuration, never repo edits
(`INJECTION-POINTS.md` §10): pass `zflash --acme-email you@yourdomain.com --public-domain
yourdomain.com`, or answer the prompt at the start of the install. The portal is then
published as `portal.yourdomain.com`. Skip both and the cluster installs LAN-only.

The **LoadBalancer IP range** is install-time configuration too (`INJECTION-POINTS.md` §11,
`docs/ops/INSTALL-TIME-CONFIG.md`): pass `zflash --lb-pool 192.168.1.240-192.168.1.250` (free
addresses on **your** subnet, outside your router's DHCP range) or `--lb-pool auto`, or answer the
prompt. The installer checks it against the LAN it measures and refuses a range that cannot work;
with nobody to ask it is left **unset, loudly** - there is no default range in the repo.

| Value | Where | To |
|---|---|---|
| DDNS host list | `ddns/cronjob.yaml` `DDNS_HOSTS` | the host records you create (default `@ *` is fine) |
| LB IP range | `zflash --lb-pool` / installer prompt (**not** a file) | a free IP block on **your** subnet |

---

## The 3 actions only you can do

### 1. Namecheap (the domain side)

- Domain List → **Manage → Advanced DNS → enable "Dynamic DNS"** → copy the **Dynamic DNS Password**.
- Add host records, each **Type = "A + Dynamic DNS Record"**: `@` (apex), `*` (wildcard), and/or `portal`, `game`.

### 2. The cluster secret (the DDNS credential — never in git)

```bash
kubectl create namespace zeta-platform --dry-run=client -o yaml | kubectl apply -f -
kubectl -n zeta-platform create secret generic namecheap-ddns \
  --from-literal=domain=YOURDOMAIN.com \
  --from-literal=password=YOUR_NAMECHEAP_DDNS_PASSWORD
kubectl apply -f full-ai-cluster/k8s/applications/ddns/cronjob.yaml
kubectl -n zeta-platform create job --from=cronjob/namecheap-ddns ddns-now
kubectl -n zeta-platform logs job/ddns-now      # expect: "updated @" / "updated *"
```

### 3. Your router (the actual gate)

- DHCP-reserve the machine's LAN IP.
- Port-forward **to the machine (the node's own LAN address)**:
  - **Portal / GitLab / API HTTPS:** TCP `443` → **the node**, not the `zeta-public-gateway`
    LoadBalancer address. Most home routers (MEASURED on an AT&T gateway, 2026-10-02) forward to a
    *device*, and the node answers for several addresses (its own plus every Cilium LoadBalancer IP)
    on **one MAC**, so a forward aimed at the gateway's address can be bound to another of them and
    production goes dark while every in-cluster check stays green. The node therefore serves `:443`
    itself: the firewall opens TCP 443 (`nixos/modules/node-public-https.nix`) and the
    `node-lan-hosts` relay passes it, TLS intact, to the public Gateway.
    See `docs/DECISIONS/2026-10-02-the-router-reaches-the-node-not-a-loadbalancer-address-so-the-node-serves-443-itself.md`.
  - **TCP `80`:** only HTTP-01 certificate issuance needs it, and it must reach the public Gateway's
    own address (`kubectl -n zeta-platform get gateway zeta-public-gateway`). A device-keyed router
    can send it to the wrong address; **DNS-01 needs no inbound port at all** (see Follow-ups).
    TCP 80 is deliberately *not* open on the node's own address (nothing listens there).
  - **Game servers (UDP):** the game's ports → that game's LoadBalancer Service IP (or the node, if
    your router can only pick a device). e.g. GMod `27015` UDP+TCP · Unturned `27015-27017` UDP ·
    Arma Reforger `2001`+`17777` UDP.
- **Router with a "DMZ host" setting:** pointing it at the node sends *every* unsolicited port to
  the node. It works, and it widens exposure from 443 to everything the node listens on; prefer
  the single forward above.
- **From inside the LAN** the router often cannot loop a public name back to itself (no NAT
  hairpin). The node already handles this for the two names it needs (`gitlab.<domain>`,
  `registry.<domain>` resolve to its own `:443` relay, from the same `--public-domain` value); other
  LAN clients should use split-horizon DNS or the LAN addresses.

---

## Bring it up + verify (ordering matters for TLS)

DNS must resolve to your IP **and** :80 must be forwarded **before** the cert can issue
(Let's Encrypt HTTP-01 reaches back on :80). So:

1. Do actions 1–3 above. Confirm `dig portal.yourdomain.com` returns your public IP.
2. Watch the certificate (issued by `letsencrypt-prod`; `letsencrypt-staging` also exists
   for a manual dry run):
   ```bash
   kubectl -n zeta-platform get certificate          # portal-tls → Ready=True
   kubectl -n zeta-platform describe certificate portal-tls   # follow the HTTP-01 order if pending
   ```
   Until it is Ready, `platform-public-tls` reads Progressing; `platform` is unaffected.
3. Browse `https://portal.yourdomain.com` (trusted padlock on prod).
4. Game: players connect to `game.yourdomain.com:<port>` → DNS → your IP → router → Service → pod.

---

## Game servers need NO Gateway/TLS

Games connect by `IP:port` over UDP — TLS/Gateway are irrelevant to them. A game
server just needs: a `type: LoadBalancer` Service on your LAN IP + the router
forwarding its UDP ports. The Gateway/cert work above is **only** for the web portal.

## Follow-ups (not needed for the above to work)

- **No inbound :80? Use DNS-01.** Opt-in Cloudflare DNS-01 issues certificates with no
  port-forward at all: `docs/ops/CLOUDFLARE-DNS01-CERTS.md` (HTTP-01 stays the default).

- **Wildcard cert** (`*.yourdomain.com`, one cert for every tenant subdomain) needs
  ACME **DNS-01**, which is painful on Namecheap → that's the one case where moving
  *DNS hosting* to Cloudflare (free; keep registration at Namecheap) is worth it.
  HTTP-01 above issues a normal per-hostname cert and needs none of that.
- **CGNAT check:** `curl ifconfig.me` on the machine vs your router's WAN IP. If they
  differ you're behind CGNAT — port-forwarding silently won't work and you need a
  VPS relay instead.
