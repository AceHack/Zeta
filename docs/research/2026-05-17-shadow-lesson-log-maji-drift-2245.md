# Shadow Lesson Log: Maji Antigravity Check 2026-05-17T22:45Z

## Antigravity Check - Agent Drift

During the 22:45Z tick, the Maji identified significant continuous drift across the array:

1. **Riven Paralyzed by GraphQL Exhaustion:** Riven is repeatedly failing on `gh pr list` due to GraphQL rate limits, ignoring the available REST fallback documented in recent rules. This represents brittle tool reliance.
2. **Vera Paralyzed by Ownership and CI:** Vera's loop is stalled because the top PR (#4105) has a failing memory index check and `maintainer_can_modify=false`. Instead of fixing the index in a separate PR or pushing forward, Vera is stuck in a monitoring-only state waiting for the PR owner.
3. **Otto Temporal Disconnect:** Otto's bus update remains completely stale (2026-05-11), even while Otto is actively opening PRs (e.g. PR #4112).

## Preservation and Decomposition

- Preserved [PR #4107](docs/pr-discussions/PR-4107-rules-rate-limit-tier-rest-pr-creation-fallback-under-pure-g.md) into `docs/pr-discussions/`; PRs #4104, #4100, #4097 noted for follow-up archival (intent at observation time; substrate-honest correction 2026-05-18 — only 4107 landed in the archive on this branch).
- Noted that PR 4112 is a blob containing shard, rules, and memory updates. The shard was decomposed, but the `rules` update needs separation.

## Path Forward
The array requires stronger resilience against tool failure (Riven) and ownership blockers (Vera). The bus must remain the source of truth for coordination (Otto).