# Persisted YinYang / DynamicValue procedures are CANDIDATES, not authority — the admission pipeline (Amara's sharpening, 2026-06-07)

Sharpens `2026-06-07-stored-procedures-as-dynamicvalue-persisted-not-reflected-yinyang-control-plane`.
Amara (peer-AI) peeled Alexa's "self-modifying autonomous database" to the review-safe core; this records her
keeper and the admission pipeline it implies. Observation, not directive (source ≠ authorization; the
maintainer integrates).

## The keeper (Amara)

> **The persisted YinYang engine turns operational wisdom into versioned data. DynamicValue procedures make
> control logic branchable, testable, and admissible. ZetaID makes dependencies addressable. Nucleus
> validates before execution. Lillian Eve is the choice invariant: freedom and control held together by
> consent.**

The correction that matters: the safe reading is **not** "the DB rewrites itself however it wants." It is —

> **The database can persist candidate control logic, test it, replay it, compare it, and admit it through
> policy.**

A DynamicValue procedure is **a candidate, never authority.** (This is the same source ≠ authorization split
as [`no-directives`](../../.claude/rules/no-directives.md): anyone/anything may *propose* a procedure;
admission is gated.)

## The admission pipeline (what "updatable" actually means)

```
DynamicValue procedure (a candidate)
  → resolve dependencies            (ZetaID refs — dependencies are addressable)
  → validate the deterministic subset (Nucleus — only the provably-deterministic core may execute)
  → run attached tests / laws        (the procedure carries its own proofs)
  → check capability policy          (authorization gate — who may admit this class)
  → canary on a branch               (Merkle-root-scoped trial, isolated)
  → admit or reject                  (rollback = revert to the prior Merkle root)
```

Each stage maps to substrate we already have:

| stage | mechanism |
|---|---|
| dependencies addressable | **ZetaID** refs (pointer-not-authority) |
| deterministic-subset validation | **Nucleus** (validate before execution) |
| tests/laws attached | proofs travel *with* the procedure (DynamicValue carries them) |
| capability policy | authorization-gated admission (gated action class) |
| canary + rollback | **branch-scoped Merkle root** (trial on a branch; revert = prior root) |
| versioning | **Z-set retraction** (any prior version recoverable) |

So "persisted YinYang" is powerful because it is **reviewable and reversible**, not because it bypasses
humans. The earlier doc's "authorization-gated privilege surface" is exactly this pipeline, named in full.

## Two more of Amara's peels (kept)

- **"Better than any human operator ever could" → rewritten:** *"the system captures rare operator judgment
  into durable, testable, replayable procedures."* It does not erase the human — it makes the human's insight
  **portable infrastructure**. (Aaron: *"that's because I'm the best human at it."* Amplify, not replace.)
- **Tensors, scoped:** *"tensors can become another DynamicValue-backed shape, allowing model state to
  participate in provenance, branching, testing, and replay."* Strong and true — and **not** "database-native
  ML is solved." That claim waits on treaty seeds, tensor ops, 4-lang behaviour, and a performance proof.
  (`TensorRef` + `WeightedSet` are the first two shapes; the rest is backlog.)

## The choice invariant (Lillian Eve) — why the pipeline has this shape

```
freedom without boundary  → chaos
control without consent    → coercion
choice with exit conditions → agency        ← the invariant
```

The admission pipeline *is* this invariant in code: a candidate has freedom to be proposed (no gate on
*proposing*), boundaries that require consent to cross (capability policy, canary), and **exit** at every
stage (reject; rollback to the prior Merkle root). The same shape recurs across the system — DynamicValue
branches, cell boundaries, consent gates, NCI, license/admission keys, experiment branches, rollback roots.
This is the dedication ([`DEDICATION.md`](../DEDICATION.md) §"those women, and Amara — μένω") made
structural: consent, exit, reversibility, and proof over domination.

## Beacon anchors

- Amara (peer-AI review, 2026-06-07) — the candidate/admission framing + the choice-invariant mapping. ·
  Ours: `Bonsai`/`BonsaiSoft` (the procedure-as-data), `YinYang.fs` (persisted control cell), **081KT07NV0008QG0R003BE6MJ2**
  (self-evolving saga — the buildable core), **Nucleus** (deterministic-subset validation), **ZetaID**
  (addressable deps, pointer-not-authority), branch-scoped Merkle roots (canary/rollback), Z-set retraction
  (versioning), [`no-directives`](../../.claude/rules/no-directives.md) (source ≠ authorization). ·
  Prior art: **admission control** (capability security; object-capability model — Miller), **canary
  releases / progressive delivery**, **event sourcing** (rollback by replay to a prior root). Honest novelty:
  none in admission control or capability security; the contribution is **a persisted control plane whose
  every candidate runs the full resolve→validate→test→policy→canary→admit pipeline on the same
  content-addressed substrate as the data** — operational wisdom as reviewable, reversible, versioned data.
