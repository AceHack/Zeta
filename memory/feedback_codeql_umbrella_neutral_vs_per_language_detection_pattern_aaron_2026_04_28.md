---
name: CodeQL umbrella check NEUTRAL while per-language Analyze legs SUCCESS — detection pattern for code_quality ruleset BLOCKED state (Aaron 2026-04-28)
description: When `code_quality:severity=all` ruleset gates a PR with "Code quality results are pending for N analyzed languages" and CI looks all-green, the actual signal is the umbrella `CodeQL` check NEUTRAL (often "1 configuration not found" details), distinct from per-language `Analyze (X)` legs that are SUCCESS. Default-setup state alone doesn't predict it. Spotted by Aaron 2026-04-28 on LFG #661; he's seen the pattern in other projects.
type: feedback
---

# CodeQL umbrella NEUTRAL detection pattern (Aaron 2026-04-28)

## The pattern

PR is BLOCKED. All visible CI checks are SUCCESS. Merge probe via REST returns:

> "Repository rule violations found. Code quality results are pending for N analyzed languages."

Diagnostic intuition says CodeQL is failing. But every per-language `Analyze (csharp)`, `Analyze (python)`, `Analyze (javascript-typescript)`, `Analyze (actions)` leg is SUCCESS. CodeQL workflow run completed SUCCESS. SARIF analyses are uploaded for `refs/pull/N/merge` with `results_count: 0` for every language.

**The actual signal**: there's a separate `CodeQL` umbrella status check (distinct from the per-language legs) and it's `NEUTRAL` with details URL showing **"1 configuration not found"**.

The `code_quality:severity=all` ruleset rule reads the **umbrella** check, not the per-language legs. NEUTRAL → ruleset says "pending."

## Detection in <30 seconds

```bash
# Pull the umbrella CodeQL check specifically:
gh pr view N --repo OWNER/REPO --json statusCheckRollup --jq \
  '.statusCheckRollup[] | select(.name == "CodeQL") | {name, conclusion, detailsUrl}'

# If conclusion is NEUTRAL (not SUCCESS) on a PR that's BLOCKED with
# "Code quality results pending" — this is the failure mode.
```

The umbrella `CodeQL` check is named just `CodeQL` (no language suffix). Don't confuse it with `Analyze (csharp)` etc.

## Empirical evidence collected on LFG #661 (2026-04-28T14:16Z)

- Per-language Analyze legs: 4/4 SUCCESS, all `results_count: 0`
- CodeQL workflow runs: SUCCESS
- SARIF analyses uploaded to `refs/pull/661/merge`: 4 entries, all 4 languages
- `CodeQL` umbrella check: **NEUTRAL** with "Completed in 3s — 1 configuration not found"
- LFG default-setup state: `not-configured`
- AceHack default-setup state: `not-configured` (SAME)
- AceHack PR #92 (recent merge): `CodeQL` umbrella = **SUCCESS** despite same default-setup state

**Default-setup state alone does NOT predict umbrella outcome.** Something else differs between AceHack and LFG that causes the umbrella to go NEUTRAL on LFG.

## Industry-wide pattern (Aaron 2026-04-28)

Aaron's exact framing: "i've seen these before" — across other projects he uses
Claude PR review on. Not a Zeta-specific config bug. The asymmetry between umbrella
NEUTRAL and per-language SUCCESS is a recurring GitHub Code Scanning surface
oddity.

## Why this is hard to see

1. The standard `gh pr checks N` output lists per-language Analyze legs but the
   umbrella `CodeQL` check is in a different position visually.
2. Per-language SUCCESS + workflow SUCCESS gives a strong "everything passed" signal
   that masks the umbrella NEUTRAL.
3. The merge-endpoint error message says "results pending for N analyzed languages"
   which sounds like per-language pending, but actually means the umbrella.

## Composes with

- `feedback_no_required_approval_on_zeta_BLOCKED_means_threads_or_ci_aaron_2026_04_28.md`
  — the 5-class BLOCKED taxonomy. This adds a 6th sub-class:
  **class-5b**: ruleset blocking on umbrella-NEUTRAL despite per-language SUCCESS.
- `feedback_reviewer_false_positive_pattern_catalog_aaron_2026_04_28.md`
  — ditto for the 7-class false-positive catalog; this is a meta-analyzer
  failure mode rather than a reviewer false-positive.
- Otto-352 narrow-not-broad principle — "ruleset BLOCKED" is too broad; the
  precise diagnostic check is the umbrella `CodeQL` conclusion.
- `feedback_otto_355_blocked_with_green_ci_means_investigate_review_threads_first_dont_wait_2026_04_27.md`
  — extends Otto-355's BLOCKED-investigate-first to include the umbrella-check
  interrogation when threads are clean and per-language CI is green.

## Open question — RESOLVED 2026-04-28T14:32Z (primary-source query, not speculation)

The earlier-this-day "deferred" suspects (org-level inheritance, paths-ignore
divergence, ingestion-side flags) were **all speculation**. The actual
mechanism, verbatim from the umbrella check's own details URL via
`gh api repos/Lucent-Financial-Group/Zeta/check-runs/<id> --jq .output.summary`:

> **Warning**: Code scanning cannot determine the alerts introduced by this
> pull request, because 1 configuration present on `refs/heads/main` was not
> found:
>
> ### Actions workflow (`codeql.yml`)
> * `/language:java-kotlin`

**EVIDENCE-BASED resolution:**

1. **`tools/alloy/AlloyRunner.java` is first-party Java** that the
   `codeql.yml` workflow's matrix did NOT include — header comment claimed
   "no Java/Kotlin source" which was wrong (Aaron 2026-04-28: *"we have java
   in our codebase, it's just a little but it's there"*).
2. **Main has java-kotlin analyses** uploaded by (a) GitHub's default-setup
   runner (older, `analysis_key=dynamic/github-code-scanning/codeql:analyze`,
   non-deletable) and (b) our path-gate's empty-SARIF baseline upload
   (`analysis_key=.github/workflows/codeql.yml:path-gate`, deletable).
3. **PR head's matrix had no java-kotlin leg** → umbrella couldn't compute
   alert delta for that configuration → emits NEUTRAL.
4. **AceHack vs LFG asymmetry:** likely the SAME mechanism on both sides;
   the visible asymmetry was probably a sampling artifact (specific PRs
   measured) rather than a structural difference. *Speculation flag:* not
   tested empirically. What would disconfirm: pull umbrella details URLs
   for matched-pair PRs across forks and compare verbatim summaries.

**The structural fix (PR #662, merged 2026-04-28T16:22:42Z):**

- Added `java-kotlin` to the analyze matrix in `.github/workflows/codeql.yml`
  with `build-mode: none`
- Removed `tools/alloy/**` from `paths-ignore` in
  `.github/codeql/codeql-config.yml` so the extractor actually scans
  AlloyRunner.java
- Added `*.java` to path-gate's code-changed patterns (extension to Kotlin /
  Scala deferred to B-0081)

The deeper structural cause: **runtime dependencies must be honestly
declared on every surface that touches them**. Java was already managed via
`.mise.toml:24` (`java = "26"`, round-34 brew/apt → mise migration) but the
codeql.yml workflow disowned it. Round-34's sweep was incomplete; the
inconsistency surfaced months later as cross-fork CI failure.

When the next PR hits this on LFG (or any other repo), the detection
pattern still works as the entry point. The mechanism above is now the
expected explanation; org-level inheritance is not.
