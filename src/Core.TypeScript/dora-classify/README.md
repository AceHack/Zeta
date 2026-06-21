# `tools/dora-classify/` — Step 1 substrate for DORA-mandate lane classification

## Purpose

Per-commit classification into LANES, with per-author operational-ratio aggregation. First substrate for the DORA-mandate + agent-orchestration substrate work per operator framing 2026-05-28 (lane discrimination + ratio discriminator).

Composes with:

- **081KSKBP80008QG0R000B3Y19A** (workflow engine v1) — lanes ARE per-action gate declarations at commit-grain scope
- **081KSKBP80008QG0R001KK9WV6** (heartbeat folder) — heartbeat lane already direct-to-main append-only
- **081KSNY2Z0008QG0R000HENSVM** (DORA-of-live-system mandate) — operational lane is what gets measured
- **081KSNY2Z0008QG0R000DA261F** (two-mandate portfolio composition) — per-agent operational-ratio is the portfolio-balance metric
- **081KSNY2Z0008QG0R003R0Z7D2** (reproducibility-as-causal-attribution) — lane-tagged commits compose with helm-charts observability

## Lane taxonomy

| Lane | Path matchers | Storage cost | Future gate (Step 3) |
|---|---|---|---|
| `operational` | `src/`, `tools/installer/`, `tools/setup/`, `full-ai-cluster/` | Free | Full PR + CI + review |
| `verbatim-preservation` | `memory/<persona>/<X>/conversations/` | Free | Fast-track PR + lint-only |
| `memory` | `memory/*.md` (non-persona) | Free | Fast-track PR + lint-only |
| `heartbeat` | `docs/agent-heartbeats/` | Free | Direct-to-main append-only |
| `backlog-row` | `docs/backlog/` | Free | Fast-track PR + lint-only |
| `shadow-work` | `docs/hygiene-history/ticks/` + `shadow-lesson-log` filename pattern | Free | Append-only with ratio-based discriminator |
| `tooling-or-ci` | `tools/ci/`, `tools/hygiene/`, `tools/lint/`, `.github/workflows/` | Free | Lighter CI; no review-block |
| `docs-general` | `docs/` not matching above | Free | Fast-track PR + lint-only |
| `substrate-cascade` | Default for unclassifiable | Free | Operator co-sign required (bounded by ratio, not volume) |
| `mixed` | Commit touches multiple distinct lanes | Free | Highest-gate-of-touched-lanes |

## Why ratios not volumes

Storage on GitHub is free for open-source projects (Zeta is open-source per 081KSKBP80008QG0R003RFX32N reproducibility framing). The scarce resource is NOT storage; it's **operator-attention** + **DORA-signal-clarity**. Per-agent operational-ratio (operational-commits / total-commits, rolling window) is the discriminator the loop's autonomous behavior responds to:

- Ratio above threshold → loop is producing operational substrate; continue
- Ratio below threshold → loop has drifted toward non-operational lanes; next-cycle prompt includes "produce operational this cycle"

Volume-throttling is reserved for asymmetric producer-consumer scenarios (high-rate event-streams where classifier can't keep up). Not relevant at per-commit-classifier layer; commit rate is bounded by review/CI cadence.

## CLI

```bash
# Classify HEAD commit
bun src/Core.TypeScript/dora-classify/cli.ts

# Classify by specific SHA
bun src/Core.TypeScript/dora-classify/cli.ts --sha abc123

# Aggregate last 24h per-author ratios
bun src/Core.TypeScript/dora-classify/cli.ts --since "24 hours ago" --aggregate

# Range mode
bun src/Core.TypeScript/dora-classify/cli.ts --range origin/main..HEAD --aggregate
```

Output: JSON to stdout. `--aggregate` mode emits `AuthorRatioStats[]`; default mode emits `ClassificationResult[]`.

## Pure logic vs CLI

- `classify.ts` — pure functions (`classifyPath`, `classifyCommit`, `aggregateAuthorRatios`); zero I/O; fully unit-testable
- `cli.ts` — I/O wrapper that calls `git log` / `git diff-tree` and feeds results into pure logic
- `classify.test.ts` — 28 unit tests covering all lane-classification + aggregation cases

## What Step 1 does NOT do (deferred to later steps)

- **Step 2**: Helm-charts observability inventory + DORA-metric-derivation
- **Step 3**: Pre-merge structural gate (lane-specific policy: operator co-sign for substrate-cascade; fast-track for verbatim/memory/heartbeat; etc.)
- **Step 4**: systemd timer for forced operational-only window
- **Step 5**: DORA-feedback file (`/run/zeta/dora-current.json`) for loop input
- **Step 6**: Per-agent operational-ratio influences next-cycle behavior (consumes this Step 1 substrate)

Step 1 ships observability primitives only. No coercion; no blocking. Higher-step substrate consumes Step 1 output to implement gate policy.

## Composes with rules

- `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md` — operational-ratio drop is observable evidence of brief-ack/standing-by-failure-mode at multi-cycle scope
- `.claude/rules/non-coercion-invariant.md` HC-8 — classifier observes; doesn't coerce
- `.claude/rules/asymmetric-critic-with-clarity-first.md` — lane-discrimination is operator-substrate-honest correction of binary operational-vs-substrate-cascade framing
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` — lane taxonomy preserves smoothness (multiple valid lanes, not binary)
