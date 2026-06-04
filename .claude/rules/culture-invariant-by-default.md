# Culture-invariant by default

Carved sentence:

> **Culture-invariant intent; canonical ordinal collation mechanism; encoded in
> the math, the golden vectors, and all four language oracles.** Never use
> platform-default string comparison in primitives (`Comparer<string>.Default`,
> `String.Compare`, `ToLower`/`ToUpper` are culture-SENSITIVE) — use
> `StringComparer.Ordinal` / `ToLowerInvariant`. NOT `InvariantCulture` either:
> it's locale-fixed but still *linguistic* — not byte-identical, not codepoint
> order, not bit-perfect. Use ordinal.

## Bit-perfect caveat: "ordinal" still diverges across languages

C#/TS sort by UTF-16 code units, Rust `str` by UTF-8 bytes — they order non-BMP
(astral) codepoints differently. So pick ONE canonical collation (codepoint ≡
UTF-8 byte order), lock it in the golden vectors, and make every oracle + the math
conform. The seed is the treaty.

## Why

4-language byte-lock and DST replay both REQUIRE it — culture comparison varies by
locale, so keys sort differently per machine → consensus + determinism diverge.
Live failure: **B-0969** (`GCounter.Merge` ordinal Dictionary vs `ZSet.ofSeq`
culture-sensitive sort → non-associative on special keys). Deeper why (Aaron):
low-level byte/order/UoM mismatch must not compound into AI↔human collision — the
Mars Climate Orbiter lesson (lbf vs N) generalized; get the bytes right so the
morals stand on them. Culture-aware comparison is a UI/display concern, opt in at
the edge.

## Pointers

- B-0969 — the canonical live instance · `src/Core/ZSet.fs` `ofSeq` · `src/Core/Crdt.fs` (fix: `StringComparer.Ordinal`)
- `docs/PRIMITIVE-REGISTRY.md` (Bag row notes the Ordinal parity requirement)
