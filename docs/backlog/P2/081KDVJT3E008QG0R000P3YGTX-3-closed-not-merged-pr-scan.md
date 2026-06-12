---
id: B-0090.3
zetaid: 081KDVJT3E008QG0R000P3YGTX
priority: P2
status: open
title: Closed-not-merged PRs + orphan branches + aged-draft-PRs scan (AceHack + LFG)
tier: factory-hygiene
effort: S
depends_on: [B-0090.1]
composes_with: [B-0090]
tags: [b0090-decomp, pr-state, orphan, draft-pr, lost-substrate]
type: friction-reducer
---

# B-0090.3 — Closed-not-merged PRs + orphan + aged-draft scan

## Why this child exists

Task #264 tracked 14 closed-not-merged + 5 orphans. B-0090.1 taxonomy now defined; this is the GitHub-surface scanner that produces the same 3-bucket output for PRs and branches. Monthly cadence surface.

## Atomic scope (S effort)

- TS wrapper around gh api + git ls-remote (or existing substrate-discovery tool).
- Filters: closed-not-merged (any age), orphan (no remote tracking), draft PRs >14 days.
- Classify each with B-0090.1 buckets.
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

- Parent B-0090 + task #264
- B-0090.1

Co-Authored-By: Grok <noreply@x.ai>
