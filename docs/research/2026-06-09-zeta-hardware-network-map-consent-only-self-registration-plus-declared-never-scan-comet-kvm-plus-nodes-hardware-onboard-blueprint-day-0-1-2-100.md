# Zeta hardware network map: a maintained, consent-only inventory (self-registration + declared) — never scan/store-all — covering the GL.iNet Comet KVMs + self-registered nodes; a hardware-onboard blueprint; day 0/1/2/100

*Captured 2026-06-09 from Aaron. A **maintained list of known hardware + IPs over time** — finds the GL.iNet Comet
("cosmos pro") IPs + the self-registered Zeta nodes (via their PR), **never randomly storing all-network-anything or
doing intrusive things**; a **blueprint** to easily add/edit/remove/update/onboard hardware on the local-cluster
path; **always thinking day 0/1/2/100**. Registers: [requirement — Aaron], [principle: consent-only/non-intrusive],
[design], [blueprint + lifecycle].*

## The requirement (Aaron)

A **Zeta hardware network map** that finds the **GL.iNet Comet KVM** IPs ("cosmos pro gl.net") + the **self-
registered Zeta nodes** (via the self-registration PR). *"We never want to randomly store all-network-anything or do
intrusive things, so we keep a list of maintained hardware + IPs over time of hardware we know about, and we make a
blueprint to easily add/edit/remove/update and onboard new hardware if you choose the local-hardware path. We always
think day 0/1/2/100."*

## The principle — consent-only, non-intrusive (the heart of it)

**Map only what *announces itself* or is *explicitly declared* — never scan, never store-all-network.** This is the
Markov-blanket / privacy-is-opacity / repelling-force principle at the network layer (#7221/#7255): you compose with
each device **at its boundary** (its self-registration, its declaration), you **never penetrate** the network with an
nmap/arp sweep that hoovers up everything. Two — and only two — sources of truth:

1. **Self-registration (the node announces itself):** a Zeta node logs **its own IP** when it self-registers
   (`maintainers/<account>/cluster-nodes/node.yaml` gains `network.ip`, #7245). The node is the source; nothing is
   scanned. (Today the manifest logs `network.mac` only — adding `network.ip` is the build front.)
2. **Declaration (the operator adds known hardware):** non-self-registering devices — the **GL.iNet Comet KVMs**,
   switches, the NAS, smart-power — are **explicitly added** to the inventory by the operator via the blueprint.
   Their IPs are *declared*, not discovered.

*(The one-off ARP MAC→IP lookup used to find the live nodes earlier was a transient, consented, MAC-matched probe —
NOT a stored network scan. The persistent map comes only from self-registration + declaration.)*

## What the map covers

| Hardware | Source | In the map |
|---|---|---|
| **Self-registered Zeta nodes** | their own self-registration PR (`node.yaml` + `network.ip`) | hostname, role, hardware, **ip**, maintainer |
| **GL.iNet Comet KVMs** ("cosmos pro") | **declared** (operator adds via blueprint) | model (GL-RM1 / GL-RM1PE), **ip**, the node it controls |
| NAS / UPS / smart-power / switches | declared | type, **ip** (if networked), location/owner |

The map is **git-native** (the manifests ARE the map; the DNS-from-manifests of #7245 is generated from it) and a
**maintained inventory over time** — IPs change rarely, updated via the blueprint when they do.

## The hardware-onboard blueprint (add / edit / remove / update / onboard)

A **`hardware-onboard` skill → blueprint** (Addison's blueprint pattern; sibling of the maintainer-onboard blueprint
#7268), gated on the **local-cluster CYOA branch** (#7253). Easy CRUD over the known-hardware inventory:

- **add** a device (node auto-adds via self-registration; Comet/NAS/etc. via a declared entry);
- **edit / update** an entry (e.g., an IP that changed after an extended power-off);
- **remove** a retired device;
- **onboard** new hardware end-to-end (flash → self-register → declare paired Comet → map updated).

Secure + frictionless, never-passwords-in-prompts (same principle as #7268).

## Always day 0 / 1 / 2 / 100

| Day | Phase | The map + blueprint role |
|---|---|---|
| **0** | design / procure | the hardware-to-buy list (#7238) + the close-over plan; nothing live yet |
| **1** | deploy / bring-up | flash USB → node **self-registers** → map gains the node + its IP; declare its Comet |
| **2** | operate / maintain | the connect/cache/health skill (#7247) reads the map to reach known hosts; blueprint edits IPs/entries; self-heal reconcile |
| **100** | long-horizon / evolve | inventory tracks add/replace/retire over time; federation grows (#7245); eventual repo-split (#7260); the map stays the durable record across hardware generations |

Designing for day 100 now = the map is **append-friendly + editable + git-versioned** (full history of the
hardware fleet over time), not a snapshot.

## Honest scope

[requirement — Aaron]: a maintained hardware+IP network map (Comet KVMs + self-registered nodes); consent-only,
non-intrusive (never scan/store-all); a hardware-onboard blueprint (add/edit/remove/update); day 0/1/2/100.
[principle]: map only self-announced (self-registration) or declared hardware — never penetrate the network
(Markov-blanket / privacy-is-opacity). [design]: git-native inventory (= the manifests, #7245 DNS source); two
sources of truth; the Comet IPs are declared. [build front]: add `network.ip` to self-registration; the
`hardware-onboard` skill→blueprint (local-cluster path); compose with connect/health (#7247) + DNS (#7245). No code
in this doc; the design + the non-intrusive principle + the lifecycle.

## Pointers

- Sources/federation: #7245 (self-registration → DNS → network map; `network.ip` to add) · #7247 (connect/cache/
  health reads the map) · #7238 (hardware-to-buy) · the close-over-hardware / Comet KVM (#7245).
- Principle: privacy-is-opacity (#7221) · the Markov telos (compose at blankets, never penetrate, #7255) · the
  repelling force / NCI (#7235). Blueprint kin: maintainer-onboard (#7268) · Addison's Blueprints (ACHIEVEMENTS).
- Fork/topology: git-native fork-aware trust + one-repo-vs-split (#7260). Anchor: GL.iNet Comet (GL-RM1/GL-RM1PE);
  Day 0/1/2 DevOps lifecycle (+ Aaron's day-100 long-horizon).
