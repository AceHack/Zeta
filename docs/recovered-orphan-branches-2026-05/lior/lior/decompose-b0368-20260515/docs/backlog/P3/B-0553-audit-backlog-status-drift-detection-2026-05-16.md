---
id: B-0553
priority: P3
status: open
title: "Backlog status-drift auditor — detect `status: open` rows whose primary artifact has already shipped"
tier: factory-hygiene
effort: S
created: 2026-05-16
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0506, B-0528, B-0530, B-0532, B-0535]
tags: [backlog, hygiene, drift, factory-cadence, mechanization, friction-reducer]
type: feature
---

# Backlog status-drift auditor

## Origin

2026-05-16T04:15Z–05:00Z Otto-CLI session manually caught 4 status-drift rows in a single 45-minute window (B-0506, B-0528, B-0530, B-0535 closed via PR #3733, #3743, #3737, #3742 respectively). Peer Otto-CLI surface independently caught the 4th (B-0535) using the same pattern. Empirical evidence captured in [`memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md`](../../../memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md).

The "substrate-drift-catch pattern" memorialized in that file is currently a per-tick discipline applied manually. This row mechanizes the audit step.

## Why P3

P3 friction-reducer — manual discipline works but is human-attention-bound. 4 catches in 45 minutes suggests the drift rate is non-trivial; an automated audit converts repeated manual work into a single CI/cron check.

Not P2 because the manual pattern is operational and produces the same outcome; mechanization is convenience, not correctness.

Not P4 because the 4-catch empirical evidence is recent and concrete.

## Proposed mechanization

`tools/hygiene/audit-backlog-status-drift.ts` — TypeScript audit tool.

### Behavior

1. Enumerate all `docs/backlog/P*/B-*.md` rows
2. For each row with `status: open` in YAML frontmatter:
   - Parse the **Acceptance** and **Proposed mechanization** sections to extract primary-artifact paths (under `tools/` or `.claude/` or `docs/`)
   - **Critically: do NOT extract paths from `composes_with:` (frontmatter), `Composes with` section, or rule citations.** A naive `grep -oE 'tools/[a-z0-9_/-]+\.ts'` over the whole body has empirical false-positive rate of ~100% (4-of-4 candidates in the 0500Z manual scan).
3. For each extracted primary-artifact path, check whether it exists on disk
4. Report rows where ALL primary-artifact paths exist (likely drift)
5. With `--prune-claims`, release any matching `bun tools/bus/claim.ts acquire ...` entries for the row (the canonical claim-CLI invocation)
6. With `--open-close-pr`, auto-open close-row PRs (status: open → closed + Resolution section + `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts` regen)

### Section parsing — the load-bearing detail

The parsing must distinguish row-body sections by their headings:

| Section | Treatment |
|---|---|
| `## Acceptance` / `## Acceptance criteria` | extract primary-artifact paths |
| `## Proposed mechanization` | extract primary-artifact paths |
| `## Scope` | extract primary-artifact paths |
| `composes_with:` (frontmatter) | **skip** (cross-reference only) |
| `## Composes with` (body section) | **skip** (cross-reference only) |
| `## Origin` / `## Source` / `## Why P3` | **skip** (context only) |
| `## Non-goals` | **skip** (intentionally absent work) |

A path mentioned in the `## Acceptance` section is a primary artifact. A path mentioned in `## Composes with` is a sibling, not a primary artifact.

### Empirical false-positive catalog (2026-05-16T05:00Z manual scan)

The naive `grep -oE 'tools/[a-z0-9_/-]+\.ts'` over the whole body flagged 4 P3 rows as drift candidates; all 4 were false positives:

| Row | False match | True state |
|---|---|---|
| [B-0116](B-0116-gh-jq-safe-wrapper-zsh-quoting-2026-04-30.md) | `tools/github/poll-pr-gate.ts` (composes_with) | Primary artifact `tools/gh-jq-safe.sh` does NOT exist; row is genuinely open |
| [B-0205](B-0205-multi-trajectory-validation-basis-instrumentation-aaron-2026-05-05.md) | `tools/github/poll-pr-gate-batch.ts` (composes_with) | Effort: L research+architecture row; multi-axis instrumentation in-progress |
| [B-0422](B-0422-clifford-algebraic-narrative-engine-pauli-symmetry-breaking-falsifiability-test-2026-05-12.md) | `.claude/rules/backlog-item-start-gate.md` (rule citation) | Research row; Clifford engine in-progress |
| [B-0537](B-0537-memory-md-index-entry-lengths-cleanup-and-gate-2026-05-15.md) | `tools/hygiene/audit-memory-index-entry-lengths.ts` (existing audit tool, but row's work is cleanup + CI gate which haven't shipped) | Genuinely open work (Slice A cleanup + Slice B CI gate pending) |

These four cases drive the section-aware parsing requirement.

## Acceptance

- New `tools/hygiene/audit-backlog-status-drift.ts`
- Parses YAML frontmatter for `status: open`
- Extracts primary-artifact paths from **Acceptance / Proposed mechanization / Scope** sections only
- Skips `composes_with:` (frontmatter), `## Composes with` section, and other context sections
- Reports candidates as markdown table (default) or JSON (`--json`)
- `--prune-claims` releases matching bus claims
- `--open-close-pr` opens close-row PRs automatically (one per candidate)
- Exit 0 in detect-only mode; structured exit on `--check` mode when candidates found
- Bun-runnable; respects the `tools/` TS-first convention per Rule 0
- Unit tests covering: section discrimination (Acceptance vs Composes-with), false-positive cases listed above, missing-file → no flag, all-exist → flag
- Documented invocation pattern in the file header

## Composes with

- [B-0506](B-0506-stale-worktree-prune-cadence-mechanization-2026-05-14.md) (closed-row precedent — same pattern caught manually)
- [B-0530](B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md) (closed-row precedent — same pattern caught manually)
- [B-0528](B-0528-shadow-launchd-installer-unit-tests-2026-05-15.md) (closed-row precedent — same pattern caught manually)
- [B-0535](B-0535-backlog-id-uniqueness-lint-extension-of-b0532-2026-05-15.md) (closed-row precedent — peer Otto-CLI catch)
- [B-0532](B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md) (parent-child status mismatch lint — similar audit-shape sibling)
- [`memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md`](../../../memory/feedback_substrate_drift_catch_pattern_claim_acquire_plus_existence_check_otto_cli_2026_05_16.md) — the discipline this row mechanizes
- [`.claude/rules/backlog-item-start-gate.md`](../../../.claude/rules/backlog-item-start-gate.md) — the start-gate this audit extends with the zero-th step
- `tools/backlog/generate-index.ts` — the `BACKLOG_WRITE_FORCE=1` regen path used after status updates
- `tools/bus/claim.ts` — the claim-acquire mechanism this audit can `--prune-claims` against

## Non-goals

- Detecting drift in `status: closed` rows (out of scope — those are already done)
- Auto-merging close-row PRs (the `--open-close-pr` mode opens them but doesn't arm auto-merge; agent discretion)
- Cross-row drift detection (e.g., B-0537 references `composes_with: B-0535` — out of scope; this is the realm of B-0532's parent-child status mismatch lint)
- Cleaning up the row file itself (Resolution section authoring is human/agent work; the tool only flags + optionally drafts a PR)

## Wire-up

- A periodic cadence (suggested: per-tick in autonomous-loop AS A SECOND-PASS after `cron-sentinel-mutex`, OR a daily GitHub Actions cron)
- Manual invocation by Otto on cold-boot when picking work — saves the manual existence-check step from the start-gate workflow

## Origin tick

Otto-CLI's 3-shard trail that landed on main: [`docs/hygiene-history/ticks/2026/05/16/0415Z.md`](../../hygiene-history/ticks/2026/05/16/0415Z.md) + [`0425Z.md`](../../hygiene-history/ticks/2026/05/16/0425Z.md) + [`0438Z.md`](../../hygiene-history/ticks/2026/05/16/0438Z.md). (An earlier draft cited `0436Z.md` and `0448Z.md`; those were intermediate shards that didn't land independently — `0436Z`'s content was rolled forward into `0438Z` via cherry-pick recovery; `0448Z`'s content lives on a peer-Otto-Desktop branch rather than its own merged PR.) Peer Otto-Desktop's parallel shards across the same window: [`0402Z.md`](../../hygiene-history/ticks/2026/05/16/0402Z.md) + [`0437Z.md`](../../hygiene-history/ticks/2026/05/16/0437Z.md) + [`0444Z.md`](../../hygiene-history/ticks/2026/05/16/0444Z.md) + [`0451Z.md`](../../hygiene-history/ticks/2026/05/16/0451Z.md).
