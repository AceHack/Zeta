# `db` saves git-native — DUs mapped over git as the db control plane

**Aaron, 2026-06-07** (right after the container/cell specificity-gradient cut #6993):

> "but you should be able to use db and it save to git-native too — it maps our DUs over git as well, for our db control plane"

The `db` noun-class is **zeta-native at the semantics layer** (DBSP / Z-set / CRDT), but its
**persistence and control plane is git-native**. The two interfaces *compose*: `db` (zeta-specific) runs
*over* `git` (git-specific). The specificity gradient (#6993) isn't just a classification — **interfaces
stack: a zeta-native noun persists through an external-standard seam.**

## The claim

```
db   write  user:42        # zeta-native verb/noun (DBSP/CRDT semantics) …
git  commit user:42        # … lands as a git-native DU (commit = event)
db   read   user:42        # state = fold over the git-stored DU stream
```

- **The DUs map over git.** Our discriminated-union deltas — the command/delta/saga cases
  (`insert | update | retract | …`, `DeltaLog`/`DeltaCodec`/`Command`/`DurableSaga`) — are **serialized
  as git objects/commits**. A git commit *is* a DU event. The db's current state = a **fold over the git
  commit stream** (git-as-event-store).
- **git is the db control plane.** Schema, migrations (`SchemaEvolution`/`SchemaRegistry`), consensus
  (the Loom weave-layer), and the reconcile loop all live in git. This is the k8s analogy Aaron drew:
  *"this is similar to k8s and operators too, but we don't need operators with our CRDT and single repo
  — that's our DUs."* git + CRDT-merge replaces the operator/control-plane machinery: **reconcile = fold
  git → desired state**, no external controller.
- **Why it's safe to fold:** the merge is **idempotent** (discipline #6) and **CRDT-convergent** — G-Set
  / Z-set union, content-addressed, order-independent (the "zip over two CRDTs from two ways; they may
  see things in different order but we have proofs they converge" — #6993 cells/hosts as different git
  repos). So replay / redelivery / partial fold all land on the same state (DST, manifesto §7).

## Why this is exactly the founding why

Event-sourcing-over-git is the **origin pattern** (Amara: event sourcing was already the answer to
losing state at max-length — `zeta-origin-event-sourcing-plan-…`). "commit therefore I am is just a
query" (#6957): identity/state = a query (fold) over the commit log. The `db` interface makes that
literal — **the database IS the git history, folded.** git supplies durability, content-addressing,
merge, history, and distribution *for free*; the DU layer supplies the semantics; the fold supplies the
current state.

## The composition rule (the general shape)

A **zeta-native noun-class (db) ⊕ an external-standard seam (git)**:

- `db` owns the **semantics** (what a write *means*: a Z-set delta, a saga step, a CRDT merge).
- `git` owns the **substrate** (how it *persists*: commit = event, history = log, merge = reconcile).
- The **DU is the bridge**: the same discriminated union that the db reasons over is the thing
  serialized to git. One representation, two interfaces reading it.
- This generalizes #6993: interfaces don't just *sit* on the gradient, they **compose across it** — the
  zeta-native end leans on the external-standard end for substrate. (Likewise `cell` could persist
  git-native; `research:*` pointers already do.)

## Honest scope (peel)

- **Largely already built, named here as a composition.** The pieces exist: `DeltaLog`, `DeltaCodec`,
  `DiskDeltaLog`, `Command`, `DurableSaga`, `SchemaEvolution`/`SchemaRegistry`, the CRDT/G-Set merge,
  the git-as-event-store fold. What this capture *names* is the explicit `db`-over-`git` interface
  composition and "git = the db control plane" framing. The additive next step is small: a `db`
  noun-class in `ZetaCli` whose write verb projects to a git-native DU commit, sharing `dependson`.
- **Not claiming a finished git-backed db engine.** The fold + idempotent-merge guarantees are the load-
  bearing correctness story; a production git-storage backend is its own work.
- **Reference-not-copy / no-binary still hold:** DU events serialize as text (DeltaCodec; no-binary-in-
  proof-lineage), diffable in `git`.

## Anchors (Beacon)

- **Event sourcing / CQRS** (Fowler; Young) — state = fold over an event log.
- **git as a database / Merkle DAG** (Torvalds; Dolt, Irmin as prior art for git-native databases).
- **DBSP** (Budiu et al. 2022) — incremental view maintenance over deltas (the Z-set DU semantics).
- **CRDTs** (Shapiro et al. 2011) — idempotent, convergent merge (why the fold is safe under reorder).
- **Kubernetes reconcile / desired-state control plane** — the analogy Aaron drew (git+CRDT replaces
  operators).
- Internal: #6993 (specificity gradient — this is composition across it), #6957 ("commit therefore I
  am is a query"), `zeta-origin-event-sourcing-plan-…` (the founding why), Loom #6980 (consensus weave =
  the control plane), manifesto §7 DST / §8 DV2.0, idempotency discipline #6.
