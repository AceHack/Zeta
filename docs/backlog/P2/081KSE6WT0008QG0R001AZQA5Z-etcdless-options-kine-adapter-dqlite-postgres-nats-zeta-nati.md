---
id: 081KSE6WT0008QG0R001AZQA5Z
priority: P2
status: open
title: Etcd-less k8s options — kine adapter family (SQLite/Postgres/MySQL/NATS/Dqlite) + Zeta-native DBSP+Raft endgame
effort: M
ask: aaron 2026-05-25
created: 2026-05-25
last_updated: 2026-05-25
depends_on:
  - 081KSE6WT0008QG0R001NG9JZH
composes_with:
  - 081KRFA460008QG0R0018SN61J
  - 081KSE6WT0008QG0R003D199HE
  - 081KSGS9H0008QG0R002T3BJ2R
  - 081KSE6WT0008QG0R000WVYAJ2
  - 081KSE6WT0008QG0R00063R6HB
  - 081KSE6WT0008QG0R00049EFBD
  - 081KSE6WT0008QG0R003WMG4XV
  - 081KSE6WT0008QG0R0008483B2
tags: [cluster, k8s, etcd, kine, dqlite, postgres, nats, dbsp, consensus, ha]
---

## Problem

Aaron 2026-05-25 mid-iter-3-CI-wait, after the digital-twin
framing (081KSE6WT0008QG0R0008483B2): *"are there etcdless"* — naming a real
substrate question: alternatives to etcd as the k8s control-
plane backing store.

081KSE6WT0008QG0R001NG9JZH HA control-plane assumed k3s embedded etcd as the default
HA path. That's one path; multiple etcd-less paths exist + some
compose better with Zeta substrate (especially 081KSE6WT0008QG0R003WMG4XV fabric +
081KSE6WT0008QG0R0008483B2 digital twin).

## Existing etcd-less options

| Option | Backend | Maturity | Best fit |
|---|---|---|---|
| **microk8s** (Canonical) | **Dqlite** (SQLite + Raft) | Production; widely deployed | Single-binary k8s with built-in HA via Dqlite quorum; Canonical's flagship; well-engineered |
| **k3s + kine + SQLite** | SQLite via [kine](https://github.com/k3s-io/kine) | Production; default for k3s single-node | Single-node lab; no HA via this path |
| **k3s + kine + PostgreSQL** | Postgres (or CockroachDB / Aurora / YugabyteDB / Neon) | Production | HA pushed to DB; works with any PG-compatible distributed DB; operator inherits DB-side quorum |
| **k3s + kine + MySQL** | MySQL / MariaDB | Production | Same shape; less common; HA via Galera/MaxScale/PXC |
| **k3s + kine + NATS JetStream** | NATS JetStream | Production; recent | Mesh-friendly; composes with 081KSE6WT0008QG0R003WMG4XV Reticulum-adjacent thinking |
| **k0s + kine + various** | Same kine options | Production | Mirantis's alternative; same backend options |
| **MicroShift** (Red Hat) | kine + SQLite by default; pluggable | Production; edge-focused | Red Hat's micro-k8s for edge |
| **Zeta-native** (081KSE6WT0008QG0R00049EFBD wave 4) | **DBSP + Raft, retraction-native** | Future endgame | Native etcd-replacement; composes with 081KSE6WT0008QG0R0008483B2 digital twin |

## Why kine is the load-bearing standard interface

[Kine](https://github.com/k3s-io/kine) is an etcd-API shim:
backends translate etcd v3 gRPC calls into native operations.
Per 081KSE6WT0008QG0R00063R6HB ServiceTitan-route, kine IS the existing standard
interface that abstracts the etcd-or-not choice:

- Operator writes k8s manifests as normal (no change)
- kube-apiserver speaks etcd v3 gRPC (no change)
- kine translates calls to the chosen backend (SQLite / PG /
  MySQL / NATS / Dqlite / DBSP / ...)
- Backend choice becomes a deployment-time decision, not an
  application-code decision

This is the pattern Zeta wants: **kine is the interface; the
backend is swappable**. Aligns perfectly with 081KSE6WT0008QG0R000WVYAJ2
operator-in-the-negotiation-high-seat — kine puts the operator
in the seat for control-plane backing store; vendors / backends
compete underneath; operator swaps via kine config.

## Per-backend-choice trade-offs (concrete)

| Backend | HA story | Perf | Operational complexity | Composes with Zeta substrate |
|---|---|---|---|---|
| **etcd** (081KSE6WT0008QG0R001NG9JZH default) | k3s embedded etcd with Raft quorum (3/5/7 nodes) | Excellent | Medium (etcd needs careful tuning at scale) | Standard; no special composition |
| **Dqlite** (microk8s) | Built-in Raft quorum; no separate cluster needed | Good for small-to-medium | Low (Canonical packages it cleanly) | Bridge possible but not native to Zeta |
| **PostgreSQL** (via kine) | HA via PG-compatible distributed DB (CockroachDB / YugabyteDB / Aurora-Limitless) | Good (PG indexes are mature) | Medium-high (operator runs another DB cluster) | Native: per 081KSE6WT0008QG0R000WVYAJ2 vendor-swap, the DB itself is swappable; per 081KSE6WT0008QG0R0008483B2, twin events can live in same PG cluster as control plane |
| **NATS JetStream** (via kine) | Built-in JetStream replication (Raft-based) | Excellent for write-heavy | Medium | **Excellent native fit**: NATS subjects ARE Rx-Observable-shaped; per 081KSE6WT0008QG0R003WMG4XV fabric, the control plane is just another Observable stream. Composes with Reticulum-mesh-adjacent thinking. |
| **DBSP + Raft** (Zeta-native, 081KSE6WT0008QG0R00049EFBD wave 4) | Raft quorum on Zeta-native consensus engine; DBSP retraction-native semantics | Highest (algebra-grounded) | Lowest once shipped (substrate-native) | **Best native fit**: control-plane state = twin state per 081KSE6WT0008QG0R0008483B2; cluster operations are first-class DBSP events; ARC-AGI benchmark (081KSE6WT0008QG0R0015ZF2G6) can include consensus-store quality as a scoring dimension |

## Target

Document + ship **kine-as-the-interface** for Zeta cluster
control-plane backing store. Operators choose backend per:

- Single-node lab: kine + SQLite (current k3s default)
- Small cluster (3-7 nodes): kine + Dqlite OR k3s embedded etcd
- Medium cluster (10-50 nodes): kine + PostgreSQL (CockroachDB
  recommended for HA without additional ops)
- Workload-heavy / mesh-native: kine + NATS JetStream
- Zeta-native target (future): kine + Zeta DBSP backend (per
  081KSE6WT0008QG0R00049EFBD wave 4)

## Acceptance

- [ ] Document kine-as-interface in
      `docs/cluster-control-plane-backing-store.md`: per-
      backend trade-offs, recommended choices per cluster size
- [ ] Update 081KSE6WT0008QG0R001NG9JZH HA control-plane row to reference kine
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
- [ ] Zeta-first-boot role keystroke prompt (081KSGS9H0008QG0R002T3BJ2R) extended
      to include backing-store choice for control-plane role:
      'a' SQLite (lab), 's' Dqlite (small HA), 'p' Postgres,
      'n' NATS JetStream, 'e' embedded etcd (default for
      compatibility)
- [ ] Auto-discovery (081KSE6WT0008QG0R000CV98PV) advertises chosen backing store
      per cluster; subsequent nodes joining the same cluster
      use the same store
- [ ] Per-backend migration path: documented + tested for each
      pairwise transition (operator can swap backing store at
      operator-driven cadence; not stranded on initial choice)
- [ ] DBSP backend research spike (per 081KSE6WT0008QG0R00049EFBD wave 4): does
      kine support pluggable backends easily enough that Zeta
      could write `kine-zeta-dbsp` as a fork OR contribute the
      backend upstream? Initial answer based on kine's
      pluggability docs + Frank McSherry's DBSP substrate

## Composes with substrate

- 081KRFA460008QG0R0018SN61J — F# fork for AI safety (the substrate base for
  future Zeta-native DBSP backing store)
- 081KSE6WT0008QG0R003D199HE — git-native per-machine state (each backend choice
  is per-machine config; declarative + GitOps-reconciled)
- 081KSGS9H0008QG0R002T3BJ2R — zero-typing first-boot (backing-store choice
  added to keystroke prompt for control-plane role)
- 081KSE6WT0008QG0R001NG9JZH — HA control-plane (this row sharpens — etcd-less
  options are alternative HA paths, not parallel scope)
- 081KSE6WT0008QG0R000WVYAJ2 — cloud-native plugins fit Zeta interfaces (kine IS
  the operator-facing interface; backends are swappable
  vendors)
- 081KSE6WT0008QG0R00063R6HB — ServiceTitan route (kine IS the existing standard
  interface Zeta plugs into; per the playbook)
- 081KSE6WT0008QG0R00049EFBD — slow-replace k8s (Zeta-native DBSP backing store
  is wave 4 control-plane territory)
- 081KSE6WT0008QG0R0016CEE2Z — Zeta-native scheduler (composes naturally with
  any kine backend; scheduler subscribes via kube-apiserver
  watch which is etcd-API agnostic per kine)
- 081KSE6WT0008QG0R003WMG4XV — observable+controllable cluster fabric (control-
  plane events are first-class Observables regardless of
  backing store; kine bridges)
- 081KSE6WT0008QG0R0008483B2 — cluster as digital twin (control-plane state IS
  twin state; backing store choice = twin storage choice;
  per 081KSE6WT0008QG0R0008483B2 'and/or' framing, operator picks proportion
  per stream class)

## Why NATS JetStream is particularly interesting for Zeta

Worth calling out separately. NATS JetStream as kine backend
composes with:

- 081KSE6WT0008QG0R003WMG4XV Rx Observable fabric: NATS subjects ARE Observable-
  shaped natively; the control plane becomes just another
  stream operators can subscribe to via Rx
- 081KR2E4K0008QG0R001SWEPNV / Reticulum mesh: NATS leaf-node + Reticulum bridge
  could deliver control-plane events over mesh transport
  (radio-fallback, federated clusters, edge sites)
- 081KSE6WT0008QG0R0008483B2 digital twin: NATS streams are event-store-native by
  design; using NATS for control plane means the twin's
  control-plane substrate is event-sourced from day 1
- 081KSE6WT0008QG0R003FG3E8R telemetry: NATS has built-in subject hierarchy that
  composes with telemetry envelope routing

Recommendation: NATS JetStream is the preferred etcd-less
backend for Zeta substrate alignment, UNTIL Zeta-native DBSP
backend ships per 081KSE6WT0008QG0R00049EFBD wave 4.

## What this preserves

The 081KSE6WT0008QG0R001NG9JZH HA control-plane row's existing path (k3s embedded
etcd) stays valid + remains the safest default for operators
who want zero deviation from upstream k8s patterns. This row
ADDS etcd-less options; doesn't deprecate etcd.

Operator choice is preserved:

| Operator profile | Recommendation |
|---|---|
| First-time, single-node lab | k3s + kine + SQLite (current default) |
| Small HA cluster (3-7 nodes), prefers upstream defaults | k3s embedded etcd (081KSE6WT0008QG0R001NG9JZH) |
| Small HA cluster, prefers single-binary | microk8s + Dqlite |
| Medium cluster, has DB ops capacity | k3s + kine + Postgres (CockroachDB for HA) |
| Workload-heavy / mesh-native / future Zeta substrate | k3s + kine + NATS JetStream |
| Future Zeta-native | k3s + kine + Zeta DBSP backend (081KSE6WT0008QG0R00049EFBD wave 4) |

## Out of scope

- Implementing the Zeta DBSP backend — that's 081KSE6WT0008QG0R00049EFBD wave 4;
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
etcdless"* after the digital-twin framing (081KSE6WT0008QG0R0008483B2). Real
substrate question: etcd-less options exist (microk8s+Dqlite;
kine adapter family); each composes differently with Zeta
substrate; some (NATS JetStream particularly) align well with
Zeta's observable fabric (081KSE6WT0008QG0R003WMG4XV) + digital twin (081KSE6WT0008QG0R0008483B2);
Zeta-native DBSP backend is the long-game endgame (081KSE6WT0008QG0R00049EFBD wave
4). Sharpens 081KSE6WT0008QG0R001NG9JZH HA control-plane row by naming the
backing-store choice as a first-class operator decision rather
than an etcd-only default.
