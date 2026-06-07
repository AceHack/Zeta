---
id: B-0969
zetaid: 081KT07NV0008QG0R001YDB73K
priority: P1
status: open
title: Invariant-culture-everywhere + ConfigureAwait(false) as cross-cutting .NET defaults — never default to culture-sensitive (F# G-Set culture-sensitivity is the first concrete fix)
effort: M
ask: aaron 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on: []
composes_with:
  - B-0959
---

# Invariant-culture-everywhere + ConfigureAwait(false) — cross-cutting .NET defaults

## The standing default (the maintainer 2026-06-01)

> "culture-sensitive we should never default to this. .NET does this [by default but] our code is not client-side code — we assume **invariant culture everywhere** and should default to it. and also **ConfigureAwait false** lol"

.NET's framework defaults are tuned for **client/UI** code (current-culture
string compare / format / parse; await captures the synchronization context).
Zeta is **server/library/agent** code — those defaults are wrong for us and
silently introduce locale-dependent behavior + context-capture deadlock/perf
hazards. The standing rule:

1. **Invariant culture / ordinal everywhere by default.** Never default to
   culture-sensitive string comparison, `ToString()`, or `Parse`. Use
   `StringComparer.Ordinal` / `StringComparison.Ordinal` for comparison and
   `CultureInfo.InvariantCulture` for format/parse. Culture-sensitive behavior
   is the **exception**, opt-in only where a genuine human-facing locale need
   exists (and that's almost never in our substrate).
2. **`ConfigureAwait(false)` by default in library code.** Don't capture the
   synchronization context on awaits in non-UI library paths.

## Why this is P1 (it already broke cross-language parity)

This isn't hypothetical — it has already produced a real cross-language-parity
bug, surfaced by the Bag-TS review (#6364) and verified against source:

**The F# G-Set sorts via `Comparer<'T>.Default`** (`src/Core/GSet.fs:56/97/114/142`),
which for `string` is **culture-sensitive**. The other three oracles are ordinal:
TS `<` (UTF-16 code-unit), C# `StringComparer.Ordinal`, Rust `Ord` (byte order).
For the ASCII `b-XXX` golden-vector keys all four coincide, so the cross-verify
passes — but for **culture-sensitive non-ASCII keys the F# oracle would diverge**
from the other three, breaking the 4-oracle byte-consensus that is the entire
point of the primitive registry. The ASCII fixtures **mask** the bug today; it's
documented as a "known gap" in `src/Core.TypeScript/{g-set,bag}/golden-vectors.json`.

## Concrete actions (in order)

1. **Fix the F# G-Set string ordering → ordinal.** Decide the generic-comparison
   strategy: either (a) take an explicit comparer param (as the C# G-Set #6363 and
   the TS `compare` do — comparer-is-part-of-identity), defaulting strings to
   `StringComparer.Ordinal`; or (b) special-case `string` to ordinal while
   keeping `Comparer<'T>.Default` for other `T` (numbers etc. are already
   ordinal-equivalent). Option (a) is the cross-language-consistent choice (TS/C#
   already take an explicit comparator). Update the "known gap" notes in both
   fixtures once F# is ordinal.
2. **Audit existing .NET code** (`src/Core.FSharp.*`, `src/Core.CSharp.*`, `src/Core/`,
   `tools/**/*.cs`/`*.fs`) for culture-sensitive defaults: bare `string.Compare` /
   `CompareTo` / `Comparer<string>.Default` / `ToString()` / `Parse` / `ToUpper`/
   `ToLower` (vs `ToUpperInvariant`/`ToLowerInvariant`) and missing
   `ConfigureAwait(false)` in library awaits.
3. **Mechanize the default** so it can't regress (per
   `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` — a standard
   that isn't enforced is weather):
   - Roslyn analyzer / `.editorconfig` rules: `CA1304`/`CA1305`/`CA1307`/`CA1310`
     (specify culture/StringComparison), `CA2007` (ConfigureAwait). Set to
     **error** in `Directory.Build.props` (`TreatWarningsAsErrors` is already on).
   - F# has no direct CA2007 equivalent — document the convention + consider a
     lint pass; F# `compare`/`Comparer<_>.Default` on strings is the F#-specific
     watch item.
4. **Cross-language note:** TS/Rust don't have a "culture" concept the same way —
   TS `<` is code-unit (already locale-independent), Rust `Ord` is byte order. The
   invariant-culture default is specifically a **.NET (F#/C#)** discipline; the
   registry's comparator contract (ordinal/UTF-16, ASCII-coincident) is the
   cross-language target all four converge on.

## Acceptance

- F# G-Set string comparison is ordinal (cross-verify still green; the "known
  gap" notes in the two fixtures removed/updated).
- `CA1304/1305/1307/1310/2007` enforced at error level for C#; F# convention
  documented + the `Comparer<_>.Default`-on-string watch item noted.
- A short standard captured where contributors will see it (CLAUDE.md bullet or
  `.claude/rules/`): "Zeta is server/library code — invariant culture / ordinal
  by default; `ConfigureAwait(false)` by default; culture-sensitive is opt-in."

## URGENCY ESCALATION (maintainer 2026-06-07) — do this sooner rather than later

> *"we need to do this sooner rather than later cause it affects all 4 lang and a lot of surface area
> before we get too far."*

The longer the 4-language surface grows, the more code is written against the culture-sensitive default and
the more golden vectors bake in ASCII-masked parity — so the fix gets strictly more expensive over time.
Treat B-0969 as **do-now**, ahead of net-new primitive surface. The collation choice (ordinal / codepoint ≡
UTF-8 byte order) is the **treaty** every oracle + every golden vector must conform to; landing it early is
what keeps the 4-oracle byte-consensus cheap. Gating decision (comparer strategy a-vs-b) is in action 1 —
pin it first so the cross-language fix can proceed.

## Confirmed located instance — ZSet (not just G-Set), empirically verified (Otto 2026-06-07)

The same defect lives in **`ZSet`**, the load-bearing data-plane primitive, not only G-Set:
`EntryKeyComparer` and the ofSeq/merge paths sort via **`Comparer<'K>.Default`** —
`src/Core/ZSet.fs:26, 67, 123, 548` — which is **culture-sensitive for `string`**. (Equality uses
`EqualityComparer<'K>.Default`, which IS ordinal for string, so only the **ordering** diverges — but
ordering drives the canonical sorted-run invariant, so culture-colliding distinct strings can be
mis-ordered/merged → an order-dependent net Z-set.)

**Empirically confirmed**, not source-read only: an FsCheck order-independence property over
`ZSet.ofSeq` with **string** keys is falsifiable (forward-vs-reverse `ofSeq` of culture-colliding strings
yields different net Z-sets); the same property over **`int`** keys passes. Surfaced while landing the
canonical Merkle-over-Z-set (PR #6789) — whose own fix is to **re-sort by ordinal key bytes**, sidestepping
`ZSet`'s culture-sensitive order (the pattern the ZSet fix should adopt). Reaffirmed by the maintainer
2026-06-07: *"we should be culture insensitive everywhere by default."* Fold ZSet into action 1's
ordinal-comparison fix alongside G-Set (same comparer-strategy decision).

## Composes with

- **B-0959** (cross-language substrate master checklist) — the 4-oracle
  byte-consensus this protects.
- The algebra-ladder primitives (G-Set / Bag / Z-set) + the primitive registry —
  the comparator contract is the shared cross-language ordering this enforces.
- `.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md` — the
  analyzer/editorconfig enforcement is the shield; an un-enforced standard is a
  hole that reads as covered.
- `.claude/rules/dep-pin-search-first-authority.md` — verify the exact analyzer
  IDs / current guidance via WebSearch before pinning the editorconfig rules.

## Full reasoning

The maintainer 2026-06-01, in response to Otto surfacing the F# G-Set
culture-sensitivity finding from the Bag-TS review: the framework defaults of
.NET (culture-sensitive string ops, context-capturing awaits) are client-side
defaults inappropriate for Zeta's server/library/agent code; the standing rule
is invariant-culture/ordinal-everywhere + `ConfigureAwait(false)`, with
culture-sensitive behavior as the explicit exception. The F# G-Set fix is the
first concrete instance; the audit + analyzer enforcement generalize it.
