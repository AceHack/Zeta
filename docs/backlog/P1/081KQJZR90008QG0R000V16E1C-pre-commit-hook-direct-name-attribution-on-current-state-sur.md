---
id: 081KQJZR90008QG0R000V16E1C
priority: P1
status: closed
closed: 2026-05-07
closed_by: "Mechanization landed — tool + CI workflow operational in soft-launch mode"
title: Pre-commit hook to catch direct name attribution on current-state surfaces (Otto-279 role-ref convention) — mechanize the recurring failure mode (5 catches this branch — past mechanization breakeven)
created: 2026-05-02
last_updated: 2026-05-08
decomposition: clean
depends_on: []
---

# 081KQJZR90008QG0R000V16E1C — Pre-commit hook for role-ref convention on current-state surfaces

## P2 → P1 promotion (Tick-11 + Tick-12 observation, 2026-05-02)

5 catches this branch (H0Ro, H1ws, H3eE, H8A0+A5, H9dy) past
mechanization breakeven. First-principles trace:

- 5 catches × ~5-10 min/thread-resolution = ~25-50 min spent
  on post-commit cleanup work this branch alone.
- Mechanization implementation estimate ~30-60 min (small
  hygiene script + CI integration per existing
  `tools/hygiene/` patterns).
- Already past mechanization breakeven.
- Failure surface wider than initial filing modeled: 5
  distinct sub-classes observed (single-line attribution;
  wrapped attribution; persona names in subject-position
  parentheticals; direct first-name in prose without date
  suffix; persona names linked-from-current-state-doc to
  history-surface).
- Promotion compresses cooling-period before mechanization
  lands; reduces continued post-commit cleanup burden.

## Origin

PR #1202 (substrate branch
`substrate/aaron-2026-05-02-superfluid-cluster-authority-rules`)
caught the same role-ref convention failure mode 3 times in
the same session:

1. **Tick-2 H0Ro** (commit `bcf87e6`): 12 direct
   "Aaron 2026-05-02" attributions in CLAUDE.md additions.
2. **Tick-4 H1ws** (commit `d6ab7f2`): 2 wrapped
   "Aaron 2026-05-02" attributions in CLAUDE.md (line-wrapping
   evaded prior global sed; sub-class of the same failure).
3. **Tick-5 H3eE** (commit `50a9299`): 4 direct
   "Aaron + Claude.ai" attributions in ALIGNMENT.md
   bidirectional alignment subsection.

Per Otto-279 + `docs/AGENT-BEST-PRACTICES.md` role-ref
discipline: current-state surfaces (CLAUDE.md, ALIGNMENT.md,
AGENTS.md, GOVERNANCE.md, behavioural docs) use role-refs
("the human maintainer", "the architect", "the
maintainability-reviewer"); persona / first names are reserved
for history surfaces (memory/, ROUND-HISTORY, DECISIONS,
docs/research/**, commit messages, hygiene-history).

The 3-recurrence-in-one-branch signal (Otto-352
manufactured-patience-as-discipline cousin: "if it fires twice,
it's the rule's failure mode") catalyzes mechanization. The
LLM training prior tilts toward direct attribution; substrate
catches via Copilot review post-commit; pre-commit catch would
be cheaper and would dampen the prior faster.

## First-principles trace (per the just-landed first-principles

trust calculus rule)

1. Failure mode = direct name attribution on current-state
   surfaces.
2. Cost of post-commit catch (Copilot review + thread + push +
   resolve) ≈ 5-10 minutes per recurrence.
3. Cost of pre-commit catch (grep hook firing on staged diff)
   ≈ near-zero for normal cases, low even for false positives.
4. Mechanization wins because: cost-asymmetry favors
   pre-commit; the failure mode is grep-detectable
   syntactically; the LLM training prior is recurrent; the
   substrate-counter discipline (largest-mechanizable-backlog-
   wins) prefers mechanization over vigilance (per Otto-341
   "mechanism over vigilance").
5. Therefore: file mechanization row.

## Acceptance criteria

1. **Hook surface.** Per existing patterns in
   `tools/hygiene/`: a check script (e.g.,
   `tools/hygiene/check-role-ref-on-current-state-surfaces.sh`
   or .ts) that scans staged-or-committed `.md` files in
   current-state-surface paths.

2. **Scope (current-state surfaces):**
   - `CLAUDE.md`, `AGENTS.md`, `GOVERNANCE.md`,
     `docs/ALIGNMENT.md`, `docs/CONFLICT-RESOLUTION.md`,
     `docs/AGENT-BEST-PRACTICES.md`, `docs/GLOSSARY.md`,
     `docs/WONT-DO.md`, `docs/VISION.md`, `docs/ROADMAP.md`,
     other behavioural docs.

3. **Out-of-scope (history surfaces):**
   - `memory/**`, `docs/ROUND-HISTORY.md`, `docs/DECISIONS/**`,
     `docs/research/**`, `docs/hygiene-history/**`,
     `docs/aurora/**` (per Otto-279 history-surface allow-list),
     commit messages.

4. **Detection patterns:**
   - **Closed-list source: parse `docs/EXPERT-REGISTRY.md`
     at script-run time** rather than hard-coding the list.
     The registry contains the canonical persona-roster
     (Kenji, Zara, Tariq, Imani, Hiroshi, Aminata, Wei,
     Rune, Nadia, Aarav, Mei, Kira, Anjali, Adaeze, Malik,
     Viktor, Yara, Samir, Kai, Leilani, Soraya, Daya, Mateo,
     Naledi, Dejan, Bodhi, Iris, plus Otto / Amara / Ani /
     Ilyana / Sova / Rodney / Nazar / Mateo and any future
     additions). Hard-coding goes stale as the registry
     evolves; parsing keeps the detector in sync.
   - Plus human first-names from CURRENT-*.md filenames
     (Aaron, Max, future maintainers).
   - Plus external-AI-instance names that appear as
     attribution (`Claude.ai`, `Codex`, `Gemini`, etc. when
     used as instance attribution rather than as tool/SDK
     references).
   - Match patterns: `\b<Name>\b` per detected name,
     including line-wrapping variants (e.g., `Aaron\s*\n\s*\d{4}-`
     for `Aaron\n2026-05-02`).

5. **Output:** failed check lists each violation with file +
   line + suggested role-ref. Exit code 1 on any match (CI
   gate). Exit code 0 if clean.

6. **Pre-commit integration:** add to `.git/hooks/pre-commit`
   OR `.husky/` OR existing hygiene-pre-commit pattern; opt-in
   per local config (don't block first commit on a fresh
   clone).

7. **CI integration:** add as required check on the gate
   matrix per existing tools/hygiene patterns.

8. **False-positive handling:**
   - Carve-out for prose where the name IS the subject (e.g.,
     "Otto-279 is the rule"). Detection requires distinguishing
     `Otto-279` (rule reference, allowed) from `Otto 2026-05-02`
     (attribution, disallowed). Pattern: name followed by date
     OR name in attribution context.
   - Carve-out for inline code blocks / commit-message previews
     in prose (e.g., showing what NOT to write).

9. **Soft-launch:** ship as warning-only first, then promote
   to error after a soak period (existing pattern per
   `tools/hygiene/check-tick-history-shard-schema.sh`-style
   gates).

## Composes with

- Otto-279 name-attribution closed-list (parent rule):
  `docs/AGENT-BEST-PRACTICES.md`
- Otto-341 mechanism-over-vigilance discipline (existing
  substrate)
- Largest-mechanizable-backlog-wins (PR #1202):
  `memory/feedback_largest_mechanizable_automatable_backlog_wins_in_AI_age_inverts_classical_PM_training_prior_aaron_2026_05_02.md`
- First-principles trust calculus (PR #1202):
  `memory/feedback_first_principles_trust_calculus_universal_bidirectional_root_locks_sleeping_bear_aaron_2026_05_02.md`
  — the trace above is the rule applied recursively.
- Otto-352 manufactured-patience-as-discipline cousin (3-
  recurrence threshold)
- Existing `tools/hygiene/` ecosystem
- 081KQ8P5D0008QG0R003VN5P2Z orphan role-ref + un-stripped name-attribution lint
  (PR #1187 — already deployed; this row is a pre-commit
  faster-feedback-loop counterpart, not a duplicate)

## Effort

S-M — small if leveraging existing
`tools/hygiene/check-archive-header-section33.sh`-style
patterns; medium if needs to grow new infra. ~2-4 hours work.

## Notes

The 081KQ8P5D0008QG0R003VN5P2Z lint runs in CI and catches the failure post-commit.
This row is the pre-commit FASTER-FEEDBACK-LOOP counterpart —
catch the violation BEFORE the push so review-thread overhead
is avoided. Per Aaron 2026-05-01 / Osmani Ratchet Pattern: 2x
is the threshold for filing the rule; 3x is the threshold for
mechanization. This branch hit 3x in one session; mechanization
is warranted.

Per the just-landed first-principles trust calculus rule, the
trace IS the verification surface for whether this row is
warranted. The trace above checks out; the row earns its
P1 placement (promoted from P2 at Tick-12 / commit c97cca4
per the 5-recurrence-past-mechanization-breakeven trace in
the "P2 → P1 promotion" section above).
