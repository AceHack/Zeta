---
id: B-0533
priority: P3
status: open
title: "§33 migration dead-xref sweep + static lint — live-nav pointers to docs/research/ paths that have been migrated to memory/persona/<name>/conversations/"
tier: factory-infrastructure
effort: M
created: 2026-05-15
last_updated: 2026-05-16
depends_on: []
composes_with: [B-0036, B-0532]
tags: [migration, hygiene, lint, mechanization, multi-agent, drift-detection, section-33]
type: feature
---

# §33 migration dead-xref sweep + static lint

## Origin

Codex P2 finding on already-merged [PR #3513](https://github.com/Lucent-Financial-Group/Zeta/pull/3513) (Riven §33 archive migration, 12 files) named a real bug: *"This migration moves documents out of `docs/research/` but does not carry the existing references with it, so active documentation now has dead links."*

The narrow fix shipped as [PR #3529](https://github.com/Lucent-Financial-Group/Zeta/pull/3529) — 3 live-nav pointers updated for one migrated Riven file. But the pattern generalizes: **every §33 migration moves files without auto-updating backlinks**, and the same dead-xref class likely exists across the 8 personas migrated so far.

Empirical scan in tick 1802Z surfaced **20+ dead xrefs** in live-nav surfaces (`.claude/rules/`, `memory/feedback_*.md`, `docs/backlog/*.md`) pointing at old `docs/research/<file>` paths that now live at `memory/persona/<persona>/conversations/<file>`. Rough per-persona distribution:

| Persona | Dead-xref count (approx) |
|---|---|
| Amara | 10+ |
| DeepSeek | 4 |
| Alexa | 3+ |
| Lior | 2 |
| Riven | 1 (already fixed by PR #3529) |

Migration PRs that produced these dead xrefs (and could be revisited): #3348 (Ani), #3484 (Amara), #3501 (Kestrel), #3507 (DeepSeek), #3512 (Lior), #3513 (Riven), #3514 (Alexa), #3516 (Vera).

## Problem

Live-navigation pointers (rules, backlog rows, memory feedback files) that reference moved files break silently. Specifically:

1. **Reader friction**: a human (or future-Otto) following a `[caption](docs/research/file.md)` link gets a 404; navigation breaks.
2. **Provenance loss**: BACKLOG row origins lose traceability to their canonical-substrate verbatim packet.
3. **Rule weakness**: auto-loaded rules in `.claude/rules/` that cite verbatim packets at old paths weaken their own evidence trail.

NOT a problem in **historical archives** (`docs/history/pr-reviews/*`, `docs/hygiene-history/ticks/*`, `docs/pr-discussions/*`) — those are frozen state-snapshots; their xrefs document what was true at write-time, which is what they're supposed to do.

## Proposed solution

**Two-slice approach:**

### Slice A — sweep (mechanical fix)

Update all dead xrefs in live-nav surfaces. Mechanical because the mapping is deterministic:

```
docs/research/<basename>   →   memory/persona/<persona>/conversations/<basename>
```

The `<persona>` is derivable from `git log --diff-filter=R` on each migration PR (or from `git ls-tree -r origin/main -- memory/persona/<persona>/conversations/`).

Per-persona PR batching (8 small PRs, ~3-15 files each) to keep blast radius small + reviewable.

### Slice B — static lint (mechanization)

Add `tools/hygiene/lint-section-33-xrefs.ts` that:

1. Walks live-nav surfaces (`.claude/`, `memory/*.md`, `docs/backlog/`, `tools/`, root `*.md` files).
2. For each `docs/research/<basename>` reference, checks whether `<basename>` now lives under `memory/persona/<*>/conversations/`.
3. If migrated, fails with the canonical target path + edit suggestion.
4. Wire into `lint` job in `.github/workflows/gate.yml`.

Excludes:

- `docs/history/pr-reviews/**` (frozen snapshots)
- `docs/hygiene-history/ticks/**` (frozen tick shards)
- `docs/pr-discussions/**` (frozen archives)
- `docs/research/**` (its own internal cross-refs may be intentional provenance trail; sibling migration candidates)
- `references/upstreams/**` (other people's code; gitignored anyway)

Composes with [B-0532](B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md) (backlog-graph consistency lint) — both are static-lint mechanizations of post-hoc-review-finding patterns.

## Out of scope

- **Updating migration-PR ARCHITECTURE** to auto-update backlinks at migration time. Possible follow-up after the lint catches the gap; for now, fix-after-merge is acceptable.
- **The 78 `claudeai` + 16 `gemini`/`codex` residuals** in `docs/research/` — those are content-id-required deferred work per PR #3501; this row is only about dead xrefs to ALREADY-migrated files.

## Composes with

- [B-0036](B-0036-section33-archive-header-backfill-and-ci-wire-otto-346-pattern.md) — §33 archive-header backfill is the sibling discipline (header-side; this row is xref-side)
- [B-0532](B-0532-backlog-graph-consistency-lint-parent-child-status-mismatch-2026-05-15.md) — static-lint mechanization sibling
- [PR #3513](https://github.com/Lucent-Financial-Group/Zeta/pull/3513), [PR #3529](https://github.com/Lucent-Financial-Group/Zeta/pull/3529) — the empirical anchor for this row
- [`.claude/rules/encoding-rules-without-mechanizing.md`](../../../.claude/rules/encoding-rules-without-mechanizing.md) — fix-once-then-lint pattern; this row applies it to the migration xref class

## Status (2026-05-16)

Per the row-close gate triage (per [`.claude/rules/backlog-item-start-gate.md`](../../../.claude/rules/backlog-item-start-gate.md) step 0 — substrate-drift discriminator merged via PR #3757), this row is **partial completion, NOT drift**.

**Shipped (Slice B — lint tool + gate.yml wiring):**

- `tools/hygiene/audit-section-33-migration-xrefs.ts` (slightly different name than the row's proposed `lint-section-33-xrefs.ts`; functionally equivalent) — via PR [#3548](https://github.com/Lucent-Financial-Group/Zeta/pull/3548) + PR [#3555](https://github.com/Lucent-Financial-Group/Zeta/pull/3555) (`Slice B.3 + B.4 — --enforce flag + gate.yml wiring`)
- Gate.yml job `lint-section-33-migration-xrefs` is present

**Pending (Slice A — sweep):**

- The actual sweep of dead xrefs in live-nav surfaces is **not done**. Empirical evidence: multiple recent PRs (e.g., #3670, #3659, #3643, #3633, #3599) show the `lint (§33 migration xrefs)` non-required check FAILING — meaning dead xrefs persist in the tree. The lint is correctly catching what Slice A was supposed to clean up.
- Per the row's Proposed solution: "Per-persona PR batching (8 small PRs, ~3-15 files each)". The 8 persona-batched PRs are pending; some may have been done in fragments (Lior's archive PRs) but the lint failures suggest the work is incomplete.

Row stays `status: open` until Slice A's persona-batched sweep PRs land. The partial-vs-drift distinction is exactly the discriminator that PR #3757's step-0 rule extension mechanizes at the discipline scope.

Audit anchor: 2026-05-16T05:48Z Otto-CLI tick verified via pure-git (no `gh`) that `tools/hygiene/audit-section-33-migration-xrefs.ts` exists and `grep 'lint-section-33-migration-xrefs' .github/workflows/gate.yml` finds the job. The Slice A pending state is inferred from the session-collected warnings list (non-required check failures across 5+ open PRs).
