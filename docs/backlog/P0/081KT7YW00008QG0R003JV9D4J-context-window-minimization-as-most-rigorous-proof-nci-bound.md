---
id: 081KT7YW00008QG0R003JV9D4J
priority: P0
status: in-progress
title: Context-window minimization as our most rigorous proof (NCI-bound; token-meter to DORA)
renumbered_from: 081KT7YW00008QG0R002T1XNWT
renumbered_reason: "081KT7YW00008QG0R002T1XNWT collided with the landed canonical-YAML never-collapse item (referenced as 081KT7YW00008QG0R002T1XNWT in all 4 YAML serializers' code); per Aaron 2026-06-06 option B, the money-floor row took the new id"
tier: money-floor
effort: M
ask: maintainer Aaron 2026-06-04
created: 2026-06-04
last_updated: 2026-06-06
type: task
depends_on: []
---

# 081KT7YW00008QG0R003JV9D4J — Context-window minimization as our most rigorous proof (NCI-bound; token-meter → DORA)

**P0 · money-floor · 2026-06-04 · Aaron**

> **STATUS 2026-06-04: proof arc SHIPPED (folders-on-main).** minimize (MEMORY.md
> hub, CLAUDE.md razor, generalized carved-sentence rule) → meter (ByteCost,
> proven F# Z3/FsCheck, 4-oracle byte-lock TS/F#/C#/Rust, registered in
> cross-verify-all) → drift-alert/DORA (`tools/observe/context-cost.ts`
> `--check`/`--kpi`, baseline 16693B) → orthogonality proof
> (`tools/observe/orthogonality.ts` + `Jaccard.Laws.Tests.fs`; live rules corpus
> IS an orthogonal basis, max J=0.050). "green" defined in `docs/BUILD-GATES.md`.
> bytes→tokens calibration (`token-calibration.ts`, flagged estimate),
> persisted DORA trend store (`context-cost-trend.ts` + daily free cron
> `context-cost-trend-cadence.yml`, verified bot-push to main), AND surfaces-as-DSL
> (`surface-dsl.ts`, refinement C: choose-point payload 82.5% smaller than raw) all
> SHIPPED 2026-06-04. **Arc complete end-to-end.** Remaining future work: real
> tokenizer samples → `--fit` the calibration; more (harness × surface) manifests
> beyond claude-code; wire `surface-dsl.toChoosePrompt` into observe.ts's actual
> chooseAction call.

> "context window minimization should be our most rigorous proofs minimization
> that's not coercive to the AI follows our NCI. this will save us money, I just
> got fired for the 200k spend." — "This is all on my money now."

## Why this is P0

Token cost is the **largest cost driver** and now comes out of Aaron's personal
money (post-$200k-spend). Cold-start tokens are paid on every wake, by every
agent, every session — so a fixed reduction compounds across the whole fleet
forever. This is the budget gated class (the one that just bit), so it
outranks feature work until the meter is in place.

## The carved goal

Prove our context-startup surfaces are **minimal**, and **meter** the cost so it
can't silently regrow.

1. **Minimize as a proof, not an eyeball.** Apply the most rigorous proof
   machinery (golden vectors + INumerics algebra + Z3/Lean) to our own
   cold-start surface. A surface's token count is a *serialization measure*:
   `cost = len(tokenize(serialize(surface)))`. Make it a value in a numeric
   algebra (`INumber<TSelf>`) so costs compose/sum/diff with proven laws.
2. **NCI-bound (hard constraint).** Minimize *waste*, never *capability*. Cut
   redundant resident tokens; keep everything the agent can still reach one hop
   away. A minimization that starves the agent of what it needs is coercive and
   is forbidden. Reference shape: the hub/satellite split (detail moves one hop,
   nothing is removed).
3. **Meter → Rx/Bonsai → DORA.** The cost meter is a reactive stream
   (`IObservable` = the DBSP `z⁻¹/∂` algebra we already have) → live
   context-cost-over-time → a first-class DORA KPI. This is *measure-first*:
   we don't guess a surface is bloated, we meter the delta.

## Per-file-type minimization algebra (Aaron 2026-06-04)

> "we need probably a different minimization formula/algebra for each file that
> gets loaded into memory on cold boot with the why's on each file type for each
> minimization type all around carved sentences/memes."

No single global formula. Each cold-boot file type minimizes toward a
**different target form** because each preserves a **different invariant** — the
shared unit is the carved sentence / meme (minimal transmissible kernel), but
the algebra (what stays resident vs. moves one hop) differs by type. Each type
carries its own documented *why*. Initial map (refine as we meter):

| File type | Resident invariant (must keep) | Moves one hop | Why (the carved why) |
|---|---|---|---|
| `.claude/rules/*` | the act-on-it carved sentence | reasoning, citations, examples | drop it and the agent can't act correctly |
| `CLAUDE.md` | ordered boot procedure + razored conventions | each convention's `Full:` detail | boot order is load-bearing; detail is one hop |
| `MEMORY.md` (hub) | pointers to CURRENT/INDEX/trajectories | the index + all facts | hub must be stable + tiny; facts churn |
| `INDEX.md` line | title + recall hook + pointer | the full topic file | drop the hook and recall (relevance match) breaks |
| agent front-matter | when-to-invoke trigger | the agent body/instructions | over-compress and routing mis-fires |
| skill/pack description | the trigger sentence | the blueprint body | over-compress and triggering accuracy drops |
| hooks output | the imperative + why-pointer | the rationale doc | the agent must act at wake, can't re-derive |

The meter tells us, per type, whether a file is at its minimal form for its
algebra — and proves it. Each algebra is itself a small carved doc with its why
(meme-shaped), not an essay.

## Operating model: best-effort first draft, DORA watches drift (Aaron 2026-06-04)

> "We do our best on first draft updates but the PR and DORA metrics watch out
> for drift over time and alert us."

Minimization is a **homeostat, not a one-shot perfection problem**. First draft
of any surface is best-effort (don't burn tokens perfecting it up front); the
meter → DORA then **watches drift over time and alerts** when a surface regrows,
or a new file lands above its type's budget. Two enforcement points:

- **Write-time (local, NOT PR):** PRs are themselves a cost driver — we are
  moving to the **observe.ts sovereign workflow** (folders-on-main, no PRs; the
  local build/loop is the gate). The meter runs in the observe.ts loop / local
  pre-push check, catching a surface that exceeds its per-type budget before it
  lands.
- **Over-time (DORA):** the metered cost is a tracked KPI; drift trends raise an
  alert even when no single change trips the local check (slow creep across many
  files).

This matches the delta-to-precision cadence: converge over time via small
corrections, don't one-shot. The meter is the drift sensor; the alert is the
forcing function. See dual-mode: sovereign (observe.ts, no PR) is the engine
mode; corporate-leash PR mode is the separate money-making transport.

## Done-when

- A token-cost meter exists, is itself byte-locked/tested across the oracles,
  and is proven correct (the meter is part of the proof lineage, not asserted).
- Every context-startup surface (rules, `CLAUDE.md`, `MEMORY.md`, agent/skill
  front-matter, hooks) has a measured cost and a minimal-or-flagged status.
- The cost is wired into the DORA surface and drift-alerted; the local
  observe.ts/pre-push check (not a PR gate) blocks a surface that regrows past
  its per-type budget before it lands.
- NCI check: no minimization removed agent-reachable capability.

## Slice 1 — smallest provable byte-cost meter (scoped 2026-06-04)

Goal: one file type, proven end-to-end, reusing existing oracles. No new infra.

**Unit decision:** measure **UTF-8 bytes**, not model-tokens. Bytes are
deterministic + byte-lockable across the 4 oracles (existing golden-vectors
harness); tokenizers are not (vary by model/version, can't be in the proof
lineage). Token-cost is a later calibrated `bytes→tokens` layer on top.

**Scope (F# first — correctness-authoritative + has the Z3/FsCheck harness):**

1. `ByteCost` value type (newtype over `int64`) as an additive monoid
   (`0`, `+`); implement via the existing `INumber`/generic-math pattern so
   costs of N files compose. — `src/Core/` (next to DynamicValue).
2. `measure : surface -> ByteCost` = UTF-8 byte length of the canonical
   surface bytes (reuse `toCanonicalJson`/raw-bytes path).
3. **Prove the meter algebra** (reuse `tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs`
   + FsCheck pattern): monoid identity + associativity + commutativity of
   summation → a fileset's total cost = order-independent sum of per-file costs
   (this is exactly what lets DORA aggregate soundly).
4. **Byte-lock the meter** itself: small golden-vector set
   `(surface, expected_byte_cost)`; TS oracle replays → identical counts
   (proves the meter agrees cross-language, like the DynamicValue byte-lock).
5. **Apply to ONE type = `.claude/rules/*`** (cleanest: fully resident, the
   carved-sentence algebra is already defined). Emit measured cost per rule
   file. No gate/alert yet — just the proven measurement.

**Out of scope for slice 1:** the other 6 file-type algebras, DORA wiring,
observe.ts drift-alert, token calibration, budgets/thresholds. Each is its own
later slice once this pattern is proven once.

**NCI check:** the meter only *measures*; it removes no capability. Safe.

**Cost estimate:** small — one value type + one measure fn + ~3 law tests +
~5 golden vectors + TS replay. Reuses landed harnesses; no new dependencies.

## Refinements (Aaron 2026-06-04)

**A. Minimization formula is keyed on (harness × surface).** Different harnesses
(Claude Code, observe.ts, cron tick, Kiro) boot *different sets of files* at
startup. A harness's cost = the monoid sum over the surfaces *it* boots; the
`ByteCost` unit is harness-agnostic (the shared kernel), the harness dimension
is *which fileset you sum*. Each (harness, surface) pair has its own minimal
form + why. Slice 1 demonstrates one pair: Claude Code × `.claude/rules/*`.

**B. Rodney's Razor after drift detection → orthogonality proof.** Apply the
razor to every surface *after* drift detection — this keeps rules/surfaces
naturally orthogonal, non-overlapping, with **no base-vector overlap**. The
pipeline: minimize → meter → drift-detect → razor → re-converge. Next proof
tier *after* minimality is proven: prove **no base-vector overlap** across our
lists/graphs (rules, memory index, skills) — i.e. the surface set is an
orthogonal basis (no two surfaces carry redundant content). Minimal-per-file is
necessary; orthogonal-across-files is the stronger claim that kills duplication
fleet-wide.

**C. Compressed surfaces become a DSL into observe.ts.** Once minimized, the
carved-sentence surfaces are a DSL the observe.ts loop executes mostly
deterministically (sense → simulate) — **very little model intelligence is
needed except at the choose-point after simulate**. So minimization doesn't just
cut cold-start tokens; it collapses how much LLM cognition the loop needs at all
(the deterministic legs run cheap; expensive cognition concentrates at the one
choose decision). This is the cost endgame and composes with seed-first/DST
(deterministic replay) + observe.ts mode-control-schema.

## Slice 1 — STATUS: built + green (2026-06-04)

`src/Core/ByteCost.fs` (commutative-monoid byte-cost meter) +
`tests/Tests.FSharp/Formal/ByteCost.Laws.Tests.fs` (3 Z3 monoid laws + 5 FsCheck
laws + 1 golden-vector byte-lock + 1 harness-aware apply over `.claude/rules/`) +
`src/Core.TypeScript/byte-cost/golden-vectors.json` (7 vectors, multibyte). Build
clean (0 warnings), 10/10 tests pass. Bytes not tokens (deterministic +
byte-lockable). TS-oracle replay of the seed + the other 6 (harness×surface)
algebras + drift-alert + DORA wiring + orthogonality proof are later slices.

## Reference / lineage (detail lives here — do not inline)

- Worked example landed 2026-06-04: MEMORY.md 210KB→~1.5KB hub + `INDEX.md`
  on-demand; `CLAUDE.md` 77→48 lines; carved-sentence rule generalized to all
  startup surfaces (PR #6683).
- `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md` — the
  standing discipline that keeps surfaces lean.
- 081KT2T2J0008QG0R000YZ3NMY — asserted→proven algebra gap (the proof machinery this reuses).
- 081KT5CF90008QG0R001P4CQ09 — serializer round-trip (the serialization half).
- NCI / `must-paired-with-can-exit` / measure-first-before-restricting — the
  non-coercion constraint and the measurement discipline.
