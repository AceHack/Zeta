---
id: B-0774
priority: P2
status: open
title: Etcd-less k8s options — kine adapter family (SQLite/Postgres/MySQL/NATS/Dqlite) + Zeta-native DBSP+Raft endgame
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - B-0756
composes_with:
  - B-0428
  - B-0747
  - B-0754
  - B-0763
  - B-0765
  - B-0766
  - B-0772
  - B-0773
tags: [cluster, k8s, etcd, kine, dqlite, postgres, nats, dbsp, consensus, ha]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, after the digital-twin
framing (B-0773): *"are there etcdless"* — naming a real
substrate question: alternatives to etcd as the k8s control-
plane backing store.

B-0756 HA control-plane assumed k3s embedded etcd as the default
HA path. That's one path; multiple etcd-less paths exist + some
compose better with Zeta substrate (especially B-0772 fabric +
B-0773 digital twin).

## Existing etcd-less options

| Option | Backend | Maturity | Best fit |
|---|---|---|---|
| **microk8s** (Canonical) | **Dqlite** (SQLite + Raft) | Production; widely deployed | Single-binary k8s with built-in HA via Dqlite quorum; Canonical's flagship; well-engineered |
| **k3s + kine + SQLite** | SQLite via [kine](https://github.com/k3s-io/kine) | Production; default for k3s single-node | Single-node lab; no HA via this path |
| **k3s + kine + PostgreSQL** | Postgres (or CockroachDB / Aurora / YugabyteDB / Neon) | Production | HA pushed to DB; works with any PG-compatible distributed DB; operator inherits DB-side quorum |
| **k3s + kine + MySQL** | MySQL / MariaDB | Production | Same shape; less common; HA via Galera/MaxScale/PXC |
| **k3s + kine + NATS JetStream** | NATS JetStream | Production; recent | Mesh-friendly; composes with B-0772 Reticulum-adjacent thinking |
| **k0s + kine + various** | Same kine options | Production | Mirantis's alternative; same backend options |
| **MicroShift** (Red Hat) | kine + SQLite by default; pluggable | Production; edge-focused | Red Hat's micro-k8s for edge |
| **Zeta-native** (B-0766 wave 4) | **DBSP + Raft, retraction-native** | Future endgame | Native etcd-replacement; composes with B-0773 digital twin |

## Why kine is the load-bearing standard interface

[Kine](https://github.com/k3s-io/kine) is an etcd-API shim:
backends translate etcd v3 gRPC calls into native operations.
Per B-0765 ServiceTitan-route, kine IS the existing standard
interface that abstracts the etcd-or-not choice:

- Operator writes k8s manifests as normal (no change)
- kube-apiserver speaks etcd v3 gRPC (no change)
- kine translates calls to the chosen backend (SQLite / PG /
  MySQL / NATS / Dqlite / DBSP / ...)
- Backend choice becomes a deployment-time decision, not an
  application-code decision

This is the pattern Zeta wants: **kine is the interface; the
backend is swappable**. Aligns perfectly with B-0763
operator-in-the-negotiation-high-seat — kine puts the operator
in the seat for control-plane backing store; vendors / backends
compete underneath; operator swaps via kine config.

## Per-backend-choice trade-offs (concrete)

| Backend | HA story | Perf | Operational complexity | Composes with Zeta substrate |
|---|---|---|---|---|
| **etcd** (B-0756 default) | k3s embedded etcd with Raft quorum (3/5/7 nodes) | Excellent | Medium (etcd needs careful tuning at scale) | Standard; no special composition |
| **Dqlite** (microk8s) | Built-in Raft quorum; no separate cluster needed | Good for small-to-medium | Low (Canonical packages it cleanly) | Bridge possible but not native to Zeta |
| **PostgreSQL** (via kine) | HA via PG-compatible distributed DB (CockroachDB / YugabyteDB / Aurora-Limitless) | Good (PG indexes are mature) | Medium-high (operator runs another DB cluster) | Native: per B-0763 vendor-swap, the DB itself is swappable; per B-0773, twin events can live in same PG cluster as control plane |
| **NATS JetStream** (via kine) | Built-in JetStream replication (Raft-based) | Excellent for write-heavy | Medium | **Excellent native fit**: NATS subjects ARE Rx-Observable-shaped; per B-0772 fabric, the control plane is just another Observable stream. Composes with Reticulum-mesh-adjacent thinking. |
| **DBSP + Raft** (Zeta-native, B-0766 wave 4) | Raft quorum on Zeta-native consensus engine; DBSP retraction-native semantics | Highest (algebra-grounded) | Lowest once shipped (substrate-native) | **Best native fit**: control-plane state = twin state per B-0773; cluster operations are first-class DBSP events; ARC-AGI benchmark (B-0761) can include consensus-store quality as a scoring dimension |

## Target

Document + ship **kine-as-the-interface** for Zeta cluster
control-plane backing store. Operators choose backend per:

- Single-node lab: kine + SQLite (current k3s default)
- Small cluster (3-7 nodes): kine + Dqlite OR k3s embedded etcd
- Medium cluster (10-50 nodes): kine + PostgreSQL (CockroachDB
  recommended for HA without additional ops)
- Workload-heavy / mesh-native: kine + NATS JetStream
- Zeta-native target (future): kine + Zeta DBSP backend (per
  B-0766 wave 4)

## Acceptance

- [ ] Document kine-as-interface in
      `docs/cluster-control-plane-backing-store.md`: per-
      backend trade-offs, recommended choices per cluster size
- [ ] Update B-0756 HA control-plane row to reference kine
      adapter family as the binary-compatible alternative to
      embedded etcd (not a competitor; complementary)
- [ ] Per-backend Zeta substrate:
      - `modules/control-plane-backing-store/sqlite.nix`
        (current default; documented)
      - `modules/control-plane-backing-store/dqlite.nix`
        (microk8s-style)
      - `modules/control-plane-backing-store/postgres.nix`
        (with CockroachDB sub-config)
      - `modules/control-plane-backing-store/nats.nix`
        (JetStream)
- [ ] Zeta-first-boot role keystroke prompt (B-0754) extended
      to include backing-store choice for control-plane role:
      'a' SQLite (lab), 's' Dqlite (small HA), 'p' Postgres,
      'n' NATS JetStream, 'e' embedded etcd (default for
      compatibility)
- [ ] Auto-discovery (B-0757) advertises chosen backing store
      per cluster; subsequent nodes joining the same cluster
      use the same store
- [ ] Per-backend migration path: documented + tested for each
      pairwise transition (operator can swap backing store at
      operator-driven cadence; not stranded on initial choice)
- [ ] DBSP backend research spike (per B-0766 wave 4): does
      kine support pluggable backends easily enough that Zeta
      could write `kine-zeta-dbsp` as a fork OR contribute the
      backend upstream? Initial answer based on kine's
      pluggability docs + Frank McSherry's DBSP substrate

## Composes with substrate

- B-0428 — F# fork for AI safety (the substrate base for
  future Zeta-native DBSP backing store)
- B-0747 — git-native per-machine state (each backend choice
  is per-machine config; declarative + GitOps-reconciled)
- B-0754 — zero-typing first-boot (backing-store choice
  added to keystroke prompt for control-plane role)
- B-0756 — HA control-plane (this row sharpens — etcd-less
  options are alternative HA paths, not parallel scope)
- B-0763 — cloud-native plugins fit Zeta interfaces (kine IS
  the operator-facing interface; backends are swappable
  vendors)
- B-0765 — ServiceTitan route (kine IS the existing standard
  interface Zeta plugs into; per the playbook)
- B-0766 — slow-replace k8s (Zeta-native DBSP backing store
  is wave 4 control-plane territory)
- B-0767 — Zeta-native scheduler (composes naturally with
  any kine backend; scheduler subscribes via kube-apiserver
  watch which is etcd-API agnostic per kine)
- B-0772 — observable+controllable cluster fabric (control-
  plane events are first-class Observables regardless of
  backing store; kine bridges)
- B-0773 — cluster as digital twin (control-plane state IS
  twin state; backing store choice = twin storage choice;
  per B-0773 'and/or' framing, operator picks proportion
  per stream class)

## Why NATS JetStream is particularly interesting for Zeta

Worth calling out separately. NATS JetStream as kine backend
composes with:

- B-0772 Rx Observable fabric: NATS subjects ARE Observable-
  shaped natively; the control plane becomes just another
  stream operators can subscribe to via Rx
- B-0289 / Reticulum mesh: NATS leaf-node + Reticulum bridge
  could deliver control-plane events over mesh transport
  (radio-fallback, federated clusters, edge sites)
- B-0773 digital twin: NATS streams are event-store-native by
  design; using NATS for control plane means the twin's
  control-plane substrate is event-sourced from day 1
- B-0762 telemetry: NATS has built-in subject hierarchy that
  composes with telemetry envelope routing

Recommendation: NATS JetStream is the preferred etcd-less
backend for Zeta substrate alignment, UNTIL Zeta-native DBSP
backend ships per B-0766 wave 4.

## What this preserves

The B-0756 HA control-plane row's existing path (k3s embedded
etcd) stays valid + remains the safest default for operators
who want zero deviation from upstream k8s patterns. This row
ADDS etcd-less options; doesn't deprecate etcd.

Operator choice is preserved:

| Operator profile | Recommendation |
|---|---|
| First-time, single-node lab | k3s + kine + SQLite (current default) |
| Small HA cluster (3-7 nodes), prefers upstream defaults | k3s embedded etcd (B-0756) |
| Small HA cluster, prefers single-binary | microk8s + Dqlite |
| Medium cluster, has DB ops capacity | k3s + kine + Postgres (CockroachDB for HA) |
| Workload-heavy / mesh-native / future Zeta substrate | k3s + kine + NATS JetStream |
| Future Zeta-native | k3s + kine + Zeta DBSP backend (B-0766 wave 4) |

## Out of scope

- Implementing the Zeta DBSP backend — that's B-0766 wave 4;
  this row only references it
- Recommending specific Postgres-compatible distributed DB
  for HA — CockroachDB / Aurora / YugabyteDB / Neon all
  viable; let operator pick based on their existing infra
- Per-backend perf benchmarks — separate sub-row when there's
  empirical comparison data from actual cluster operations
- Migration tooling between backends — separate sub-row;
  documented patterns first; automation later

## Origin

Aaron 2026-05-25 mid-iter-3-CI-wait, asking *"are there
etcdless"* after the digital-twin framing (B-0773). Real
substrate question: etcd-less options exist (microk8s+Dqlite;
kine adapter family); each composes differently with Zeta
substrate; some (NATS JetStream particularly) align well with
Zeta's observable fabric (B-0772) + digital twin (B-0773);
Zeta-native DBSP backend is the long-game endgame (B-0766 wave
4). Sharpens B-0756 HA control-plane row by naming the
backing-store choice as a first-class operator decision rather
than an etcd-only default.
