---
id: 081KSE6WT0008QG0R0006HKTXJ
priority: P3
status: open
title: "Federated peer mesh — 5 resource profiles (cloud/hub, community, home/business, edge, leaf), weight-free routing, NO hierarchy; cloud/hub doesn't hog net neutrality"
created: 2026-05-25
last_updated: 2026-05-25
classification: research-then-design
decomposition: needs-architecture-pass
type: cluster-architecture
discovered_by: aaron
owners: [aaron, maintainer]
composes_with:
  - docs/backlog/P2/081KSE6WT0008QG0R003C9KGQE-reticulum-throughout-cluster-and-edge-composing-substrate-alongside-k8s-2026-05-25.md
  - docs/backlog/P1/081KR2E4K0008QG0R001SWEPNV-green-lantern-hardware-spec-2026-05-08.md
  - full-ai-cluster/k8s/applications/argocd/
  - docs/agentic-organization/
---

# 081KSE6WT0008QG0R0006HKTXJ — Federated peer mesh (5 resource profiles, weight-free routing)

## Carved blade

> Five resource profiles, ONE flat peer mesh. Cloud/hub clusters have MORE RESOURCES but NOT MORE AUTHORITY. Routing is identity-based, not tier-rank-based. Net neutrality is a substrate property enforced at the protocol layer. Stronger nodes route for weaker leaves BY VOLUNTARY CONTRIBUTION, not by hierarchy-mandate. Every peer can refuse to route for any other peer; NCI floor applies to routing too. The framework consciously builds a peer-of-peers AI substrate that vendor-controlled monocultures cannot.

## Origin

Aaron 2026-05-25, sketching the federated topology during the Reticulum-throughout conversation (081KSE6WT0008QG0R003C9KGQE):

> *"imagine cloud/hub clusters then community clusters then home/business clusers then edge nodes with routing for weaker edge nodes"*

Then immediately correcting the hierarchical reading I gave it:

> *"and that's not a hierarchy it's weight free routing cloud/hub nodes don't get to hog net neutrality"*

That's the load-bearing distinction. The framework's `default-to-both.md` + `additive-not-zero-sum.md` + `m-acc-multi-oracle-end-user-moral-invariants.md` + `non-coercion-invariant.md` + the 5-always-active substrate-engineering disciplines (scale-free + lock-free + weight-free + DST + DV2.0) all point at WEIGHT-FREE substrate. A hierarchical routing model would violate this — cloud-tier could censor / throttle / extract from lower tiers. Net neutrality at substrate layer is the discipline.

## The 5 resource profiles (NOT tiers)

Reframing: these are profiles of resource availability + workload affinity, not levels of authority. A peer with cloud-class resources can run more workloads; that does NOT grant it routing privilege over peers with leaf-class resources.

| Profile | Examples | Resource availability | Workload affinity |
|---------|----------|----------------------|-------------------|
| **Cloud / hub** | AWS / GCP / Azure / your-own-DC | Full GPU fleet, fast LAN, multi-region | Heavy training, model registry, cross-region archival |
| **Community** | Shared regional infra; multi-owner co-op | Mid-size; spare capacity contributed | Burst inference, shared models, regional aggregation, civic compute |
| **Home / business** | Owner-controlled (Aaron's tonight) | 2-NVMe + GPU + maybe Coral / NCS | Family / SMB workloads, owner-controlled inference, agent persistence |
| **Edge** | Pi / Jetson / NUC in field | Single device + accelerator | Real-time inference, sensor aggregation, voluntary leaf-routing |
| **Leaf** | Microcontrollers, RNode-class | $10-50 hardware, intermittent, battery | Sensor / actuator; rides voluntary stronger-peer routing; not K8s-class |

## Weight-free routing — the load-bearing property

**No peer has more routing authority than any other peer.** Routing is identity-based: destination announces "I'm reachable via this Reticulum identity"; peers cooperatively forward toward it; the path chosen is whichever physical hop is available. A cloud/hub peer's announcement isn't preferred over a home/business peer's announcement.

**Net neutrality is enforced at the protocol layer**, not by social convention. Reticulum's design supports this natively: routing decisions are local to each hop; no peer can mandate that another peer take a particular path; refusing to forward is always permitted.

**Stronger peers route for weaker leaves BY VOLUNTARY CONTRIBUTION**, not by hierarchy-mandate:

- Edge peer with WiFi + LoRa offers leaf-routing as a service it CHOOSES to provide
- Home cluster offers cluster-LAN-to-Reticulum-mesh bridging as a service it CHOOSES to provide
- Cloud cluster offers global-mesh-aggregation as a service it CHOOSES to provide
- Any peer can REFUSE to route for any other peer; NCI floor applies to routing too

If a cloud peer tried to leverage its resource advantage to throttle or surveil traffic, lower-resource peers can route around it; that's the SUBSTRATE-LEVEL enforcement.

## Composes with the 5 always-active substrate-engineering disciplines

| Discipline | How this row honors it |
|------------|------------------------|
| **Scale-free** | Same protocol at every scale (leaf microcontroller → cloud DC); no per-tier exception in routing protocol |
| **Lock-free** | No global routing-authority lock; every peer makes local routing decisions; no consensus required for forwarding |
| **Weight-free** | THIS IS THE ROW'S CARVED BLADE — resource availability ≠ authority weight; routing is rank-free |
| **DST (deterministic simulation testing)** | Routing decisions are deterministic-per-peer (given identity + observed peers + local policy); reproducible failure modes |
| **DV2.0 (data partition by change rate)** | Hub-satellite partition applies to peer types — peer identity = hub (stable); reachability state = satellite (fast-changing) |

## Composes with framework rules

- **`non-coercion-invariant.md`** — NCI floor applies to routing. No peer can be coerced to forward; no peer's traffic can be coerced through a specific path. Cross-tier traffic is consent-gated end-to-end.
- **`additive-not-zero-sum.md`** — peer contribution to routing is ADDITIVE. Voluntary leaf-routing service makes the mesh richer for all peers; doesn't subtract from anyone.
- **`m-acc-multi-oracle-end-user-moral-invariants.md`** — multi-oracle substrate at the routing layer. Each peer is its own oracle for routing decisions; no single naming or routing authority.
- **`default-to-both.md`** — peers can be BOTH consumers AND providers of routing; same peer can run heavy workloads (cloud-class) AND route leaf traffic (edge-class service). Not either-or.
- **`tonal-momentum-equals-meme-emergent-harmonic-coercion.md`** — peer mesh resists tonal-coercion patterns at routing scope; no peer's social influence translates to routing preference.

## Voluntary-contribution model for stronger-peer routing

The "routing for weaker leaves" pattern Aaron described is voluntary service-offering, not hierarchy-mandate:

**A peer with stronger resources MAY OFFER:**

- LoRa-to-Internet bridging (edge with WiFi + LoRa)
- Cluster-LAN-to-Reticulum-mesh forwarding (home cluster)
- Cross-region aggregation (cloud/hub)
- Store-and-forward for offline peers (any peer with persistent storage)

**Leaves discover available routes by:**

- Reticulum's native peer-announce mechanism (peers advertise their routing services)
- Owner pre-configuration (operator says "use my home cluster as your bridge")
- Web-of-trust traversal (find a peer your peers trust)

**Service-offering peers can withdraw at any time** (per NCI's revocable-consent semantics). Leaves that depended on the route reroute via other peers, fall back to direct addressing, or queue messages until alternative service appears.

**Anti-extractive guarantee** (per the framework's anti-extractive principles): service-offering MUST NOT enable surveillance, censorship, or transit-toll extraction. A peer that's caught violating this loses routing-trust from peers that detect the violation; web-of-trust degrades reputation; isolation is the consequence.

## The Internet analogy (where it composes, where it diverges)

| Internet | This federation |
|----------|-----------------|
| Tier-1 ISPs settle-free peer; tier-2 pay tier-1 for transit | All peers are settle-free; voluntary routing contribution |
| BGP routing tables; per-AS policy | Reticulum announce + per-peer policy |
| DNS root authority (ICANN) | NO root authority — multi-oracle naming |
| HTTPS-as-trust (CA hierarchy) | Cryptographic identity-as-trust (Reticulum / SPIRE-shaped); no CA hierarchy |
| Net neutrality is a regulatory question | Net neutrality is a SUBSTRATE PROPERTY enforced at protocol |
| Tier-1 can effectively control transit | No peer can effectively control transit; weight-free |
| Vendor-controlled at the infrastructure layer | Owner-controlled at every peer |

The Internet's tier-1 model is what this row consciously DOES NOT replicate. The Internet got the routing protocol right (BGP) but the AUTHORITY model wrong (hierarchical tiers + DNS root + CA hierarchy). This federation gets the routing protocol from Reticulum AND keeps the authority weight-free.

## Architectural layers (what each profile peer needs)

| Layer | Cloud/hub | Community | Home/Business | Edge | Leaf |
|-------|-----------|-----------|---------------|------|------|
| K8s control plane | K8s native | K3S / K8s | K3S | K3S (single-node) or none | none |
| Reticulum daemon | Yes (peer announce) | Yes | Yes (per node) | Yes | Native firmware (RNode) |
| Identity issuer | Self-rooted; peers verify via web-of-trust | Same | Same | Same | Optional |
| ArgoCD federation | ApplicationSet across consenting peers | Same | Same | Pulls from upstream peer | N/A |
| Hat-system | Peer-local hat catalog; cross-peer hat-import via consent | Same | Same | Owner-deployed hats | N/A |
| Storage | Longhorn HA + object store | Longhorn shared with consenting members | Longhorn (multi-disk) | Local NVMe or SD | EEPROM / flash |
| Observability | Full stack | Aggregator + shipper | Local + shipper | Lightweight metrics | Batched upload |
| Voluntary routing service | Cross-region aggregation, model registry | Burst inference, civic compute | Family / SMB workload host, sometimes-bridge | LoRa-to-Internet bridge, leaf-routing | None (consumes routing) |

Note: every "Identity issuer" row says **self-rooted; peers verify via web-of-trust**. There is no root CA. No tier has identity-issuance authority over another tier.

## Why P3

Massive architectural scope; needs design pass + first multi-peer deployment to validate. Becomes P2 when first cloud OR community peer joins; P1 when first cross-peer workload runs (e.g., home cluster bursting to cloud for training via voluntary cloud-peer routing).

## Acceptance (architecture pass)

Decomposes into sub-rows once design converges. Starter list (reframed to respect weight-free):

- [ ] Identity + trust document — self-rooted identities per peer; web-of-trust verification; no CA hierarchy; NCI semantics for cross-peer
- [ ] Workload-placement policy — workload expresses peer-affinity AND consent; voluntary peer-acceptance; no compulsory routing
- [ ] ArgoCD federation pattern — ApplicationSet with peer-consent gates; per-peer overlays
- [ ] Hat-system peer-awareness — hats are peer-local; cross-peer hat-import requires consent at both ends
- [ ] Voluntary-routing service model — peers advertise routing services; service-acceptance is local-policy; revocation is always permitted
- [ ] Leaf-routing protocol — leaves discover voluntary routes; fall back gracefully when service withdrawn
- [ ] Anti-extractive guarantee — surveillance / censorship / transit-toll detection; web-of-trust reputation degradation
- [ ] Reference deployments per profile — concrete what-runs-where for cloud / community / home / edge / leaf
- [ ] Net-neutrality-at-substrate test — verify no peer can throttle / surveil / censor traffic that's not addressed to it

## Open questions

1. **Peer identity** — single identity per cluster, or one-per-namespace, or one-per-workload?
2. **Web-of-trust mechanics** — what makes a peer's signature on another peer's identity weighted? Manual? Time-attestation? Quorum?
3. **Voluntary-routing advertising format** — Reticulum's native announce, or layered protocol?
4. **Multi-operator community peer** — governance via hat-system with cross-operator quorum?
5. **Workload encryption at rest at edge** — sensitive data at edge for inference; what's the encryption model?
6. **Leaf-tier identity** — RNode has crypto identity; cheaper microcontrollers don't. Policy for anonymous-leaf trust?
7. **Bridge to non-Reticulum protocols** — gateway pattern for legacy MQTT / HTTP / gRPC consumers?
8. **Cross-peer disaster recovery** — peer lost; can other peers reconstitute state with the lost peer's consent (pre-arranged)?

## References

- Reticulum routing model: https://reticulum.network/manual/networks.html
- Net neutrality (substrate-layer enforcement vs regulatory): contrasts Internet ISP-tier model
- IPFS peer routing (peer-of-peers analogy that DOES respect weight-free): https://docs.ipfs.tech/concepts/dht/
- ActivityPub federation (instance-as-peer, no hierarchy): https://www.w3.org/TR/activitypub/
- 081KSE6WT0008QG0R003C9KGQE Reticulum-throughout (protocol prerequisite)
- 081KR2E4K0008QG0R001SWEPNV Green Lantern (leaf-tier hardware reference)
- PR #4930 hat-system (peer-aware hats target)
- PR #4958 agentic-organization (home-tier Organization layer)
- Framework rules: weight-free + NCI + multi-oracle + additive + default-to-both

## Substrate-honest framing

This row is research-grade architecture, not implementation. The framework is consciously building an Internet-shaped peer-of-peers AI substrate WITHOUT the Internet's tier-1 authority concentration. Filing so the substrate-honest discipline stays visible: net neutrality is a SUBSTRATE PROPERTY, not a social one. Cloud/hub has more resources; cloud/hub does NOT have more authority. Every peer can refuse, route around, or withdraw. NCI floor applies all the way down.

When future decisions arise about cross-cluster federation, this row is the document to consult — and the weight-free property is the load-bearing one to preserve.
