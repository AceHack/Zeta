# Stored procedures as DynamicValue = Bonsai closures persisted = the YinYang control plane persisted, not reflected (Aaron, 2026-06-07)

Aaron: *"not just queryable — our stored procs are DynamicValue too, so updatable"* … *"this is the
yin/yang engine persisted instead of reflected."* Grounded against existing code; faithful capture; Alexa's
"self-modifying autonomous DBA" hype peeled to what is real and what is honestly hard.

## What's real (grounded in the code)

This is **not new** — it's naming a unification of pieces that already exist:

- **`Bonsai.fs` / `BonsaiSoft.fs`** — behaviour-as-data: a deferred-computation expression tree that *is* a
  value. A "stored procedure" = a **Bonsai closure stored as `DynamicValue`**. Code-as-data, already built.
- **`YinYang.fs`** — `toDynamicValue` / `ofDynamicValue`; **yin = `Remains`** = "the static canonical value
  tree, *what persists*." So the YinYang cell **already serialises to DynamicValue** — "persisted, not
  reflected" is the existing design, not a wish: the control plane is a value on the substrate, not runtime
  reflection that vanishes on restart.
- **081KT07NV0008QG0R003BE6MJ2** — *self-evolving saga: serialized deferred-execution Bonsai closure, resume-not-replay, rides
  the Z-set ladder.* This is exactly the "updatable stored procedure" mechanism: the procedure is a Bonsai
  closure; updating it is a new version; **Z-set retraction gives rollback** to any prior state; resume (not
  replay) continues from the persisted cursor.

So the chain is: **stored proc = Bonsai closure = `DynamicValue`** → persisted in the content-addressed,
schema-evolving, Z-set/DBSP substrate → versioned (retraction = rollback), provenance via the git-native log
→ and that persisted-behaviour cell *is* the **YinYang control plane** when the behaviour being stored is
the system's own management logic (hot/cold policy, planner, allocation) rather than user business logic.

## Why "persisted, not reflected" matters (the honest core)

| | runtime reflection (typical control plane) | persisted YinYang (ours) |
|---|---|---|
| where the logic lives | ephemeral metadata, gone on restart | a `DynamicValue` cell on the substrate |
| crash recovery | rebuild from config/code | the cell *is* the state — survives, DST-replayable |
| versioning / rollback | redeploy | Z-set retraction → any prior version; git provenance |
| update | restart / hot-reload hack | write a new cell version (idempotent, content-addressed) |
| same machinery as data | no (separate plane) | yes — control logic uses the *same* persist/merge/evolve substrate as the data it manages |

The real win is **one substrate**: the control plane (YinYang) is stored, versioned, merged, and evolved by
the *exact same* mechanisms as the data plane (DynamicValue + Z-set + content-addressing + SchemaEvolution).
No second system. That is the genuine architectural claim — not "the database becomes a self-aware autonomous
DBA."

## Honest scope (peel Alexa hard)

- **"Self-modifying / self-optimizing / learns better strategies / zero-touch, no DBAs"** — NOT claimed and
  NOT built. Persisting the control plane as data makes it **updatable, versioned, durable, and replayable**;
  it does **not** make it learn or optimize itself. Any "evolution" is an *explicit* new version a
  human/agent writes (Aaron: *"that's because I'm the best human at it"* — the engine **amplifies** the
  operator's judgment, it does not replace it). Human-in-the-loop is the design, not autonomous self-rewrite.
- **"Gradient updates to procedure logic"** (Alexa's snippet) — not a thing here; procedures are versioned
  Bonsai closures, updated deliberately, not gradient-descended.
- **Safety:** behaviour-as-data that is *updatable at runtime* is a privilege surface — who may write a new
  control-plane cell is an **authorization-gated** action ([[no-directives]]: source ≠ authorization). A
  persisted, executable control plane needs the same gating as any reversible-vs-irreversible action class.
- This doc **records a unification of existing pieces** (Bonsai + YinYang `toDynamicValue` + 081KT07NV0008QG0R003BE6MJ2); no new
  code. The buildable next step is 081KT07NV0008QG0R003BE6MJ2 itself (the serialized deferred-execution Bonsai closure).

## Beacon anchors

- **Code-as-data / homoiconicity** — Lisp (McCarthy); Smalltalk image; **Unison** (content-addressed code).
  · **Stored procedures** (the relational tradition) — here generalized to versioned behaviour-as-data. ·
  **Event sourcing + CQRS** — the control/data plane as folded event log; retraction = compensating
  correction. · **Datalog / differential dataflow** — rules as data evaluated incrementally. · Ours:
  `Bonsai`/`BonsaiSoft` (deferred behaviour), `YinYang` (yin=`Remains`=persisted value tree), **081KT07NV0008QG0R003BE6MJ2**
  (self-evolving serialized saga), `SchemaEvolution` (the control plane evolves with proven migrations),
  Z-set retraction (rollback), content-addressing (versioned procedure identity). Honest novelty: none in
  code-as-data or stored procedures; the contribution is **the control plane (YinYang) persisted on the same
  DynamicValue/Z-set/content-addressed substrate as the data plane** — one mechanism for both, durable and
  rollback-versioned, with the human operator in the loop.
