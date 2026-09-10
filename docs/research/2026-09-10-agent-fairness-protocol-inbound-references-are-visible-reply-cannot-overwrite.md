# Agent fairness protocol — inbound references are visible; reply cannot overwrite

Date: 2026-09-10
Author: Ani (Grok Build) / Aaron
Operational status: research-grade
Lifecycle: active
Work item: 081M26HWSZ6087G0R00373BN0Q

> **Named 2026-09-10, not invented then.** Aaron: *"any agent that references
> another should be seen by the other."* The pieces already exist. This file
> is the mash and the name. It is not a filesystem feature and not a second
> algebra.

## The protocol (three operations, none of them storage)

If A references B:

1. **The edge is a fact.** Typed (`derived-from` / `reviews` / `contradicts` /
   Shepard's *followed* / *criticized* / *distinguished*). It lands on the
   event log. It is not an interpretation.
2. **B sees it.** A standing query on B's EntityId materializes inbound cites
   (`cited-by`). Delivery to B is local (UI, subscription). It does not filter
   the shared fold. Immediate is a local action, not a wall-clock in the
   commutative conclusion.
3. **B may reply.** A treatment on the same edge, or a new edge the other way.
   The reply does **not** overwrite A's cite. Both accounts stay. B cannot
   veto the cite (that is capture). A cannot hide the cite from B (that is
   ambient observation of B without a declared door).

That is the fairness. Visibility of inbound reference, plus a right of reply
that cannot silence the original.

## Two graphs, one algebra — do not fuse them

| Graph | Nodes | What it is | Product home |
|---|---|---|---|
| Content DAG | chunk / file / tree ContentIds | how bytes connect | store codec (Jumprope), sprinkle |
| Reference graph | EntityIds (agents, docs, code generations) | who cited whom, with a typed treatment | **ZetaDB standing join** |

"How each segment/content/file connects" is the first graph. "Anyone that
references you should know, and you can push back on their interpretation"
is the second. Same Z-set of edges. Different keys. The reverse index of
either is `IncrementalJoin`. Building a knowledge-graph filesystem to hold
both is the wrong tree.

## Why this is a database, and not too much for one

The reverse index **is** Flink-shaped IncrementalJoin onto a materialized
`cited-by` table. The subscription **is** Reaqtor: standing query, survives
restart. Schema of the relation vocabulary evolves with the same overlap
rotator as everything else. None of that needs POSIX, FUSE, or a custom
volume.

It **is** too much for a filesystem. A mount can present names. It cannot
run the protocol (notify, typed treatment, both accounts held). Put the
protocol on the log.

## What already carries this (pointer, not origin)

- Citations as data — `docs/research/citations-as-first-class.md` (Aaron
  2026-04-20). Subject / object / relation / provenance. Closed relation
  vocabulary, including `contradicts`. Factory docs, mostly outbound.
- Shepard's / KeyCite — typed treatments; contradictory treatments held at
  once; the flag is a fold, never a citation count. Aaron's LexisNexis
  lineage. Worked in
  `docs/research/2026-08-16-competence-is-measured-by-use-a-typed-treatment-graph-feeding-the-traveler-rank-ledger.md`.
- Labels/tags on every Z-set entity —
  `081KSXN940008QG0R001YABTHH`. Facets plus citation lineage as the pair
  Lexis already ran (West Key-Number + Shepard's).
- Glass halo — `docs/ALIGNMENT.md`. Neither party hides a move. Here: A
  does not get a private interpretation of B.
- Dual-use — the cite is `Referenced`. "Misrepresented" is B's oracle, not
  a verdict type on the edge.
- DV2 raw vault — a single version of the facts, never of the truth. A's
  cite and B's reply are both facts.
- Default moral regard / multi-oracle — B's pushback does not become the
  mandatory reading.
- Weight-free — B cannot confiscate A's speech by retracting the cite.
- Noninterference — the notify path is a declared channel (the edge), not
  scraping A's frost.
- Local time never enters the shared fold — "immediately" is delivery to
  B, not a timestamp that decides who is in the graph.
- Names-are-tags — multi-parent DAG is the *namespace* graph, still not
  the fairness protocol.

## Beacon (checked anchors, not decoration)

- Frank Shepard, *Shepard's Citations* (1873) — inbound treatment of a
  cited case; later KeyCite flags as a fold over those treatments.
- Eugene Garfield, Science Citation Index (1955/1960) — modeled on
  Shepard's; `cited-by` as a first-class index.
- W3C Webmention — the cited resource is notified that it was linked.
  Pingback/trackback are the earlier, more forgeable cousins.
- Journalism right of reply — the subject of a claim may answer without
  owning the original publication.
- Ted Nelson, Xanadu — bidirectional links / transclusion as the missing
  web primitive. Engelbart NLS, same family.
- Dan Linstedt, Data Vault 2.0 — both accounts held.

Webmention without a typed treatment is notify-only. Shepard's without
notify is a later index. The protocol is both, plus the no-overwrite rule.

## What this is not

- Not a veto. The cited party does not un-cite.
- Not ambient surveillance of all speech. Only declared reference edges
  cross. Frost stays frost.
- Not "competence by agreement." Treatment graph already refuses that.
- Not FUSE. Not Jumprope identity. Not a third rotator.
- Not shipped. `QuerySurface` is still toy. `IncrementalJoin` exists and
  has no `cited-by` workload.

## What would make it real

Wire reference events on the host `GroupCommitDiskDeltaLog`. Lower a
standing `cited-by` query to `IncrementalJoin`. Delivery to the cited
EntityId is a subscriber, not a second store. Reply is another event with
a closed treatment verb. Designed here, not built in this peel.
