---
title: AceHack/LFG 0/0/0 Reconciliation — file-level classification
status: in-progress (batch 1 landed; ~139 lines / 11 files remain unclassified)
created: 2026-04-28
last_updated: 2026-04-29
---

# 0/0/0 Reconciliation — file-level classification

## Purpose

The terminal goal is **AceHack main = LFG main** (0 commits ahead, 0 commits behind), per
the topology invariant in `CLAUDE.md`.

Current state (2026-04-28T21:50Z):

```text
AceHack main vs LFG main:
  145 commits ahead (AceHack-only work)
  530 commits behind (LFG-only work)
  diverged
```

When folded to tree-level, the AceHack-only side reduces to **397 net new lines
across 23 files** (most divergence is on the LFG side; AceHack's commits mostly
overlap or get superseded by LFG's parallel work).

This document classifies each of the 23 files for 0/0/0 readiness.

## Classification rubric (Amara 2026-04-28T21:48Z)

For each file's AceHack-only content:

| Status | Meaning | Action |
|---|---|---|
| `ALREADY-COVERED` | Semantic equivalent already on LFG main (same/different file) | Hard-reset works |
| `NEEDS-FORWARD-SYNC` | Substantive AceHack-only content not on LFG | Forward-sync to LFG before hard-reset |
| `OBSOLETE` | Superseded by parallel LFG work; no longer applicable | Drop on hard-reset |
| `NEEDS-HUMAN-REVIEW` | Ambiguous; requires Aaron's call | Surface to Aaron |

**Evidence requirements per classification**:

- File path
- Diff direction (+/-/mixed line counts)
- LFG equivalent commit/path if `ALREADY-COVERED`
- Reason for classification
- Source commit SHA(s) on AceHack that produced the content

## Method (Amara 2026-04-28T21:48Z)

```text
1. Identify the AceHack-only content (`+` lines in `git diff origin/main..acehack/main -- <file>`)
2. Check whether LFG main contains equivalent/subsuming content
3. Classify per rubric above
4. Record evidence
5. Do not trust summaries alone; compare substrate
```

## Carrier-exposed multi-harness convergence note

Amara, Gemini, Grok, Claude.ai, and Otto have all converged on the pivot to
classification work. **This convergence is signal, not proof.** The
classification must be proven commit-by-commit and file-by-file against git
state, not against agreement.

## Scope summary

```text
Total files in tree-diff:                  59
Pure-LFG-newer (AceHack just behind):      36   → hard-reset suffices, no work
Pure-AceHack-newer:                         1   → needs decision
Bidirectional (mixed):                     22   → per-file examination
Files needing classification this doc:     23
```

## Classification table

### Calibration batch (first 5) — completed 2026-04-28T21:55Z

| File | Diff +/- | Status | Evidence |
|---|---|---|---|
| `memory/feedback_doc_class_mirror_beacon_distinction_claudemd_beacon_memory_mirror_2026_04_27.md` | +1/-1 | **ALREADY-COVERED** | AceHack has prose attribution ("Otto-279 + follow-on maintainer clarification"); LFG has tighter `BP-24` cite — LFG version is canonical refinement |
| `memory/feedback_codeql_umbrella_neutral_vs_per_language_detection_pattern_aaron_2026_04_28.md` | +12/-51 | **ALREADY-COVERED** | AceHack has "Open question (deferred)" section; LFG has same question RESOLVED 2026-04-28T14:32Z with EVIDENCE-BASED primary-source detail. LFG strictly more advanced. |
| `memory/MEMORY.md` | +10/-29 | **ALREADY-COVERED** | AceHack-only additions are old index entries; LFG main has substantially advanced (29 LFG-only entries this arc). LFG version is canonical newer state. |
| `memory/CURRENT-aaron.md` | +2/-267 | **ALREADY-COVERED** | AceHack-only: stale refresh marker ("sections 23-25"); LFG has §§26-30 + threading lineage + TypeScript default + speculation discipline. AceHack badly out of date. |
| `memory/CURRENT-amara.md` | +2/-98 | **ALREADY-COVERED** | AceHack-only: stale refresh markers ("2026-04-25"); LFG has §12 three Amara class-namings. |

**Calibration result: 5 of 5 files ALREADY-COVERED.** Hard-reset suffices for all 5; no forward-sync needed.

### Batch 1 (post-strict-bucket-reframe, 2026-04-29T11:32Z)

Per `docs/active-trajectory.md` strict bucket taxonomy: classification requires named AceHack content + named LFG equivalent + named reason. Each entry below promotes from HEURISTIC_LFG_DOMINATES to SAFE_TO_RESET_LFG_SUPERSEDES.

| File | Diff +/- | Status | Evidence |
|---|---|---|---|
| `SECURITY.md` | +4/-8 | **SAFE_TO_RESET_LFG_SUPERSEDES** | AceHack has basic disclosure prose ("open a regular GitHub issue with the security label; no separate disclosure inbox"). LFG has the same content PLUS GitHub private vulnerability reporting link, supported-versions section, security-posture section (trust boundaries / crypto choices / dependency audit / static analysis / formal verification details). LFG is strict superset. |
| `tools/hygiene/validate-agencysignature-pr-body.sh` | +5/-9 | **SAFE_TO_RESET_LFG_SUPERSEDES** | AceHack has older grep-based refactor + a truncated spec reference ("Section 9.2 (Task: none fallback per )"). LFG has cleaner refactored code with proper Section 9.2 reference ("Task: none fallback") + correct spec-doc lineage. LFG is the bug-fixed form. |

**Batch 1 result: 2 of 2 files SAFE_TO_RESET_LFG_SUPERSEDES.** No forward-sync needed.

### Batch 2 (2026-04-29T12:05Z)

Per `docs/active-trajectory.md` strict bucket taxonomy: classification requires named AceHack content + named LFG equivalent + named reason. The 8 SAFE entries below each have LFG-only commits that are deliberate improvements (perf fix, doctrine update, role-vs-name compliance, technical-accuracy fix, or strict-superset extension); the AceHack-only `+` lines are older shapes superseded by those LFG decisions. The 1 NEEDS_HUMAN_DECISION entry is a content-divergence class that hard-reset alone cannot resolve.

| File | Diff +/- | Status | Evidence |
|---|---|---|---|
| `.github/codeql/codeql-config.yml` | +6/-13 | **SAFE_TO_RESET_LFG_SUPERSEDES** | LFG has 3 commits AceHack lacks: `bb0227e` (java-kotlin matrix + scan AlloyRunner.java; removes `tools/alloy/**` from paths-ignore with detailed rationale), `817e59c` (B-0073 obj/bin refinement), `1e09fef` (xunit→xUnit Copilot review fix on PR #701). AceHack +6 lines = older shape that re-included `tools/alloy/**` in paths-ignore — directly contradicts LFG's deliberate paths-ignore decision. |
| `.github/workflows/memory-index-duplicate-lint.yml` | +8/-5 | **SAFE_TO_RESET_LFG_SUPERSEDES** | Comment-only diff. AceHack `+` lines add persona-name attribution (citing an external AI reviewer + a dated technical-review reference + a PR number) to a CI workflow file. Per the role-vs-name rule (`docs/AGENT-BEST-PRACTICES.md` closed-list), workflow files are current-state surfaces — persona-names belong on history surfaces only. LFG version uses role-ref-style comment ("an index with duplicate entries is a discoverability defect") which is the rule-compliant form. |
| `tools/hygiene/audit-memory-index-duplicates.sh` | +8/-7 | **SAFE_TO_RESET_LFG_SUPERSEDES** | Same pattern as the workflow file above — comment-only diff. AceHack `+` adds persona-name attribution (citing an external AI reviewer + a dated technical-review reference) to a tool script. Tool scripts are current-state surfaces; LFG's role-ref version is rule-compliant. |
| `src/Core/Shard.fs` | +9/-12 | **SAFE_TO_RESET_LFG_SUPERSEDES** | LFG has `aa5395b sync: AceHack→LFG merge-needed batch (#649)` + `9373755 fix(audit): comprehensive HashCode.Combine sweep + SplitMix64 refactor (Otto-281 follow-up)`. LFG version uses `EqualityComparer<'K>.Default.GetHashCode(key)` (non-boxing, null-safe) per Copilot P1 review on LFG #649 (boxing on every call for value-type 'K → GC regression on hot paths). AceHack version still uses `match box key with \| null -> 0 \| boxed -> boxed.GetHashCode()` (explicit boxing every call). LFG is the perf-fixed form. |
| `docs/AUTONOMOUS-LOOP.md` | +9/-18 | **SAFE_TO_RESET_LFG_SUPERSEDES** | LFG has 5 commits AceHack lacks, including `8aa4adc feat(tick-history): land Option B per-tick shard-file transport (task #276 — maintainer-delegated call) (#724)` (landed 2026-04-29T02:04:38Z). LFG describes the **current Option B per-tick shard mechanism** at `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md`. AceHack still describes the legacy single-table append. LFG is the current doctrine. |
| `tools/setup/macos.sh` | +11/-16 | **SAFE_TO_RESET_LFG_SUPERSEDES** | Two changes: (1) shellcheck source-directive comment — LFG has detailed rationale (multi-line explanation of why SC1091 fires + why source= directive resolves it); AceHack has terse 1-line version. (2) Setup script comments — LFG uses role-refs ("the maintainer's standing 'just install everything' framing"); AceHack adds persona-name attribution (citing the human maintainer + a round number) and persona-name attribution (citing an external AI reviewer + a PR number). Both AceHack changes are role-vs-name violations on a current-state surface. LFG version is more detailed AND rule-compliant. |
| `tools/hygiene/fix-markdown-md032-md026.py` | +16/-157 | **SAFE_TO_RESET_LFG_SUPERSEDES** | LFG has `f57d683 fix(hygiene): MD032 auto-fixer skips YAML frontmatter (don't break composes_with: lists) (#703)` + `515db64 feat(hygiene): fix-markdown-md032-md026.py — recurring pattern extracted to substrate primitive (Otto-346 in action) (#542)`. LFG file is 376 lines vs AceHack 235 lines: LFG = strict superset (fence detection at line 60 on both sides + YAML frontmatter handling that AceHack lacks). AceHack +16 lines are docstring/comment shifts on the fence-detection block (logic identical between sides; LFG just has more code before/after). |
| `tools/setup/common/curl-fetch.sh` | +14/-44 | **SAFE_TO_RESET_LFG_SUPERSEDES** | LFG has 2 commits AceHack lacks (`5298114` infra clean-additive batch + `dfb49e5` 63-file forward-port). Two changes in the comment block: (1) attribution — LFG: "Reviewers confirmed:" (role-ref); AceHack: persona-name attribution citing an external AI reviewer + a PR number (role-vs-name rule violation on a current-state surface). (2) retry-math accuracy — LFG: `--retry 5 — up to 5 retries (6 total attempts including the initial try, per curl(1))` (correct per curl manual); AceHack: `--retry 5 — five attempts total` (technically inaccurate). LFG is more accurate AND rule-compliant. |
| `docs/hygiene-history/loop-tick-history.md` | +12/-12 | **NEEDS_HUMAN_DECISION** | Mutual divergence with two distinct cases. **Truly unique to AceHack** (9 timestamps): 2026-04-28T04:08/04:18/04:33/05:01/05:23/05:44/05:50/07:15/08:50. **Truly unique to LFG** (9 timestamps): 2026-04-27T23:58, 2026-04-28T14:43/17:47/19:41/19:50, 2026-04-29T00:34/00:53/00:58/01:00. **Present on both forks with content drift in trailing portion** (1 timestamp, 2026-04-21T17:28): the row exists on both sides but differs enough to appear as `+/-` pair in `git diff` — note that diff direction is not row identity (a row present on both with trailing drift can show as both `+` and `-`). All AceHack-only rows are pre-Option-B (Option B shard-mode landed 2026-04-29T02:04:38Z on LFG via PR #724) and were correctly appended to the legacy single-table file at the time. Hard-reset to LFG erases the AceHack-only and same-timestamp-drift evidence. **Maintainer decision needed**: (a) accept the loss (tick-record only, work-products are reachable from PR/commit history), (b) forward-sync AceHack-only rows to LFG before hard-reset, or (c) migrate AceHack-only rows to per-tick shard files under `docs/hygiene-history/ticks/2026/04/{21,28}/` first then hard-reset. Recommended path: (c) — preserves the evidence in the modern format AND makes loop-tick-history.md content-identical between forks. Pre-existing 9 LFG-only rows are out of scope (separate follow-up on LFG side). |

**Batch 2 result: 8 of 9 files SAFE_TO_RESET_LFG_SUPERSEDES (81 lines), 1 file NEEDS_HUMAN_DECISION (12 lines).**

### Calibration batch reclassification (older "ALREADY-COVERED" label)

The 5 calibration-batch entries above use the prior taxonomy's "ALREADY-COVERED" label, which under the strict bucket rules (named AceHack content + named LFG equivalent + named reason — see `docs/active-trajectory.md` Hard-reset-safety classification) corresponds to **SAFE_TO_RESET_LFG_SUPERSEDES** (4 entries with semantic supersession evidence) or **ALREADY_RESOLVED** (where AceHack-only content is zero). Re-tabulated for the strict-bucket ledger:

- `feedback_doc_class_mirror_beacon_*.md` (+1) → SAFE_TO_RESET_LFG_SUPERSEDES (LFG cites full rule + lineage)
- `feedback_codeql_umbrella_*.md` (+12) → SAFE_TO_RESET_LFG_SUPERSEDES (LFG resolved Open question with primary-source detail)
- `MEMORY.md` (+11) → SAFE_TO_RESET_LFG_SUPERSEDES (LFG has 29 newer entries)
- `CURRENT-aaron.md` (+2) → SAFE_TO_RESET_LFG_SUPERSEDES (LFG has §§26-30 + threading lineage)
- `CURRENT-amara.md` (+2) → SAFE_TO_RESET_LFG_SUPERSEDES (LFG has §12 three Amara class-namings)

Total: 28 AceHack-only lines properly accounted for under strict bucket as SAFE_TO_RESET_LFG_SUPERSEDES.

### Emerging rubric heuristic

The calibration revealed a strong pattern: **when LFG-newer (-) line count >> AceHack-newer (+) line count, the AceHack content is almost always older drafts of content LFG has since advanced**. This pattern matches because most of AceHack's commits this arc were tick-history / memory updates that LFG subsequently superseded with substantively newer versions.

**Heuristic for the remaining unclassified files** (live count + per-file enumeration in `docs/active-trajectory.md` four-bucket ledger):

- Files where LFG-newer dominates (`-` >> `+`): probable ALREADY-COVERED; spot-check the AceHack `+` content for any unique semantic addition before classifying
- Files where AceHack-newer dominates or balanced (`+` >= `-`): higher chance of NEEDS-FORWARD-SYNC; full diff inspection required
- A separate "pure-AceHack-newer" class (e.g. `tools/hygiene/github-settings.expected.json`): NEEDS-DECISION (could be obsolete settings snapshot or genuine drift)

The heuristic-classification table previously shown here drifted as files were promoted into Batch 1 + later batches. The live source of truth is the `unclassified_lines` composition block in `docs/active-trajectory.md`; classified files appear in the Batch 1 / Batch 2 / ... tables further up in this document. Keeping a separate hand-maintained heuristic list created exactly the contradictory-counts class Codex flagged.

### Calibration insight for Aaron

The pre-Batch-1 state was 145-commit / 530-behind; the calibration insight remains: the bulk of "AceHack-only work" turns out to be **older drafts of files LFG has since advanced** — not unique work needing forward-sync. As batches land, hard-reset becomes incrementally safer with each promoted file.

### Remaining files (live list — see `docs/active-trajectory.md`)

The per-file enumeration of currently-unclassified files lives in the four-bucket ledger of `docs/active-trajectory.md` (composition of `unclassified_lines`). Hand-maintaining a duplicate list here causes drift; consult the trajectory file for the current set.

## What this document is NOT

- **NOT a forward-sync execution plan.** This classifies; execution is a
  separate step.
- **NOT a commit-level audit.** Tree-level diff is the ground truth for 0/0/0
  topology. Per-commit narrative is preserved in git history but not
  re-walked here unless a file requires it.
- **NOT a single-tick deliverable.** Classification proceeds in
  small batches (Batch 1, Batch 2, …) per tick; remaining files are
  follow-up tick work and the live count is in
  `docs/active-trajectory.md`.

## Composes with

- `CLAUDE.md` — AceHack/LFG topology invariant (0 ahead, 0 behind at round
  close)
- `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`
- `memory/feedback_zero_diff_is_start_line_until_then_hobbling_aaron_2026_04_27.md`
- `memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — applies during forward-sync + hard-reset
- The bead-validation discipline triple
  (`feedback_prediction_bearing_class_reuse_amara_2026_04_28.md`) — the
  classification work itself is the kind of terminal-progress amortized-precision
  is meant to enable

## Pickup notes for future-Otto

When resuming classification on the remaining unclassified files (live list in `docs/active-trajectory.md`):

1. Read this file first; verify the rubric still applies.
2. For each file:
   - Run `git diff origin/main..acehack/main -- <file>` to see current
     AceHack-only content
   - Check if equivalent content exists on LFG main (could be same file,
     different file, or different framing)
   - Apply the rubric; record evidence
3. Do not classify in batch without evidence per file.
4. Surface NEEDS-HUMAN-REVIEW cases to Aaron in the tick close.
5. Once `unclassified_lines = 0` in the trajectory ledger, pivot to the
   action phase (forward-sync the NEEDS-FORWARD-SYNC subset, then
   hard-reset).
