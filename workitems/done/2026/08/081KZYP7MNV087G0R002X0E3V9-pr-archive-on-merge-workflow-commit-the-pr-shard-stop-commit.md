---
id: 081KZYP7MNV087G0R002X0E3V9
type: task
state: done
priority: P1
slug: pr-archive-on-merge-workflow-commit-the-pr-shard-stop-commit
title: "pr-archive-on-merge workflow: commit the PR shard, stop committing the derived manifest"
created: 2026-08-13T23:10:05.499Z
completed: 2026-08-14T00:16:33.194Z
depends_on: []
composes_with: []
---

# pr-archive-on-merge workflow: commit the PR shard, stop committing the derived manifest

The split half of `081KZYMY46P087G0R003S64V2B` (PR #10414). The code, the migration and the
tests land without touching `.github/workflows/**`, because **a PR touching a workflow file
never gets the `gate` check scheduled and is unmergeable through the normal path**. This item
carries the one workflow edit that remains, with the exact diff.

## Why it is still needed

`archive-pr-reviews.ts` now writes a per-PR shard at `docs/github/prs/shards/<NNN>/<zetaid>.json`
AND keeps updating the derived `docs/github/prs/manifest.jsonl`. Until the archive COMMIT stops
carrying the manifest mutation, every archive PR still touches the same trailing region of the
same file, so the pairwise-conflict class is reduced in blast radius but not yet retired.

`.github/workflows/agent-heartbeat.yml` needs **no change**: it already stages the whole
directory (`git add docs/github/prs/`), so shards ride along today. Only the on-merge workflow
stages explicit paths.

## Exact diff

`.github/workflows/pr-archive-on-merge.yml`, in the `Inspect diff` step:

```diff
-          # Stage just the two output paths; anything else is noise the
+          # Stage the archive + its per-PR shard. The manifest is DERIVED from the shards
+          # (081KZYMY46P087G0R003S64V2B) — committing it here is what made N in-flight
+          # archive PRs conflict pairwise, so it is deliberately restored, not staged.
           # archival tool should not be producing.
-          git add docs/history/pr-reviews/ docs/github/prs/manifest.jsonl
+          git add docs/history/pr-reviews/ docs/github/prs/shards/
+          git restore docs/github/prs/manifest.jsonl 2>/dev/null || true
           if git diff --cached --quiet; then
```

and in the PR body block:

```diff
-            echo "- Update docs/github/prs/manifest.jsonl"
+            echo "- Add docs/github/prs/shards/<NNN>/<zetaid>.json (the derived manifest is regenerated separately)"
```

## Who repairs the derived index afterwards

`bun src/Core.TypeScript/forge-host/github/derive-pr-manifest.ts --write` — mechanical, and the
only correct resolution for a manifest conflict (the derived file carries no information the
shards do not). Options for cadence, to be decided when this lands:

1. a heartbeat tick step that runs `--write` and commits when it drifts (preferred — no gate,
   no serialization), or
2. a human/agent tick running it during any archive-queue sweep.

Deliberately **not** a blocking PR gate: an archive PR that adds a shard makes the checked-in
manifest one line stale by design, and failing that PR would recreate the serialization this
work removes.

## Acceptance

- Two archive PRs open simultaneously, neither conflicting with the other (the failure that
  cost three ticks on 2026-08-13).
- `derive-pr-manifest.ts` (check mode) is green after the repair cadence runs.

## Landed as (2026-08-14)

The exact diff was applied. Three corrections to this items own text, recorded because
the item was written before the facts were checked:

1. **The premise for splitting this item out was false by the time it was worked.** The
   item says a PR touching a workflow file never gets `gate` scheduled and is unmergeable.
   PR #10410 (`ci: add passkey proposal gated-commit workflow`) received `gate (required)
   -- pass` in 5s and merged. Ruleset 16134995 (`CI Gate`, enforcement active) requires
   exactly one check, `gate (required)`, and gained a bypass actor (RepositoryRole 5,
   `bypass_mode: pull_request`) on 2026-08-13. #10410 shows a genuine PASS, not a bypass,
   so workflow PRs do get the gate. The split was still useful -- it isolated a
   supply-chain-sensitive edit -- but not for the stated reason.

2. **`agent-heartbeat.yml` DID need a change.** The claim that it needs none is correct
   for the narrow question the item asked (it stages `docs/github/prs/` wholesale, so
   shards ride along). It is wrong for the question that matters once the on-merge
   workflow stops writing the index: something has to DERIVE that index, and the
   heartbeat archive step was doing a per-PR upsert of three PRs, which cannot index the
   shards written by every other run. It now runs `derive-pr-manifest.ts --write`.

3. **The flush job was dead.** Every flush leg of every heartbeat run on 2026-08-13
   failed with `bun: command not found` (rc=127) -- the job calls bun and never installed
   it. Repaired here, because the staleness bound this item hands the reader is only true
   if that job actually lands.

Acceptance, checked: the two-concurrent-archive-commits scenario merges clean, and the
same scenario against the single-file manifest reproduces CONFLICT as a control
(`git merge-tree`, real repo, real shard bytes). `derive-pr-manifest.ts` check mode is
green on the landed tree (6411 entries).

The drift gate is `.github/workflows/pr-manifest-integrity.yml` -- option 1 in the
cadence list above (heartbeat tick repairs) plus a watchdog that fails loudly when the
repair cadence stops, because a gate that never runs is worse than no gate.
<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYP7MNV087G0R002X0E3V9-*.md` glob. -->
