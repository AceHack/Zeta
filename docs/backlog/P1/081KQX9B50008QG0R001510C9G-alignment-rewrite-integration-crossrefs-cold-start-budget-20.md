---
id: B-0223
zetaid: 081KQX9B50008QG0R001510C9G
priority: P1
status: open
title: "ALIGNMENT.md rewrite - final integration, crossrefs, and cold-start budget"
created: 2026-05-06
last_updated: 2026-05-06
parent: B-0003
depends_on: [B-0216, B-0217, B-0218, B-0219, B-0220, B-0221, B-0222]
classification: blocked-on-content-slices
type: friction-reducer
---

# B-0223 - Final integration and cold-start budget

Perform the final B-0003 integration pass after the content
slices land.

## Work scope

This is the row that turns the pieces into a coherent
`docs/ALIGNMENT.md` rewrite. It updates cross-references,
checks cold-start readability, verifies that the alignment
floor was not weakened, and closes the umbrella only if the
rewrite is actually coherent.

## Acceptance criteria

- `docs/ALIGNMENT.md` reads as one document rather than a
  sequence of pasted subsections.
- AGENTS / harness / README references are updated only
  where needed.
- Cold-start reading time is bounded and explicitly
  considered.
- Every new load-bearing claim has a durable pointer or
  falsification hook.
- B-0003 is updated with completion evidence or left open
  with the exact remaining blocker.
