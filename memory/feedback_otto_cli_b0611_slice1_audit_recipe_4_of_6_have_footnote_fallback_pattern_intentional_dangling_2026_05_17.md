---
name: 081KRSKQ20008QG0R0014PPGZM slice 1 audit recipe — 6 dangling refs in .claude/skills + .claude/rules; 4/6 have established footnote-fallback pattern (intentional dangling)
description: Slice-1 prep for 081KRSKQ20008QG0R0014PPGZM cleanup (skills + rules surface, 6 of 35 total dangling refs). Per-ref recipe captured. Key substrate-design observation — 4 of 6 dangling refs are INTENTIONAL (the citing rule explicitly footnotes the user-scope path with an in-repo fallback). The audit tool exit-1 on these may be false positives under the footnote pattern. Raises the substrate-design question of allowlist annotation vs deletion of the user-scope citation.
type: feedback
created: 2026-05-17T06:37Z
---

# 081KRSKQ20008QG0R0014PPGZM slice 1 audit recipe — 6 dangling refs, 4 footnoted-intentional

## Audit output (`tools/hygiene/audit-dangling-memory-refs.ts --surfaces .claude/skills .claude/rules`, 2026-05-17T06:37Z)

| # | citing | line | dangling-ref filename (in `memory/`) | pre-existing in-repo fallback? |
|---|---|---:|---|---|
| 1 | `.claude/skills/counterweight-audit/SKILL.md` | 179 | `feedback_memory_alone_leaky_without_cadenced_inspect_audit_for_missing_balance_otto_278_2026_04_24.md` | (needs inspection) |
| 2 | `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` | 125 | `feedback_classifier_caught_otto_in_standing_by_failure_mode_80_consecutive_heartbeat_polls_no_work_violated_own_rule_2026_05_15.md` | YES — rule body says "user-scope only — preserved at `~/.claude/projects/.../memory/` on maintainer machines; cold-boot agents on fresh checkouts should read the rule body above + `memory/CURRENT-otto.md` in-repo for the projection" |
| 3 | `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` | 132 | `feedback_aaron_zeta_is_memory_preservation_specialist_first_everything_else_second_ephemeral_or_maxed_out_chat_agents_2026_05_15.md` | YES — rule body says "user-scope only; same cold-boot fallback as above — `memory/CURRENT-aaron.md` or `memory/CURRENT-otto.md` in-repo carries the constitutional projection" |
| 4 | `.claude/rules/premise-flagged-unverified-stays-unverified-downstream.md` | 88 | `feedback_aaron_we_are_the_ones_cooking_it_youtube_finance_ai_video_substrate_validation_fsharp_fork_for_ai_safety_90_percent_python_type_failures_64_beats_75_with_type_poisoning_2026_05_16.md` | (needs inspection — likely has in-line "Canonical substrate lesson" section per memory's known structure) |
| 5 | `.claude/rules/codeql-no-source-on-docs-only-pr-is-broken-commit-canary.md` | 126 | `feedback_codeql_no_source_seen_on_docs_only_pr_is_broken_commit_canary_not_flake_lior_lock_cleanup_race_2026_05_15.md` | YES — rule body says "user-scope only — preserved at `~/.claude/projects/.../memory/` on maintainer machines and indexed in user-scope `MEMORY.md`. Cold-boot agents on fresh checkouts: this rule's own body above is the canonical in-repo projection; `memory/CURRENT-otto.md` may also carry the entry" |
| 6 | `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` | 191 | `feedback_aaron_shadow_star_shorthand_means_autocomplete_generated_not_aaron_authored_grey_text_completed_2026_05_15.md` | YES — there's a separate `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` AND the m-acc rule body says "see [`shadow-star-shorthand-autocomplete-marker.md`](shadow-star-shorthand-autocomplete-marker.md) for the in-repo rule that names the shorthand definitively" |

**Established pattern**: 4 of 6 (#2, #3, #5, #6) already carry an
explicit footnote that:

1. Acknowledges the user-scope-only nature of the cited file
2. Names a specific in-repo fallback (CURRENT-*.md projection,
   rule body itself, OR a sibling rule)
3. Tells cold-boot agents what to do when they can't follow the
   path

The citation IS substrate-honest documentation of the user-scope
asymmetry, AND it's compositional with the in-repo fallback. The
audit tool's exit-1 on these references the path-existence check
only, NOT the surrounding pattern.

## The substrate-design question

**Resolving the 4 footnoted refs requires a design choice:**

- **Option A — Allowlist annotation**: extend the audit tool to
  recognize an inline annotation (e.g., `<!-- audit-allowlist:
  user-scope-intentional -->` adjacent to the citation) and skip
  flagged refs that opt-in. Treats them as known-intentional,
  unblocks CI integration of the audit tool.

- **Option B — Delete the user-scope citation, keep the footnote**:
  remove the `memory/feedback_*.md` filename mention; rewrite the
  footnote as "the user-scope memory + in-repo projection at
  `<path>` covers this." Pure-pattern — audit-tool returns 0,
  substrate stays substrate-honest, future-Otto follows the in-repo
  projection path.

- **Option C — Move the cited memory in-repo**: if the maintainer's
  PII discipline allows, port the user-scope content into the
  in-repo `memory/` directory. Restores the citation's truthfulness.
  Tradeoff: leaks the maintainer's local content into the public
  repo per the user-scope-vs-in-repo split that motivates the
  CURRENT-*.md projection pattern in the first place.

- **Option D — Hybrid**: per-citation choice. Some get deleted
  (purely structural references), some get moved in-repo (load-
  bearing content), some get allowlisted (footnoted-intentional).

**Recommendation for 081KRSKQ20008QG0R0014PPGZM slice 1**: ask the maintainer at next
safe-window which option (or hybrid mix) fits the substrate-
honest discipline. This is NOT a tick-scope decision — it's a
substrate-design question that should compose with
`.claude/rules/honor-those-that-came-before.md`,
`.claude/rules/substrate-or-it-didnt-happen.md`, and
`.claude/rules/wake-time-substrate.md`.

## What slice 1 cleanup looks like AFTER design decision

Once Option A/B/C/D is chosen:

- **Edit the 4 footnoted citing rules** to implement the choice
  (annotation OR deletion OR in-repo path)
- **Inspect refs #1 + #4** to determine whether they fit the
  same pattern OR need different treatment
- **Verify**: `bun tools/hygiene/audit-dangling-memory-refs.ts
  --surfaces .claude/skills .claude/rules` exits 0
- **Commit** the changes in one PR with explicit paths

If Option A is chosen, the audit tool itself needs a sibling
update (allowlist parser). That's an additional PR scope.

## Composes with

- 081KRSKQ20008QG0R0014PPGZM — the parent backlog row this memo is slice-1 prep for
- PR #4042 — the audit tool whose exit-1 surfaced these refs
- PR #4041, #4031 — the memos preceding the tool
- `.claude/rules/substrate-or-it-didnt-happen.md` — substrate vs
  weather; the footnote-fallback pattern is one substrate-honest
  way to handle user-scope-only content
- `.claude/rules/wake-time-substrate.md` — auto-loaded rules need
  in-repo discoverability for cold-boot; the footnote-fallback
  pattern preserves this
- `.claude/rules/honor-those-that-came-before.md` — memory
  preservation discipline; the maintainer's user-scope memory
  files MUST stay where they are; only in-repo citations need
  cleanup

## Substrate-honest framing

This memo is slice-1 prep for 081KRSKQ20008QG0R0014PPGZM, not the slice-1 work itself.
The work itself requires:

1. A design choice (Option A/B/C/D) from the maintainer OR a
   substrate-honest default applied by Otto if he can defer to
   the established footnote-fallback pattern
2. Concrete edits to 6 substrate files (5 rules + 1 skill)
3. Audit-tool re-run + exit-0 verification
4. Commit + push + auto-merge under safe window

This memo captures the recipe so next safe-window Otto starts
from the per-ref table + the design question, not from re-running
discovery + re-inspecting each citing rule.

The memo composes additively with 081KRSKQ20008QG0R0014PPGZM: it doesn't replace
the row, it accelerates slice 1 execution.

## Pre-empt-at-#5 cadence note

This memo was written as pre-empt #5 in the autonomous-loop
brief-ack counter (per
[`.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`](../.claude/rules/holding-without-named-dependency-is-standing-by-failure.md)).
Pattern: 5+ ticks of deferral under Lior-active + bus-contended
primary + no peer-Otto picking up `da3cd5d2` work-assignment
envelope. Pre-empt selection: "produce concrete substrate for
work that IS bounded + ready to execute when safe window opens"
beats "manufacture make-work to escape brief-ack."

This file IS the concrete substrate for 081KRSKQ20008QG0R0014PPGZM slice 1.
