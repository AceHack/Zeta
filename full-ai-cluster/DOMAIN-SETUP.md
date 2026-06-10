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
| `k8s/applications/platform/gateway.yaml` | `zeta-gateway` — the Cilium Gateway the portal publishes on (HTTP :80 + HTTPS :443), TLS auto-provisioned by cert-manager |
| `k8s/applications/platform/clusterissuer.yaml` | Let's Encrypt staging + prod issuers (HTTP-01, no DNS API / no Cloudflare) |
| `k8s/applications/cert-manager/Application.yaml` | `enableGatewayAPI: true` so cert-manager can solve via the Gateway |
| `portal.yaml` / `controller.yaml` | `imagePullPolicy: Always` so a rollout pulls fresh `:latest` |

So the infra is all defined. The rest is your domain/email values + 3 real-world actions.

---

## The values to fill (5 edits)

| Value | Where | To |
|---|---|---|
| Your domain | `gateway.yaml` HTTPS listener `hostname` | `portal.yourdomain.com` |
| Same domain | `portal.yaml` HTTPRoute `hostnames` | `portal.yourdomain.com` (must match the Gateway) |
| Your email | `clusterissuer.yaml` (both issuers) | your real email |
| DDNS host list | `ddns/cronjob.yaml` `DDNS_HOSTS` | the host records you create (default `@ *` is fine) |
| LB IP range | `cilium-lb-ipam/ip-pool.yaml` | a free IP block on **your** subnet |

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
- Port-forward → the machine / the Cilium LB IP:
  - **Portal HTTPS:** `80` + `443` TCP → the `zeta-gateway` LoadBalancer IP
    (`kubectl -n zeta-platform get gateway zeta-gateway` / `get svc`).
  - **Game servers (UDP):** the game's ports → that game's LoadBalancer Service IP. e.g.
    GMod `27015` UDP+TCP · Unturned `27015-27017` UDP · Arma Reforger `2001`+`17777` UDP.

---

## Bring it up + verify (ordering matters for TLS)

DNS must resolve to your IP **and** :80 must be forwarded **before** the cert can issue
(Let's Encrypt HTTP-01 reaches back on :80). So:

1. Do actions 1–3 above. Confirm `dig portal.yourdomain.com` returns your public IP.
2. Start staging first to avoid rate limits: in `gateway.yaml` set the annotation to
   `cert-manager.io/cluster-issuer: letsencrypt-staging`, push (ArgoCD applies), and watch:
   ```bash
   kubectl -n zeta-platform get certificate          # portal-tls → Ready=True
   kubectl -n zeta-platform describe certificate portal-tls   # follow the HTTP-01 order if pending
   ```
3. Once staging issues cleanly, flip the annotation back to `letsencrypt-prod`, push, and
   delete the staging secret so it re-issues a trusted cert:
   ```bash
   kubectl -n zeta-platform delete secret portal-tls
   ```
4. Browse `https://portal.yourdomain.com` (trusted padlock on prod).
5. Game: players connect to `game.yourdomain.com:<port>` → DNS → your IP → router → Service → pod.

---

## Game servers need NO Gateway/TLS

Games connect by `IP:port` over UDP — TLS/Gateway are irrelevant to them. A game
server just needs: a `type: LoadBalancer` Service on your LAN IP + the router
forwarding its UDP ports. The Gateway/cert work above is **only** for the web portal.

## Follow-ups (not needed for the above to work)

- **Wildcard cert** (`*.yourdomain.com`, one cert for every tenant subdomain) needs
  ACME **DNS-01**, which is painful on Namecheap → that's the one case where moving
  *DNS hosting* to Cloudflare (free; keep registration at Namecheap) is worth it.
  HTTP-01 above issues a normal per-hostname cert and needs none of that.
- **CGNAT check:** `curl ifconfig.me` on the machine vs your router's WAN IP. If they
  differ you're behind CGNAT — port-forwarding silently won't work and you need a
  VPS relay instead.
