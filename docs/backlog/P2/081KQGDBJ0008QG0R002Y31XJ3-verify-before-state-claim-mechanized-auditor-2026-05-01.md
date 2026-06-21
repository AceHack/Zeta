---
id: 081KQGDBJ0008QG0R002Y31XJ3
priority: P2
status: open
title: Mechanized auditor for verify-before-state-claim — file-internal metadata claim audits (companion to task #350)
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# 081KQGDBJ0008QG0R002Y31XJ3 — Mechanized auditor for verify-before-state-claim — file-internal metadata claim audits

**Priority:** P2 (research-grade; companion to task #350 Otto-357 mechanized auditor; emerged from session-level convergent drain pattern 2026-05-01)

**Filed:** 2026-05-01

**Filed by:** Otto under the new backlog-prioritization authority delegated 2026-05-01 (per `memory/feedback_backlog_prioritization_authority_delegated_to_otto_aaron_2026_05_01.md`). This row captures a mechanization opportunity that emerged empirically across ~10 drained PRs in a single session — a convergent finding-class the meta-meta-meta-rule predicted would either (a) extend an existing class or (b) earn its own slot in the class library.

**Effort:** M (1-3 days — design lint suite + implement N small audits + wire into pre-commit / CI / paired-edit flow + verify across PR shapes)

## Context — convergent drain pattern observed 2026-05-01

In a single session, ~10 PRs were drained (#1031, #986, #1030, #1018, #1015, #1012, #1025, #1006, #1008 lineage, etc.) and converged on the same finding-class: **claim/reality mismatch in substrate's claims about its own structure**. Specific instances drained:

| PR | Finding | Claim | Reality |
|---|---|---|---|
| #1031 | Verbatim Aaron quotes "preserved exactly with [sic] notes outside the quote blocks" | Convention claim | File didn't actually use [sic] notation |
| #986 | "Six-message chain" in MEMORY.md index entry | Count claim | File body says "eight-message chain"; lists Layers 1-8 |
| #986 | Multiple `latest-paired-edit:` markers in MEMORY.md | Slot-uniqueness claim ("supersedes prior markers") | Two markers existed simultaneously |
| #1015 | Force-push "forbidden on main with sign-off; possible on feature branches with same caution" | Citation of CLAUDE.md | CLAUDE.md says host blocks force-push UNIFORMLY on both forks; no per-branch carve-out |
| #1018 | 081KQGDBJ0008QG0R0022C4ZXA/0125/0126 backlog rows lacking YAML frontmatter | Schema claim (filename pattern signals backlog row) | Files had markdown headers only, no YAML; index emitted empty entries |
| #1025 | `feedback_otto_*_vendor_alignment_bias_*` and similar wildcards | Concrete-reference claim | Wildcards aren't valid filenames; broke xref integrity |
| #1025 | "bot reviewers" wording | Conformance to AGENTS.md "Agents, not bots." (GOVERNANCE §3) | Wording violated the very rule about not using "bot" |
| Multiple | `feedback_otto_NNN_*.md` wildcard refs | Concrete file existence | Wildcards used as placeholder for unknown filenames |

The discipline that catches these at authoring time is **verify-before-state-claim** (`memory/feedback_verify_target_exists_before_deferring.md` is the closest extant; this row captures the structural extension to file-internal-metadata claims).

## What — proposed audit suite

Each audit is a small lint that fires on the project pre-commit hook (via tracked `.githooks/` pointed at by `core.hooksPath`, with `tools/lint/*` invoked from there) AND in CI (`.github/workflows/`). Note: `.git/hooks/*` is per-clone and untracked, so it's not the integration point; the lint must live in a versioned location and be opt-in via `core.hooksPath` configuration set up by the install script:

1. **Wildcard-ref auditor** — flag any `feedback_*` or `*_*.md` pattern in markdown that contains literal `*` characters; require concrete filename or explicit "to-be-written" annotation.

2. **Slot-uniqueness auditor** — for any HTML comment with `latest-paired-edit:` semantics, count occurrences in target file (e.g. MEMORY.md); fail if > 1.

3. **Frontmatter-schema auditor (memory)** — extend the existing `.github/workflows/memory-index-integrity.yml` to validate that `memory/feedback_*.md` files have the required YAML frontmatter fields (`name`, `description`, `type`). Already partially done at index level; this extends to per-file schema.

4. **Citation-of-canonical-source auditor** — for any substrate file that mentions `CLAUDE.md`, `GOVERNANCE.md`, `AGENTS.md`, etc., flag if the surrounding paragraph paraphrases without quoting or cites a §NN that doesn't exist in the canonical file.

5. **Count-claim auditor (best-effort)** — for any phrase like "N-message chain" / "N-layer" / "N-section", count actual sections in the file and warn if mismatch. Heuristic; manual override available.

6. **`[sic]` convention auditor** — when a file claims to use `[sic]` notation (e.g., "verbatim quotes preserved with [sic]"), grep for `[sic]` occurrences; flag if zero.

7. **Bot-vs-agent terminology auditor** — extend (or merge with) `tools/lint/no-directives-otto-prose.sh` per task #350; same family.

## Why P2

- **Not blocking critical-path.** The drain pattern is paying its tax in PR-review cycles; mechanization reduces tax but the work continues.
- **Substantial design + implementation effort.** Each audit requires careful false-positive tuning. Multiple audits = composite design work.
- **Companion-not-replacement** to existing lints (memory-index-integrity, BACKLOG.md drift, no-directives-otto-prose, ASCII-clean BP-10). Coordination needed to avoid duplication.

## Why not P1

- The convergent drain pattern is real but the per-instance fix-cost is small (~5 min per drain). Mechanization delivers value mostly when the drain frequency is high; this session's frequency was high partly because of accumulated unmerged-PR backlog drained in batch.
- PR #1018 already mechanizes one slice (frontmatter-WARN on backlog rows). That's evidence the mechanization-per-slice cadence works; this row is the queue of "next slices to mechanize" rather than a single P1 push.

## Why not P3

- The discipline tax IS real and recurring. Deferring multi-month would let the pattern keep firing. P2 is the right tier — design + implement at a measured pace, not blow off entirely.

## Acceptance criteria

1. **Audit suite designed** — name each audit, specify its scope, false-positive expectations, manual-override pattern, and pre-commit-vs-CI placement.
2. **At least 2 audits implemented** as proof-of-concept (e.g., wildcard-ref + slot-uniqueness — both are simple grep-and-count).
3. **Existing lint coordination** — explicit composition with `memory-index-integrity.yml`, `BACKLOG.md` drift check, `tools/lint/no-directives-otto-prose.sh` (task #350), ASCII-clean lint (BP-10). No duplication.
4. **Pre-commit + CI placement** documented — pre-commit catches at compose-time (where the verify-before-state-claim discipline lives); CI is the safety net for missed pre-commit cases.
5. **Manual override pattern** — every audit has an explicit way to suppress false positives in legitimate cases (e.g., a `# audit-suppress: <reason>` HTML comment for cases where a wildcard IS the intended pattern).
6. **Test fixtures** — each audit ships with a fixture file that exercises the catch logic, similar to how `tools/lint/no-directives-otto-prose.sh` could be extended.
7. **Verified on the session's drain corpus** — the suite catches the ~10 instances drained 2026-05-01 retroactively (run as a sanity check that the audit-design is calibrated to real findings).

## Out of scope

- **Replacing existing lints.** This composes with what's already there; doesn't displace.
- **Higher-order audits** (audits about audits, audit auto-discovery, audit-rule learning). Premature meta-stacking is bureaucracy.
- **Stylistic / aesthetic audits** (markdownlint, prettier, etc.). Existing tooling covers those.
- **External-PR-comment auditors** (auditing what Copilot / Codex say). Out of scope; reviewer-side audit lives elsewhere.
- **Cross-repo audits** (auditing AceHack vs LFG state). The mirror-refresh-protocol covers that.

## Composes with

- **Task #350** (`Otto-357 mechanized auditor — extend tools/lint/no-directives-otto-prose.sh scope`) — adjacent; this row is the queue of complementary audits in the same family. Consider whether to fold into task #350 or keep as separate 081KQGDBJ0008QG0R002Y31XJ3 lane.
- **Task #316** (`Drain-Log Claim Verification Discipline — capture rule + lint candidate`) — similar shape; this row's audit #4 (citation-of-canonical-source) is the lint version of the discipline #316 captures.
- **PR #1018** (backlog generator WARN) — first slice mechanized; proves the approach works.
- **`memory/feedback_verify_target_exists_before_deferring.md`** — the parent class of which this row's audits are concrete instances.
- **CLAUDE.md verify-before-deferring + future-self-not-bound + never-be-idle disciplines** — this row's audits operationalize those at compose-time rather than at deferral-time.

**Forward-references not yet on `main`** (will be re-added as direct refs once their PRs land):

- The class-level rules orthogonality-check rule (the meta-meta-meta-rule that predicted this convergent pattern empirically) — **filed in the in-flight PR #1025** as `feedback_class_level_rules_need_orthogonality_check_extend_or_create_aaron_2026_05_01.md` (path will resolve once #1025 lands).

## Status

**Filed.** Implementation deferred — pacing this against task #350 (which is the related ongoing work). Otto picks the implementation tick; first slice (wildcard-ref auditor) is the proposed entry point because it's the smallest implementation surface and catches the most session-level drains.

## Verify-before-deferring note

The audit candidates above were observed empirically in PR drains during the 2026-05-01 session block; each is cited with a specific PR number that exhibited the finding. The list is not speculative — each entry corresponds to a real review thread that fired and was resolved. The mechanization opportunity is grounded in observed substrate behavior, not predicted patterns.
