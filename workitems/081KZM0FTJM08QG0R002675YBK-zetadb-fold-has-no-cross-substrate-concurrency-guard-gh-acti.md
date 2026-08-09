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
