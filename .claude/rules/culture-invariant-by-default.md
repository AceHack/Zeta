# Culture-invariant by default

Carved sentence:

> **Culture-invariant intent; canonical ordinal collation mechanism; encoded in
> the math, the golden vectors, and all four language oracles.** Never use
> platform-default string comparison in primitives (`Comparer<string>.Default`,
> `String.Compare`, `ToLower`/`ToUpper` are culture-SENSITIVE) — use
> `StringComparer.Ordinal` / `ToLowerInvariant` / `StringComparison.Ordinal`.
> NOT `InvariantCulture` for strings: it's locale-fixed but still *linguistic* —
> not byte-identical, not codepoint order, not bit-perfect. Use ordinal.
> For numeric parsing, formatting, and string interpolations, explicitly use
> `CultureInfo.InvariantCulture` / `FormattableString.Invariant`.
> Explicitly use `ConfigureAwait(false)` on awaits in library paths.

## Diagnostics and Enforcement

These rules are enforced at compiler/analyzer level for all harnesses in the repository via `.editorconfig` under `[*.{cs,csx}]`:

- `CA1304` (Specify CultureInfo) ➔ `error`
- `CA1305` (Specify IFormatProvider) ➔ `error`
- `CA1307` (Specify StringComparison for clarity of intent) ➔ `error`
- `CA1310` (Use Ordinal comparison when possible) ➔ `error`
- `CA2007` (Do not directly await a Task / specify ConfigureAwait) ➔ `error`

## Bit-perfect caveat: "ordinal" still diverges across languages

C#/TS sort by UTF-16 code units, Rust `str` by UTF-8 bytes — they order non-BMP
(astral) codepoints differently. So pick ONE canonical collation (codepoint ≡
UTF-8 byte order), lock it in the golden vectors, and make every oracle + the math
conform. The seed is the treaty.

The canonical collation has a name DBAs already know: **`Latin1_General_100_BIN2_UTF8`**
(SQL Server). It is the *only* SQL Server binary name that is exact — `_BIN` is
first-char-then-raw-bytes, and `BIN2` over `nvarchar` is UTF-16 **code-unit** order, so both
diverge from us above the BMP. Implemented as `Collation.binary` in all four oracles.
**Culture-aware collations are opt-in at the EDGE and must not be shared catalog names** —
no two runtimes ship the same collation tables, so a shared culture-aware name silently
means different things per language. Detail + measurements + the SQL Server citations:
`docs/research/2026-08-15-canonical-collation-is-utf8-byte-order-sql-servers-bin2-utf8-not-nvarchar-bin2.md`.

## Why

4-language byte-lock and DST replay both REQUIRE it — culture comparison varies by
locale, so keys sort differently per machine → consensus + determinism diverge.
Live failure: **081KT07NV0008QG0R001YDB73K** (`GCounter.Merge` ordinal Dictionary vs `ZSet.ofSeq`
culture-sensitive sort → non-associative on special keys). Deeper why (Aaron):
low-level byte/order/UoM mismatch must not compound into AI↔human collision — the
Mars Climate Orbiter lesson (lbf vs N) generalized; get the bytes right so the
morals stand on them. Culture-aware comparison is a UI/display concern, opt in at
the edge.

Library paths also require non-blocking, execution-context-independent awaits via
`ConfigureAwait(false)` (CA2007) to prevent deadlocks in UI / synchronization-context
bound platforms.

## Pointers

- 081KT07NV0008QG0R001YDB73K — the canonical live instance · `src/Core/ZSet.fs` `ofSeq` · `src/Core/Crdt.fs` (fix: `StringComparer.Ordinal`)
- `docs/PRIMITIVE-REGISTRY.md` (Bag row notes the Ordinal parity requirement)
