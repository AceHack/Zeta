# DynamicValue homoiconicity realized — table/stream/catalog carry DynamicValue

**Otto, 2026-06-08** (Aaron's chosen direction: "DynamicValue homoiconicity"). Closes the gap flagged in
#7038: the noun-class oracles carried `string` values; now the table/stream/catalog vertical carries
`DynamicValue` — metadata and data genuinely share **one representation**.

## What changed (tests green, 0-warning)

- **`TableStream`** (#7041): `Delta.Upsert`/`Meta` and `Table` now carry **`DynamicValue`** values, not
  `string`. Data values and `Meta` values are the *same* `DynamicValue` shape — homoiconicity made literal
  (a count is `DynamicValue.Int 42`, a name is `DynamicValue.String "zeta"`, on the same stream). The fold
  (`applyDelta`/`toTable`/`toMeta`/`toStream`) was already value-type-agnostic, so only the type changed.
- **`Catalog`**: catalog rows are now homoiconic `DynamicValue` — a table row is `Bool true`, a column row
  is `String <type>`. So the **catalog is data in the same value model as the data it describes** (#7028
  table-meta-is-a-table, now byte-for-byte the same value type). `readSchema` extracts the type back.

## Design note: keys stay `string` (deliberately, #7042)

`DynamicValue` is `[<NoComparison>]` (its `Object` is order-significant, `Float` has NaN, etc.), so it
**cannot be a Map key** — only a value. So **keys remain `string`**. This is not a limitation but the
right call for long-term flexibility (Aaron's steer): a string key is free to carry **version / namespace
/ scope** qualification later (e.g. `users@v2`, `ns:prod/users`, `scope:cell-7/users`) — match with or
without the qualifier — without fighting a `NoComparison` key type. Values are homoiconic `DynamicValue`;
keys are flexible qualified strings. (The eventual key-qualification grammar is future work, #7043.)

## Honest scope (peel)

Done for the **table/stream/catalog** vertical (the freshest, most coupled). `Db`, `File` (contentHash is
already a hash *pointer* string — arguably stays a ref), and `KeyStore` (KeyRef is a pointer) still carry
their original value/pointer types; converting `Db`'s `Create`/`Update` values to `DynamicValue` is the
same one-line-per-case change and is the obvious follow-on. The 4-lang/4-serializer parity for these
noun-classes (C#/Rust/TS oracles + golden vectors) remains the separate, larger discipline gap.

## Anchors (Beacon)

- **Homoiconicity / self-describing values** — `DynamicValue` (the universal CBOR/msgpack/JSON/YAML core),
  Lisp S-expressions, RDF, Datomic.
- Internal: #7038 (metadata homoiconic to data), #7028 (table-meta-is-a-table), #7029 (table/stream
  duality), #7032 (meta-in-band), #7010 (Catalog), `DynamicValue.fs`.
