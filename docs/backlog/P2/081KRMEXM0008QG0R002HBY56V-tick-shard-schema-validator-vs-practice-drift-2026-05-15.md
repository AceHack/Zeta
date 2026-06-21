---
id: 081KRMEXM0008QG0R002HBY56V
priority: P2
status: open
title: Tick-shard schema validator vs current practice drift
created: 2026-05-15
last_updated: 2026-05-15
depends_on: []
parent: null
type: friction-reducer
decomposition: atomic
---

# 081KRMEXM0008QG0R002HBY56V — Tick-shard schema validator vs current practice drift

**Priority:** P2 (non-blocking; validator is not wired to CI).
**Filed:** 2026-05-15.
**Filed by:** Otto-CLI (surfaced via Codex P1 review on [PR #3359](https://github.com/Lucent-Financial-Group/Zeta/pull/3359)).
**Effort:** S (decision + small substrate change).

## What

`tools/hygiene/check-tick-history-shard-schema.ts` validates that every tick shard's first non-empty line is a 6-column pipe-row with an ISO 8601 UTC timestamp matching the path's date + the filename's `HHMMZ`. The schema is documented in [docs/hygiene-history/ticks/README.md](../../hygiene-history/ticks/README.md):

```text
| <ISO 8601 UTC timestamp> | <model id> | <cron sentinel> | <body> | <PR ref> | <observation> |
```

The legacy single-table format (`docs/hygiene-history/loop-tick-history.md`, pre-2026-04-29) was a single Markdown table where each tick added one such row. The shard transport split each tick into its own file, preserving the same row schema as the first line.

**Practice has diverged.** Recent May 2026 shards (e.g. [0027Z.md](../../hygiene-history/ticks/2026/05/15/0027Z.md), [0043Z.md](../../hygiene-history/ticks/2026/05/15/0043Z.md), [0230Z.md](../../hygiene-history/ticks/2026/05/15/0230Z.md)) start with an `# Tick HHMMZ — <headline>` H1 and contain rich multi-section Markdown bodies (Headline, Δ since, Substrate-honest observations, Next, etc.). Running the validator across the May 2026 cohort produces 100% violations:

```text
$ bun tools/hygiene/check-tick-history-shard-schema.ts --files docs/hygiene-history/ticks/2026/05/15/0027Z.md docs/hygiene-history/ticks/2026/05/15/0230Z.md docs/hygiene-history/ticks/2026/05/15/0043Z.md
VIOLATION: docs/hygiene-history/ticks/2026/05/15/0027Z.md — first row has 0 pipes; schema requires 6 columns (7+)
VIOLATION: docs/hygiene-history/ticks/2026/05/15/0230Z.md — first row has 0 pipes; schema requires 6 columns (7+)
VIOLATION: docs/hygiene-history/ticks/2026/05/15/0043Z.md — first row has 0 pipes; schema requires 6 columns (7+)
checked 3 shard files; 3 violations
```

The validator is NOT wired to any CI workflow (`grep -rn "shard-schema" .github/workflows/` returns 0 matches; only `check-tick-history-order.ts` is wired into `.github/workflows/gate.yml`). So the violation has been invisible at gate-time and the practice migrated forward without correction.

This drift surfaced via Codex's P1 review on [PR #3359](https://github.com/Lucent-Financial-Group/Zeta/pull/3359). The minimal local fix landed in commit `3392368` (pipe-row header above the H1 in both 0414Z and 0458Z shards). That fix is local to two shards; the substrate-wide drift across the rest of the May 2026 cohort remains.

## Why this matters

If the validator were ever wired to a CI required check OR enforced via PR-gate scripts, the entire May 2026 shard cohort would block all PRs touching `docs/hygiene-history/ticks/`. Several proposals — `tools/hygiene/check-tick-history-order.ts` companion validation, a shard-collation projector that reads the pipe-row schema, or future tooling that expects parseable shard files — would all hit this drift.

## Options

1. **Update the validator + README to recognize H1-rich format as canonical.** Practice has informed the new schema; codify it.
   - Pros: minimal-churn, validates what's actually being written, preserves rich content
   - Cons: loses the single-row machine-parseability the original schema afforded; downstream tooling (collation, projection) would need a different parse model
2. **Keep the validator + README as-is and bulk-add pipe-row headers to all May 2026 shards.** Backfill compliance.
   - Pros: preserves the machine-parseable read model; restores validator-vs-practice convergence
   - Cons: bulk-edit churn; PR scope balloons; potential merge-friction with in-flight tick shards
3. **Hybrid (recommended)**: keep the pipe-row first-line schema (machine-parseable) AND allow rich H1+body below it. Bulk-add pipe-row headers to existing shards (Option 2 mechanics) but update the README to explicitly endorse the H1-rich body as canonical (Option 1 framing).
   - Pros: best of both — machine parseable + human readable + matches what 0414Z + 0458Z (and now this row's authoring) already do
   - Cons: bulk-edit churn for the backfill

## Recommendation

Option 3, prioritized as follows:

- **Now** (this row, P2): backfill pipe-row headers to all May 2026 shards via a `tools/hygiene/add-pipe-row-header.ts` one-shot script (greppable: any shard whose first non-empty line is `# Tick` should get a pipe-row above it). Single PR, scoped to `docs/hygiene-history/ticks/2026/`.
- **Soon** (separate row): update [docs/hygiene-history/ticks/README.md](../../hygiene-history/ticks/README.md) "Shard file schema" section to explicitly describe the hybrid (pipe-row first line + H1-rich body).
- **Later** (separate row): wire the validator into CI's gate.yml as a non-required check first, promote to required after a sweep cycle.

## Composes with

- [docs/hygiene-history/ticks/README.md](../../hygiene-history/ticks/README.md) (current schema docs)
- [tools/hygiene/check-tick-history-shard-schema.ts](../../../tools/hygiene/check-tick-history-shard-schema.ts) (the validator)
- [PR #3359](https://github.com/Lucent-Financial-Group/Zeta/pull/3359) (Codex P1 surface where drift was caught)
- [PR #3361](https://github.com/Lucent-Financial-Group/Zeta/pull/3361) (this tick's shard, follows the hybrid pattern)
- [.claude/rules/refresh-before-decide.md](../../../.claude/rules/refresh-before-decide.md) (operational discipline; this row IS a refresh-before-decide artifact)

## Not in scope

- Wire the validator to gate.yml — separate row (would require fixing all violations first)
- Migrate the legacy single-row format to H1-rich for pre-2026-04-29 shards — those should stay in their legacy format as historical record
