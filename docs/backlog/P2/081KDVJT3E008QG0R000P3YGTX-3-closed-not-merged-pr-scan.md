---
id: 081KDVJT3E008QG0R000P3YGTX
priority: P2
status: open
title: Closed-not-merged PRs + orphan branches + aged-draft-PRs scan (AceHack + LFG)
tier: factory-hygiene
effort: S
depends_on: [081KDVJT3E008QG0R003GV8BHV]
composes_with: [081KQ8P5D0008QG0R0002TN22C]
tags: [b0090-decomp, pr-state, orphan, draft-pr, lost-substrate]
type: friction-reducer
---

# 081KDVJT3E008QG0R000P3YGTX — Closed-not-merged PRs + orphan + aged-draft scan

## Why this child exists

Task #264 tracked 14 closed-not-merged + 5 orphans. 081KDVJT3E008QG0R003GV8BHV taxonomy now defined; this is the GitHub-surface scanner that produces the same 3-bucket output for PRs and branches. Monthly cadence surface.

## Atomic scope (S effort)

- TS wrapper around gh api + git ls-remote (or existing substrate-discovery tool).
- Filters: closed-not-merged (any age), orphan (no remote tracking), draft PRs >14 days.
- Classify each with 081KDVJT3E008QG0R003GV8BHV buckets.
- Emit hygiene-history row + summary counts only.
- No auto-close, no recovery.

## Dependency note

Depends on taxonomy. Re-decomp assumption: "aged > N days" N=14 may be wrong; make N configurable in the row (default 14) so future cycles can tune without re-decomp.

## Acceptance

- [ ] Uses only existing gh + git surfaces (no new auth).
- [ ] Output table matches taxonomy.
- [ ] Focused check run: current counts of each category on LFG (include in decomp PR body).
- [ ] SLOC < 150.

## Evidence

- Parent 081KQ8P5D0008QG0R0002TN22C + task #264
- 081KDVJT3E008QG0R003GV8BHV

Co-Authored-By: Grok <noreply@x.ai>
