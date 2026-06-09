# Zeta doesn't need Rust's borrow checker: F# immutability gives aliasing for free; ALL mutation goes through single-writer / CRDT / CAS / consensus — pluggable in MUMPS like crypto

**Register:** [grounded] correction (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Refines the "honest limits" of the mumps-DI / Rust-lifetimes doc.

## Aaron's words

> "i think in f# you get aliasing for free cause of the immutability, and all our mut will
> be either single partition so agent-owned, or CRDT, our qubit RX query/pair observed to
> reduce uncertainty of private observations, or CAS, or paxos/raft, or BFT. our db stored
> procs are DynamicValue and SoftValue via the yin-yang cell. we can have consensus as a
> plugin like crypto in mumps."

## The correction: the borrow-checker concern mostly doesn't apply to us

The mumps-DI doc cautioned that brand/rank-2 types give region/escape safety but **not**
Rust's full borrow checker (no aliasing/mutation tracking). Aaron's point: **we don't need
that part** — for two reasons.

### 1. F# immutability ⇒ aliasing is free/safe

Rust's borrow checker exists to enforce **aliasing XOR mutation** (you can share *or* mutate,
not both) — to prevent data races on shared mutable state. **F# is immutable by default**, so
**aliasing is safe for free**: you can share an immutable value arbitrarily; there is no
mutation to race. The whole class of bugs the borrow checker prevents **doesn't arise** on
immutable data. So most of Zeta's substrate (DynamicValue/SoftValue values, the mumps tree
read frame-relative) needs no borrow checking at all.

### 2. ALL mutation is channeled through a small set of safe disciplines

Where mutation *does* happen, it never uses uncontrolled shared mutable state — it goes
through **one of**:

- **single-partition / agent-owned** — single-writer per partition (the writer-actor /
  clone-per-writer model); one writer ⇒ no aliasing race by construction;
- **CRDT** — conflict-free, commutative/idempotent merge (no coordination needed; `Crdt.fs`);
- **RX-observed query/pair** ("qubit") — a reactive observed pair that **reduces uncertainty
  of private observations** (DBSP/RX incremental observation; measurement collapses to a
  definite value);
- **CAS** — lock-free compare-and-swap (atomic, no lock);
- **Paxos / Raft** — strong-consistency consensus when a single order is required;
- **BFT** — Byzantine-fault-tolerant consensus when participants may be adversarial.

Each is a **safe mutation mechanism** — none permits the aliased-mutable-shared-state that
the borrow checker guards against. The mutation discipline is enforced *architecturally*,
not by a borrow checker.

### 3. Consensus as a pluggable PORT in mumps (like crypto)

Crucially, these are not hard-wired: **consensus is a plugin** — the same ports-and-adapters
shape as the crypto port (Itron `ICryptoPlugin` / Zeta `ICrypto`). An `IConsensus`/`IMerge`
port in mumps, with **single-writer / CRDT / CAS / Paxos / Raft / BFT as swappable adapters**,
chosen per global / per cell by its needs. (DB stored procs are **DynamicValue + SoftValue via
the yin-yang cell** — what-acts/what-remains — so the consensus adapter is selected at the cell
boundary, like crypto.)

## So what the type system is actually for (narrowed + correct)

- **Aliasing/mutation safety** → handled by **immutability + the mutation-discipline plugins**
  (not the type system; not needed from brand/rank-2). Zeta sidesteps the borrow checker by
  **not having the problem** it solves.
- **Scope/region escape** (a scoped value / standby key / expired contract / ended tenure must
  not be used out of its lifetime) → *this* is where the **brand + rank-2 ST + lightweight-HKT**
  lifetime simulation earns its keep. That's a *different* guarantee than borrow-checking, and
  the one worth the ergonomic cost.

So the corrected stance: **Zeta gets borrow-checker-grade safety without the borrow checker** —
immutability + single-writer/CRDT/CAS/consensus(-as-plugin) for aliasing/mutation, and brand/
rank-2 types only for lifetime/region escape. Stronger and simpler than trying to port Rust's
model into .NET.

## This composes with the six always-active disciplines

- **lock-free / wait-free** — CAS / CRDT / single-writer are exactly the lock-free toolkit.
- **scale-free** — single-writer partitions + CRDT scale 1→N with no special case.
- **DST** — every mechanism is deterministic-replayable (consensus included, seeded).
- **idempotency** — CRDT merge + CAS + upsert are idempotent by construction.
  (See `dv2-data-split-discipline-activated`.)

## Honest scope / handoff

Refinement, no code. Updates the mumps-DI doc's honest-limits. Routes to Ilyana (type design:
don't reach for affine/linear types we don't need) + Soraya/Sova (the mutation-discipline +
consensus-plugin are formalizable: single-writer/CRDT/CAS/Paxos/Raft/BFT each with their
safety property) + the F# core (`Crdt.fs`, `Consensus.fs`, the yin-yang cell).

## Anchors / ties

F# immutability (aliasing-free); Rust borrow checker = aliasing XOR mutation (what we *don't*
need); CRDTs (Shapiro et al.); single-writer (LMAX Disruptor / actor model / clone-per-writer
routing); CAS / lock-free; Paxos (Lamport) / Raft (Ongaro–Ousterhout) / **PBFT** (Castro–Liskov);
DBSP/RX observed query-pair (uncertainty reduction); DynamicValue/SoftValue + yin-yang cell;
consensus-as-plugin (ports-and-adapters, like the crypto plugin); the six always-active
disciplines (lock-free/scale-free/DST/idempotency); the mumps-DI / brand-rank-2-lifetime doc.
