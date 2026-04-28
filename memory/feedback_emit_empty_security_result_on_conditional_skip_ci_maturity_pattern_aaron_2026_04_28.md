---
name: Emit empty security-tool result on conditional-skip — CI security-maturity pattern (Aaron 2026-04-28)
description: Aaron 2026-04-28T19:08Z: 'probably just need some CI maturity vector maybe we already have' — confirming this is a substrate-level CI-security-maturity trajectory, not just a one-off backlog item. The pattern: when a security-tool workflow conditionally skips (path-gate, branch-filter, file-filter, fork-PR-permissions guard), STILL emit a minimal no-findings result so coverage metrics (Scorecard, code-scanning rulesets, audit dashboards) see "tool ran on this commit" rather than "tool didn't run". Generalizes beyond CodeQL to Semgrep, dependency-scan, container-scan, license-scan. Zeta already implements this in codeql.yml (path-gate emits empty SARIF per language category); the trajectory says: apply this pattern to every security-tool workflow we add.
type: feedback
---

# Emit empty security-tool result on conditional-skip — CI security-maturity pattern

## The rule (Aaron verbatim 2026-04-28T19:08Z)

> *"That's how mature CI security pipelines satisfy Scorecard without
> burning Actions minutes on prose-only changes. sound like we should
> capture this as our trajectory? or is it just a small backlog item,
> or are you fixing it now?"*

> *"probably just need some CI maturity vector maybe we already have"*

The two messages together: yes, capture as trajectory. Yes, we already
have most of it.

## The pattern

When a security-tool workflow conditionally **skips** running the
actual analysis on a given commit (because path-gate determines no
code changed, branch-filter excludes the branch, file-filter
excludes the changeset, fork-PR-permissions block tool, etc.), the
workflow MUST STILL **emit a minimal no-findings result** so:

1. **Coverage metrics stay high**: Scorecard's SAST coverage ratio,
   GitHub's `code_scanning` ruleset rule ("Require code scanning
   results"), org-level security dashboards all count "tool ran on
   commit X with zero findings" as covered.
2. **Audit trail is uniform**: every commit shows up in the
   security-tool's run-history; no implicit-skip gaps that look
   like "did we forget to scan this?".
3. **Required-status-check rulesets pass**: when the rule requires
   the SAST status check be present, the empty-result satisfies
   the gate without blocking doc-only PRs on full analysis.

## The cost-benefit

- **Cost**: ~5 seconds per skipped PR (synthesize ~50-byte SARIF
  + upload via `codeql-action/upload-sarif`).
- **Benefit**: every coverage metric stays at 100%; no false
  alarms from process-metrics (Scorecard SASTID etc.); merge-gating
  rulesets pass on doc-only PRs without burning full-scan minutes.

## Where Zeta already implements this

`.github/workflows/codeql.yml` (round-34-tuned, see comment block
lines 53-65 + 67-74):

- `path-gate` job runs first; sets `code_changed` output.
- If `code_changed=false` (pure docs / memory / .claude PR):
  - **Aggregate-CodeQL baseline** step (lines 241+): synthesizes
    minimal no-findings SARIF per language category and uploads
    via `github/codeql-action/upload-sarif@<sha-pin>`.
  - The `analyze` matrix is skipped (no expensive DB-build).
- Fork-PR guard: forces `code_changed=true` on external-contributor
  PRs because their downgraded `GITHUB_TOKEN` permissions can't
  do `security-events: write` for synthetic SARIF upload.

## Where the pattern should propagate

When the factory adds new security-tool workflows, apply the same
shape:

- **Semgrep workflow** (currently on every PR via `lint (semgrep)`):
  if we ever add a path-gate to skip docs-only PRs, the path-gate
  must emit an empty Semgrep SARIF or equivalent.
- **Dependency-scan workflow** (Dependabot, OSV-Scanner, future
  additions): if branch-filter or path-filter skips, emit empty
  result.
- **Container-scan workflow** (future, if we ship containers):
  if no Dockerfile changed, emit empty result.
- **License-scan workflow** (future): if no dependency changed,
  emit empty result.
- **CodeQL itself** when new languages are added to the matrix:
  the `path-gate` aggregate-baseline must emit one no-findings
  SARIF per matrix language (already covered for `actions` /
  `csharp` / `python` / `java-kotlin` / `javascript-typescript`).

## When this trajectory MIGHT NOT apply

- **Tool doesn't produce SARIF or equivalent uploadable artifact**:
  some security tools log to stdout only. For these, the empty-
  result pattern requires a wrapper that synthesizes the upload
  format. Skip the empty-emit if the wrapper cost exceeds the
  metric-gain.
- **Tool's run-history is not coverage-metric-checked**: if no
  external system (Scorecard / ruleset / dashboard) checks
  per-commit coverage for that tool, the empty-emit is unnecessary
  ceremony. Apply YAGNI.
- **Skip is intentional non-applicability**: e.g., a Windows-only
  tool on a Linux-only PR. Document the skip in the workflow's
  decision step instead of emitting a misleading "ran with no
  findings" signal.

## Composes with

- `feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`
  — discipline 1 (history preservation): the empty-SARIF upload
  IS the artifact that makes the security-tool's history
  preservation complete (no per-commit gaps).
- `feedback_codeql_umbrella_neutral_vs_per_language_detection_pattern_aaron_2026_04_28.md`
  — same family: code_scanning ruleset rule expects per-language
  SARIF; missing one = NEUTRAL = ruleset blocks. Empty-SARIF on
  conditional skip = ruleset passes.
- Otto-247 version-currency: when bumping `codeql-action/upload-sarif`
  pin, check the latest version per the WebSearch discipline.
- B-0084 (the concrete-instance backlog row) — captured for the
  specific Scorecard SASTID metric.

## What this is NOT

- **NOT a directive to run every tool on every commit.** That would
  burn Actions minutes for zero security value on doc-only PRs.
  The pattern is "skip the analysis, emit the receipt".
- **NOT a generic CI-pattern-of-the-month.** This applies
  specifically to **security-tool** workflows where coverage
  metrics matter. Build/test workflows have their own conditional-
  skip patterns and don't need the empty-result emit.
- **NOT applicable to the maintainer's own scripts** (e.g.,
  tools/budget/snapshot-burn.sh). Those have their own success-
  on-no-change semantics.
- **NOT a substitute for actual security analysis.** When code
  changes, run the real tool. The empty-emit is for the
  no-code-changed case only.

## Pickup notes for future-Otto

When adding a new security-tool workflow:

1. **Decide if conditional-skip applies**: does the tool make
   sense to skip on certain commits (path-filter, branch-filter)?
2. **If yes, design the skip path with empty-emit**:
   - Synthesize a minimal valid result format (SARIF for
     code-scanning; tool-specific format otherwise).
   - Upload via the canonical action (`codeql-action/upload-sarif`,
     etc.).
   - Document the skip-with-emit shape in the workflow's
     comment block.
3. **If no (tool always runs)**: no special handling.
4. **Cross-CLI verify (Otto-347)** the skip-path on first
   implementation — getting the SARIF schema wrong silently
   succeeds at upload but fails at the metric check.
