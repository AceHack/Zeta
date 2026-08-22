---
id: 081KZM0FTJM08QG0R002675YBK
type: bug
state: backlog
priority: P2
slug: zetadb-fold-has-no-cross-substrate-concurrency-guard-gh-acti
title: "zetadb fold has no cross-substrate concurrency guard — GH Actions concurrency group cannot see local/browser cells"
created: 2026-08-09T19:37:40.692Z
depends_on: []
composes_with: []
---

# zetadb fold has no cross-substrate concurrency guard — GH Actions concurrency group cannot see local/browser cells

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZM0FTJM08QG0R002675YBK-*.md` glob. -->

## SHARPENED + PARTIALLY FIXED (2026-08-09, Otto shadow*)

Investigating this found the original filing was **partly wrong and partly understated**.

**Wrong:** I wrote that content-addressing "plausibly gives idempotence by construction —
plausibly is not proven." It IS proven: `scheduled-node.test.ts` already had
*"persists one checkpoint and becomes an idempotent no-op on replay"*. And the zetadb
workflow already had the correct convergence SHAPE — after `git pull --rebase` it
**re-derives** the checkpoint (re-runs the fold) instead of replaying a stale precomputed
diff. Credit where due; I filed against a healthier system than I thought.

**Also wrong about society-heartbeat:** it appends **uniquely-named** files
(`society-<id>.json`), which is a G-set append — naturally commutative and conflict-free
under rebase. Not a second instance of this race.

**FIXED:** the genuine gap was that a lost push race **failed the run instead of
re-converging**. `git push` is a compare-and-swap; the loser was rejected and `set -e`
killed the job. Tolerable when Actions was the only writer (the Actions-scoped
`concurrency:` group serialised us with ourselves) — not tolerable for runners + local +
browser cells at once. Added a bounded retry that re-runs
rebase → **re-fold** → amend → push, so each attempt re-derives from whatever `main` now
holds. Convergence, not a lock (a lock would be central coordination, §1, and would not
survive a browser tab going offline).

**NEW FINDING — the checkpoint is NOT BYTE-CANONICAL (the deeper cause).** Proven by
test: folding `{a,b}` versus `{b,a}` yields **identical semantic state** (entries and
rows agree once sorted) but **different bytes**, because `entries` persists in ARRIVAL
ORDER.

```
SEMANTIC entries equal (sorted): true
SEMANTIC rows equal (sorted):    true
BYTE-identical:                  false
entry order A: event/a,event/b   B: event/b,event/a
```

With one writer this is invisible. With concurrent substrates, two nodes **in the same
state** emit different checkpoint files — so git sees a real diff, last-writer-wins
clobbers, and content-addressing cannot dedup them. The retry loop converges the *race*;
it cannot fix a representation that is not a pure function of the delta SET.

**Fix (NOT taken — owner's call):** canonically order `entries` before serialisation.
That changes the on-disk checkpoint representation and may interact with existing
checkpoints and byte-lock vectors, so it belongs to the zetadb owner rather than a
drive-by. Two tests are landed: one asserting the semantic convergence that DOES hold,
and one PINNING the byte-divergence so the gap stays visible and its fix is detectable —
deliberately not asserting that the divergence is correct.

## FIX TAKEN (2026-08-18) — and the deferral's two stated risks were both empty

The deferral above named two reasons to hold: *existing checkpoints* and *byte-lock
vectors*. Both were checked rather than assumed, and neither exists:

- `data/zetadb/checkpoint.json` on `main` holds **one** entry, so it is canonical under
  any total order. Re-folding the live journal after the change is still `changed:false`
  and rewrites nothing — verified by running `bun run run:zetadb-node`.
- **No golden vectors reference `zeta.db.image.v1`.** The only non-test consumer,
  `browser-database-receipt-handoff.ts`, encodes an image with `entries: []`.

So what was left was work, not a decision, and it is done.

**Byte-canonical entries.** `validateImage` — the single point every serialisation
passes through, on both the encode and decode side — puts the ledger in ordinal
`eventId` order. Two cells folding the same delta set now emit the *same file*, and a
checkpoint that is not in canonical order is refused on read with
`database-image-non-canonical` rather than quietly surviving on whichever node's next
tick happens to be a no-op.

**The fold is now genuinely commutative — this was the deeper half, and it is NOT what
the original filing predicted.** Canonical ordering alone *breaks* the ordinary
retract-then-emit update, because `score/emit` sorts before `score/retract`. The cause:
`foldRows` summed weights per `rowKey` and rejected the instant an incoming payload
differed from the running one, so the **conflict verdict itself** depended on arrival
order across a zero-weight crossing — accepted in one order, `database-row-conflict` in
the other. The same order-sensitivity sat on the admission path (`planRowTransition`).

The fold now sums signed weights per **`(rowKey, payload)`** — a Z-set — and checks
well-formedness ("a row key names one payload") **once, at the end of the batch**, as a
post-condition on the admitted SET rather than as a step of the fold. Weight addition is
commutative and associative with `0` as identity, so this answers the analytic question
below in the affirmative *by construction*: the journal fold is a commutative monoid and
the verdict is order-independent.

**Falsifiers** (`bun test` over `zetadb/` + `browser-node/` + `darkhall-ui/`, 450 pass /
0 fail with the fix):

| break | fails |
|---|---|
| drop canonical entry order | **3** |
| restore the per-`rowKey` order-sensitive admission check | **2** |
| disable the end-of-batch well-formedness check | **1** |

That last row matters on its own: the conflict guard *moved*, and it previously had no
test at all, so `zeta-db-node.test.ts` now pins that it still refuses a genuine
two-live-payload conflict — from either arrival order. A guard relocated into a place
that cannot fire would have been worse than the ordering bug it replaced.

## RUNTIME CONVERGENCE FIX TAKEN (2026-08-22)

`runConvergentZetaDbNodeTick` now composes the finite one-attempt tick with a caller-
supplied finite attempt budget. An ordinary idempotent event batch that loses a durable
revision race reloads the newest image and folds again. An explicit `expectedRevision`
remains a strict compare-and-swap predicate and is never weakened by retrying. Exhausted
attempts return typed `database-revision-conflict` backpressure; there is no lock,
timeout, last-writer-wins path, or unbounded loop.

The executable acceptance test now starts two tab executors concurrently against the
same in-memory durable image with disjoint batches. Both initially observe revision 0;
one writes revision 1, the loser reloads and writes revision 2, and the final canonical
journal contains both batches. A second test pins finite exhaustion, and a third pins
strict compare-and-swap behavior.

**Still open:** the substrate-general formal property assigned to Soraya. The concrete
runtime concurrency acceptance criterion is now closed.

---

## The gap

`.github/workflows/zetadb-scheduled-node.yml` guards concurrent folds with:

```yaml
concurrency:
  group: zetadb-scheduled-node
  cancel-in-progress: false
```

That lock is **scoped to GitHub Actions**. It cannot see a cell running as a launchd
service on the maintainer's laptop, a k8s pod, a browser tab, or a PWA — all of which
are declared tick-source substrates
(`docs/research/2026-08-09-the-society-is-one-thread-four-tick-sources-…`).

The commit path is a read-modify-write with no compare-and-set:

```
if git diff --quiet data/zetadb/checkpoint.json; then exit 0; fi
git add data/zetadb/checkpoint.json && commit && push
```

Two cells on different substrates can therefore fold the same journal concurrently and
race to commit `checkpoint.json`.

## Why this is on the critical path (not a nice-to-have)

Aaron 2026-08-09, stating the target directly:

> *"this is what I want to dogfood on the github free workflow runners **and also on
> our local hardware at the same time** — we are just consuming tick sources from
> anywhere, even open browser tabs and PWA and locally running apps."*

The stated goal **is** the condition that defeats the existing guard. Simultaneous
runner + local-hardware dogfooding is not a later phase; it is the thing being built
now. Every downstream item in the zetadb-as-compiler thread (fold → reify → types) sits
on top of a checkpoint that two cells can currently corrupt.

## The fix is NOT a distributed lock

A cross-substrate lock would be a central point of coordination — a §1 scale-free
violation, and it would not survive a browser tab going offline. The disciplines
already prescribe the alternative:

- **#6 idempotency** — N folds of the same journal == one fold's *effect*.
- **Commutativity** — order of arrival must not change the result.
- **Content-addressing** — plausibly supplies idempotence *by construction*
  (`ContentStore` / `DagFs` already work this way). **Plausibly is not proven.**

So the work is to make concurrent folds **converge**, not to prevent them.

## Acceptance

- Property (route to Soraya, formal): *N cells folding the same journal from any
  substrate produce one checkpoint effect, independent of order or overlap.*
- A test that actually runs two folds concurrently against one journal and asserts a
  single converged checkpoint — not a mock. The GH concurrency group may stay as a
  cheap optimisation, but it must no longer be the thing correctness depends on.
- Analytic half (math team): is the journal fold a commutative monoid, and does
  content-addressing give idempotence by construction?

## Cross-refs

- `docs/research/2026-08-09-zetadb-as-compiler-of-compilers-db-as-types-cells-anywhere-dogfood-audit-aaron.md`
  — open question 4, promoted here to a tracked bug.
- `docs/research/2026-08-09-the-society-is-one-thread-four-tick-sources-auto-heal-by-redundancy-aaron.md`
  — the substrates that defeat an Actions-scoped lock.
- `.claude/rules/dv2-data-split-discipline-activated.md` §6 idempotency ·
  `.claude/rules/local-time-never-enters-the-shared-fold.md` (the sibling fold invariant).
- Owner: zetadb / harness. Formal property → Soraya; algebra → math team.
