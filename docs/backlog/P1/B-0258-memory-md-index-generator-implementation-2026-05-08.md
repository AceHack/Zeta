---
id: B-0258
zetaid: 081KR2E4K0008QG0R001E27DDV
priority: P1
status: closed
title: "MEMORY.md marker-vs-index - index generator implementation"
created: 2026-05-08
last_updated: 2026-05-14
parent: B-0066
depends_on: [B-0257]
classification: blocked-on-harness-contract
decomposition: atomic
closed_by: "feat/b0258-document-ordering-formatting-2026-05-14"
---

# B-0258 - MEMORY.md index generator implementation

Implement deterministic generation of `memory/MEMORY.md` from
memory-file frontmatter so manual edits are no longer required.

## Work scope

- Author generator under `tools/memory/` in TypeScript.
- Parse `name` and `description` fields from frontmatter.
- Emit deterministic ordering and stable formatting.

## Acceptance criteria

- Generator command produces `memory/MEMORY.md` deterministically.
- Ordering and formatting are documented.
- Output is stable on repeated runs with no source changes.
- No hook or CI wiring in this row.

## Pre-start checklist (completed 2026-05-14)

Prior-art search:

- `tools/memory/reindex-memory-md.ts` — already implemented under B-0423
  (PR #3004, merged 2026-05-13). Generator is complete; 18/18 tests pass.
- B-0257 dependency (harness contract verification) — merged via PR #3097.
- No duplicate or conflicting generator found in `tools/`.

Dependency walk:

- B-0257 (harness contract verification): MERGED ✓
- B-0066 (parent): open (B-0258 closure advances it)

Resolution: implementation is done. Gap remaining = AC "Ordering and
formatting are documented." Closed by adding explicit ordering/formatting
block comments to `tools/memory/reindex-memory-md.ts` header.
