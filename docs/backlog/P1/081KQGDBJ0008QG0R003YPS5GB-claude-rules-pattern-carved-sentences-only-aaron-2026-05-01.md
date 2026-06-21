---
id: 081KQGDBJ0008QG0R003YPS5GB
priority: P1
status: open
title: Adopt `.claude/rules/<rule>.md` pattern + carved-sentences-only constraint (Aaron 2026-05-01)
created: 2026-05-01
last_updated: 2026-05-01
decomposition: decomposed
children: [081KR2E4K0008QG0R003DDAFJD, 081KR2E4K0008QG0R002FYNDT1]
depends_on:
  - 081KQ0YZ80008QG0R001V0XCYZ
  - 081KQGDBJ0008QG0R000E10AAM
# `depends_on` is a forward-compat schema field per
# `memory/feedback_backlog_hygiene_cadenced_refactor_look_for_overlap_not_just_dump_2026_04_23.md`
# 2026-05-01 extension; informational-only until tooling lands.
type: friction-reducer
---

# 081KQGDBJ0008QG0R003YPS5GB — Adopt `.claude/rules/<rule>.md` pattern + carved-sentences-only constraint

## Outcomes solved

This row is a **trajectory** (per the parallel-trajectories
discipline in `docs/active-trajectory.md` +
`memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`).
Outcomes it serves, ordered:

1. **Reduce always-on context-load** — CLAUDE.md is 23.7k
   chars; GOVERNANCE.md is 40.4k chars (AT the proven 40k
   ceiling — the sibling repo's incident report).
   AGENTS.md is 19.2k. Total always-on across our four
   surfaces: 107.5k chars. Sibling-repo experience
   indicates measurable performance impact above 40k
   per-file. Lazy-loading rule bodies into
   `.claude/rules/<rule>.md` keeps CLAUDE.md terse
   (headline + 1-paragraph summary + pointer per rule).

2. **Reduce goldfish-ontology recurrence** — per
   `memory/feedback_otto_buddy_spin_up_when_waiting_aaron_2026_05_01.md`,
   Otto rebuilds existing rules within 30 min of
   forgetting them. Per-rule canonical homes in
   `.claude/rules/<rule>.md` make grep-before-author
   trivially cheap (one file = one rule = one query).

3. **Carved-sentences-only compression** — Aaron 2026-05-01:
   *"you are only allowed carved statments in the rules
   compression is key."* Forces every rule to be
   blade-shaped, not prose-shaped. Composes with the
   carved-sentences architectural-claim cluster (in-flight
   integration) + CSAP framework. The constraint is the
   discipline.

4. **DORA-aligned — lower lead-time** — every session-wake
   that reads CLAUDE.md pays the always-on tax. Reducing
   that tax shortens the time-from-wake-to-productive-action
   for every agent invocation.

## External anchor

Sibling repo `../no-copy-only-learning-agents-insight`
ships this pattern at production scale:

- `.claude/rules/agent-behavior.md` — 30k chars (the big one)
- `.claude/rules/dst-and-dispose.md` — 12k chars
- `.claude/rules/dependencies-and-citus.md` — 5k chars
- `.claude/rules/claude-md-lean.md` — 4k chars (the
  meta-rule documenting the split)
- Smaller files (`backend.md`, `frontend.md`,
  `development-workflow.md`) are **`@<path>` references**
  delegating to existing `.cursor/rules/<rule>.mdc`
  entries — parallel-harness consolidation.

The sibling's `claude-md-lean.md` documents the proven
incident: a fresh Claude Code session reported
*"Large CLAUDE.md will impact performance (50.1k chars
> 40.0k)"* after rules accreted directly into CLAUDE.md.
The split was the mitigation. We are 23.7k on CLAUDE.md
today + 40.4k on GOVERNANCE.md — the ceiling is on the
horizon, not theoretical.

## Aaron's framing — load-bearing constraints

Aaron 2026-05-01 (verbatim):

> *"i mean honestly the way
> ../no-copy-only-learning-agents-insight does .claude/rules
> seems like the way to go and you are only allowed carved
> statments in the rules compression is key."*

Two load-bearing constraints:

1. **Adopt the sibling-repo `.claude/rules/<rule>.md`
   pattern** — proven design, no new architecture
   needed. Mechanical anchor: their pattern is the
   reference.
2. **Carved-sentences-only** — TIGHTER than the sibling
   repo (whose rules carry full prose bodies). Our
   constraint: every rule in `.claude/rules/<rule>.md`
   is a *carved sentence* (blade-shaped statement, no
   prose-explanation). Per the CSAP framework + the
   carved-sentences architectural-claim cluster
   (in-flight integration; the canonical filename will
   resolve once that PR merges). Compression is the
   discipline. (Aaron's verbatim "carved statments" maps
   to the established factory term "carved sentences" —
   single-source vocabulary per the engagement-under-
   discipline memo's mirror-language convention.)

The combination is novel: sibling's lazy-load shape +
our carved-sentence constraint. The sibling's pattern
proves the lazy-load works at scale; the carved-sentence
constraint is our addition.

## Phase 1 — design + first three rules (P1)

**Acceptance criteria**:

1. **`.claude/rules/<rule>.md` directory created** — empty
   initially, with a `README.md` that defines:
   - The carved-sentences-only constraint
   - Pointer back to CSAP framework for rule promotion
   - Pointer to `claude-md-lean.md` for the lazy-load
     pattern
2. **Three pilot rules migrated** — pick the three rules
   currently in CLAUDE.md that are heaviest (longest
   prose) AND most frequently violated:
   - Candidate 1: verify-before-deferring
   - Candidate 2: future-self-not-bound
   - Candidate 3: substrate-or-it-didn't-happen (Otto-363)
   Each becomes a `.claude/rules/<name>.md` with a
   carved-sentence body + reference incident pointer.
3. **CLAUDE.md updated** — replace the three rules' bodies
   with: heading + 1-paragraph summary + pointer line.
4. **Char-count verification** — `wc -c CLAUDE.md` after
   migration shows reduction proportional to the moved
   bodies.
5. **Carved-sentences linter** — pre-commit hook that
   verifies every `.claude/rules/<rule>.md` body is
   ≤ N sentences (N to be determined; candidate: 3
   carved-sentence claims max per rule). Linter is a
   081KQGDBJ0008QG0R000E10AAM lint-class candidate.

## Phase 2 — bulk migration (P2)

Migrate remaining standing rules from CLAUDE.md +
GOVERNANCE.md into `.claude/rules/<rule>.md` files.
Each migration:

1. Identify the rule's full prose body in
   CLAUDE.md/GOVERNANCE.md
2. Carve it down to ≤ N carved sentences for
   `.claude/rules/<rule>.md`
3. Replace original prose with summary + pointer
4. Verify char-count budget
5. Update copilot-instructions.md if relevant

GOVERNANCE.md at 40.4k is the priority surface
(already at the proven ceiling).

## Phase 3 — parallel-harness consolidation (P3)

Mirror the sibling-repo's `@<path>` reference pattern
for rules that have `.cursor/rules/<rule>.mdc`
equivalents (per the agent-orchestra harness adapters
trajectory, tasks #324-339). Each
`.claude/rules/<rule>.md` can be a 1-line `@<path>`
pointer to a Cursor-equivalent rule, or vice-versa,
keeping both harnesses sync'd from a single canonical
source.

## Composes with

- 081KQ0YZ80008QG0R001V0XCYZ — MEMORY.md compression pass (sibling
  cleanup; both serve the broader compression
  discipline)
- 081KQGDBJ0008QG0R000E10AAM — pre-commit lint suite (Phase 1's
  carved-sentences-linter is a candidate class)
- `memory/feedback_otto_buddy_spin_up_when_waiting_aaron_2026_05_01.md`
  — goldfish-ontology fix; lazy-loaded rules make
  pre-author grep cheap
- `memory/feedback_outcomes_over_vanity_metrics_goodhart_resistance.md`
  — outcomes-driven framing
- `memory/feedback_detect_changes_pattern_sibling_repo_parallel_optimized_external_anchor_aaron_2026_05_01.md`
  — sibling-repo as external anchor (same anchor as
  this row; different pattern surface)
- The carved-sentences architectural-claim cluster
  (PR #1111 in-flight; canonical memory filename
  resolves once that PR lands) — the
  CSAP framework that defines what "carved" means
- `memory/feedback_prefer_mechanical_external_anchors_over_aaron_as_anchor_aaron_2026_05_01.md`
  — sibling-repo IS the mechanical anchor, not
  Aaron-as-anchor

## What this row does NOT do

- **NOT a license to immediately bulk-migrate every
  rule** — Phase 1 ships three pilot rules; bulk
  migration is Phase 2 + 3 with explicit cadence.
- **NOT a replacement for `memory/`** — `.claude/rules/`
  holds *standing rules* (BP-NN-class); `memory/` holds
  *episodic substrate* (corrections, observations,
  preferences). Different stores, different shapes.
- **NOT a hard ceiling shift** — the 40k char ceiling is
  Claude Code's reported threshold; if Anthropic raises
  it, the priority shifts but the goldfish-reduction
  outcome remains.
- **NOT a green-field architecture** — the sibling-repo
  pattern is the reference design; we adopt + add the
  carved-sentence constraint, we don't invent.
