# Zeta Platform Architecture & Expansion Plan

> How we turn the Zeta cluster into a self-hostable cloud platform: an
> Azure-style management console, game-server hosting (GMod first), general VM
> compute (KubeVirt), and databases — all on the substrate we already run, all
> driven by one pattern (**everything is a Custom Resource**), with the **AI
> agents threaded through as the ops layer**.

Status: design. Companion to `README.md`, `PROVISIONING.md`, `INJECTION-POINTS.md`.

---

## 0. Thesis

A cloud platform is three things: **(1) a provisioning API, (2) a console to
drive it, (3) resource types you can provision.** We already own the hard
substrate. We add resource types (VMs, game servers, databases), one console
(Zeta Portal), and use the agents as the automation/ops layer — the thing no
Azure Portal or Pterodactyl has.

The unifying rule: **every provisionable thing is a Kubernetes Custom Resource.**
The portal creates CRs. The agents create the same CRs. ArgoCD reconciles the
platform itself. One API, three ways to drive it (human UI, agent, GitOps).

```
        ┌──────────────────── Zeta Portal (Azure-style console) ───────────────────┐
        │   top-down view + actions over EVERY resource type + embedded agent chat  │
        └───────┬──────────────────────┬───────────────────────┬───────────────────┘
                │ k8s API + CRDs        │ (agents drive          │ FTP / console
                │                       │  the SAME CRs)          │ gateways
   ┌────────────┼───────────────────────┼───────────────────────┼──────────────┐
   │  Tenant    │  GameServer  │  VirtualMachine  │  Database  │  App (ArgoCD)   │  ← resource types (CRDs)
   └────────────┴───────────────────────┴───────────────────────┴──────────────┘
   ┌──────────────────────────── substrate we already run ───────────────────────┐
   │  k3s · Cilium (CNI+LB+Gateway) · Longhorn · Vault/SPIRE/gatekeeper/cert-mgr  │
   │  ArgoCD/Argo-Rollouts/Workflows · CockroachDB/Redis/NATS/Weaviate ·          │
   │  Prometheus/Loki/Mimir/Tempo/Alloy(Grafana) · Forgejo/GitLab · vLLM/Ollama   │
   └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. What we already have (the substrate)

This is the inventory every section below builds on. Nothing here is new.

| Concern | We already run | Used by |
|---|---|---|
| Orchestration | **k3s** (single CP today; multi-node wired-but-TODO) | everything |
| CNI / networking | **Cilium** 1.16.5 — kube-proxy replacement, **Gateway API**, ingress, Hubble, **LB-IPAM capable** | all traffic |
| Storage | **Longhorn** (distributed block; RWO + RWX-over-NFS) | all stateful: game saves, VM disks, DB data, agent memory |
| GitOps | **ArgoCD** (app-of-apps), Argo Rollouts, Argo Workflows | platform reconciliation |
| Databases | **CockroachDB** (distributed SQL), **Redis**, **NATS**, **Weaviate** (vector) | apps, DBaaS |
| Secrets / identity / policy | **Vault**, **SPIRE**, **cert-manager**, **external-secrets**, **sealed-secrets**, **OPA/gatekeeper**, **trust-manager** | per-tenant creds, isolation, policy |
| Observability | **kube-prometheus-stack** + **Loki/Mimir/Tempo/Alloy** (Grafana) | portal metrics, billing source |
| Compute runtimes | **Orleans**, **Dapr**, **Temporal** | platform services |
| AI | **vLLM**, **Ollama**, deepseek/qwen-coder, **hindsight** (semantic memory), **agent-memory** (file memory) | the agent layer |
| Git / CI | **Forgejo**, **GitLab** | source, can be OIDC IdP |
| Virtualization base | NixOS `virtualisation.libvirtd` + `qemu_kvm` + **VFIO/GPU-passthrough** on `worker-gpu` | KubeVirt foundation |

**Gaps to close for "platform":** (a) VMs aren't in k8s yet, (b) no
service-LB/external-IP wired (servicelb disabled in favour of Cilium), (c) no
file/FTP layer, (d) no management console, (e) no tenant/provisioning CRDs.

---

## 2. Architectural spine (the pattern everything follows)

Five layers, bottom-up. Each ask in §3 plugs into these.

```
 ┌─ Surfaces ─────────────────────────────────────────────────────────────┐
 │  Zeta Portal (human) │ Agents (otto/lior/vera) │ GitOps (ArgoCD)         │
 ├─ Control plane (one API) ───────────────────────────────────────────────┤
 │  k8s API + CRDs + controllers   (later: Crossplane compositions)         │
 ├─ Resource types (CRDs) ─────────────────────────────────────────────────┤
 │  Tenant · App · GameServer · VirtualMachine · Database · Volume · FTP     │
 ├─ Platform services ─────────────────────────────────────────────────────┤
 │  Cilium LB/Gateway · Longhorn · Vault/SPIRE/gatekeeper · Grafana stack    │
 ├─ Substrate ─────────────────────────────────────────────────────────────┤
 │  NixOS nodes · k3s · KVM/QEMU                                             │
 └──────────────────────────────────────────────────────────────────────────┘
```

**Why CRD-first:** the portal and the agents both just `create`/`patch` CRs;
controllers do the work; ArgoCD/git is the audit log. A "deploy a GMod server"
button and an agent saying "spin up a GMod server" are the **same API call**.

---

## 3. The asks — each with full architecture

### 3.1 KubeVirt — general VM compute (NOT game-specific)

VMs become a first-class resource the portal lists next to pods. KubeVirt is the
**un-appliance'd Harvester**: Harvester = `SLE-Micro + RKE2 + KubeVirt + Longhorn`
packaged; we assemble `NixOS + k3s + Longhorn + KubeVirt` declaratively, keeping
our OS, our k8s, our GitOps.

**Components (all ArgoCD apps, sync-wave after Longhorn):**

- **KubeVirt operator** → installs `virt-controller`, `virt-handler` (DaemonSet),
  `virt-api`. VMs run as `virt-launcher` pods wrapping QEMU.
- **CDI** (Containerized Data Importer) → imports disk images (qcow2/iso/raw)
  into **Longhorn PVCs** as `DataVolume`s. A VM disk *is* a Longhorn volume.

**NixOS node enablement** (`nixos/modules/kubevirt-node.nix`, imported by hosts
that run VMs):

- `boot.kernelModules = [ "kvm-intel" /* or kvm-amd */ ]`, ensure `/dev/kvm`.
- packages: `swtpm` (vTPM), `virtiofsd` (fs passthrough), `qemu` (already present
  on `worker-gpu`).
- KubeVirt device plugins expose `/dev/kvm` to launcher pods. Known NixOS wrinkle:
  `virt-handler` wants a couple of writable host paths — pinned via the module.

**Networking:** VM gets a Cilium pod IP by default (masquerade binding); exposed
externally exactly like a pod (§4.1). For VMs needing their own L2 (a "real
server" NIC), add **Multus** + a bridge/macvlan attachment.

**Storage / HA:** RWO Longhorn PVC per VM disk; **live migration** later needs
**RWX** (Longhorn-over-NFS — enabled by the `nfs-utils` in `longhorn-prereqs.nix`).

**GPU:** the existing **VFIO passthrough** composes — KubeVirt supports
`GPU`/host-device passthrough → GPU VMs on `worker-gpu`.

```
 VirtualMachine CR ──> virt-controller ──> virt-launcher pod (QEMU)
        │                                      │ disk: Longhorn PVC (via CDI DataVolume)
        │                                      │ net : Cilium pod IP (+ Multus optional)
        └─ runStrategy/resources/gpu           │ gpu : VFIO host-device (worker-gpu)
                                               └─ console/VNC via virtctl / portal
```

**Phases:** deploy operator+CDI → first cloud-image VM → VM templates → GPU VMs →
live migration (multi-node).

---

### 3.2 Game-server hosting — GMod as the base test

A rented game server = a persistent, single-instance stateful workload + a panel.
**No Pterodactyl runtime** (it's Docker-daemon based and fights k8s); we reuse the
*idea* (and optionally its game "egg" specs) but build k8s-native — the **same
pattern as the `agent-memory` StatefulSet** already shipped.

**`GameServer` CRD** (new) → a controller materializes, per server:

```
 GameServer { game: gmod, gamemode: sandbox, map: gm_construct,
              maxPlayers: 16, mem: 4Gi, runtime: pod, ftp: true,
              workshopCollection: "<id>" }
        │  (controller — start as ArgoCD ApplicationSet+Helm, graduate to kubebuilder)
        ▼   namespace: tenant-<id>
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ StatefulSet(1)  steamcmd image → srcds            (the GMod process)       │
 │ PVC (longhorn)  /home/steam/gmod  ← server+addons+workshop+saves (FTP root)│
 │ Service (LB)    27015/udp game · 27015/tcp query+rcon   (Cilium LB-IPAM)   │
 │ SFTP sidecar    atmoz/sftp → same PVC, creds from Vault     (FTP)          │
 │ console gateway RCON(tcp) ⇄ websocket → portal             (web console)   │
 │ (agents)        k8s exec into the pod, RBAC-scoped         (AI/SSH)        │
 └──────────────────────────────────────────────────────────────────────────┘
```

**GMod specifics (the base test):** Source dedicated server via **SteamCMD app
`4020`**; start `srcds_run -game garrysmod +gamemode sandbox +map gm_construct
+maxplayers 16 -port 27015 +rcon_password <vault>`; workshop content via
`+host_workshop_collection`; ~2 vCPU / 2–4 GiB per server; single instance
(no autoscaling — these are pets, not cattle).

**Each sub-ask, mapped:**

| Sub-ask | Architecture |
|---|---|
| **Panel** | UI over the k8s API + `GameServer` CR: list/create/start(scale 0↔1)/stop/delete, resource graphs from Prometheus. **Console** = a small in-cluster **RCON⇄WebSocket gateway** (Source RCON over TCP, password from Vault) + log tail via the k8s API — the job Pterodactyl "wings" does, but over the cluster API. |
| **FTP** | Per-server **SFTP sidecar** (`atmoz/sftp`) mounting the game's Longhorn PVC; per-server credentials issued by **Vault**; exposed on a Cilium LB IP/port. Add **Filebrowser** for a web file manager over the same PVC. |
| **AI / SSH** | Agents reach a server via **k8s `exec`** into the pod, with an RBAC Role scoped to the tenant's namespace (`pods/exec` on game pods) — no sshd, minimal attack surface. Portal gets an **"ask the AI"** action → an agent task execs in to install addons, fix a crash loop, tune `garrysmod/cfg/server.cfg`, read logs. *(Optional real SSH for users: an sshd sidecar with the user's pubkey — the same ESP key-injection pattern we use for nodes.)* **This is the differentiator Pterodactyl/Azure can't do.** |
| **Provision** | User picks game + size → portal writes a `GameServer` CR → controller materializes the objects → live in seconds. **Agents provision identically** (same CR). |

**Pod vs VM:** **pods by default** (lighter, k8s-native; covers GMod and most
Source/SteamCMD games). `runtime: vm` (KubeVirt) only for games needing a full OS
/ kernel anti-cheat / Windows — same panel, same CR, different backend.

**Phases:** GMod MVP (pod+PVC+ports+SFTP+RCON) → agent-exec admin → more games
(import Pterodactyl egg specs as `GameSpec`s) → web file manager → tenant
accounts/quotas/billing → VM-backed games via KubeVirt.

---

### 3.3 Zeta Portal — the Azure-style top-down console

The management plane. Mental model maps cleanly:

| Azure | Zeta Portal |
|---|---|
| Subscription / Resource Group | **Tenant** (one or more namespaces) |
| Resource (VM, DB, App Service…) | any k8s object **incl. our CRDs** (GameServer, VirtualMachine, Database) |
| Resource blade (metrics/config/actions) | per-resource view: status, **Grafana** panels, YAML, actions |
| Activity log | k8s events + ArgoCD history + git |
| Cloud Shell / Copilot | **embedded agent chat** (acts through the same API) |

**Architecture:**
```
 Browser ──> Zeta Portal frontend
                │  ├─ k8s API (read all resources + CRDs; actions = create/patch CR)
                │  ├─ Prometheus/Loki/Tempo  (metrics/logs/traces per resource)
                │  ├─ OpenCost (later)        (cost/metering blade)
                │  └─ agent chat endpoint     (NL → agent → same k8s API)
                └─ OIDC login ──> IdP (decision: Authentik/Keycloak, or Forgejo/GitLab OIDC)
                                    └─ maps user → tenant namespaces + k8s RBAC
```

**Build vs adopt:**

- **Now (days):** drop in **Headlamp** (CNCF, plugin-extensible) as an ArgoCD app
  → instant top-down visibility into pods/clusters/PVCs/DBs/(VMs once KubeVirt).
  *(Rancher is also NixOS-safe — it's an app, unlike Harvester — but heavier.)*
- **Then:** **Zeta Portal** — a thin custom console rendering a **resource graph**
  over k8s built-ins **+ our CRDs**, with metrics from the Grafana stack, actions
  that write CRs, the agent chat, and tenant-scoped RBAC views. Headlamp can be
  extended with plugins for the CRDs as a bridge before a bespoke UI.

**Phases:** Headlamp visibility → Zeta Portal v1 (resources + actions) →
metrics/quota/cost blades → multi-tenant views → marketplace (one-click
app/game/DB/VM).

---

### 3.4 Databases-as-a-service

| | |
|---|---|
| Have | CockroachDB, Redis, NATS, Weaviate (as platform singletons today) |
| Add | a **`Database` CRD** + DB **operators** (CloudNativePG for Postgres, the CockroachDB operator) so "create a database" = a CR that provisions an instance/logical DB + a Vault-issued credential + a Longhorn PVC |
| Admin UI | Adminer/pgAdmin behind the portal; connection strings from Vault |
| Backups | scheduled dumps/snapshots to Longhorn + object storage (MinIO/SeaweedFS — a later add) |

---

### 3.5 Agent memory (shipped)

Already done as the reference for the whole pattern: `agent-memory` StatefulSet →
`volumeClaimTemplates` → Longhorn PVC (durable per-persona memory across restarts).
Semantic memory = `hindsight` (also Longhorn-backed). Every resource type in this
doc follows that same StatefulSet/CR + Longhorn shape.

---

## 4. Cross-cutting architecture

### 4.1 Networking — the layered truth (corrects the earlier MetalLB note)

Three distinct layers; don't conflate them:

```
 1. CNI / pod & VM IPs ........ Cilium (already)           — east-west
 2. Service external IP ....... Cilium LB-IPAM + L2/BGP    — the MetalLB slot
       CiliumLoadBalancerIPPool  (hands out IPs)
       CiliumL2AnnouncementPolicy / BGP (announces them)
    HTTP/L7 apps ............... Cilium Gateway API (already enabled)
 3. Public reachability ....... routable public IP / colo / port-forward / BGP
                                upstream  — about WHERE the box sits, not k8s
```

- **Use Cilium LB-IPAM, NOT MetalLB.** servicelb was deliberately disabled so
  Cilium owns L2-L4; MetalLB would fight it. Cilium does the same job natively.
- **Game/VM ports** (UDP for srcds) → `Service type=LoadBalancer` gets a Cilium
  LB IP. On a single public IP, allocate a **port range per server** (27015,
  27016, …) — a port-allocation field on `GameServer`. With an IP pool, one IP
  per server.
- **Public reachability is a separate, physical decision.** A home/AT&T NAT
  connection cannot host public game servers reliably (NAT, dynamic IP, UDP,
  upstream filtering). Productizing needs a public-IP host / colo / cloud node.
  *(This is the single biggest external dependency in the whole plan.)*

### 4.2 Multi-tenancy — a `Tenant` CRD (we have every primitive)

`Tenant` → controller provisions: **namespace(s)** + **RBAC** (tenant role) +
**ResourceQuota/LimitRange** (sold CPU/RAM/storage caps) + **Cilium
NetworkPolicy** (tenants can't see each other) + **Vault path** (per-tenant
secrets) + **gatekeeper** binding (what the tenant may create). Everything a
tenant owns lives in its namespace(s). We already run all five mechanisms — most
platforms don't.

### 4.3 Storage

Longhorn for all stateful state: game saves, VM disks, DB data, agent memory.
Single replica on one node (set in the hardening PR); 2–3 as workers join.
Object storage (MinIO/SeaweedFS) added for backups, images, large blobs.

### 4.4 Security

Per-tenant: gatekeeper policy, Vault creds, SPIRE workload identity,
cert-manager TLS. Tenant workloads image-scanned before admission. The portal
authenticates via OIDC (IdP decision below) → k8s RBAC.

### 4.5 Observability & billing

Grafana stack already collects metrics/logs/traces → the portal's per-resource
blades read from it. **OpenCost** (later) turns Prometheus usage into per-tenant
cost → billing/metering.

### 4.6 The agent layer (the differentiator)

otto/lior/vera run as systemd units **outside** k8s ("control plane outside the
control plane"), so they can repair the cluster from outside its failure domain.
They drive the **same CRs** the portal does: provision, scale, repair, configure,
and answer support — across VMs, game servers, DBs, apps. The portal's chat is a
front-end to them.

---

## 5. Provisioning control plane & resource taxonomy

Start with **CRD + controller** per type (fast, explicit); graduate to
**Crossplane** if/when one composition API over app+DB+VM+game+bucket is worth it.

```
 Tenant
   ├─ App            (ArgoCD Application — deploy arbitrary workloads)
   ├─ GameServer     (gmod, …)            → StatefulSet+PVC+Svc+SFTP+console
   ├─ VirtualMachine (KubeVirt)           → virt-launcher + Longhorn disk
   ├─ Database       (operator-backed)    → instance + Vault cred
   ├─ Volume         (Longhorn PVC)       → standalone storage
   └─ FTPEndpoint    (SFTP into a Volume) → atmoz/sftp + Vault cred
```

---

## 6. Roadmap

| Phase | KubeVirt | Game hosting (GMod) | Portal | Platform / cross-cutting |
|---|---|---|---|---|
| **0 — now** | operator+CDI app; `kubevirt-node.nix` | `GameServer` CRD + **GMod MVP** (pod+PVC+ports+SFTP+RCON) | **Headlamp** for visibility | Cilium **LB-IPAM** turned on |
| **1** | first VM templates | agent-exec admin; web console | **Zeta Portal v1** (resources+actions) | `Tenant` CRD draft; OIDC IdP chosen |
| **2** | GPU VMs | more games (egg import); Filebrowser | metrics/quota/cost blades | multi-tenancy (NetworkPolicy+quota); object storage |
| **3** | live migration (multi-node) | self-service signup; **billing (OpenCost)** | marketplace | **public-IP / colo** host; backups |
| **4** | — | VM-backed/anti-cheat games | agent-ops console | HA, autoscale, agent self-healing |

---

## 7. Immediate next steps (first PRs, dependency order)

1. **Headlamp** — `k8s/applications/headlamp/` ArgoCD app → instant top-down view.
2. **Cilium LB-IPAM** — a `CiliumLoadBalancerIPPool` + `CiliumL2AnnouncementPolicy`
   (or BGP) so `type: LoadBalancer` works (prereq for game/VM external ports).
3. **KubeVirt** — `k8s/applications/kubevirt/` (operator) + `.../cdi/` + a
   `nixos/modules/kubevirt-node.nix`.
4. **GameServer + GMod** — `k8s/applications/game-hosting/`: the CRD, a
   template-based controller, and a GMod instance (StatefulSet + Longhorn PVC +
   LB Service + SFTP sidecar + RCON gateway), plus the agent-exec admin path.

---

## 8. Open decisions (need a call before/while building)

1. **Public reachability** — where do production game/VM servers live? (home NAT
   is a non-starter for public hosting; need public IP / colo / cloud node.)
2. **Portal: adopt vs build** — Headlamp-extended vs Rancher vs a bespoke Zeta
   Portal (recommend Headlamp now, bespoke later).
3. **Human auth / IdP** — Authentik/Keycloak vs Forgejo/GitLab OIDC for portal
   + tenant login.
4. **Single-tenant ops vs multi-tenant product** — gates how much of §4.2 we
   build now.
5. **Provisioning API** — CRD+controllers now; adopt Crossplane later? (recommend
   CRD-first.)
