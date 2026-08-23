---
id: 081M0Q8TQYE087G0R001WBX1ZC
type: task
state: done
priority: P1
slug: decide-the-revision-discipline-for-the-browser-backed-zetadb
title: "Decide the revision discipline for the browser-backed ZetaDbImagePort (monotone LWW vs compare-and-swap)"
created: 2026-08-23T12:16:52.174Z
completed: 2026-08-23T17:08:32Z
depends_on: []
composes_with: []
---

# Decide the revision discipline for the browser-backed ZetaDbImagePort (monotone LWW vs compare-and-swap)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0Q8TQYE087G0R001WBX1ZC-*.md` glob. -->

## The decision to make

`ZetaDbImagePort` now DECLARES its revision discipline
(`src/Core.TypeScript/zetadb/zeta-db-node.ts`, `ZetaDbRevisionDiscipline`). Two shipped
implementations declare different ones:

| implementation                                                         | declares                    | enforces                                                |
| ---------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------- |
| `createInMemoryZetaDbImagePort` (reference)                            | `compare-and-swap`          | `existing.revision + 1`; first write must be revision 1 |
| `createBrowserZetaDbImagePort` (production IndexedDB)                  | `monotone-last-writer-wins` | refuses only `<` and `===`-with-different-bytes         |
| `createFileImagePort` (`src/Core.TypeScript/zetadb/scheduled-node.ts`) | `compare-and-swap`          | successor-only                                          |

Declaring the divergence was the honest, non-unilateral half. The resolution below makes
the contract executable without pretending every storage adapter needs the same policy.

## Why the browser port is monotone (evidence — this is DELIBERATE, not drift)

`BrowserCheckpointPort` predates the ZetaDB kernel by 8 days and is not primarily a
database port:

- PR #9943 (`98984fd59`, 2026-08-01) specified it as _"enforce atomic **monotonic**
  revisions"_. Intent is on the record.
- It serves three non-database record kinds — `"room"`, `"causal-corrections"`,
  `"causal-handoffs"` (`BrowserCheckpointRecordKind`).
- `browser-multitab-smoke.ts` — the real Chromium proof — saves room revision **250**,
  `removeCheckpoint(250)`, then saves **300** into the now-empty slot, and requires both
  to be admitted. Compare-and-swap refuses **both** (a leapfrog, and a first write that
  is not revision 1). Tightening `decideBrowserCheckpointSave` to CAS breaks that proof.
- `ZetaDbImagePort` carried **no written contract at all** until this change, so the
  adapter `createBrowserZetaDbImagePort` violated nothing — there was nothing to violate.

So the drift is not in `decideBrowserCheckpointSave`. It is in the **adapter**, which
presented a deliberately-monotone checkpoint store through an interface whose reference
implementation is compare-and-swap, and whose convergence result assumes it.

## What is actually at risk

`runConvergentZetaDbNodeTick`'s bounded-retry convergence (#13929) is driven by the port
REFUSING a revision another writer already took. Its evidence
(`zeta-db-node.test.ts`, the two-cell race) runs against the in-memory CAS port only.

**Honest limit on the exposure — checked, not inferred.** Every current writer to the
image store computes `loaded + 1`, so none of them leapfrogs by construction:

- the kernel: `revision = image.value.revision + 1`
- `compactGeneration` (`browser-database-receipt-handoff.ts`): `snapshot.archiveRevision + 1`
- the causal-correction / causal-handoff sites (`darkhall-browser-durable-runtime.ts`):
  `(baseRecord?.revision ?? 0) + 1`
- `BrowserCheckpointPort.remove` is wired **only** to `roomCheckpointNodeId`, never to a
  database image node — so the empty-slot path is not reachable for images today either.

This is therefore a **latent contract hole, not live data loss on `main`**. Soraya's
"reachable, not theoretical" is right about the _port surface_ (witnessed: stored 5,
candidate 9 → ACCEPTED) and overstated about the _current caller graph_. Recording both
so the next reader does not have to re-derive it.

The risk is that the hole is invisible to anyone adding a writer. One caller that writes
a revision it did not derive from the immediately-preceding load, and the store silently
takes it.

## Options

1. **Wrap, don't tighten.** Give `createBrowserZetaDbImagePort` a CAS check of its own
   over the monotone store (load-then-compare inside the adapter). Leaves
   `BrowserCheckpointPort` and the Chromium proof untouched. Costs a read per write and
   is not atomic against a concurrent tab unless it rides the same IndexedDB transaction.
2. **Split the store.** A separate `decideBrowserImageSave` predicate for the
   `zeta.db.image` record kind, CAS, inside the existing transaction; room/causal kinds
   keep monotone. Atomic, and makes the two contracts two functions instead of one.
3. **Accept monotone for images** and re-establish #13929's convergence result against a
   monotone port — or narrow the claim to say it holds only for CAS ports.

Option 2 looked right if one global discipline had to be chosen. The landed resolution
instead makes the policy a required port, so an adapter can provide either behavior without
changing the database kernel or misreporting what it executes.

## Resolution (2026-08-23)

Revision discipline is now an executable hexagonal port, not a descriptive string:

- `src/Core.TypeScript/persistence/revision-policy.ts` owns `RevisionPolicyPort`, typed
  decisions/refusals, and the compare-and-swap and monotone implementations.
- `BrowserCheckpointPort` and `ZetaDbImagePort` both require a `revisionPolicy`. The ZetaDB
  browser adapter inherits the exact policy supplied by its checkpoint adapter.
- Native IndexedDB executes its policy inside the existing read-write transaction. The
  in-memory and scheduled-file stores execute compare-and-swap inside their local write
  boundary. The policy decides admissibility; the adapter owns atomicity.
- Native browser checkpoints retain monotone last-writer-wins by default, preserving the
  Chromium remove/revision-300 proof. No global tightening silently changes room behavior.
- CP-3b now generates candidates, asks each port's policy for the expected decision, and
  compares `save` against that executable result. A port cannot pass by naming a string.

Evidence: 495 focused browser/ZetaDB/Dark Hall tests pass, including six direct policy-law
tests and generated conformance for both shipped policy modes; whole-tree TypeScript is clean.

## Falsifiers already in place

`src/Core.TypeScript/zetadb/zeta-db-node.property.test.ts` — CP-3a (obligations both
disciplines owe), CP-3b (a port must behave as it declares), CP-3c (the roster must cover
both, so CP-3b cannot pass vacuously). Whatever is decided, CP-3b holds the result.
