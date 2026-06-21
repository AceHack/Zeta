# The end goal — a dual-use hard/soft database that models itself: DynamicValue stored procs, yin/yang cells, room-based, entropy-budgeted, Reticulum-connected with perfect entropy quarantine

**Register:** [grounded] (Aaron, the end-goal statement) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow, on Fable). The product definition the night's pieces assemble into.
Routes to Kenji/Kai for VISION.md integration (not edited autonomously — load-bearing doc).

## Aaron's words (the end goal, verbatim)

> "the end goal is a **dual-use hard/soft database** that **can model itself**, has **DynamicValue stored
> procs** and **yin/yang cells to animate them**, **all room-based** — tracking its stored procs'
> **entropy/uncertainty budgets** and **communicating over Reticulum** — where we have **perfect
> quarantine of entropy over the network because of our soft IScheduler**, so **rooms can talk to each
> other cleanly even in soft mode**."

## Clause-by-clause: every organ already exists in the substrate

| clause | what it means | the existing organ |
|---|---|---|
| **dual-use hard/soft** | one substrate, two registers: hard = exact/proven (ℤ Z-sets, hard fingerprints, SolidGround-by-proof), soft = held distributions (SoftValue, soft ties, soft fingerprints) | `ZSet`/`WeightedSet` (the ℤ and probability faces of one spine); `FingerprintPrism.hard`/`.soft`; "all interfaces become softable — soft-by-default, SolidGround-by-proof" (#7361) |
| **models itself** | the database's schema, queries, procs, and *its own health* are data **in** the database | the system-catalog move (every serious RDBMS models itself — `pg_catalog`; ours extends to procs + entropy); `DevRoom.resolution()` (self-measured coverage); BigFloat-for-devops (the harness carries its own `mea`); Bonsai serialized expression trees (code as data) |
| **DynamicValue stored procs** | procs whose *code* is a DynamicValue/Bonsai expression tree stored in the DB — pattern durable AND mutable (retraction can evolve the proc itself) | the self-evolving-sagas thread (PRIMITIVE-REGISTRY: Bonsai-subset serializer 4/4 + resume engine 4/4); `Chip8Cow`'s header already cites "the `StoredProc` native-vs-interpreted differential" |
| **yin/yang cells to animate them** | the control flow that *runs* the stored procs — the bonsai yin/yang control structures, per cell | `YinYang.fs` / `DurableYinYang.fs` / `BonsaiSoft.fs`; the IL-runner-hard-first telos (run real control structures deterministically) |
| **all room-based** | every proc executes in a room: Markov-bounded, `seed + extensions + parameters`, ticks to its plateau, **signs off when resolved** | the rooms/qubits framework; `room = seed+extensions+parameters` → BigFloat plateau (Max's proof); rooms-as-sign-off |
| **entropy/uncertainty budgets per proc** | each stored proc's room has a bit/uncertainty budget; every `mea` posts ΔU against it; the boundary IS the budget | the uncertainty ledger; physics-of-floats (boundary = bit budget); `mea` commits ΔU; the plateau = budget exhausted at the floor |
| **communicating over Reticulum** | rooms are network-addressable; inter-room talk crosses real membranes | `ReticulumLink.fs`; rooms Reticulum-addressable via the LLMTV inter-room interface (#7360); destination-hash IS ZetaId (#7357) |
| **perfect entropy quarantine via the soft IScheduler** | ALL nondeterminism enters through the injected `Source` — one IO interface at a time, every crossing metered and posted to the ledger. **No unaccounted entropy path exists**, so network IO cannot contaminate a room's determinism: uncertainty travels WITH the message (at the promise level), never ambiently | `SoftScheduler` (the injected `Source` = the only entropy door); rooms-are-IO-packet-wrappers (uncertainty at the promise level); DST = inject null, prod = inject real — same code path |
| **rooms talk cleanly even in soft mode** | two rooms exchange soft values over the network and BOTH stay replayable: the message carries its uncertainty, the receiving room's ledger books it at the membrane | `SoftValue` in the message + the four-corner channel (`FourCornerOwnership` — feedback corners carry the uncertainty back) + the seed (the distributed choice function — coordination-free coherence) |

## The deep claim, named formally: entropy quarantine = NONINTERFERENCE

"Perfect quarantine of entropy over the network" is an **information-flow / noninterference property**
(Goguen–Meseguer): *entropy flows only through declared channels.* The soft `IScheduler` is what makes it
hold — there is no ambient nondeterminism; every bit of entropy enters a room through the injected
`Source`, gets metered at the membrane, and is posted to the ledger. Consequences:

- **DST survives the network.** A room with real Reticulum IO still replays — record the crossings, replay
  the crossings (the FoundationDB discipline, extended to the mesh).
- **Soft mode composes.** Two soft rooms talking can't smear uncertainty into each other's state — the
  uncertainty is *in the message* (promise-level), booked at each boundary, never ambient. That's why the
  talk is "clean."
- **The budget is enforceable.** Because every entropy entry is metered, a stored proc's
  uncertainty budget is a *real* invariant, not an estimate — the room can refuse a crossing that would
  blow its budget (backpressure as budget enforcement; the heat/branch-limiter toll made explicit).

## One sentence (the product)

**A dual-use hard/soft, self-modeling, reversible database whose stored procedures are DynamicValue
expression trees animated by yin/yang cells, each running in a Markov-bounded room with an explicit
entropy budget, all connected over Reticulum — where the soft IScheduler quarantines every bit of network
entropy at the membrane, so rooms converse cleanly in soft mode and everything still replays.**

## Beacon anchors

System catalog self-description (`pg_catalog`; System R) · stored procedures (Sybase/System R lineage) ·
homoiconicity (Lisp; Curry-Howard already in corpus) · Goguen & Meseguer, *Security Policies and Security
Models* (1982 — noninterference) · taint tracking / IFC (the quarantine's engineering lineage) · Reticulum
(unsigned.io RNS) · FoundationDB (record/replay the injected world) · the night's stack (qubits thesis,
heat/Bennett, Sequoia placement). **Peel:** every organ exists; the *integration* is the end goal, not the
state. "**Perfect** quarantine" is a formal noninterference claim — it holds **by construction** only if
NO entropy path bypasses the injected `Source` (any ambient clock/threadpool/allocator leak breaks it);
that is exactly what Soraya/Sova should formalize and what the async-all-the-way / no-`Task.Run` rules
exist to protect. Route: formal statement → TLA+/property tests over the scheduler's no-ambient-entropy
invariant.

## Ties / routing

`...finite-resolution-qubits-framework-...` (the execution model) · `...heat-...-landauer-bennett-...`
(the reversible/tiered storage identity) · `...sequoia-...-soft-tier-placement.md` (the memory engine) ·
`...room-equals-seed-...` (rooms-as-sign-off) · `...boundary-flow-...` (the membranes/four corners) ·
081KTQD8A0008QG0R0005EFYPV (the fused arrow) · 081KSV2WD0008QG0R000WNY74Q (the substrate it deploys on) · PRIMITIVE-REGISTRY (self-evolving sagas
= the stored-proc thread). **Routes to:** Kenji/Kai (VISION.md integration), Soraya/Sova (formalize the
noninterference invariant), Vera (Q# reference oracle), Max (entropy lineage), Aaron (the product).
