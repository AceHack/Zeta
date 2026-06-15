# ADR: Router-coherence v2 — analytic/empirical hand-off contract between `complexity-reviewer` and `claims-tester`, superseding `47d92d8` after harsh-critic adversarial pass

**Date:** 2026-04-21 (round 41, late — same-round supersedure)
**Status:** *Accepted.* Supersedes ADR `docs/DECISIONS/2026-04-21-router-coherence-claims-vs-complexity.md` (`47d92d8`, "v1"). v1 stays in place with a "Superseded by v2" header appended per `GOVERNANCE.md §2` so that the CONFLICT-RESOLUTION Active-tensions citation chain remains resolvable.
**Owner:** Architect (Kenji) integrates and is the **binding dispatcher** for the two-stage pipeline declared below (closes v1 P1-8). Hiroshi (`complexity-reviewer`) and Daisy (`claims-tester`) each sign their half of the contract; neither holds veto. Advisory input from Aarav (`skill-tune-up`) on whether the contract is honoured in practice; from Kira (`harsh-critic`) on whether the supersedure closes the findings that motivated it.
**Depends on:** `.claude/skills/complexity-reviewer/SKILL.md`, `.claude/skills/claims-tester/SKILL.md`, `docs/CONFLICT-RESOLUTION.md` (Active-tensions Hiroshi ↔ Daisy row now points at this ADR via v1's supersedure header), `docs/BACKLOG.md` (P0 supersedure item now discharged).

## Why supersedure, not inline edit

v1 landed at commit `47d92d8` without the adversarial-review gate the project applies to other load-bearing artefacts. A post-landing harsh-critic pass (Kira) surfaced **3 P0 + 5 P1 + 2 P2** substantive findings, enumerated as v1-P0-1 through v1-P2-10 in `docs/BACKLOG.md` lines 96-143. Because `docs/CONFLICT-RESOLUTION.md` (Active-tensions, Hiroshi ↔ Daisy row) already cites v1 as the Standing Resolution, inline-editing v1 would invalidate the reference: a reviewer citing "v1 §Stage-1 output 2" expects the referenced text to say what it said when cited. Supersedure preserves the citation graph — v1 remains the historical document, v2 carries the closures. This is the revision-control analogue of immutable-commit + new-commit-for-fix.

## Scope change from v1 — one-sentence summary

Both skills keep their scope. The two-stage pipeline remains: Hiroshi proves the analytic bound first, Daisy measures second; reverse trigger flows empirical → analytic on benchmark surprise. v2 (a) closes the three P0 gaps that blocked the escalation-evidence loop and left the grandfather set unowned, (b) names Kenji as the binding dispatcher so advisory + advisory composes to mandatory, (c) adds an escalation timebox that prevents v2 from reproducing the 23-round-stale failure mode v1 itself diagnosed, and (d) fixes two examples-vs-documentation inconsistencies. No scope creep; the v1 "future analyst/falsifier pairs" speculation is cut per v1-P2-10.

## Findings closed by v2

For each v1 finding, v2 states the concrete textual change. Kira's supersedure audit checks findings against these closure clauses.

### Closure C-P0-1 (scopes the grandfather clause — v1-P0-1)

v1 §Stage-2 trigger list mentions "a claim landed without Stage 1 (grandfathered pre-ADR work)" with no inventory, owner, or discharge cadence. v2 replaces that clause with:

> **Grandfather clause, bounded.** Pre-ADR claims are the set of `O(·)` claims that already exist in the repository at the time this ADR lands. Owner: Architect (Kenji) commissions a one-time audit within the round this ADR lands, produces `docs/research/grandfather-claims-inventory-YYYY-MM-DD.md` listing every docstring, README, BACKLOG, TECH-RADAR, paper-draft, and `openspec/specs/**` `O(·)` claim with its current Stage-1 and Stage-2 status. Discharge cadence: one pre-ADR claim per round thereafter until the inventory is empty, tracked via a `docs/BACKLOG.md` P2 entry created alongside the inventory. New claims (post-ADR) route through the normal Stage-1-first flow and do not enter the grandfather set.

Result: grandfather set is finite, owned, and discharges on a declared cadence. If the inventory is not produced within the round, Aarav files it as a P1 drift finding the following round.

### Closure C-P0-2 (reconciles table and prose on reverse trigger — v1-P0-2)

v1 §Decision table row "Performance regression in CI" reads *"Daisy (Stage 2) | Hiroshi (Stage 1) if measurement contradicts bound"*, implying Hiroshi re-engagement is conditional. v1 §Reverse trigger prose reads *"Any time a benchmark surprise surfaces ... the work routes to `claims-tester` Stage 2 **first** (to pin the numbers), then to Hiroshi Stage 1 **second**"* — unconditional. v2 reconciles by making the prose authoritative:

> **Reverse trigger is unconditional.** Every benchmark surprise (CI regression, allocation growth, unexpected scaling behaviour) routes first to Daisy's Stage 2 for numeric pinning and then to Hiroshi's Stage 1 for diagnosis, regardless of whether the measurement contradicts a previously-asserted bound. The decision-table row for "Performance regression in CI" is *"Daisy (Stage 2) → Hiroshi (Stage 1), unconditional"*. Rationale: a benchmark surprise that matches a stated bound still merits diagnosis — the bound may be right, but the constant factor or workload assumption usually tells us something new.

Result: no clause in v2 names a condition on Stage-1 re-engagement for the reverse trigger. Table and prose now agree.

### Closure C-P0-3 (unblocks the escalation-evidence loop — v1-P0-3)

v1 §Stage-1 output 2 reads *"File a P0 on `docs/BACKLOG.md`; cite the specific step where the claim fails ... Do **not** hand to Stage 2 until the code is fixed; measuring a wrong bound produces false comfort."* This blocks the conference-protocol escalation: if Hiroshi and Daisy disagree about whether the analytic argument holds, Daisy's measurement is the contradicting evidence the protocol needs, but this clause forbids producing it. v2 narrows the forbidding clause:

> **Stage-1 output 2 (v2).** When Hiroshi concludes the claim is analytically wrong, the default is to file a P0 and block Stage 2 — measuring a wrong bound on production-path code produces false comfort about the real-world constant factor. Exception: when the route is `escalation` (Hiroshi and Daisy disagree about the analytic argument itself, not about whether the code implements it correctly), Daisy's Stage 2 measurement is permitted as *evidence in the conference protocol* rather than as *validation of the claim*. Daisy labels such measurements explicitly: *"Measured under analytic-argument dispute; does not certify the claim."* This keeps the escalation's adversarial structure intact (Kenji integrates; on deadlock, Aaron decides per `docs/CONFLICT-RESOLUTION.md`) while allowing the empirical half to contribute evidence.

Result: the conference protocol has the evidence it needs; default is still "fix the code first, measure second".

### Closure C-P1-4 (aligns Status with citation state — v1-P1-4)

v1 Status: *"Proposed — awaits Architect + human-maintainer sign-off."* But `docs/CONFLICT-RESOLUTION.md` already cites v1 as Standing Resolution. v2 Status: **Accepted**. v1's header line is rewritten (same round as v1's landing, so no legacy state drift) to "Accepted (pre-adversarial-review; superseded by v2 after Kira pass)" when this ADR lands. Result: both ADRs' Status fields truthfully reflect their promulgation state.

### Closure C-P1-5 (matches Stage-1 trigger list to skill contract — v1-P1-5)

v1 §Stage-1 Trigger names "XML doc comment, README, `docs/BACKLOG.md`, `docs/TECH-RADAR.md`, paper draft under `docs/papers/`, or a spec under `openspec/specs/**`." This is narrower than `.claude/skills/claims-tester/SKILL.md` line 3, which covers any "doc comment, README, or commit message" claim. v2 widens:

> **Stage-1 trigger (v2).** A Stage-1 review fires on any `O(·)` claim introduced or modified in any of: XML doc comment, F#-style `///` triple-slash comment, README (any path), commit message, `docs/BACKLOG.md`, `docs/TECH-RADAR.md`, `docs/papers/**` draft, `openspec/specs/**`, `docs/research/**`, or any file under `memory/<persona>/*/NOTEBOOK.md` that ships an asserted bound to a downstream consumer. The contract mirrors `.claude/skills/claims-tester/SKILL.md`'s own trigger surface so that no skill is narrower than the other.

Result: the two contracts align; the forthcoming `skill-creator` updates to both SKILL.md files can cite this ADR without having to reconcile a mismatch.

### Closure C-P1-6 (preserves author-bounce information in the decision table — v1-P1-6)

v1 §Decision table row "Docstring lacks which bound" reads *"Hiroshi (Stage 1, output 3) | — "* with an em-dash under Stage-2; the prose §Stage-1 output 3 says *"Return to author."* v2 rewrites the row as *"Hiroshi (Stage 1) → Author (bounce with request to declare worst/amortised/expected/lower-bound) | Stage-2 does not fire"* so the author-bounce is explicit in the table and the Stage-2 non-firing is declared rather than implied by punctuation.

### Closure C-P1-7 (adds escalation timebox — v1-P1-7)

v1 §Escalation: *"If Hiroshi and Daisy disagree on a reconciliation ... the conflict escalates to the conference protocol in `docs/CONFLICT-RESOLUTION.md`."* No timebox. Aarav's round-18 finding v1 closes sat unresolved for 23 rounds precisely because escalation had no timebox. v2 adds:

> **Escalation timebox.** An escalation opens a file at `docs/DECISIONS/YYYY-MM-DD-<topic>-escalation.md` per `docs/CONFLICT-RESOLUTION.md` §5. The file carries a **round-window** header: escalations unresolved at the end of the round +2 from their filing round auto-promote to a P1 entry in `docs/BACKLOG.md` assigned to the Architect with a recurring "why is this still open?" note on each ranker run. The timebox is a discipline, not a deadline — resolution within the window is preferred; exceeding the window is legal but makes the drift visible rather than silent.

Result: v2 cannot reproduce the 23-round-stale failure mode v1 diagnoses, because after round +2 the drift self-surfaces in Aarav's ranking.

### Closure C-P1-8 (names the binding dispatcher — v1-P1-8)

v1 §Consequences — Neutral: *"Does not change either skill's tone or reviewer authority. Both remain advisory."* Two advisory roles do not compose to a mandatory two-stage pipeline without a binding dispatcher. v2 adds:

> **Binding dispatcher.** Both `complexity-reviewer` (Hiroshi) and `claims-tester` (Daisy) remain advisory on their individual findings. The *pipeline itself* — including the trigger conditions, the Stage-1 → Stage-2 ordering, the reverse-trigger rule, and the escalation timebox — is binding through the Architect (Kenji). Failure to run the pipeline on an in-scope claim is a blocking finding that Kenji surfaces at round-close. The two skills remain advisory on substance; the routing and sequencing are binding through the dispatcher. This matches the pattern in `docs/CONFLICT-RESOLUTION.md` where specialists advise and Kenji integrates with binding authority.

Result: advisory + advisory + binding-dispatcher composes to a mandatory pipeline without changing either skill's individual authority.

### Closure C-P2-9 (fixes BCL-contract example bug — v1-P2-9)

v1 §The shape of the gap uses *"inner `Dictionary.Remove` is `O(k)` under adversarial rehashing"* as an illustration of an analytic-vs-implementation mismatch. The BCL contract for `System.Collections.Generic.Dictionary<K,V>.Remove` is amortised `O(1)`; adversarial rehashing is the `k = 1` case under the current BCL implementation's chaining-plus-probing discipline, not a legitimate `O(k)` degradation mode. v2 replaces the example:

> **Example (v2).** *"The bound is wrong: the inner `Pool.Rent(int minimumLength)` can allocate a larger buffer than requested, so the per-call work is not `O(1)` when the consumer traverses the returned buffer assuming `== minimumLength` — it is `O(actualLength)` which can exceed `minimumLength` by up to `2×`. The outer claim of `O(n)` becomes `O(n · 2)` = `O(n)` only when the amortised analysis is tightened, and wrong when it is not."*

This is an actual BCL-contract mismatch (`ArrayPool<T>.Rent` documents the over-allocation behaviour) and a real trap the incremental-join code path could hit.

### Closure C-P2-10 (cuts the scope-creep paragraph — v1-P2-10)

v1 §Consequences — Positive includes *"Precedent for future analyst/falsifier pairs ... the two-stage pattern is reusable when the same shape appears elsewhere."* v2 cuts this paragraph. Rationale: the pattern is reusable *when a second instance actually surfaces*; pre-committing the project to it now is speculative scope. If a second pair (e.g. `verification-drift-auditor` vs `formal-verification-expert`) needs a hand-off contract, that contract gets its own ADR at that time; cross-referencing back to this ADR for pattern reuse is legal without this ADR needing to authorise it.

## The two-stage pipeline (authoritative v2 text)

### Stage 1 — analytic-first (complexity-reviewer, Hiroshi)

**Trigger.** Per Closure C-P1-5 above.

**Work.** Read the code against the claim. State: (a) worst-case bound, (b) amortised bound if different, (c) expected bound if different, (d) the lower bound that applies (streaming / external-memory / cell-probe / communication), (e) whether the constant factor is honest.

**Three outputs.**

1. *Claim analytically sound.* Hand off to Stage 2 with a note naming the contrary-workload to test.
2. *Claim analytically wrong.* File a P0 on `docs/BACKLOG.md`; cite the failing step. Default: block Stage 2 until fix. Exception: see Closure C-P0-3 (escalation evidence).
3. *Claim under-specified.* Bounce back to author with a request to declare which of (worst / amortised / expected / lower-bound / constant-factor) is claimed. Stage 2 does not fire.

### Stage 2 — empirical (claims-tester, Daisy)

**Trigger.** Hiroshi's Stage-1 hand-off (output 1) OR a grandfather-inventory item (per Closure C-P0-1) OR a benchmark surprise via reverse trigger (per Closure C-P0-2) OR an escalation-evidence request (per Closure C-P0-3).

**Work.** Smallest test that can falsify the claim: baseline + claim-proof + contrary-workload. Measure at the specified `n` range. Print the ratio, not just pass/fail.

**Three outputs.**

1. *Measurement matches analytic bound.* Test lands; tighten docstring to name the measured constant factor.
2. *Measurement contradicts analytic bound.* Re-engage Hiroshi. The analytic argument or the code is wrong. Stage 1 re-runs with the benchmark as new evidence. File a P0 until reconciled.
3. *Measurement matches bound on claimed workload but fails a contrary workload.* Narrow the claim to the workloads that held.

### Reverse trigger

Per Closure C-P0-2: unconditional Daisy-first → Hiroshi-second on any benchmark surprise.

### Who fires when — decision table (v2)

| Situation | First fires | Then fires | Notes |
|---|---|---|---|
| New `O(·)` claim in PR | Hiroshi (Stage 1) | Daisy (Stage 2) if Stage 1 output 1 | Default path |
| Performance regression in CI | Daisy (Stage 2) | Hiroshi (Stage 1), unconditional | Reverse trigger; C-P0-2 |
| Paper draft with bound | Hiroshi (Stage 1) | Daisy (Stage 2) before paper submission | Paper has higher evidence bar |
| Docstring lacks which bound | Hiroshi (Stage 1) → Author (bounce) | Stage 2 does not fire | C-P1-6 |
| Claim analytically wrong | Hiroshi (Stage 1, output 2) | Stage 2 blocked by default; escalation-evidence exception per C-P0-3 | C-P0-3 |
| Measurement ≠ bound | Daisy (Stage 2, output 2) | Hiroshi (Stage 1, re-run) | P0 until reconciled |
| Pre-ADR claim (grandfather) | Per C-P0-1 inventory | Cadence: one per round | Bounded set |

### Escalation

Per Closure C-P1-7: `docs/DECISIONS/YYYY-MM-DD-<topic>-escalation.md` with round +2 auto-promote to P1 on drift.

### Binding dispatcher

Per Closure C-P1-8: Kenji.

## Follow-up work (not this ADR)

- Update `.claude/skills/complexity-reviewer/SKILL.md` with a §"Hand-off to `claims-tester`" block citing *this* ADR (not v1). Route via `skill-creator` (GOVERNANCE §4).
- Update `.claude/skills/claims-tester/SKILL.md` symmetrically.
- Append "Superseded by v2 (`docs/DECISIONS/2026-04-21-router-coherence-v2.md`) after Kira adversarial pass" header to v1.
- Update `docs/CONFLICT-RESOLUTION.md` Hiroshi ↔ Daisy row to point at this ADR instead of v1 (or leave the v1 pointer and let the supersedure header do the redirect — Kenji's call at close).
- File the grandfather-inventory doc within the round per C-P0-1.
- `docs/BACKLOG.md` supersedure item discharged by this ADR's landing; Kenji removes the entry at round-close.

## Decision rationale (one paragraph)

v1 landed without adversarial review and surfaced 10 findings under Kira's harsh-critic pass. Rather than inline-edit a Proposed-but-cited ADR, v2 supersedes it in the same round and closes all 10 findings with named textual changes (three closures on the P0s, five on the P1s, two on the P2s) and names Kenji as the binding dispatcher that makes advisory + advisory compose to mandatory. v1 stays in place as the historical record; v2 is the operative contract. Same-round supersedure is the pattern v1's §Escalation clause permits — landing it in-round demonstrates the pattern works rather than deferring a known-imperfect artefact to round-42.
