# Deploying + testing the portal against a real cluster

How the portal **detects** the cluster, how its code **gets onto** the cluster,
and how to **verify** the live resource console end-to-end.

## How the portal detects the cluster (no config, no repo entry)

The portal does **not** read a cluster address from anywhere. When it runs as a
pod it talks to *its own* cluster's API server using the ServiceAccount that
Kubernetes auto-injects into every pod:

- `KUBERNETES_SERVICE_HOST` / `..._PORT` — env vars the kubelet sets in-pod.
- `/var/run/secrets/kubernetes.io/serviceaccount/{token,ca.crt}` — the projected
  SA token + cluster CA, mounted by Kubernetes.

[`server.ts`](src/server.ts) `makeData()` switches on this:

| Condition | Data source |
|---|---|
| `PORTAL_DEMO=1` | `demoPlatform()` / `DemoOps` — fake data, runs anywhere |
| otherwise | `new K8sPlatform(...)` → `new K8sOps()` — reads the SA token, live cluster |

`K8sOps` throws if `KUBERNETES_SERVICE_HOST` is unset, i.e. it *only* constructs
in-cluster. What it's **allowed** to read/do is the `portal` ClusterRole in
[`../k8s/applications/platform/portal.yaml`](../k8s/applications/platform/portal.yaml)
(deployables r/w, pods, pods/log, events, metrics.k8s.io, apps rollout-restart).

So "detect the cluster" = "be a pod with the right ServiceAccount + RBAC." There
is no cluster-registration step for the portal. (Repo registration is a separate
thing: *nodes* self-register via the installer PR, and ArgoCD reconciles whatever
`Application.yaml` files live under `k8s/applications/`.)

## How the code gets onto the cluster (the chain)

```
push to main
  └─ build-platform-images.yml         → ghcr.io/.../zeta-portal:latest (+ :sha-<commit>)
                                          ghcr.io/.../zeta-platform-controller:latest
  └─ ArgoCD zeta-root (App-of-Apps)     → reconciles k8s/applications/**/Application.yaml
       └─ platform/Application.yaml     → applies CRDs + controller + portal (StatefulSet)
            └─ pod imagePullPolicy: Always → pulls the fresh :latest on (re)start
```

Both platform pods set `imagePullPolicy: Always`, so a rollout re-pulls the
rebuilt `:latest`. To ship new portal code after it's merged + the image is built:

```bash
kubectl -n zeta-platform rollout restart statefulset/portal
kubectl -n zeta-platform rollout restart deployment/platform-controller
```

(The portal can also restart a *workload* from its own lifecycle tab — that's the
`apps … rollout-restart` RBAC grant.)

## Tier 1 — local demo (no cluster, proves the UI + contract)

```bash
cd full-ai-cluster/portal
PORTAL_DEMO=1 bun run src/server.ts      # http://localhost:8080
```

Exercises every tab against `DemoOps`. Proves the UI and the `ResourceOps`
contract; proves nothing about live Kubernetes.

## Tier 2 — real cluster (proves K8sOps end-to-end)

Two ways in.

### 2a. A throwaway dev cluster (k3d) — fastest real test

```bash
# 1. local k3d + ArgoCD
full-ai-cluster/dev-cluster/up.sh

# 2. build the portal image and side-load it into k3d
docker build -t ghcr.io/lucent-financial-group/zeta-portal:latest full-ai-cluster/portal
k3d image import ghcr.io/lucent-financial-group/zeta-portal:latest -c <cluster>

# 3. let ArgoCD deploy the platform (CRDs + controller + portal)
full-ai-cluster/dev-cluster/apply-root-app.sh

# 4. reach the portal
kubectl -n zeta-platform port-forward svc/portal 8080:80

# 5. create something to manage, then open its console
kubectl apply -f full-ai-cluster/k8s/applications/platform/examples/   # a Deployable
```

### 2b. The real NixOS k3s cluster

Once `build-platform-images.yml` has published `:latest` and ArgoCD has synced
the `platform` Application, the portal is already running. Reach it via its
`HTTPRoute` host (set the hostname in `portal.yaml`) or port-forward as above.

## Verify the live path

With a Deployable applied and the portal open on that resource:

| Tab | Proves |
|---|---|
| **Overview / dashboard** | status derived from real pods (`info` → `parsePods`) |
| **Logs** | streamed from the pod `log` subresource (`parseLogs`) |
| **Events** | the resource's real k8s Events (`parseEvents`) |
| **Metrics** | live CPU/mem from `metrics.k8s.io` (flat series if metrics-server absent — honest) |
| **Config** | the Deployable spec; edits → merge-patch the CR; the controller reconciles |
| **Lifecycle** | stop/start = scale; restart = rollout-restart annotation; delete = delete the CR |

Honest degradation (these say what infra they need, never fake data): **exec**
(needs the SPDY/WebSocket channel), **files** (SFTP file-proxy), **traces** (OTel
collector), **query** (a DB driver). Those are the next live-path builds.

Quick sanity from a shell in the portal pod:

```bash
kubectl -n zeta-platform exec -it statefulset/portal -- sh -lc \
  'wget -qO- http://localhost:8080/api/catalog | head'
# real catalog from the cluster → K8sPlatform is talking to the API server.
```

## Known follow-ups

- **Digest-pin the manifests** + have CI bump them, instead of `:latest` + Always
  (immutable, audit-friendly GitOps). `:latest`+Always is the simple bootstrap.
- The four degraded ops above, when you want those tabs fully live.
