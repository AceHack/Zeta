# Lockfiles assemble incrementally / JIT per timestep — resolution itself is a DU/saga (Aaron, 2026-06-07)

The execution model for the bounded resolve (#6974). Aaron:

> *"then lockfiles incrementally / JIT assemble per timestep — it's a DU or saga."*

## The kernel: resolution RUNS as an incremental, per-timestep saga (not a batch solve)

#6974 said *what* resolution is (a bounded iterative fixpoint over the template ∩ niche intersections). This
says *how it runs*:

- **Incrementally / JIT, per timestep.** The lockfile is **not** computed in one batch upfront. It's **assembled
  just-in-time, one timestep at a time** — fitting the one-step-at-a-time loop (#6965). Each timestep advances
  the resolution (resolve the next node/edge, pin the next version) and emits a delta; the lock accretes (the
  infinite-assembly model, #6975).
- **Resolution itself is a DU / saga (#6959).** Because resolving has steps, can stall, conflict, or partially
  complete, the **process is modeled as a discriminated union / saga** — not a black-box function:
  - **DU = the resolution state machine:** `Unresolved | Resolving of progress | Pinned of lockEntry | Conflict
    of nodes | Failed of reason` — the resolution state is first-class **data**, inspectable per node.
  - **Saga = the durable driver:** each step is durable + **resumable** (stop after any timestep, resume), with
    **compensation** (back out a bad pin — the reversible-destruction `Down`, #6896/#6968). Idempotent resolve
    steps are bare; the genuinely effectful/ordering ones are saga-fenced (#6959).
- **Incremental = re-resolve only deltas.** When inputs change — a niche added/removed (#6972), the omega master
  moves (#6973), a new tiny per-dep file lands (#6975) — re-resolution recomputes **only the affected
  subgraph**, not the whole lock (DBSP incremental view maintenance / nested fixpoint, #6974). The lock is a
  *maintained view* over the dep graph, not a from-scratch artifact each time.

So: **the lockfile is a JIT-assembled, per-timestep, incrementally-maintained saga whose state is a DU** — the
bounded resolve (#6974) executed as a first-class, durable, resumable, inspectable process.

## Why this is the right execution model

- **It makes resolution fit the universal loop (#6965).** Resolution is just more `seam verb noun dependson`
  steps (#6971), one per timestep — no special batch phase. The resolver *is* the loop, resolving.
- **Resumable + crash-safe (the saga).** A long resolve over a big niche intersection can pause/resume/recover —
  no "re-run the whole solve from scratch on failure." Compensation makes a bad partial pin reversible (#6896).
- **Inspectable + DST-able.** The DU state means you can *see* where resolution is (which nodes pinned,
  conflicting, pending) — and replay it deterministically (the test seam, #6958), step by step.
- **Cheap to keep current.** Incremental maintenance means an evolving graph (#6975 assembly over time) keeps a
  fresh lock with delta-cost, not full-resolve-cost — the lock tracks the moving omega (#6973) incrementally.

## Honest scope / peel

- **Design / execution model, not built.** The pieces exist (DurableSaga, the DU discipline #6959, DBSP
  incremental/nested fixpoint #6974, the one-step loop #6965); "lockfile resolution implemented as an
  incremental per-timestep saga with a DU state" is the spec to build.
- **Incremental correctness is the hard part** — a delta re-resolve must be *equivalent* to a from-scratch
  resolve (the IVM correctness obligation); a wrong incremental step yields a lock that a full solve wouldn't.
  So the incremental saga must be proven/tested against the batch resolve (cross-check; route to Soraya).
- "JIT per timestep" doesn't make a hard intersection cheap — it **spreads** the bounded solve (#6974) over
  timesteps + makes it resumable/incremental; the total work can still be large at a gnarly niche intersection
  (Pareto/NP caveat from #6974 stands). It's better *amortization + resumability*, not free.
- Compensation requires resolve steps be reversible/idempotent or saga-fenced — undeclared side effects break
  resumability (same discipline as #6959/#6960).

## Ties

- **Bounded lockfile resolve (#6974)** — this is its *execution model* (incremental JIT saga vs batch solve).
- **One-step-at-a-time loop (#6965)** — resolution = resolve-steps, one per timestep.
- **Idempotent ensure / non-idempotent → DU/saga (#6959) + DurableSaga + reversible Down (#6896/#6968)** — the
  resolver IS a DU/saga; bad pins compensate.
- **Infinite assembly over time / tiny per-dep files (#6975) + alpha/omega master (#6973)** — the lock
  JIT-assembles from the assembly; tracks moving omega incrementally.
- **DBSP incremental view maintenance / nested fixpoint (#6974)** — re-resolve only deltas; the lock is a
  maintained view.
- **Test seam DST (#6958)** — replay the resolution saga step by step.

## Beacon anchors

- **JIT compilation / lazy evaluation** (assemble as needed, per timestep — not ahead-of-time batch). ·
  **Incremental view maintenance** (re-resolve deltas; DBSP, Budiu et al.) — the lock as a maintained view. ·
  **Sagas / compensating transactions** (Garcia-Molina & Salem 1987) + **discriminated-union state machines**
  (resolution state as data). · **Streaming / online constraint solving** (resolve incrementally rather than
  one-shot). Honest novelty: none in the primitives; the contribution is modeling **lockfile resolution as an
  incremental, JIT-per-timestep DU/saga** — the bounded resolve (#6974) executed as a first-class, durable,
  resumable, inspectable, delta-maintained process inside the one-step loop (#6965), with compensation for bad
  pins (#6896) — resolution that *runs like the rest of the system* (steps, sagas, incremental folds), not a
  black-box batch phase.
