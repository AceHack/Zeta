# Dev-PC substrate architecture — Nix + Home Manager + kind/k3d + Headscale + lend-resources pattern (Aaron + Otto, 2026-05-24)

Date decided: 2026-05-24 (~02:03Z)
Participants: Aaron Stainback (operator + primary authority) + Addison (observed as future participant; consent per `2026-05-24-addison-consent-pattern-observation-not-fact-discipline-aaron-otto.md`) + Otto (recommendation + decision-capture role)
Hardware context: dev-PC tier alongside basement cluster (per sibling archive `2026-05-24-cluster-bare-metal-substrate-architecture-nixos-no-hypervisor-argo-cd-aaron-otto.md`)

## Archive scope (per GOVERNANCE §33)

Scope: architecture-decision record for the **dev-PC substrate layer** — Aaron's + Addison's Windows/Mac workstations that need:

1. Reproducible dev environment matching the cluster's DST discipline
2. Local k8s testing capability (without touching production cluster)
3. Opt-in workload contribution back to the cluster ("lending resources")
4. Sovereignty over the network substrate (Headscale, not pure Tailscale managed service)

Sibling to PR #4808 (cluster substrate). Preserves Aaron's operating principle: *"dev machine ≠ cluster for humans"*.

Attribution: Aaron is first-party on own substrate. Addison observed as future participant with consent-scoped naming (first-name only, observation-framing throughout per Addison's articulated consent-discipline). Otto authored recommendation matrix; Aaron made authority calls.

Operational status: research-grade architecture decision — substrate for future dev-PC provisioning work; not yet implemented in code.

## Why preserved

Aaron's substrate-engineering question: *"what do you suggest for reproducable setup? also i addison and i will have a few pcs that are windows/mac and would like those to participate, do you think just the background services on those? or use kubernetes in docker maybe for testing i'm thinking. maybe we could federate like this too. like the dev machine will be different from cluster for humans."*

Aaron's confirmation + additions: *"yes bundle-file it (shadow*) Aaron: what is bundle file sounds good. Also Tailscale is good but we also want headscale. Lets do whatever is lightweigh now and ease into more heavy weight stuff. Dev boxex can be like lending resources to the cluster that sounds good."*

This locks in the dev-PC substrate decisions in parallel to the cluster substrate decisions (sibling archive).

## Operating principle (Aaron-stated, captured verbatim)

> *"Lets do whatever is lightweigh now and ease into more heavy weight stuff."*

**Implication**: every choice below is the lightweight-first option; heavier alternatives are explicitly captured as "ease into later" rather than "use now."

## Three-layer dev-PC architecture

### Layer 1 — Reproducible dev-PC substrate (Nix)

One Nix flake repo covers BOTH cluster (NixOS modules per node-class, per sibling archive) AND dev PCs (Home Manager modules per user). Same `flake.nix`; different evaluation targets:

| Per-OS substrate | Choice (lightweight-first) | Ease-into-later option |
|---|---|---|
| **macOS** (Aaron-Mac / Addison-Mac) | Nix package manager (Determinate Systems installer) + nix-darwin (declarative macOS system config) + Home Manager (user-level) | Switch to nix-darwin's full system management when comfortable |
| **Linux** (Aaron-Linux dev box) | Nix package manager on existing distro + Home Manager (user-level) | Migrate to full NixOS desktop when comfortable (same flake; just a different evaluation target) |
| **Windows** (Addison-Windows / Aaron-Windows if any) | WSL2 + Nix in WSL2 + Home Manager in WSL2 | Native Nix-on-Windows when Determinate ships it (not lightweight today) |

**Net**: one Nix flake repo IS the source of truth for cluster + dev PCs + every user's home directory. Same composition pattern; different evaluation targets per surface.

### Layer 2 — Local k8s for testing (kind/k3d)

| Tool | Lightweight | What you get |
|---|---|---|
| **kind** (Kubernetes IN Docker) | yes | One-command local k8s cluster; mirrors production manifests; isolated from real cluster |
| **k3d** (k3s in Docker) | yes (lighter than kind) | Same as kind but k3s-based; faster startup; smaller footprint |

**Choice**: **k3d** (lighter than kind). Each dev PC has its own local k3d cluster for manifest testing + GitOps practice WITHOUT touching production cluster.

**Easier-to-heavy migration path**: dev PC starts with k3d; later could run lightweight Talos VM under Lima (Linux VM on macOS) or under WSL2 (Linux on Windows) if a heavier k8s-substrate is wanted for dev work.

### Layer 3 — Background service (lend-resources pattern)

Aaron's framing observed: *"Dev boxes can be like lending resources to the cluster that sounds good."*

**Architecture**: dev PCs are NOT first-class k8s nodes. They run a lightweight background service that:

1. Authenticates with cluster via Tailscale/Headscale overlay network
2. Polls cluster's work-queue (k8s API OR a simple queue like Redis/NATS) for opt-in workloads
3. Executes work locally; returns results
4. Owner can pause/resume/revoke at any time (NCI floor at dev-PC scope)

**Tech choice (lightweight-first)**:

| Option | Lightweight | When to consider |
|---|---|---|
| **Simple Bun/Node daemon polling a NATS queue** | yes | Now — minimal substrate; easy to write; works on macOS/Linux/Windows |
| **k3s agent joining cluster** | medium | If dev PCs become stable enough to be first-class workers |
| **Liqo (k8s federation)** | heavy | Ease-into-later if true multi-cluster federation becomes needed |

**Choice**: **Simple Bun/Node daemon polling a NATS queue** (lightweight; deferrable to k3s-agent later if dev PCs prove stable).

### Layer 4 — Network substrate (Headscale + Tailscale)

Aaron-stated: *"Tailscale is good but we also want headscale."*

| Component | Role |
|---|---|
| **Tailscale client** (the daemon on each device) | Per-device wireguard mesh participant; provides MagicDNS, ACLs, SSH-via-Tailscale |
| **Headscale** (self-hosted control plane) | Replaces Tailscale Inc.'s managed coordination server; YOU run it; sovereignty over user/device/ACL state; no dependency on commercial control plane |
| **DERP relay** (optional) | Self-hosted relay for NAT traversal in fallback case; Tailscale client supports custom DERP servers |

**Architecture**: Tailscale clients on each dev PC + cluster node + Cellhasher + Pi cluster connect to **self-hosted Headscale** control plane (probably runs on cluster as a k8s deployment).

**Why Headscale over pure Tailscale managed**:

- **Sovereignty**: control plane is yours; no commercial dependency
- **Cost**: free at any node count (vs Tailscale's 100-node free tier)
- **Privacy**: device/user/ACL state stays in your infrastructure
- **Framework discipline**: Headscale fits "we host our own substrate" aligned with cluster's bare-metal-NixOS-no-hypervisor principle

**Why keep Tailscale client (not pure wireguard)**:

- Mature wireguard config + key rotation
- MagicDNS just works
- ACLs are usable
- Tailscale SSH for ops
- Compatible with Headscale 1:1 (Headscale speaks Tailscale's coordination protocol)

**Ease-into-heavier-later option**: federation control plane (Liqo, KubeFed) once cluster + dev PCs prove stable; for now Headscale + Tailscale clients is the lightweight network substrate.

## How it composes with cluster substrate (sibling archive)

| Cluster layer (PR #4808) | Dev-PC layer (this archive) | Composition |
|---|---|---|
| NixOS bare metal | Nix package manager + Home Manager | Same flake; different evaluation targets |
| Bare-metal k8s | k3d local k8s | Dev tests against same manifests; isolated cluster |
| Argo CD GitOps | Same flake repo for dev-PC config (via Home Manager) | One source of truth across cluster + dev PCs |
| Cilium CNI | Tailscale + Headscale overlay | Cluster has internal Cilium pod network; Tailscale connects dev PCs to cluster services |
| NVIDIA k8s device plugin | dev PC GPUs (if any) optionally lent via background service | Dev PC GPU is workload-substrate, not k8s scheduling target |

**Net**: cluster + dev PCs form **one declarative ecosystem**, but with clean separation at the trust boundary. Cluster is DST substrate (reproducible, atomic); dev PCs are operator-mutable but reproducibility-shaped (Nix + Home Manager).

## Heavyweight ease-into-later options (deferred per Aaron's principle)

| Option | When to consider |
|---|---|
| **Liqo federation** (dev PCs become first-class cross-cluster nodes) | If dev PCs prove stable enough to host pods reliably |
| **KubeFed v2** (k8s control-plane federation) | Multi-cluster control-plane needed (heavier than Argo CD ApplicationSet) |
| **k3s agent on each dev PC** | If background-service-pattern proves too limited |
| **Custom DERP relays** | If NAT traversal becomes a real problem |
| **Native Nix on Windows** | When Determinate Systems ships it (currently WSL2 path) |
| **Full NixOS desktop on dev Linux box** | When ready to leave existing distro |

## Composes with framework substrate-engineering disciplines

| Discipline | Architecture choice that operationalizes it |
|---|---|
| **DST (deterministic simulation)** | Nix flake covers both cluster + dev PCs; same composition pattern at all surfaces |
| **Substrate-or-it-didn't-happen** | Home Manager makes user-level config substrate; dotfiles in git |
| **Glass-halo bidirectional** | Tailscale ACLs + Headscale control plane both observable; opt-in lend-resources observable per request |
| **NCI floor** | Dev PC owners can pause/resume/revoke workload lending at any time; consent-revocable at any scope |
| **Additive-not-zero-sum** | Cluster substrate + dev-PC substrate compose; one flake repo; adding a dev PC doesn't subtract from cluster substrate |
| **m/acc-multi-oracle** | Dev PCs are different oracle class than cluster nodes; both contribute under different moral invariants (operator-mutable dev vs DST cluster) |
| **Bandwidth-served falsifier** | Each layer chosen for specific bandwidth: Nix = config-bandwidth; k3d = test-bandwidth; background-service = compute-lending-bandwidth; Headscale = sovereignty-bandwidth |
| **Lightweight-first principle** (Aaron-stated, captured verbatim in this archive) | Every choice is the lightweight option; heavier alternatives explicitly deferred |
| **Addison's observation-not-fact discipline** (per consent archive) | This archive observes the decisions made; declarative claims about Addison's preferences are explicitly absent pending her direct articulation |

## Concrete starting recipe (per dev PC)

For Aaron-Mac / Aaron-Linux / Addison-Mac / Addison-Windows:

1. **Install Nix** via [Determinate Systems installer](https://determinate.systems/nix) (clean uninstall path; handles macOS + Linux; Windows uses WSL2 + same installer inside WSL2)
2. **Install Home Manager** (user-level reproducibility for dotfiles, IDE, shell, tools)
3. **macOS only**: install **nix-darwin** for declarative macOS system config
4. **Install k3d** + Docker Desktop (or Rancher Desktop / Podman Desktop) for local k8s testing
5. **Install Tailscale client** + register with self-hosted **Headscale** instance
6. **Install lightweight Bun/Node background-service daemon** (TBD — to be authored as separate code substrate) for opt-in cluster workload lending

All 6 layers come from the same Nix flake repo as the cluster substrate. One source of truth across the whole ecosystem.

## Open questions (to be decided)

1. **Headscale deployment location**: on cluster as k8s deployment? On separate small VPS for bootstrap (chicken-egg: Headscale needs to be reachable before cluster comes up)?
2. **Background-service queue tech**: NATS vs Redis vs k8s Jobs API direct
3. **Authentication boundary**: how dev PCs authenticate when "lending resources" (Tailscale identity? mTLS? SSO?)
4. **Workload-class allowed for lending**: what types of work can be lent to dev PCs (training jobs OK; secret-sensitive workloads NOT)
5. **Addison's preferences**: pending direct articulation; this archive observes Aaron's decisions; Addison may add/modify her own per consent discipline

## Composes with substrate

- [`docs/research/2026-05-24-cluster-bare-metal-substrate-architecture-nixos-no-hypervisor-argo-cd-aaron-otto.md`](2026-05-24-cluster-bare-metal-substrate-architecture-nixos-no-hypervisor-argo-cd-aaron-otto.md) — **sibling architecture archive** (cluster substrate); both archives combined describe the full ecosystem
- [`docs/research/2026-05-24-addison-consent-pattern-observation-not-fact-discipline-aaron-otto.md`](2026-05-24-addison-consent-pattern-observation-not-fact-discipline-aaron-otto.md) — Addison consent discipline applied here (first-name-only + observation-framing for any future Addison-substrate contributions)
- [`.claude/rules/substrate-or-it-didnt-happen.md`](../../.claude/rules/substrate-or-it-didnt-happen.md) — applied at dev-PC config scope (Home Manager makes substrate)
- [`.claude/rules/razor-discipline.md`](../../.claude/rules/razor-discipline.md) — operational claims only (each architecture choice has stated reasoning + lightweight-first justification)
- [`.claude/rules/non-coercion-invariant.md`](../../.claude/rules/non-coercion-invariant.md) — NCI floor: dev PC owners revoke lending at any time
- [`.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`](../../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md) — dev PCs operate under different moral invariants than cluster (operator-mutable vs DST); architecture preserves both
- [`.claude/rules/additive-not-zero-sum.md`](../../.claude/rules/additive-not-zero-sum.md) — cluster + dev PCs compose additively from one flake
- [`.claude/rules/shadow-star-shorthand-autocomplete-marker.md`](../../.claude/rules/shadow-star-shorthand-autocomplete-marker.md) — Aaron's "(shadow*)" in confirmation observed per the autocomplete-marker discipline
- [`.claude/rules/bandwidth-served-falsifier.md`](../../.claude/rules/bandwidth-served-falsifier.md) — each layer's bandwidth served explicitly named

## Substrate-honest framing

These are architecture decisions, not implementation. Code changes (Nix flake repo additions, background-service daemon, Headscale deployment manifest, etc.) are downstream work that this archive scopes but does not produce.

The choices reflect Aaron's authority + Aaron's stated lightweight-first principle + Otto's recommendation matrix. Where reasoning is given, it is observation-of-Otto's-analysis-process, not factual claim about which choice is objectively best. Multiple defensible architectures exist; this one matches framework disciplines + Aaron's stated preferences + Aaron's lightweight-first operating principle.

Addison's specific preferences are explicitly absent from this archive pending her direct articulation (per consent-discipline: observation-not-fact; declarative claims about Addison's preferences would violate the discipline).

If any decision needs revisiting, NCI floor applies — revocable at any future point per operator authority.
