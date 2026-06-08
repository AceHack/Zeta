# All metadata is homoiconic to data

**Aaron, 2026-06-07 (#7038):**

> "all our metadata is homoiconic to our data."

Metadata is **the same form as data** — not a separate representation, schema language, or sidecar. Just
as Lisp code is data (homoiconic), Zeta **metadata is data**: same value type, same edge type, same
stream, same fold, same query. The `(metadata, data)` pair (#7036) are two edge *types* on one graph, but
they share **one representation**.

## What it means concretely

- **Same value type.** A meta value and a data value are both `DynamicValue` — there's no distinct
  "metadata type." (`DynamicValue.fs` is the universal homoiconic value; #6962 CLI≡file≡data.)
- **Same edge / same stream.** A `Meta` event and a data event ride the *same* stream (#7032, meta-in-
  band) and become the *same kind of edge* in the one graph (#7036) — distinguished by edge *type*, not by
  representation.
- **Same fold.** `toMeta` and `toTable` (#7029) are the *same fold* over the same stream, just filtered by
  edge type — so the **metadata view is itself a table** (#7028 table-meta-is-a-table) and a **file's
  metadata is itself a file** (#7027), because metadata is data all the way down.
- **Same tools.** Anything that queries/serializes/diffs/merges data works *unchanged* on metadata — the
  `db`/`table`/`file` verbs, the 4 serializers, the golden-vector discipline, CRDT merge, DST replay. No
  separate metadata API; `zeta table read meta:…` is just `zeta table read`.

## Why it matters

- **No metadata/data schism.** Most systems bolt on a separate metadata layer (information_schema, a
  catalog DB, sidecar files) with its own language and tooling. Homoiconicity removes the schism: the
  catalog is queried by the same query, versioned by the same git, merged by the same CRDT. This is what
  makes self-hosting (#7027/#7028) trivial rather than a special case — the system describes itself in the
  same terms it describes everything.
- **It's the bottom of the meta-recursion.** "file-meta is a file, table-meta is a table, stream-meta is
  an event on the stream" (#7027/#7028/#7032) all hold for one reason: **metadata is homoiconic to data**,
  so "metadata about X" is just "an X." The recursion bottoms out because there's nothing more primitive
  to convert *to*.

## Honest scope (peel)

A principle/observation that names what the existing substrate already encodes (`DynamicValue` as the one
value type; `Meta` edges on the one stream #7032; `toMeta`/`toTable` the same fold #7029). No new code.
The one thing to *verify* (not assert) as the noun-classes mature: that meta and data genuinely share the
same `DynamicValue`/edge representation end-to-end (today `Db`/`File`/`TableStream` use `string` values in
the oracle — homoiconicity is the design intent, realized fully when they carry `DynamicValue`). Recorded
as the governing principle, with that gap named.

## Anchors (Beacon)

- **Homoiconicity** — Lisp / McCarthy (code-is-data, S-expressions); Tcl; Prolog; the property that
  programs and data share one representation.
- **Self-describing / reflective data** — RDF (data and schema both triples), Datomic (schema is datoms),
  Smalltalk metaclasses, the relational catalog-as-tables idea taken to its limit.
- Internal: #6962 (homoiconic CLI≡file≡data), #7036 (everything is edges; metadata/data are edge types),
  #7032 (meta-in-band), #7029 (table/stream fold), #7027/#7028 (self-hosting: file-meta-is-file, table-
  meta-is-table), `DynamicValue.fs`, manifesto §9 recursive / §10 self-similar.
