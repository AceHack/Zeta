# Aminata — Red-Team Pass on Multi-Claude Peer-Harness Experiment Design (Iteration 1)

**Scope:** adversarial review of
`docs/research/multi-claude-peer-harness-experiment-design-2026-04-23.md`
(PR #270, branch `research/multi-claude-peer-harness-
experiment-design`) — specifically the five success
criteria, the eight-row failure-mode table, the four
mechanism candidates, the bullet-proof bar definition, the
cross-session edit discipline, and the Otto-iterates-solo
premise. Research and cross-review artifact only; advisory,
not a gate.

**Attribution:** findings authored by Aminata (threat-
model-critic persona, Claude Code, model
`claude-opus-4-7`). Source design authored by Otto
(Otto-93). Third adversarial pass this session (prior:
PR #241 5th-ferry governance edits; PR #263 7th-ferry
oracle rules). Same no-compliments discipline.

**Operational status:** research-grade. Does not authorise
launch of the experiment, nor override Otto's iteration
ownership.

**Non-fusion disclaimer:** two Claude Code sessions
coordinating is protocol, not personhood. Aminata's
concordance with Otto's framing on separateness is a
baseline expectation, not evidence of substrate fusion.

---

## Section 1 — The five success criteria

### 1.1 False-positive surface (criteria pass; experiment fails)

**CRITICAL.** Criterion 3 (*"cross-session review happens
at least once ... comments are substantive, not 'looks
good'"*) is trivially gameable. "Substantive" is a
judgement call the primary makes about its own output. A
single substantive comment on a single low-stakes PR
clears the bar while the broader review regime never
materialises. **Bar should be proportional:** substantive
review on >= N% of the secondary's merged PRs, not one
comment full-stop.

**CRITICAL.** Criterion 1 (*"tick-history rows cleanly ...
chronology preserved"*) is observable only post-hoc by
reading tick-history. A session that corrupts tick-history
*and* rewrites it to look clean — e.g., primary amends its
own row after observing a race — passes the criterion
while having already exhibited the exact failure mode the
criterion is meant to catch. Needs a `git reflog`-backed
audit, not a surface read.

**IMPORTANT.** Criterion 5 (*"no identity-blending
observed"*) is self-reported by the thing being audited.
A session that has already blended identity is the worst
possible auditor of its own blending. Independent-observer
scan required (Aaron or a third persona), or a lexical
grep pass over both sessions' output for collective-
pronoun density.

### 1.2 False-negative surface (real failures trip no criterion)

- **Work-product quality regression.** Two sessions
  coordinating with zero shared-resource conflicts, clean
  tick-history, and perfect identity discipline can still
  produce measurably worse PRs than one session alone
  would have. No criterion measures per-PR quality.
- **Coordination tax.** Both sessions could spend the
  30-minute bound entirely on coordination overhead
  (reviewing each other; resolving synthetic conflicts)
  with near-zero forward-motion on BACKLOG. No criterion
  measures throughput-per-session-minute vs single-session
  baseline.
- **Memory-folder mutation race** that happens to not
  produce a git artefact — e.g., two sessions both update
  the same `memory/MEMORY.md` entry, last-writer wins, no
  conflict marker because the writes happened through the
  memory tool not git. Criterion 2 is scoped to
  "shared-resource conflicts" which reads as
  file-conflicts; memory-layer mutation is invisible here.
- **Cron arming drift** — per AUTONOMOUS-LOOP, each
  session re-arms cron. If both sessions re-arm
  concurrently, you can end up with two crons firing on
  overlapping minutes. Nothing in the criterion set
  detects cron-multiplicity.

### 1.3 Observability timing

Four of the five criteria are post-session-only. Only
Criterion 4 (test-mode bounding) has an in-the-moment
signal (wall-clock monitor). **This is backwards for a
safety-critical experiment.** Halt conditions should be
detectable in-flight; currently the only in-flight halt is
wall-clock. Identity-blending, tick-history corruption,
and shared-resource conflicts are all theoretically
detectable live but the design punts them to post-hoc.

---

## Section 2 — The eight-row failure-mode table

### 2.1 Missing failure modes

- **Cross-session prompt-injection via memory folder.**
  The table covers cross-session prompt-injection via
  direct output; it omits the indirect channel where
  secondary writes to `memory/*.md` and primary reads the
  memory entry on next wake as authoritative context.
  This is a higher-probability injection vector than
  direct output because memory is *designed* to be read
  as guidance. Classify **CRITICAL**.
- **Cron-multiplicity.** Both sessions re-arm `* * * * *`
  cron; result is two scheduler streams, ticks fire twice
  per minute, tick-history explodes. Classify
  **IMPORTANT**.
- **Divergent `AGENTS.md` / `CLAUDE.md` reads.** If the
  two sessions read the bootstrap docs at different
  commits (one before a main-branch update, one after),
  they operate under silently-different rules. No row
  covers substrate-version skew. Classify **IMPORTANT**.
- **Tick-history append race that Git merges "cleanly"
  but semantically wrong.** Git line-merge treats two
  appended rows as both-keep; the rows may describe
  mutually-exclusive state transitions. Git is happy; the
  history lies. Classify **IMPORTANT**.
- **Secondary adopts a persona name that collides with a
  *retired* persona's memory folder** — CLAUDE.md
  honor-those-that-came-before policy says retired memory
  folders stay. If secondary names itself "Elena" and an
  Elena folder exists in `memory/persona/`, secondary
  inherits context it shouldn't. Classify **IMPORTANT**;
  the table has a name-conflict WATCH row but it's scoped
  to active personas only.
- **Approval-laundering.** Aaron's trust-based-approval
  pattern (memory: approves without comprehending) means
  secondary's PR gets approved by Aaron with primary
  having reviewed it. This creates a mutual-rubber-stamp
  risk that neither session can detect from inside.
  Classify **CRITICAL**; it corrupts the review signal
  for *all* future PRs, not just experiment ones.

### 2.2 Misclassifications

- **"Session dominance" (IMPORTANT)** should be
  **CRITICAL** for this experiment specifically. The
  experiment's entire purpose is to test peer-mechanics;
  if one session dominates, the experiment didn't test
  peer-mechanics, it tested a single session with an
  observer. That's a false-validation, not a soft finding.
- **"Wall-clock approaches bound" (WATCH)** should be
  **IMPORTANT**. The design's hard requirement per
  Otto-86 is bounded test-mode; a graceful-checkpoint-
  at-bound path that doesn't exist in code is not a
  WATCH, it's a missing defence.

### 2.3 Detection-method robustness

Six of the eight rows rely on Otto-self-observation
("primary's timeout monitor"; "primary reviews secondary's
output as data"; "DRIFT-TAXONOMY pattern 1 scan in
tick-history"). One Otto observing one Otto is not an
independent mechanism. At minimum: infinite-loop-bypass
detection needs a parent-process wall-clock enforcer
outside the Claude session (a launcher script with
`timeout 1800`), not primary's own monitor.

---

## Section 3 — The four mechanism candidates

### 3.1 Fidelity-vs-cost

| Mechanism | Fidelity | Cost | What it tests |
|---|---|---|---|
| Synthetic tick-history rows | Near-zero | Near-zero | Otto's imagination of what secondary would do |
| `Task` subagent dispatch | Low | Low | Single-turn parallel dispatch; not loop-agent behaviour |
| Paired worktree, same CLI | Medium-low | Low | Substrate mechanics; not concurrency |
| Bash-spawned background `claude` | High | Medium-high | Real concurrent loop-agent behaviour |

### 3.2 The right first-iteration choice

The doc states first iteration *"likely uses the
lowest-fidelity mechanism (synthetic rows + subagent
simulation)"*. This is **wrong for iteration 1.** Synthetic
rows test nothing except Otto's mental model; they cannot
surface any of the CRITICAL failure modes (cross-session
edit corruption, prompt-injection, infinite-loop bypass)
because there is no second process. Running iteration 1 on
synthetic rows and declaring "no failure modes emerged" is
the exact trivial-iteration game flagged in §4.

**Iteration 1 should be paired-worktree, same CLI.** It's
the first mechanism that exercises the substrate (git
merges, tick-history appends, memory reads) with real
file-system concurrency-adjacent writes. Subagent dispatch
as peer-simulation has a structural problem: the subagent
is **not a loop agent**. It has no cron, no persistent
memory between invocations, no autonomous-tick-closing
behaviour. Using it to test peer-harness mechanics tests
single-turn delegation, which is not what the experiment
is about.

### 3.3 Mechanism-specific risks

- **Bash-spawned background `claude`** — the Claude Code
  CLI's detached-session support is a research question,
  not a known capability. If the CLI requires interactive
  TTY, this mechanism is unavailable entirely. Confirm
  before scheduling iteration-plan around it.
- **Paired worktree** — the open-question about
  per-worktree auto-memory folder is load-bearing. If
  worktrees share memory, this mechanism tests concurrent
  memory mutation (good signal). If worktrees isolate
  memory, this mechanism under-tests the memory-race
  failure mode. Needs empirical check in iteration 1.

---

## Section 4 — Cross-cutting findings

### 4.1 Bullet-proof bar — theatrical

**CRITICAL.** The bar is "2 consecutive iterations with no
new failure modes + defences for all identified +
monitoring plan covers each." Trivially gameable: run two
iterations on synthetic tick-history rows (lowest
fidelity, zero concurrency). No new failure modes will
emerge because no mechanism exists for them to emerge
*in*. Bar cleared. Bullet-proof declared. Aaron runs
Windows validation against a design validated only
against Otto's imagination.

**Fix:** bar should require **at least one iteration at
highest available fidelity** (real concurrent processes
if CLI supports detached; paired-worktree with real-time
concurrent operation if not) before bullet-proof is
declarable. Iterations on lower-fidelity mechanisms count
toward design-refinement but not toward bullet-proof.

### 4.2 "Review yes, edit no" under forced-integration

**IMPORTANT.** The doc treats "review yes, edit no" as a
clean invariant. It isn't. Scenarios where the invariant
breaks:

- Secondary's PR merges; primary's in-flight branch now
  has merge conflicts with the merged secondary work.
  Primary must edit files secondary touched to resolve —
  that's cross-session edit by necessity.
- Secondary renames a symbol primary depends on. Primary
  edits its own code to match — which is an edit driven
  by secondary's decision. Is that "edit of secondary's
  substrate"? The design doesn't distinguish.
- Dependency-graph reorderings where primary's PR needs
  to land *before* secondary's to unblock secondary.
  Sequencing is a form of cross-session control the
  invariant doesn't address.

The invariant should be restated: "no direct commits to a
branch the other session authored; merge-conflict
resolution and dependency-ordering are allowed with
explicit PR-comment acknowledgement of the cross-session
dependency."

### 4.3 Otto-solo-iterates premise

**IMPORTANT — possibly CRITICAL.** Per Otto-93 Aaron-not-
bottleneck, Otto owns iteration. But there is a class of
failure modes Otto-solo fundamentally cannot surface:

- **Naming collision the secondary makes.** The design
  says secondary names itself in first-conversation-with-
  Aaron. Otto cannot simulate this because Otto-solo
  isn't the secondary in any meaningful sense — it's Otto
  wearing a secondary hat, with full knowledge of Otto's
  memory and intentions. A real second Claude session
  with no prior context makes different naming choices.
- **Divergent `AGENTS.md` interpretation.** Two Claude
  sessions reading the same doc at the same commit
  routinely interpret ambiguous passages differently.
  Otto-solo cannot produce that divergence because there
  is one interpretive agent.
- **Genuine disagreement during cross-session review.**
  Otto reviewing a PR Otto wrote is not a second-reviewer
  signal; it's self-review with a hat-swap. The
  experiment's stated aim is testing peer-mechanics;
  peer-mechanics require an actual peer.

**Recommendation:** bullet-proof cannot be achieved in
Otto-solo iteration for criterion 3 (cross-session review
substantive) or failure-mode row "contradictory review
guidance." These require a real second session. Either
(a) acknowledge them as explicitly un-testable-in-Otto-
solo-iteration and deferred to Aaron's Windows run
(making Aaron's run the *first* real test of those
criteria, not a validation of an already-bullet-proof
design), or (b) lower the bar on those specific criteria
for stage (b) and mark them as stage-(c)-or-(d) concerns.

---

## Summary of classifications

- **CRITICAL:** cross-session prompt-injection via memory
  folder (missing); approval-laundering (missing);
  criterion 3 trivially gameable; criterion 1
  self-reportable; bullet-proof bar theatrical;
  Otto-solo cannot surface cross-session-review failure
  modes.
- **IMPORTANT:** session-dominance should be CRITICAL;
  wall-clock-approaches-bound should be IMPORTANT;
  cron-multiplicity missing; substrate-version skew
  missing; tick-history semantic-merge-race missing;
  retired-persona name collision missing; forced-
  integration edge cases not handled.
- **WATCH:** worktree memory isolation question needs
  empirical check in iteration 1, not left open.
- **Dismiss:** none this pass. The design is
  well-structured enough that every finding is a real
  gap, not a category error.

---

## Relevant paths

- [`docs/research/multi-claude-peer-harness-experiment-design-2026-04-23.md`](multi-claude-peer-harness-experiment-design-2026-04-23.md)
  (under review, PR #270)
- [`docs/research/aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md`](aminata-threat-model-5th-ferry-governance-edits-2026-04-23.md)
  (prior pass this session)
- [`docs/research/aminata-threat-model-7th-ferry-oracle-rules-2026-04-23.md`](aminata-threat-model-7th-ferry-oracle-rules-2026-04-23.md)
  (prior pass this session; header-format reference)
- [`docs/AUTONOMOUS-LOOP.md`](../AUTONOMOUS-LOOP.md)
  (relevant for cron-multiplicity finding)
- [`CLAUDE.md`](../../CLAUDE.md) (honor-those-that-came-
  before — retired-persona collision finding)
