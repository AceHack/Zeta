---
id: B-0153
priority: P2
status: open
title: Pre-commit lint suite — consolidate the 13 mechanizable lint-classes characterized 2026-05-01
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# B-0153 — Pre-commit lint suite — mechanizable lint-class consolidation

## What

Build a pre-commit lint suite consolidating the **13 mechanizable
lint-classes** thoroughly characterized during the 3-PR
substrate cluster iteration 2026-05-01 (PRs #1116, #1117,
\#1118, and #1119, ~17 ticks of CI/review iteration). Each class
corresponds to a friction encountered by reviewer agents
(Copilot + reviewers) that mechanizable pre-commit checks would
have eliminated.

The amortized-keystone discipline (per
`memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`)
predicts that mechanizing these checks at commit-time eliminates
review-time iteration. The 2026-05-01 cluster provides empirical
evidence: ~17 ticks of CI/review iteration that pre-commit lint
would have closed in single-push.

## Why now

The 3-PR substrate cluster (parallelism-scaling-ladder,
timeseries-DB, and topological-quantum-emulation) is now fully
merged. The
cluster's iteration journey produced empirical characterization
of 13 distinct lint-classes that compound coordinator-load when
unmechanized. Filing a single consolidated row prevents the
classes from diffusing into the backlog as 13 separate rows.

## The 13 mechanizable lint-classes

Classes are globally numbered 1-13. Subsection headings group
by category but do NOT restart numbering — the global IDs are
what the "Empirical motivation" section below cites and what
implementation should use as stable class identifiers.

<!-- markdownlint-disable MD029 -->
### Markdown rendering (classes 1-4)

1. **MD032 / blanks-around-lists**: literal line-leading `+` in
   flowing prose interpreted as list-marker, triggering the
   blanks-around-lists rule. Fix-pattern: prose-reflow with
   connectives ("plus", "and", comma-list, "/"). Aaron-affirmed
   as *"very high quality decision"* (Aaron typed "decison").
2. **MD038 / no-space-in-code**: spaces inside inline-code spans
   (e.g., `` `| ` ``) trigger MD038. Fix: tighten code-span or
   replace with prose.
3. **Inline-code broken across lines**: backtick-fenced filenames
   that wrap mid-token break CommonMark inline-code spans. Fix:
   move full filename to own line.
4. **Asterisk-in-quoted-content rendering**: trailing `*` in
   quoted verbatim (e.g., Aaron's `"amortized*"`) breaks italic
   markup. Fix: escape inner `*` or add annotation.

### Reference resolution (classes 5-9)

5. **Wildcard refs vs concrete filenames**: `feedback_*_*.md`
   patterns in flowing prose don't resolve to a real file. Fix:
   replace with concrete filename or descriptive prose.
6. **Bare memory-ref vs `memory/`-prefix**: `feedback_*.md`
   without `memory/` prefix in backlog rows is inconsistent
   with other rows. Fix: prepend `memory/`.
7. **Forward-ref to unmerged PR**: references to files in
   sibling-PR branches that don't exist on main yet. Fix: annotate
   as "(forward-ref to PR #N)" until target merges.
8. **B-NNNN refs that don't resolve**: references to backlog
   rows that don't exist as files in `docs/backlog/**`. Fix:
   annotate as `(not yet filed)` / `(when filed)` / `(when
   they land)`.
9. **`task #NNN` vs GitHub auto-link ambiguity**: `task #NNN`
   pattern conflicts with GitHub's automatic `#NNN` PR/issue
   linking. Fix: prefix with `Otto-task #NNN` to disambiguate.

### Project-state accuracy (classes 10-13)

10. **Stale code-tree paths**: `Zeta.Core/**`, `Zeta.*/**`
    stale references when actual code lives under `src/Core/**`,
    `src/Core.CSharp/**`, `src/Bayesian/**`. Fix: use concrete
    current paths.
11. **Aspirational tooling without framing**: `tools/lint/markdownlint`
    or similar paths cited as if existing when they don't.
    Fix: prefix with framing words ("envisioned", "candidate
    path", "to be established", "when filed").
12. **URL canonicalization**: `research.microsoft.com` form vs
    repo-canonical `https://www.microsoft.com/en-us/research/`
    form. Fix: use canonical form.
13. **MEMORY.md duplicate-link-targets**: post-rebase regression
    where long-form-original + tightened-one-liner both point
    at same memory file. Fix: dedup keeping terse form per
    `memory/README.md` policy.
<!-- markdownlint-enable MD029 -->

## Acceptance criteria

1. **Consolidated lint script** at `tools/lint/pre-commit-suite.sh`
   that runs all 13 checks and reports per-class violations
   with file:line context.
2. **Pre-commit hook integration**: `.husky/pre-commit` (or
   equivalent) invokes the suite on staged `.md` files.
3. **Per-class fix-suggestion output**: each violation prints a
   one-line fix-suggestion based on the characterized fix-pattern
   from this row's class taxonomy.
4. **Opt-out mechanism**: `git commit --no-verify` still works
   for emergencies (matches existing pre-commit hook conventions).
5. **CI parity**: the same suite runs in CI as a fail-fast
   check before the existing markdownlint job (so CI failures
   match local pre-commit failures).
6. **Evidence-based prioritization**: each class implementation
   cites the PR + commit + line that motivated it (the
   2026-05-01 substrate cluster provides this evidence).

## Out of scope (defer)

- **Auto-fix mode**: the script reports violations but doesn't
  auto-fix. Auto-fix is Layer-2 work (composes with the
  motorized-keystone dimension); deferred until violation
  reporting is solid.
- **Lint extensions to non-markdown files**: this row scopes
  to markdown-substrate (memory/, docs/). Code-side lint is
  separate.
- **Phantom-blocker P0 schema-violation noise**: copilot's
  false-positive `||` claims on tick-shards (3/3 verified false
  via `xxd`) are reviewer-noise, not authoring-error. Mitigation
  is reviewer-side, not lint-side.
- **Outdated-thread auto-resolve script**: separate concern;
  candidate path `tools/hygiene/resolve-outdated-threads.sh`
  (not yet filed) is its own row.
- **Rebase-after-sibling-merge mechanization**: separate
  concern; candidate path
  `tools/hygiene/rebase-after-sibling-merge.sh` (not yet filed)
  is its own row.

## Composes with

- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  — the amortized-keystone discipline this row instantiates
- `memory/feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
  — fitness-function-first; this row IS the harness for
  pre-commit quality
- `memory/feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
  — the metrics-are-our-eyes framing; this lint suite is
  one mechanism that adds to the factory's sensory capacity
- `memory/feedback_topological_quantum_emulation_via_bayesian_inference_majorana_zero_modes_beacon_protocol_mirror_trampoline_aaron_2026_05_01.md`
  — the Mirror+Trampoline+Beacon emulation discipline
- `memory/feedback_same_model_different_harness_produces_different_biases_cursor_vs_claude_code_opus_4_7_aaron_2026_05_01.md`
  — peer-mode harness-bias substrate
- `docs/AGENT-BEST-PRACTICES.md` — BP-NN rule catalog; promoted
  classes from this suite become BP-NN entries
- `tools/lint/no-directives-otto-prose.sh` — existing precedent
  for factory-specific lint
- `memory/README.md` — terse-one-line-per-entry policy that
  class 13 enforces

## Empirical motivation

The 3-PR substrate cluster iteration journey (~17 ticks of
CI/review iteration documented in the tick-history shards
1344Z through 1501Z, 2026-05-01) provides direct empirical
evidence:

- **PR #1118** (topological-quantum-emulation): hit classes
  1, 2, 4, 8, 9 → required ~3 force-push iterations
- **PR #1117** (timeseries-DB + dependency-priority +
  metrics-are-our-eyes): hit classes 1, 2, 5, 8, 11, 12 →
  required ~5 force-push iterations
- **PR #1116** (parallelism-ladder + reproducibility-first):
  hit classes 1, 5, 6, 7, 8, 10, 11, 13 → required ~6+
  force-push iterations
- **PR #1119** (harness-bias): hit classes 5, 9 → required
  1 force-push iteration

Total: ~15 force-push iterations across 4 PRs that the
consolidated lint suite would have closed in single-push.
The amortized-keystone empirical confirmation is now 4-PR
strong.

## Effort

**M (medium, 1–3 days)** for the script, pre-commit hook,
CI parity, and per-class fix-suggestion output. Per-class
implementation effort is small (each is a regex / file-glob
check); the consolidation effort is the integration shell.

## Why P2

- **Not P0/P1** because the factory functions today; lint-
  driven CI iteration is a friction-cost, not a correctness
  failure.
- **Not P3** because every future PR pays the same compounding
  cost when these classes are unmechanized. The 4-PR cluster
  provides ~15 force-push empirical evidence; even one
  additional PR with this baseline justifies P2.
- **P2** sits where mechanization is important + lands when
  bandwidth permits. The substrate cluster's empirical
  characterization makes the work mechanically definable;
  no design risk remaining.

## Carved-sentence framing

*"Each unmechanized lint-class is coordinator-load that
compounds across PRs. The amortized-keystone discipline
turns 15 force-push iterations into one pre-commit pass."*
