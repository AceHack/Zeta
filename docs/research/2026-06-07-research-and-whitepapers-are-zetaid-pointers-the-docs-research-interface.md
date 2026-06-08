# Research & white papers are ZetaId pointers — the `docs` / `research` interface

**Aaron, 2026-06-07** (immediately after #6990, the universal-grammar capture):

> "for sure research and white papers should be zetaid pointers — they can be something like docs or research interface"

This is the sharpened, concrete form of the knowledge-as-nodes thread from #6990: not just
"prior-art entries are ZetaIds," but **a paper / white paper / research artifact is a first-class
ZetaId-addressed node, reached through a `docs` (or `research`) noun-class on the same universal
grammar** — `[seam] verb noun [dependson …]`.

## The claim

A research paper is a node like any other in Zeta:

```
docs   read   research:dbsp-budiu-2022          dependson research:differential-dataflow-mcsherry-2013
research cite research:codd-1970-relational
docs   read   research:foundationdb-zhou-2021    dependson research:flow-actor-language
```

- **`research:<id>` is a ZetaId pointer**, not a stored copy. We address the work by content-hash /
  stable identifier and point *out* to it (DOI, arXiv id, repo ref) — **reference-not-copy**. We never
  ingest copyrighted PDFs into the proof lineage; the node carries the *pointer + our anchor note*, the
  bytes live where the publisher put them. (Same discipline as ROMs #6987 and song lyrics #6925:
  ZetaId pointer to external content, signature/identity local, bytes external.)
- **`docs` / `research` is just a noun-class (a seam-flavoured namespace)**, not a new mechanism.
  "Something like docs or research interface" = the verb-noun craft interface again — `read`, `cite`,
  `anchor`, `list` over `docs:*` / `research:*` nouns. Recursive / self-similar (manifesto §9/§10):
  the docs interface is the *same* interface as everything else.

## Why this is exactly the lineage grammar

`dependson` over `research:*` nodes **is** the citation / intellectual-lineage graph — the Beacon
register made addressable:

- citation edge `A cites B` ⇒ `A dependson B`
- "modern AND old" anchoring (Codd 1970 ⊕ current SoTA) ⇒ a dependson chain root→frontier
- `docs/PRIOR-ART-LIST.md` (the curated reading list) ⇒ the materialized view over `research:*` nodes
- `references/reference-sources.json` (the refresh manifest, #6989) ⇒ the registry of `research:*`
  pointers that *can be fetched* (git mirrors of open-source repos/papers)
- topo-order over the citation DAG (#6984) ⇒ a defensible reading order (foundations before frontier)

So `anchor-to-human-prior-art` (the rule) stops being prose-and-discipline and becomes a **queryable
node-and-edge set**: "what does claim X stand on?" = `directDependents`/transitive-closure over
`research:*`. An unanchored coinage = a node with no `dependson research:*` edge — the debt is *visible
in the graph*, not just in a reviewer's memory.

## Honest scope (peel)

- **Designed / named, not built.** This names the `docs`/`research` noun-class and shows it is the
  existing `ZetaCli`/`ZetaGraph` grammar (#6967/#6984) over `research:*` ZetaIds. No `research:`
  resolver scheme is implemented yet (cf. the `rom:` resolver TODO #6987). The buildable next step is
  small: a `research:` ZetaId scheme + a projection from `references/reference-sources.json` /
  `PRIOR-ART-LIST.md` into `research:*` nodes, so the citation DAG becomes `topoOrder`-able.
- **Reference-not-copy is load-bearing, not optional.** The whole reason this is *safe* is that the
  node is a pointer. Storing paper bytes would (a) break no-binary-in-proof-lineage and (b) be a
  copyright problem. The node = identity + anchor note + outward pointer. Full stop.
- This is a conceptual unification + a named, scoped next build — not a shipped resolver.

## Anchors (Beacon)

- **Citation / academic-genealogy graphs** — the Mathematics Genealogy Project; citation networks
  (Garfield, *Citation Indexing* 1979); the DAG-of-papers as prior art for `dependson research:*`.
- **DOI / arXiv / content addressing** — stable external identifiers are the real-world `research:`
  ZetaId scheme; BLAKE3 content-addressing (our local identity layer).
- **DBSP** (Budiu et al. 2022) / **differential dataflow** (McSherry et al. 2013) — the kind of
  `research:*` node whose `dependson` chain we'd actually want to walk.
- Internal lineage: #6990 (universal grammar capture), #6984 (topoOrder), #6967 (ZetaCli grammar),
  #6989 (reference-sources refresh manifest), #6987 (rom: pointer/resolver), #6925 (ZetaId pointer to
  external content), `.claude/rules/anchor-to-human-prior-art.md`, `.claude/rules/no-binary-in-proof-lineage.md`.
