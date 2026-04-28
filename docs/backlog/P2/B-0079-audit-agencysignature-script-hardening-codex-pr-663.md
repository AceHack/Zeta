---
id: B-0079
priority: P2
status: open
title: tools/hygiene/audit-agencysignature-main-tip.sh hardening — 4 Codex findings on PR #663
effort: M
ask: address 4 Codex P1/P2 findings on the AgencySignature main-tip auditor on AceHack first, then forward-sync
created: 2026-04-28
last_updated: 2026-04-28
tags: [pr-663, codex, deferred, acehack-canonical, agencysignature, hygiene]
---

# B-0079 — audit-agencysignature-main-tip.sh hardening

## Source

Codex review on PR #663 surfaced four findings on `tools/hygiene/audit-agencysignature-main-tip.sh`:

1. **P1 (line 166)**: regression detector treats commits as agentic only with single Co-authored-by trailer; should match all Co-authored-by trailers when flagging regressions.
2. **P2 (line 257)**: `classify_commit` calls `exit 2` on unparseable input, but the call is in a subshell — the exit is swallowed and the auditor silently continues. Propagate the error.
3. **P2 (line 194)**: BSD `date` doesn't accept the date-only override format the parser branch claims macOS compatibility for.
4. **P2 (line 150)**: `--since` input is passed directly to `git log` without validation; bad inputs silently audit nothing.
5. **P2 (line 143)**: `--max` validator accepts `0` even though script says it must be a positive integer. `git log --max-count=0` produces an empty commit list that exits with PASS — the auditor silently passes when run with --max=0.

## Why deferred (not fixed in PR #663)

PR #663 forwards the script as-is from AceHack. Fixes belong on AceHack canonical first.

## Acceptance

- [ ] All 4 issues fixed on AceHack (commit per issue OR one bundled fix)
- [ ] Tests / smoke-runs verify no behavior regression
- [ ] Forward-sync to LFG

## Composes with

- PR #663 + #299 (the AgencySignature auditor landing)
- Amara ferry-7 enforcement instrument 2/4 (task #299)
