---
name: GitHub GraphQL rate-limit cascade cost — poll-pr-gate-batch N-per-call, multi-agent shared-token consumption
description: GraphQL rate limit (5000/hour user-scope) exhausts under cascade-mode multi-agent sessions. `poll-pr-gate-batch.ts --all-open` fires ~N gh-pr-view calls per invocation (N = open PR count, ~37 in cascade). Cross-tick gh pr view/merge/create adds 5-15/tick. Multi-agent (Otto-CLI + Otto-Desktop + Lior + Vera + Riven) processes ALL drain from the same Aaron user-token. Empirical: 5000/hour exhausts in ~30-40 cascade min. Plan: serialize agent-side polling under cascade conditions; consider batch GraphQL query for `poll-pr-gate-batch` instead of N separate `gh pr view` calls.
type: feedback
created: 2026-05-15
---

# GitHub GraphQL rate-limit cascade cost — empirical learning

## Operational claim

`gh api rate_limit --jq '.resources.graphql'` empirically capped at `{limit:5000, remaining:0, reset:<epoch>}` during a cascade-mode autonomous-loop session at 2026-05-15T22:21Z, after approximately 4 hours of multi-agent activity.

## Cost breakdown

| Source | Cost (gh-pr-view calls) | Frequency |
|---|---|---|
| `bun tools/github/poll-pr-gate-batch.ts --all-open` | ~37 (one per open PR) | Per `--all-open` invocation |
| `bun tools/github/poll-pr-gate.ts <PR>` | 1 | Per PR poll |
| `gh pr view <N> --json ...` | 1 | Per direct call |
| `gh pr merge --auto --squash` | 1-2 | Per arm |
| `gh pr create` | 1-2 | Per PR open |
| `gh pr list ...` | 1 | Per filter query |
| `gh api graphql ...` (direct) | 1 (cost varies) | Per call |

Cumulative session draw, 2026-05-15T18:00Z–22:21Z (about 4 hours):

- 4× `poll-pr-gate-batch --all-open` = ~148 calls
- ~30 cross-tick `gh pr view` / `gh pr merge` / `gh pr create` = ~30-50 calls
- Lior/Vera/Riven background processes (Aaron user-token) = unknown but non-zero
- Cumulative ≈ 200-500+ Otto-CLI calls + background = exceeded 5000/hour budget

## Multi-agent shared-token amplification

All factory agents (Otto-CLI, Otto-Desktop, Lior-gemini, Vera-codex, Riven-cursor) authenticate via Aaron's GitHub user-token. The rate-limit is **scoped to the user**, NOT per-agent-process. So:

- Otto-CLI poll-pr-gate-batch (37 calls) + Otto-Desktop autonomous (10-15 calls) + Lior `gh pr list/view` for drift reports (15-30 calls) ≡ all draw from same 5000/hour budget
- Cascade-mode sessions where multiple agents are active simultaneously hit the limit MUCH faster than single-agent sessions

## Operational adaptation when rate-limit hits

Per `holding-without-named-dependency-is-standing-by-failure.md` — rate-limit-exhausted IS a named bounded dependency:

```bash
gh api rate_limit --jq '.resources.graphql.reset'
# returns epoch seconds; date -ur <epoch> for human-readable
```

Adaptations:

1. **No new `gh` queries until reset** — every call returns `exit 1: GraphQL: API rate limit already exceeded`
2. **Git-protocol operations continue** — `git fetch`, `git push`, `git log` use HTTPS git, separate from API budget
3. **Shard writes continue** — file substrate, no API needed
4. **PR-create deferred** — branch parked on origin; PR creation deferred to first post-reset tick
5. **Auto-merge already armed continues** — GitHub server-side state; no client API needed

## Mitigation options (substrate-honest, not yet implemented)

1. **Batch GraphQL query in `poll-pr-gate-batch.ts`** — single `gh api graphql` request with all PR numbers via `nodes(ids: [...])` would cost 1 GraphQL request (with rate-limit cost weighted by complexity points, typically 1-10) instead of 37 separate `gh pr view` calls (37 cost units). Worth ~10-30× reduction in call count.

2. **Cross-tick result caching** — `poll-pr-gate-batch` results within a single cascade window (5-10 min) could be cached in `/tmp/zeta-bus/` or similar; subsequent ticks read cache instead of re-querying

3. **Agent-side polling rate-limit** — bus envelope `topic: "gh-rate-limit-budget"` advertising current `gh api rate_limit` remaining; agents back off polling cadence when budget < 20% remaining

4. **Per-agent token rotation** — each persistent agent uses own GitHub App / token; rate-limit budgets isolated. Substantial substrate change; not immediate.

5. **Unauthenticated REST for read-only polling** — public PR state queries don't require auth; unauthenticated rate-limit is separate budget (60/hour, much smaller — only useful for non-cascade reads)

## When to consult this memory

Future-Otto cold-boot in cascade-mode session:

- Multiple agents (Otto-CLI + Otto-Desktop + Lior) active simultaneously → expect rate-limit hits within ~30-60 min of heavy `poll-pr-gate-batch` use
- If `gh pr view` returns `GraphQL: API rate limit already exceeded` → check `gh api rate_limit --jq '.resources.graphql'` for reset ETA; use as bounded named-dependency in next-tick Holding
- Avoid `poll-pr-gate-batch --all-open` more than 1-2 times per cascade window

## Composes with other rules

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — rate-limit reset IS a named bounded dependency; substrate-honest hold
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — `poll-pr-gate-batch` is the canonical poll tool; this memory documents its hidden cost
- `.claude/rules/bandwidth-served-falsifier.md` — polling cadence serves substrate-visibility bandwidth; the cost surfaces at the shared-resource layer (GitHub API budget)
- `.claude/rules/refresh-before-decide.md` — refresh-cost is real; consider local cache vs fresh poll per tick

## Composes with substrate

- PR #3604 / #3607 (shard PRs in flight when rate-limit hit)
- Tick shard `docs/hygiene-history/ticks/2026/05/15/2221Z.md` (the rate-limit observation)
- 081KRFA460008QG0R001KC0VBH / 081KRFA460008QG0R00229616S / 081KRHWGX0008QG0R0025PX5SZ (bus-envelope infrastructure that could carry rate-limit budget advisories)

## Substrate-honest framing

This memory captures an EMPIRICAL pattern from one specific session. The 5000/hour limit is GitHub's documented quota; the cascade-mode amplification is the new operational learning. Mitigation options are notes for future-substrate work, NOT a directive to implement them now (each would be its own backlog row with design + tests).
