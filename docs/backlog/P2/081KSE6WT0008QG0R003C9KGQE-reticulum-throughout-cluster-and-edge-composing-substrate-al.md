---
id: 081KSE6WT0008QG0R003C9KGQE
priority: P2
status: open
title: "Reticulum throughout — cluster nodes AND edge devices on the same mesh; K8s and Reticulum compose as layers rather than partition by network tier"
created: 2026-05-25
last_updated: 2026-05-25
classification: research-then-buildable
decomposition: needs-design-pass
type: cluster-architecture
discovered_by: aaron
owners: [aaron, maintainer]
composes_with:
  - docs/backlog/P1/081KR2E4K0008QG0R001SWEPNV-green-lantern-hardware-spec-2026-05-08.md
  - full-ai-cluster/k8s/applications/cilium/
  - full-ai-cluster/k8s/applications/spire/
  - full-ai-cluster/k8s/applications/hat-system/
---

# 081KSE6WT0008QG0R003C9KGQE — Reticulum throughout (cluster + edge as one mesh)

## Carved blade

> K8s and Reticulum compose as layers, not partition by network tier. Cluster nodes speak Reticulum natively alongside their K8s identity. Every workload addressable via both: Cilium for intra-cluster, Reticulum for cross-substrate. Identity-routing is fungible across physical layers (TCP / LoRa / packet-radio / serial). Edge devices speak the same mesh; no gateway boundary.

## Origin

Aaron 2026-05-25, during the 081KSE6WT0008QG0R002T0BFN4 polyglot-accelerator + edge-FPGA conversation:

> *"i want to push fpgas at the edge but i'm not sure k8s is the right iot shape"*

Then sharpening the answer when I sketched a K8s-in-cluster + Reticulum-past-gateway hybrid:

> *"i'm thinking it will require reticiulum at the edge and in cluster"*

That's the load-bearing distinction. Not K8s up-to-the-edge-then-Reticulum-past — Reticulum is in the cluster too, as a composing substrate that operates at a different layer than Cilium / K8s networking.

Composes with 081KR2E4K0008QG0R001SWEPNV (Green Lantern hardware spec — Reticulum mesh for $10-microcontroller-class edge devices) which is already in-progress on main. This row generalizes Reticulum from "edge-device transport" to "cluster + edge mesh substrate."

## The layered substrate

| Layer | Owner | Purpose | Identity |
|-------|-------|---------|----------|
| Pod-to-pod, Service, NetworkPolicy | Cilium / K8s | Intra-cluster networking; high-throughput; mTLS via SPIRE | K8s ServiceAccount + SPIRE SVID |
| Cross-substrate routing | Reticulum | Identity-based addressing across physical layers; survives heterogeneous networks; works on tiny devices | Reticulum cryptographic identity (Ed25519) |
| Physical | Ethernet, WiFi, LoRa, packet-radio, serial, USB | Whatever moves bits | (transparent) |

The key claim: a pod can be addressed BOTH via its K8s Service (Cilium handles routing within the cluster) AND via its Reticulum destination (Reticulum handles routing from any edge device on the mesh). Same workload, two reachability modes. The Reticulum destination doesn't replace the K8s Service — they're orthogonal addressing schemes that compose.

## Why Reticulum specifically

- **Identity-as-address** — no IP / DNS / NAT traversal mess; cryptographic identity IS the address; works across whatever network can carry the bytes
- **Tiny-device-capable** — runs on $10 microcontrollers (RNode firmware); same protocol works on a Raspberry Pi, a Jetson, a cluster node, or a battery-powered sensor
- **Physical-layer agnostic** — TCP over Ethernet for cluster nodes; LoRa for long-range edge; packet-radio for amateur-radio-band substrate; serial for direct-attach; all same Reticulum addressing
- **Intermittent-connectivity tolerant** — store-and-forward semantics; reachable destinations get messages; offline destinations queue
- **Already in framework substrate** — 081KR2E4K0008QG0R001SWEPNV Green Lantern hardware spec, prior research at `docs/research/2026-05-14-b0289-green-lantern-hardware-spec-local-inference.md`, references in `bandwidth-served-falsifier.md` rule + Mika Itron mesh quantum-tunnel substrate (PR #2820 referenced in framework)
- **Web-of-trust identity model** maps cleanly onto multi-oracle BFT pattern (081KS3X9Y0008QG0R00218150M) and the hat-system's quorum-gated authority (PR #4930)

## Operational shape on a cluster node

Each cluster node runs:

```
┌─────────────────────────────────────────────────────────────┐
│ NixOS host                                                  │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ K3S agent +      │  │ rnsd (Reticulum daemon)          │ │
│  │ Cilium / kubelet │  │  - Cluster identity              │ │
│  │  - Pod CIDR      │  │  - Routes for known destinations │ │
│  │  - Service mesh  │  │  - Physical interfaces:          │ │
│  │  - SPIRE SVID    │  │    * TCP (Ethernet, cluster LAN) │ │
│  └──────────────────┘  │    * RNode LoRa (if attached)    │ │
│        │                │    * Packet radio (if attached)  │ │
│        │                └──────────────────────────────────┘ │
│        │                          │                          │
│  ┌─────▼────────────────────────▼────┐                       │
│  │ Workload pod                       │                       │
│  │  - K8s identity (SVID)             │                       │
│  │  - Reticulum identity (sidecar     │                       │
│  │    or shared via UDS)              │                       │
│  │  - Reachable both ways             │                       │
│  └────────────────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

The pod-to-Reticulum binding can be:

- **Sidecar pattern** — each pod gets a Reticulum sidecar container that exposes a Unix-domain-socket the app talks to; sidecar handles all Reticulum protocol mechanics
- **Per-node daemon + per-pod identity** — `rnsd` on the node; each pod requests an identity via DaemonSet API; identity issued by SPIRE-equivalent for Reticulum
- **Init container** — generates / loads identity at pod start; app uses Reticulum client library directly

Probably the sidecar pattern for v1 (matches the SPIRE Agent / Vault Agent sidecar shape; familiar to K8s operators).

## What this enables that pure K8s doesn't

- **Cluster-to-edge messaging that survives network changes** — a pod sends to a Reticulum destination; the message reaches the destination regardless of whether the edge device is on WiFi, LoRa, or just plugged in via serial
- **Edge-to-cluster without IP** — an ESP32 with RNode firmware sends to a cluster pod via LoRa; gateway node forwards; pod receives addressed message; no NAT traversal, no public IP required
- **Cluster-to-cluster mesh** — multiple clusters in different data centers share a Reticulum mesh; cross-cluster traffic routes via Reticulum identity instead of requiring federation gateway YAMLs
- **Resilient identity** — Reticulum identities survive cluster rebuilds; the same workload re-deployed gets the same identity if you preserve its key material
- **Fungible physical layer for the same workload** — the same model server can be reached over Ethernet (full speed), LoRa (low bitrate but works from a field deployment), or serial (debug attached) without code change

## What this DOESN'T replace

- **Cilium service mesh** — still does intra-cluster networking; Cilium's BPF + observability + policy doesn't move to Reticulum
- **SPIRE** — still issues K8s workload identity; Reticulum identity is ADDITIONAL, not substitutive
- **K8s Services / Ingress / Gateway API** — still the way to publish HTTP endpoints
- **Network policy** — Cilium NetworkPolicy still enforces intra-cluster network rules

Reticulum adds a SECOND addressing + transport layer that operates orthogonally.

## Why P2

Bigger architectural decision than 081KSE6WT0008QG0R002T0BFN4 polyglot-accelerator (which is incremental device-plugin additions). Reticulum-throughout affects every workload eventually. Not P1 because:

- First-wave cluster works fine without it (NVIDIA GPUs + Cilium + ArgoCD ship as planned)
- Becomes P1 when the first edge-device deployment needs cluster-mesh reachability (e.g., field-deployed Coral TPU sending inference results back to a cluster pod)
- Composes naturally with 081KR2E4K0008QG0R001SWEPNV Green Lantern (already P1, in-progress) — once Green Lantern hardware is fielded, the cluster needs to receive its traffic, which is what this row enables

## Acceptance (needs design pass)

- [ ] `nixos/modules/reticulum.nix` — installs `rnsd` (the Reticulum daemon) on cluster nodes as a system service; configurable physical-layer enable/disable
- [ ] `nixos/modules/reticulum-interfaces.nix` — per-host physical-layer config (TCP always; LoRa / RNode / packet-radio when hardware attached)
- [ ] `k8s/applications/reticulum/Application.yaml` — cluster-wide Reticulum-related K8s resources (sidecar injection mutation webhook? per-namespace identity issuer? — design pass)
- [ ] Identity-issuance story: how does a pod get its Reticulum identity at start? SPIRE-equivalent for Reticulum?
- [ ] Discovery story: how do workloads find each other's Reticulum destinations? Annotation on Services? DNS extension? Reticulum's own announce mechanism?
- [ ] Composition with hat-system: do hats carry Reticulum destinations? (Probably yes — a hat-wearer can be addressed via the hat's Reticulum destination, succession carries the destination forward)
- [ ] Composition with NCI: Reticulum identity is consent-gated for incoming messages (each destination decides who can address it); NCI floor at protocol layer
- [ ] Cilium + Reticulum coexistence: does `rnsd` need any special CNI config? (probably not — it runs on the node, uses host-network)
- [ ] First end-to-end test: a pod sends a message to a Reticulum destination representing another pod on a different node; trace the path via both Cilium logs (Hubble) and Reticulum logs

## Composition with shipped substrate

- **081KR2E4K0008QG0R001SWEPNV Green Lantern** — already specifies Reticulum at the edge; this row extends it into the cluster
- **PR #4930 hat-system** — hats can carry Reticulum destinations; succession + cooldown + quorum apply
- **SPIRE** — identity issuer pattern carries over; possible "SPIRE-for-Reticulum" sidecar
- **Cilium / Hubble** — observable cluster-internal flow; Reticulum flows observable via its own log + NATS publish
- **NATS** — Reticulum tick stream can publish to the same NATS bus the hat-system uses
- **081KSE6WT0008QG0R002T0BFN4** polyglot-accelerator — Reticulum is THE answer for "how does a Coral TPU at the edge address a cluster pod"

## Composition with framework rules

- **`non-coercion-invariant.md` HC-8** — Reticulum's destination model bakes in consent (each destination accepts or rejects incoming); NCI floor at protocol layer
- **`tonal-momentum-equals-meme-emergent-harmonic-coercion.md`** — multi-substrate addressability composes with multi-oracle BFT pattern from 081KS3X9Y0008QG0R00218150M
- **`m-acc-multi-oracle-end-user-moral-invariants.md`** — multi-oracle substrate at the addressing layer; no single naming authority

## Open questions for the design pass

1. **Reticulum identity provisioning** — manual via SPIRE-equivalent? K8s admission webhook injects sidecar with fresh identity? Bootstrap from a "Reticulum CA" that's a daemon on each node?
2. **Reticulum destination = K8s Service?** — bidirectional Service-to-destination mapping via a controller, or explicit per-workload annotations?
3. **Cluster ↔ cluster federation** — does a multi-cluster setup share one Reticulum mesh or have one mesh per cluster with bridges?
4. **Physical-layer per-node config** — `zeta.reticulum.interfaces = [tcp lora rnode-serial]` as a NixOS module option?
5. **Hat-bound Reticulum destinations** — when a hat changes wearer (succession), does the Reticulum identity transfer to the new wearer or get re-issued? (Probably re-issued; identity continuity stays with the hat-as-role, not the wearer — matches the hat-not-cage discipline)
6. **NATS-as-bridge** — could the cluster's NATS bus be exposed as a Reticulum destination, letting edge devices publish into it? (probably yes; clean composition)

## Estimated scope

- ~2-4 weeks of substrate work once design pass converges
- ~1500-3000 lines (NixOS modules, Helm chart, sidecar implementation, identity-issuance daemon, observability glue)
- Best owned by Aaron (or a future maintainer with strong networking + crypto + K8s background)

## References

- Reticulum Network Stack: https://reticulum.network/
- Reticulum manual: https://markqvist.github.io/Reticulum/manual/
- RNode firmware (cheap LoRa hardware): https://unsigned.io/rnode/
- 081KR2E4K0008QG0R001SWEPNV Green Lantern Hardware Spec: `docs/backlog/P1/081KR2E4K0008QG0R001SWEPNV-green-lantern-hardware-spec-2026-05-08.md`
- Itron mesh quantum-tunnel mapping (Reticulum-class substrate at planet scale; framework reference PR #2820)
- Reticulum + Meshtastic + LoRaWAN comparison: https://reticulum.network/start.html

## Bigger picture: 4-tier federated topology

Aaron 2026-05-25, expanding the picture: *"imagine cloud/hub clusters then community clusters then home/business clusers then edge nodes with routing for weaker edge nodes"*.

This row covers **one cluster + its edge**; the 4-tier federation across cluster classes is its own design problem and lives in **081KSE6WT0008QG0R0006HKTXJ** (filed as a sibling). Brief shape:

| Tier | Examples | Resource profile | Role |
|------|----------|------------------|------|
| Cloud / hub | AWS / GCP / own datacenter | Full GPU fleet, fast internal network | Heavy training, archival, cross-region authority |
| Community | Shared regional infra (multi-owner) | Mid-size, spare capacity from members | Burst inference, shared models, regional aggregation |
| Home / business | The boxes Aaron is provisioning tonight | 2-NVMe + GPU + maybe Coral / NCS | Owner-controlled inference, family / SMB workloads |
| Edge | Pi / Jetson / NUC in field | Single device, accelerator-equipped | Real-time inference, sensor aggregation, leaf-routing |
| (Leaf) | Microcontrollers, RNode-class | $10-50 hardware, intermittent, battery | Pure data source / actuator; ride on stronger edge for routing |

Reticulum-throughout (this row) is what makes tier-to-tier traffic work without per-pair network engineering — each cluster announces destinations on the shared mesh; routing is identity-based; physical layer between tiers is fungible. 081KSE6WT0008QG0R0006HKTXJ covers the workload-placement / trust / federation policy concerns; this row covers the protocol substrate that makes them possible.

## Substrate-honest framing

This is a real architectural decision Aaron is converging on; not a speculation. The framework already has Reticulum substrate at the edge (081KR2E4K0008QG0R001SWEPNV); this row generalizes it to "Reticulum throughout the cluster too" because Aaron's K8s-fit observation revealed that partitioning by network tier (K8s in cluster, Reticulum past gateway) is the wrong cut. The right cut is by LAYER (K8s for intra-cluster networking, Reticulum for cross-substrate identity-routing), with both running everywhere.

Becomes operationally load-bearing when the first cluster ↔ edge deployment happens. Probably aligns with the Green Lantern hardware fielding timeline.
