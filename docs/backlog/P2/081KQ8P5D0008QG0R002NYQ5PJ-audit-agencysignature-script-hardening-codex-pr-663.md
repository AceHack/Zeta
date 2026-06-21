---
id: 081KQ8P5D0008QG0R002NYQ5PJ
priority: P2
status: closed
title: tools/hygiene/audit-agencysignature-main-tip.ts hardening — 5 Codex findings on PR #663 (sh→ts ported)
effort: M
ask: address Codex P1/P2 findings on the AgencySignature main-tip auditor
created: 2026-04-28
last_updated: 2026-05-10
depends_on: []
tags: [pr-663, codex, agencysignature, hygiene]
type: friction-reducer
closed_reason: All findings fixed — 3 by TS port (no subshell, JS Date.parse, multi-trailer regex), 2 by this PR (--max 0 false-PASS, --since unvalidated input)
---

# 081KQ8P5D0008QG0R002NYQ5PJ — audit-agencysignature-main-tip.sh hardening

## Source

Codex review on PR #663 surfaced four findings on `tools/hygiene/audit-agencysignature-main-tip.sh`:

1. **P1 (line 166)**: regression detector treats commits as agentic only with single Co-authored-by trailer; should match all Co-authored-by trailers when flagging regressions.
2. **P2 (line 257)**: `classify_commit` calls `exit 2` on unparseable input, but the call is in a subshell — the exit is swallowed and the auditor silently continues. Propagate the error.
3. **P2 (line 194)**: BSD `date` doesn't accept the date-only override format the parser branch claims macOS compatibility for.
4. **P2 (line 150)**: `--since` input is passed directly to `git log` without validation; bad inputs silently audit nothing.
5. **P2 (line 143)**: `--max` validator accepts `0` even though script says it must be a positive integer. `git log --max-count=0` produces an empty commit list that exits with PASS — the auditor silently passes when run with --max=0.

## Resolution

The `.sh` file was ported to TypeScript (`audit-agencysignature-main-tip.ts`) in an earlier
round, which structurally resolved findings 1-3:

- Finding 1 (multi-trailer): `COAUTHOR_RE` with `im` flags tests the whole trailers block;
  any matching `Co-authored-by:` line triggers the agentic classification.
- Finding 2 (subshell exit): `classifyCommit` returns `null`; caller checks it and surfaces
  `toolingError: true` — no subshell swallowing.
- Finding 3 (BSD date): `parseShipDate()` uses `Date.parse()` — no OS `date` call.

Findings 4 and 5 survived into the TS port and were fixed by this PR:

- Finding 4 (`--since` unvalidated): `parseShipDate(sinceDate)` is called before the git
  invocation; an unparseable date now exits 2 with an error message.
- Finding 5 (`--max 0` false-PASS): `POSITIVE_INT_RE` changed from `/^\d+$/` to
  `/^[1-9]\d*$/`; `--max 0` now exits 2 with an error message.

## Acceptance

- [x] All 5 issues resolved (3 by TS port, 2 by this PR)
- [x] Smoke-runs: `--max 0` → exit 2, `--since not-a-date` → exit 2,
      `--max 1` → exit 1 (live regression on HEAD, correct behaviour),
      `--since 2026-05-01` → exit 1 (correctly audits)
- [x] `dotnet build -c Release` — 0 warnings, 0 errors
- [x] `tsc --noEmit` — 0 type errors

## Composes with

- PR #663 + #299 (the AgencySignature auditor landing)
- Amara ferry-7 enforcement instrument 2/4 (task #299)
