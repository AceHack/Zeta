---
id: 081KQX9B50008QG0R001510C9G
priority: P1
status: open
title: "ALIGNMENT.md rewrite - final integration, crossrefs, and cold-start budget"
created: 2026-05-06
last_updated: 2026-05-06
parent: 081KQ0YZ80008QG0R001QJJTVF
depends_on: [081KQX9B50008QG0R0039H39VC, 081KQX9B50008QG0R001FK1G36, 081KQX9B50008QG0R003B0HG9R, 081KQX9B50008QG0R0026EHVW2, 081KQX9B50008QG0R001D089H3, 081KQX9B50008QG0R0008KHHZR, 081KQX9B50008QG0R000Z511EV]
classification: blocked-on-content-slices
type: friction-reducer
---

# 081KQX9B50008QG0R001510C9G - Final integration and cold-start budget

Perform the final 081KQ0YZ80008QG0R001QJJTVF integration pass after the content
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
- 081KQ0YZ80008QG0R001QJJTVF is updated with completion evidence or left open
  with the exact remaining blocker.
