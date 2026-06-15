# ADR: Router-coherence hand-off contract between `claims-tester` (empirical) and `complexity-reviewer` (analytic) — who owns which half of an O(·) claim, and when work hands off

> **Superseded by** [`docs/DECISIONS/2026-04-21-router-coherence-v2.md`](2026-04-21-router-coherence-v2.md) after Kira (harsh-critic) adversarial pass surfaced 3 P0 + 5 P1 + 2 P2 findings. v1 kept in place per `GOVERNANCE.md §2` so the CONFLICT-RESOLUTION Active-tensions citation chain remains resolvable. Read v2 for the operative contract; v1 below is the historical record.

**Date:** 2026-04-21 (round 41, late)
**Status:** *Accepted (pre-adversarial-review; superseded by v2 same-round after Kira pass). v1 retained for citation continuity.*
**Owner (proposed):** Architect (Kenji) integrates; Hiroshi
(`complexity-reviewer`) and Daisy (`claims-tester`) each
sign their half of the contract. Advisory signal from
Aarav (`skill-tune-up`) on whether the contract is being
honoured in practice.
**Depends on:** `.claude/skills/complexity-reviewer/SKILL.md`,
`.claude/skills/claims-tester/SKILL.md`,
`memory/aarav/NOTEBOOK.md` (round-41 top-5 #4),
`docs/CONFLICT-RESOLUTION.md` (conference-protocol fallback).

## Context

Aarav flagged claims-tester ↔ complexity-reviewer as a
router-coherence drift in round 18 under the
HAND-OFF-CONTRACT action. The finding sat open for 23
rounds because Aarav's own ranker was offline by cadence
(rounds 19-40). The round-41 catch-up pass re-entered it at
P1 with this concrete rationale:

> *"Both skills still claim 'is this O(·) claim true?'
> without an explicit analytic-bound → empirical-falsifier
> pipeline."*
> — `memory/aarav/NOTEBOOK.md` §"Current top-5
> (round 41)" #4

Reading the two SKILL.md files confirms the overlap:

- **`complexity-reviewer/SKILL.md`** line 3 — *"ask 'can it
  use less RAM?', 'can we reduce the complexity class?',
  'is there a known space-vs-time trade-off we're
  missing?'. He reviews every non-trivial algorithmic
  commit for asymptotic and constant-factor cost … flags
  when a claim ('O(1) retraction') is actually O(n) in
  disguise."*

- **`claims-tester/SKILL.md`** line 3 — *"Use this skill
  whenever a doc comment, README, or commit message makes
  a **claim** about the behaviour of Zeta.Core code —
  e.g. 'O(1) retraction' … The skill designs empirical
  tests that either prove or disprove the claim with
  real measurements."*

Both claim authority over the same artefact (an O(·) claim
in a doc comment). Neither names the other. Neither
declares a hand-off trigger. Today, a human dispatcher
picks whichever skill comes to mind first, and the other
half of the review never happens. This is router-coherence
drift in its textbook form: two adjacent lanes, no
disambiguation, authority without contract.

## The shape of the gap

An O(·) claim has two halves that require *different tools*
to assess:

| Half | Tool | Owner | Output |
|---|---|---|---|
| **Analytic bound** — does the algorithm, read on paper, yield the claimed bound? Do the loops, recursion depths, and data-structure operations compose to the asserted class? | CLRS / Tarjan / AMS-style argument; proof sketch or cell-probe lower bound | `complexity-reviewer` (Hiroshi) | "The bound is `O(log n)` amortised because potential function Φ … pays for each merge." *or* "The bound is wrong: the inner `Dictionary.Remove` is `O(k)` under adversarial rehashing." |
| **Empirical measurement** — at `n = 10⁶` with realistic workload, does the running time / allocation / scan count actually match the asserted bound? Does the constant factor survive contact with a real cache hierarchy? | FsCheck property test, BenchmarkDotNet, `MemoryDiagnoser`, contrary-workload sweep | `claims-tester` (Daisy) | "Measured `2.3 × n × log n ± 0.1` over `n ∈ [10³, 10⁶]`; matches claim within noise." *or* "Claim says O(1); measurement shows linear growth in `n` above `n = 10⁴` — opening bug." |

Either half **alone** is insufficient:

- Analytic-only misses constant-factor cliffs, cache
  behaviour, and implementation bugs that break the
  paper's abstraction. Hiroshi's motto — *"a wrong
  complexity claim in a paper is worse than a wrong
  number in a benchmark, because it follows you for a
  decade"* — applies, but only if the paper's bound
  and the code's behaviour actually agree.
- Empirical-only misses theoretical lower bounds (AMS
  streaming space, cell-probe, communication) and
  amortised-vs-worst-case distinctions. A benchmark
  passing at `n = 10⁶` does not prove a bound holds
  asymptotically. The MI-sharder claim-tests caught
  bugs precisely because the *claim* was analytic;
  without that anchor, the measurement would have had
  nothing to contradict.

The gap is not that either skill is wrong; it is that
neither names the other as the completing half.

## Decision

Both skills keep their scope. We add an explicit
**two-stage pipeline** with named triggers. The contract
lives in three places (in SKILL.md bodies + in this ADR +
in `docs/CONFLICT-RESOLUTION.md`) per GOVERNANCE §2 (edit
in place to reflect current truth).

### Stage 1 — analytic-first (complexity-reviewer)

**Trigger.** A commit or PR introduces or modifies an
O(·) claim in any of: XML doc comment, `README`,
`docs/BACKLOG.md`, `docs/TECH-RADAR.md`, a paper draft
under `docs/papers/`, or a spec under `openspec/specs/**`.

**Hiroshi's work.** Read the code against the claim.
State: (a) worst-case bound, (b) amortised bound if
different, (c) expected bound if different, (d) the lower
bound that applies (streaming / external-memory /
cell-probe / communication), (e) whether the constant
factor is honest — no hidden `k` that's secretly `n`.

**Three possible outputs:**

1. **Claim analytically sound.** Hand off to Stage 2
   with a note: *"Analytic bound confirmed at
   `O(<class>)`. Requesting `claims-tester`
   measurement at `n ∈ [10³, 10⁶]` under
   {uniform, Zipf, adversarial} workloads to verify
   constant factor and guard against
   implementation-abstraction drift."*

2. **Claim analytically wrong.** File a P0 on
   `docs/BACKLOG.md`; cite the specific step where
   the claim fails (*"line 147's inner
   `Dictionary.Remove` is `O(k)` under collision
   cluster → outer claim of `O(log n)` is
   `O(k log n)`"*). Do **not** hand to Stage 2 until
   the code is fixed; measuring a wrong bound
   produces false comfort.

3. **Claim under-specified.** Return to author with a
   note on which of (worst / amortised / expected /
   lower-bound / constant-factor) is missing. Do not
   hand to Stage 2; `claims-tester` cannot test a
   claim that hasn't declared which bound it's
   claiming.

### Stage 2 — empirical (claims-tester)

**Trigger.** Hiroshi's Stage-1 hand-off (output 1
above) OR a claim landed without Stage 1 (grandfathered
pre-ADR work) OR a performance regression surfaced
during benchmark-authoring-expert's normal cadence.

**Daisy's work.** Build the smallest test that can
falsify the claim: baseline + claim-proof +
contrary-workload (Hiroshi's Stage-1 note names the
contrary workload explicitly). Measure at the specified
`n` range. Print the ratio, not just pass/fail.

**Three possible outputs:**

1. **Measurement matches analytic bound.** Test lands,
   claim stays, tighten the docstring to include the
   measured constant factor (*"O(log n) — measured
   `2.3 × log n` at `n = 10⁶`"*).

2. **Measurement contradicts analytic bound.**
   **Re-engage Hiroshi.** The analytic argument must
   be wrong (bug in the proof) or the code violates
   the proof's abstraction (bug in the code). Either
   way, Stage 1 re-runs with the benchmark as the
   new evidence. File a P0 until reconciled.

3. **Measurement matches analytic bound but fails
   contrary workload.** Claim is narrower than
   stated. Tighten the claim to the workloads that
   held (*"O(log n) under Zipf and uniform; O(n)
   under adversarial pre-image collision"*) and
   update the docstring. This is the MI-sharder
   pattern that the original `claims-tester` skill
   cites.

### Reverse trigger — benchmark surprise

Any time a benchmark surprise surfaces in CI or a
development pass (PerfBench regression, allocation
growth, unexpected scaling behaviour), the work routes
to `claims-tester` Stage 2 **first** (to pin the
numbers), then to Hiroshi Stage 1 **second** (to
diagnose whether the analytic bound was wrong or the
implementation drifted from it). This is the reverse
of the commit-time flow; both directions are legal.

## Who fires when — decision table

| Situation | First fires | Then fires | Notes |
|---|---|---|---|
| New O(·) claim in PR | Hiroshi (Stage 1) | Daisy (Stage 2) if Stage 1 outputs 1 | Default path |
| Performance regression in CI | Daisy (Stage 2) | Hiroshi (Stage 1) if measurement contradicts bound | Reverse trigger |
| Paper draft with bound | Hiroshi (Stage 1) | Daisy (Stage 2) before paper submission | Paper-target has higher evidence bar |
| Docstring lacks which bound | Hiroshi (Stage 1, output 3) | — | Returns to author first |
| Claim analytically wrong | Hiroshi (Stage 1, output 2) | — | P0; no measurement until fix |
| Measurement ≠ bound | Daisy (Stage 2, output 2) | Hiroshi (Stage 1, re-run) | P0 until reconciled |

## Escalation

If Hiroshi and Daisy disagree on a reconciliation
(common failure mode: Hiroshi says *"the bound is
correct, your benchmark is measuring the wrong thing"*,
Daisy says *"the bound is wrong, your proof elides the
constant factor"*), the conflict escalates to the
conference protocol in `docs/CONFLICT-RESOLUTION.md`:
Architect (Kenji) integrates a third option, and on
deadlock, the human maintainer decides. This is exactly
the surface that protocol is for.

## Consequences

### Positive

- Every O(·) claim in a shipped artefact gets both halves
  of the review. Paper-publication-worthy bounds are
  honest by construction.
- The hand-off is explicit, so a human dispatcher (or an
  agent following the skill) knows which skill to fire
  first without guessing.
- The reverse trigger (benchmark surprise → Daisy → Hiroshi)
  closes the loop that otherwise lets implementation drift
  accumulate invisibly.
- Aarav's router-coherence-drift flag has a concrete
  closure path; the round-18 finding stops carrying
  forward.
- Precedent for future analyst/falsifier pairs (e.g.
  `verification-drift-auditor` vs `formal-verification-expert`
  on spec-to-code claims) — the two-stage pattern is
  reusable when the same shape appears elsewhere.

### Negative

- Two skills now have a mutual dependency in their
  procedure bodies. If one skill's scope changes, the
  other's hand-off text must update. Mitigation: this
  ADR is cited in both SKILL.md bodies and reviewed
  every 5-10 rounds by `skill-tune-up`.
- Some claims will be caught in the "under-specified"
  bucket (Stage 1 output 3) and bounce back to author.
  This slows the PR round-trip slightly. Net-positive
  trade (better claims > faster merge).

### Neutral

- Does not change either skill's tone or reviewer
  authority. Both remain advisory. Binding decisions
  still route through the Architect or human
  maintainer per `docs/CONFLICT-RESOLUTION.md`.

## Follow-up work (not this ADR)

- Update `.claude/skills/complexity-reviewer/SKILL.md`
  with a §"Hand-off to `claims-tester`" block citing
  this ADR. Route via `skill-creator` (GOVERNANCE §4).
- Update `.claude/skills/claims-tester/SKILL.md` with a
  symmetric §"Hand-off to/from `complexity-reviewer`"
  block. Route via `skill-creator`.
- Update `docs/CONFLICT-RESOLUTION.md` row for Hiroshi
  and Daisy to reference this ADR as the hand-off
  contract.
- Aarav closes the round-41 top-5 #4 entry after the
  SKILL.md edits land (not this round's work; next
  round's).

## Decision rationale (one paragraph for the wait-don't-read audience)

Two skills were fighting over the same O(·) claim
without a contract. Neither was wrong; neither was
complete alone. We declare the split explicitly —
analytic bound first (`complexity-reviewer`),
empirical measurement second (`claims-tester`) — and
name the reverse trigger (benchmark surprise flows
the other direction). Both halves are required for
paper-publication-worthy claims; either half in
isolation is a known failure mode. This is a
router-coherence fix, not a scope change.
