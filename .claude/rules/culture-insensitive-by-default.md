# Culture-insensitive by default

Carved sentence:

> All string comparison, sorting, hashing, and casing is **culture-INVARIANT
> (ordinal) by default**; culture-sensitive only when a locale/display context is
> explicitly specified. The platform defaults (`Comparer<string>.Default`,
> `String.Compare`, `ToLower`/`ToUpper`) are culture-SENSITIVE landmines — use
> `StringComparer.Ordinal`, `ToLowerInvariant`, ordinal compares. Cross-language
> byte-lock and deterministic replay REQUIRE ordinal.

## Why

Two load-bearing guarantees break under culture-sensitive string ops:
- **4-language byte-lock** — oracles must produce identical bytes/order; culture
  comparison varies by locale, so the same keys sort differently per machine →
  consensus diverges.
- **DST / deterministic replay** — a culture-dependent sort isn't deterministic
  across environments.

Live failure: **B-0969** — `GCounter.Merge`'s `Dictionary` uses ordinal equality
but `ZSet.ofSeq` sorts with `Comparer<string>.Default` (culture-sensitive), so on
control-char/special replica keys the merge state is non-associative. A
state-level CRDT test (Otto 2026-06-04) falsified on exactly this. Culture-aware
comparison is a UI/display concern — opt in at the edge, never in the substrate.

## Pointers

- B-0969 — the G-Set/CRDT Comparer.Default culture gap (the canonical instance)
- `src/Core/ZSet.fs` `ofSeq` sort · `src/Core/Crdt.fs` — fix: `StringComparer.Ordinal`
- `docs/PRIMITIVE-REGISTRY.md` (Bag row) already notes the Ordinal requirement for parity
