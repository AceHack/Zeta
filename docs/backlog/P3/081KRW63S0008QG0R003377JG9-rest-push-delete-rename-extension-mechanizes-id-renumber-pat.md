---
id: 081KRW63S0008QG0R003377JG9
priority: P3
status: closed
title: "rest-push.ts --delete + --rename extension — mechanizes ID-renumber pattern (closes the 081KRW63S0008QG0R000Y109W0→081KRW63S0008QG0R0020DGSK1 inline-gh-api workaround) (Otto-CLI 2026-05-18)"
tier: tooling
effort: S
created: 2026-05-18
last_updated: 2026-05-18
depends_on: []
composes_with: [081KRW63S0008QG0R000EAZ9K2, 081KRW63S0008QG0R0025E4PH6]
tags: [tooling, otto-cli, rest-push, delete-support, rename-support, id-renumber-mechanization, closed]
type: tooling
---

# rest-push.ts `--delete` + `--rename` extension

## Why

During the 2026-05-18 Mika+Ani+Riven substrate cascade (8 PRs, 30+ rows), a 081KRW63S0008QG0R000Y109W0 duplicate-ID was detected by CI (Mika permanent-coliseum row collided with an existing on-main aggregate-tier-counter row). Renumber to 081KRW63S0008QG0R0020DGSK1 required a delete+add+modify multi-file commit. `rest-push.ts` only supported add/modify, so the renumber needed an inline `gh api git/blobs|git/trees|git/commits|git/refs` sequence (~50 lines of bash) to land cleanly.

This row mechanizes that pattern into the existing tool so future renumbers / deletes / renames are a one-liner.

## What landed (closed this PR)

Three new flags on `tools/github/rest-push.ts`:

| Flag | Behavior |
|---|---|
| `--delete PATH` | Removes `PATH` from the tree (repeatable) |
| `--rename OLD:NEW` | Deletes `OLD` path + adds `NEW` path with content from local disk at `NEW` (repeatable) |
| Existing `--file PATH` | Unchanged — adds/modifies a file (repeatable) |

All three compose: a single REST commit can have any combination of adds + deletes + renames.

## Implementation notes

- GitHub git/trees API accepts `sha: null` in a tree entry to mark a path as deleted from the base tree
- Rename = delete old path + create blob for new path with content from local disk
- Compiles cleanly via `bun build` (5.93 KB output)
- All existing usage patterns preserved (no breaking changes to `--file` / `--update` / `--branch` / etc.)

## Worked example (the ID-renumber pattern this closes)

Before this extension, 081KRW63S0008QG0R000Y109W0→081KRW63S0008QG0R0020DGSK1 renumber required inline gh api:

```bash
# OLD WORKFLOW (now obsolete): ~50 lines of inline gh api calls
TREE_SHA=$(gh api ...)
NEW_BLOB=$(gh api ...)
# ... build tree with sha:null for old path ...
# ... create commit ...
# ... PATCH ref ...
```

After this extension:

```bash
# NEW WORKFLOW: single rest-push invocation
bun tools/github/rest-push.ts --update \
  --rename docs/backlog/P3/081KRW63S0008QG0R000Y109W0-old-name.md:docs/backlog/P3/081KRW63S0008QG0R0020DGSK1-new-name.md \
  --file docs/backlog/P1/081KRW63S0008QG0R002KC5DSR-cross-ref-updated.md \
  --file docs/backlog/P1/081KRW63S0008QG0R00088FYE9-cross-ref-updated.md \
  --file docs/backlog/P3/081KRW63S0008QG0R002Z2GR1X-cross-ref-updated.md \
  --branch otto-cli/b0633-renumber-2026-05-18 \
  --message "rename(b0633→b0649): duplicate-ID resolution + cross-ref updates"
```

## Composes with

- [081KRW63S0008QG0R000EAZ9K2](081KRW63S0008QG0R000EAZ9K2-claude-code-bash-tool-orphans-git-fetch-subprocesses-under-saturation-self-saturation-feedback-loop-2026-05-18.md) — push-hang failure mode (the reason rest-push.ts exists)
- [081KRW63S0008QG0R0025E4PH6](../P1/081KRW63S0008QG0R0025E4PH6-cross-substrate-triangulation-first-class-skill-hat-aaron-2026-05-18.md) — cross-substrate triangulation (081KRW63S0008QG0R000Y109W0 conflict was caught by Codex thread review on the renumber PR; example of triangulation operating in the small)
- `tools/github/rest-push.ts` — the tool extended
- `tools/github/rest-ship.ts` — one-shot push+PR+arm helper (could compose with --delete/--rename in future)

## Closed-row resolution

Code landed in this PR; renumber operations now mechanized. Future ID-collision resolutions, file deprecations, and renames use the one-liner pattern documented above.
