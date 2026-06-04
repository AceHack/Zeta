# Culture-invariant by default

Carved sentence:

> All string comparison, sorting, **collation**, hashing, and casing is
> **culture-INVARIANT by default** (intent: locale-independent), implemented as
> **ordinal** (mechanism); culture-sensitive only when a locale/display context is
> explicitly specified. For our 4-lang primitives this is **encoded into the math
> + the golden vectors + every oracle** — a primitive invariant, not a code
> convention, because **bit-perfect demands it**. Platform defaults
> (`Comparer<string>.Default`, `String.Compare`, `ToLower`/`ToUpper`) are
> culture-SENSITIVE landmines — use `StringComparer.Ordinal` / `ToLowerInvariant`.

## Culture-invariant INTENT → ordinal MECHANISM (not `InvariantCulture`)

`InvariantCulture` is locale-fixed but still a *linguistic* comparison — NOT
byte-identical, NOT guaranteed equal to codepoint order, and not bit-perfect. For
the substrate use **Ordinal** (pure byte/codepoint), not `InvariantCulture`.

## Bit-perfect caveat: "ordinal" still diverges across languages

Even ordinal isn't automatically identical across the four oracles: C# and TS sort
by **UTF-16 code units**, Rust `str` by **UTF-8 bytes** — these order non-BMP
(astral) codepoints + surrogates differently. So pick ONE **canonical collation**
(codepoint order ≡ UTF-8 byte order), lock it in the golden vectors, and make
every oracle + the math conform to that one collation. The seed is the treaty.

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

**Deeper why (Aaron 2026-06-04):** "this way low-level byte/order/uom won't cause
our AI to crash into humans." Byte-perfect + culture-invariant collation + UoM
safety is the lowest layer of the common-ground safety thesis (extend proven
ground = autonomy AND safety): make bytes/order/units provably identical across
oracles and legible to humans so a representation mismatch can't compound into
behavior that collides with a person — the Mars Climate Orbiter failure (lbf vs N)
generalized to AI↔human. Get the bytes right so the morals can stand on them.

## Pointers

- B-0969 — the G-Set/CRDT Comparer.Default culture gap (the canonical instance)
- `src/Core/ZSet.fs` `ofSeq` sort · `src/Core/Crdt.fs` — fix: `StringComparer.Ordinal`
- `docs/PRIMITIVE-REGISTRY.md` (Bag row) already notes the Ordinal requirement for parity
