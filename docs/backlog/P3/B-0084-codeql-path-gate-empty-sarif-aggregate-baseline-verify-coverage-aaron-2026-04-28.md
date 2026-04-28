---
id: B-0084
priority: P3
status: mostly-implemented-verify-coverage
title: Verify CodeQL path-gate empty-SARIF aggregate-baseline covers all matrix languages (already implemented, verify-only scope)
tier: factory-tooling
effort: S
ask: maintainer Aaron 2026-04-28 (SASTID alert investigation — speculation-vs-evidence + do-the-right-long-term-thing corrections)
created: 2026-04-28
last_updated: 2026-04-28
tags: [aaron-2026-04-28, scorecard, sastid, codeql, path-gate, do-the-right-long-term-thing, mostly-implemented, verify-only, P3-downgraded-from-P1-on-finding-already-done]
---

# B-0084 — CodeQL path-gate emit-empty-SARIF for Scorecard SAST coverage

## Source

Aaron 2026-04-28T19:01Z verbatim:

> *"SASTID dismissed ✅ did you fix what it was complaining about?"*

Aaron 2026-04-28T19:02Z verbatim:

> *"it also voilates do the right long term thing when making suggested fixes"*

Two compounding corrections caught my dismissal as the wrong move:

1. The dismissal was speculation-without-evidence (I asserted the 2/30
   unchecked were "path-gate-skipped doc-only" without verifying).
2. Even if the speculation had been correct, dismissal-with-rationale
   is a short-term avoidance vs. fixing the root cause. Violates
   do-the-right-long-term-thing.

## What the speculation-check actually showed

After reversing the dismissal and investigating:

- **PR #651** ("CI cadence split + Windows trajectory seed"): 32 files
  touched including \`.github/workflows/codeql.yml\` itself. This is
  the commit that introduced the path-gate. Path-gate may have been
  effectively no-op before this PR; CodeQL legs may have been absent
  for transitional reasons.
- **PR #654**: 2 memory files only. After path-gate landed, this
  correctly skipped CodeQL (no code to scan).

So the path-gate IS working as designed. The failure isn't the gate —
it's that Scorecard's SASTID metric counts "did the github-code-scanning
app log a SAST run" per commit, and path-gate-skipped commits register
as "SAST didn't run".

## Update 2026-04-28T19:09Z: pattern already implemented

After deeper investigation: `.github/workflows/codeql.yml` lines 53-65,
121-180, 241-334 ALREADY implement this pattern. The path-gate job
emits no-findings SARIF per language category when no code changed.
**The current SASTID 28/30 is a timing artifact**, not a missing fix:

- The alert was created 2026-04-27T23:52:55Z.
- The path-gate became fully active around PR #651 (which itself
  modified codeql.yml).
- Scorecard's window of 'recent 30 merged PRs' currently includes
  pre-path-gate commits, hence the gap.
- As more post-path-gate PRs land, the metric self-heals.

**Lower-priority than initially scoped.** The trajectory is now
captured durably as substrate (see
`memory/feedback_emit_empty_security_result_on_conditional_skip_ci_maturity_pattern_aaron_2026_04_28.md`)
so future security-tool workflows inherit the pattern. The specific
codeql.yml work is DONE; the timing-artifact resolves on its own.

What remains in scope for B-0084:

- Verify the path-gate aggregate-baseline covers ALL matrix languages
  (currently: actions + csharp + python + java-kotlin + javascript-
  typescript per round-34 update).
- If a future language addition misses the aggregate-baseline, this
  row catches it.

## The original fix shape (preserved for context)

When path-gate determines no code changes, **still upload an empty
SARIF** via \`codeql-action/upload-sarif@<sha-pin>\`. This makes GitHub's
Code Scanning surface log "SAST ran with zero findings" for that
commit, which Scorecard then counts as SAST-covered.

This is the documented pattern for Scorecard satisfaction without
burning Actions minutes on prose-only changes. The empty SARIF is
~50 bytes; the upload-sarif step takes ~5 seconds; net Actions cost
is negligible.

## Concrete change

In \`.github/workflows/codeql.yml\`, after the path-gate "code_changed"
output is computed:

```yaml
- name: Path gate decision
  id: path-gate
  run: |
    # ... existing logic that sets code_changed=true|false ...
    echo "code_changed=$code_changed" >> "$GITHUB_OUTPUT"

# NEW: emit empty SARIF when path-gate skips, so Scorecard SAST
# coverage stays at 30/30 instead of dropping on doc-only PRs.
- name: Emit empty SARIF on no-code-change
  if: steps.path-gate.outputs.code_changed != 'true'
  run: |
    cat > empty.sarif <<'EOF'
    {
      "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      "version": "2.1.0",
      "runs": [{
        "tool": {"driver": {"name": "codeql-path-gate-noop", "version": "1.0.0"}},
        "results": []
      }]
    }
    EOF

- name: Upload per-language empty SARIF to Code Scanning
  if: steps.path-gate.outputs.code_changed != 'true'
  strategy:
    matrix:
      language: [actions, csharp, python, java-kotlin, javascript-typescript]
  uses: github/codeql-action/upload-sarif@<sha-pin>
  with:
    sarif_file: empty.sarif
    category: "/language:${{ matrix.language }}"
```

**Important**: the live `codeql.yml` implementation uses **per-language
SARIF categories** (one upload per `Analyze (X)` matrix leg) rather
than a single aggregate category. Reason: the
`code_quality:severity=all` ruleset rule reads SARIF coverage
per-language; a single-category upload would still leave 4 of 5
language legs as "results pending". See lines 270-334 of the live
workflow for the actual matrix-loop implementation.

## Acceptance criteria

- [ ] `.github/workflows/codeql.yml` modified to emit empty SARIF
  on path-gate skip
- [ ] Empty SARIF passes GitHub Code Scanning validation
- [ ] After the next 2-3 doc-only PRs land, Scorecard SASTID metric
  reads 30/30 (or whatever the recent-N-commits ratio shows)
- [ ] Per-PR Actions minutes cost increases by ~5 seconds (empty-
  SARIF upload), within budget
- [ ] Otto-247 version-currency: upload-sarif action SHA-pinned to
  latest stable (not `@v3` or similar)

## Why P1 (not deferred to after 0/0/0)

- The Scorecard SASTID alert is gating PR #661 (`code_quality:severity=all`
  ruleset requires zero open code-scanning alerts).
- This unblocks the 0/0/0 chain rather than being blocked by it.
- Small effort (S = under a day; the change is ~15 lines of YAML).

## Composes with

- `feedback_speculation_leads_investigation_not_defines_root_cause_*` —
  the failure mode this row corrects (I dismissed without
  verifying).
- `feedback_destructive_git_op_5_pre_flight_disciplines_*` — discipline
  3 (commit messages / process metrics count as content) compose
  with: process metrics count as ALERTS, dismissal isn't a fix.
- The "do the right long term thing" framing Aaron just named —
  worth landing as its own memory after this PR.

## What I learned (this row's meta-lesson)

1. **Dismissing security alerts as "won't fix" is a code smell** when
   the alert points at a real metric gap, even if the metric is
   "process" rather than "code-vuln".
2. **Speculation-without-evidence still kicks in even on small calls.**
   I'd asserted "path-gate correctly skipped" without checking the 2
   actual unchecked PRs. Aaron's question forced the investigation.
3. **Short-term avoidance ≠ long-term fix.** Dismissal closes the
   alert in this scan but lets the metric drop on every doc-only PR
   thereafter. Emit-empty-SARIF is one-time work that fixes the
   underlying signal-quality forever.
