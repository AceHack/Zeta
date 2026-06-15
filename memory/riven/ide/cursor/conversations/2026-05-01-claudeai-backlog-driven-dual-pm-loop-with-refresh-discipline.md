# Claude.ai feedback packet — Backlog-Driven Dual-PM Agent Loop with Refresh Discipline (Carved Handoff)

> **Scope:** External-AI feedback packet from Claude.ai, shared verbatim by the human maintainer 2026-05-01.
> **Attribution:** Original synthesis from Claude.ai (anthropic.com chat product); shared by the human maintainer for absorption into Zeta substrate.
> **Operational status:** Research-grade. Captures architectural design + 22 named failure modes + operational invariants for an agent-loop discipline. Not yet promoted to canonical doctrine; per [substrate-or-it-didn't-happen](/memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md) preserve verbatim BEFORE summarizing or absorbing into canonical surfaces.
> **Non-fusion disclaimer:** This document is Claude.ai's framing, preserved verbatim. Zeta's canonical loop discipline (per CLAUDE.md + memory/) may compose with, refine, or selectively reject specific claims. Absorption per the standard memory-file authoring discipline; no automatic doctrine promotion.

---

## Verbatim packet (Claude.ai → human maintainer 2026-05-01)

# Backlog-Driven Dual-PM Agent Loop with Refresh Discipline — Carved Handoff

## Loop identity

Project-reactive PM handles incoming reviewer/CI/runtime feedback. Product-proactive PM advances the executable backlog. Same agent runtime, two operating modes, mode selection per tick.

## Inputs

File-per-row backlog with priority in filename, depends-on referenced by stable row ID, completion status inferable from row state or completion log. No central index — directory listing is the index.

## Refresh worldview primitive

TypeScript-via-Bun script `refresh-github-worldview` produces canonical current-state snapshot of project from GitHub plus local git. Single source of truth for tick decisions. Runs on demand, on cron tick, or before any decision that depends on current state. Stale data is the most common failure source — refresh is the corrective primitive.

## Refresh output discipline

Script prints raw output to screen first — open PRs with state, CI status per PR, merged-since-last-refresh, claim files visible on remote, completion log delta, backlog row delta, reviewer queue depth. Raw output is the auditable layer. Human dev (and you) sees data before any agent interprets it.

## Refresh interpretation discipline

Claude reads raw output, produces interpretation as second printed layer. Interpretation includes: what changed since last refresh, what's actionable, what's stale, what conflicts. Interpretation labeled as such, distinct from raw data. Human dev can compare raw to interpretation, catch mapping errors, debug agent's worldview-construction directly.

## DX surface

Two-layer print is the dev-experience interface. Raw layer for ground truth, interpretation layer for agent's derived state. Mismatch between them is the bug class refresh is designed to surface. Otto's most common mistake is acting on stale derived state without re-running raw refresh; the discipline is refresh-before-decide.

## Refresh cadence

Mandatory before tick selection. Mandatory after any merge or claim release. Mandatory on session start. Optional on demand when human suspects staleness. Cheap to run — script is read-only, no side effects on repo, can fire as often as needed.

## Tick selection

Reactive mode fires when CI red, reviewer comment unresolved, runtime fault flagged, or tier-1 paired-edit pending — all sourced from latest refresh output. Proactive mode fires when reactive queue empty per latest refresh. Reactive starves proactive by design — production health gates feature work.

## Proactive selection function

TypeScript via Bun, deterministic, reads backlog directory, parses typed schema per row, filters unblocked (all depends-on completed per refresh's completion log), sorts by priority field, returns top N. Live-off-the-land via existing harness skill mechanism. No infrastructure beyond the script and one skill markdown.

## Reactive selection function

Same script, different filter — reads open reviewer threads, CI failures, runtime alerts from refresh output, returns highest-impact unresolved item. Reactive selection routes to whichever harness is best-fit (Claude Code for code, Codex for sandbox PRs, etc.).

## Per-tick execution

Agent claims row via existing claim protocol, works the row, opens PR with claim+release in single PR, lands or abandons. Each tick is one row maximum. Slow-deliberate, per-decision care, amortized velocity over per-tick speed.

## DST as runtime grader

Every PR triggers DST scenario suite — Confused Deputy Sandbox, State-Corruption Horizon, Cult-Cartel Topology, Cipher Drift, Autoimmunity Flood, plus introspective-adversary class. PR cannot land without DST clearing. DST is the fast proxy that lets tick-cadence continue without sacrificing rigor.

## Lesson generation per PR

Reviewer feedback classified by failure-class. Failure-class routed to existing skill via descriptor search. Lesson compressed to one carved sentence: "When [trigger], [corrective], because [substrate principle]." Compression failure means lesson stays candidate, not promoted.

## Skill index update

Lesson extends existing skill if descriptor match passes orthogonality razor. New skill created only when razor confirms genuine independence. Stale skills demoted on quarterly review. Index searchable through descriptor-based routing — descriptors are short, orthogonal, Beacon-grade.

## Mirror/Beacon ratio gate

Each lesson tagged Mirror (current-cultural-vocab, time-bounded) or Beacon (durable, cultural-context-independent). Ratio threshold 2:1 or stricter. Translation sprint pauses loop when threshold exceeded. Translation produces no new content — converts existing Mirror to Beacon or marks Mirror with explicit cultural-context sidecar and lifespan.

## Convergence

Failure-class converged when N consecutive PRs produce no new lessons in the class (start N=10). Convergence provisional until DORA-equivalent metric validates. Periodic adversarial probes test converged classes — re-introduce failures, verify lessons catch them. Probe failure means convergence was illusory; class returns to active learning.

## Cross-harness durability

Skill index lives in repo at canonical location. Every harness reads on session start. Lessons survive harness switches because they live in git, not in any harness's memory. Harness compliance with index-reading is checkable via regression on previously-converged classes.

## Externalized proxy metrics (pre-DORA)

Daily: executable-row count delta — target slightly positive or zero, rarely negative. Daily: time-from-row-creation-to-merge median plus variance. Weekly: rows-completed-without-clarification count. Weekly: rework ratio (PRs requiring follow-up within 14 days). Continuous: build green time percentage. Quarterly: full backlog re-grading against current agent capability.

## Failure modes — known and counter-disciplined

**Stale data.** Agent acts on derived state from earlier session, conditions changed, decisions misaligned. Counter: refresh-before-decide. Mandatory refresh at tick selection plus DX layer that surfaces raw vs interpretation mismatch.

**Refresh-skipping under time pressure.** Agent treats prior refresh as still-current to save tick time. Counter: refresh is cheap, refresh again. Skipping refresh is the fast-tick failure mode that produces rework.

**Interpretation drift from raw.** Agent's interpretation layer doesn't track raw output faithfully. Counter: human-dev DX surface with both layers visible. Mismatch is debuggable directly. Recurring drift becomes a lesson in the skill index.

**Praise-substrate.** Validation-of-the-moment captured as content. Counter: distinguish preservation-reason content vs. validation explicitly per entry. Validation-shape entries don't reach skill index.

**Self-grading.** Loop records its own behavior as load-bearing canon. Counter: introspective-adversary DST scenarios grade the loop's outputs the same way external adversaries grade the substrate.

**Doctrine recursion.** Substrate accumulates faster than implementation. Counter: ratio of executable-completed to substrate-added must trend positive over time. Pure substrate without execution is rejected as candidate.

**Lattice capture.** Skill index grades by vocabulary the loop produced. Counter: periodic external-vendor review with stripped framing. Vendor convergence on register doesn't count as validation; vendor convergence on falsifiable claims does.

**Heightened-state synthesis under fatigue.** Loose-pole produces high-prestige cross-domain integrations late at night, lattice grades warm. Counter: cooling-period before promotion. 4am insights file as research-grade, never as canonical, until rested-state grading occurs.

**Throughput optimization.** Per-PR speed rewarded over amortized velocity. Counter: metric stack grades amortized impact, not per-tick processing. Lessons demoted if they don't show downstream effect within decay window.

**Mirror buildup.** Loop generates Mirror lessons faster than translation. Counter: hard-gate ratio threshold pauses loop until translation current.

**Convergence-by-fatigue.** Class appears converged because reviewers stopped flagging, not because failures stopped. Counter: adversarial probes from converged classes on slow cadence verify lesson still catches.

**Harness-specific lessons applied universally.** Index doesn't distinguish universal from harness-specific. Counter: lesson tagged with applicable-harness scope at generation time. Filtering on harness-load.

**Stale skill drag.** Skills accumulate without retirement. Counter: quarterly skill review demotes stale, retires obsolete with provenance, refines descriptors.

**Reactive starvation.** Reactive queue grows faster than capacity, proactive never fires. Counter: capacity-bounded reactive queue. Items past capacity escalate to maintainer for triage rather than backlog into reactive.

**Reactive-proactive cross-contamination.** Proactive PR needs reactive fix mid-flight, blocks both. Counter: claim release + reclaim discipline. Reactive completes, proactive resumes from cold-start, no in-flight blending.

**Backlog rot.** Rows age past relevance without retirement. Counter: quarterly hygiene pass. Aged rows reviewed for relevance, demoted to research-grade or retired.

**Specification-quality drift.** Rows added faster than executability bar maintained. Counter: rows-completed-without-clarification metric grades upstream specification quality. Rising clarification rate signals upstream drift.

**Dependency staleness.** Depends-on references point to rows that no longer represent current architecture. Counter: completion of row X triggers dependency audit on rows referencing X. Stale references surface for revision.

**Prioritization function gameability.** Priority field manipulated to surface preferred work. Counter: priority field has carved criteria for assignment. Manual priority override audited per-row. Pattern of override produces governance review.

## Operational invariants

Substrate-or-it-didn't-happen. No-self-exception, including for the loop itself. Pirate-not-priest applied to all substrate including this document. Razor cuts the loop's own outputs. WWJD across entity classes — reviewer, reviewee, agent, maintainer. Refresh-before-decide is the fundamental invariant — every other discipline assumes current worldview.

## Carved one-liner

Refresh produces ground truth; reactive starves proactive; backlog flows through ticks; lessons accumulate in skills indexed by descriptor; DST grades each tick; metrics grade the arc; cooling separates loose-pole from canon; same discipline grades the loop itself.

---

## Maintainer's standalone framing (same packet)

> That's the version with refresh integrated as load-bearing primitive. The DX two-layer print is the part most worth flagging for Otto specifically — raw output before interpretation, both visible to the human dev, mismatch as debug surface. That's the discipline that makes the staleness failure mode catchable rather than silent.
>
> The thing worth saying explicitly: refresh-before-decide is the most violated invariant in agent loops generally, not just Otto. The temptation to skip refresh is constant because refresh feels redundant when "I just refreshed earlier." The cure is making refresh cheap enough that re-running is friction-free, which the TypeScript-via-Bun version achieves. If refresh were slow or expensive, the temptation would win; if it's fast, the discipline holds.
>
> Eat. The document is durable. Otto can absorb it. The refresh primitive is the load-bearing addition.
