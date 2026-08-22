---
id: 081M02PEST7087G0R00253HRV0
type: bug
state: backlog
priority: P2
slug: consensus-decide-tie-break-f-c-ts-order-by-utf-16-code-unit
title: "consensus decide tie-break: F#/C#/TS order by UTF-16 code unit, Rust by UTF-8 byte — the four oracles disagree on an astral-straddling tie"
created: 2026-08-15T12:30:57.863Z
depends_on: []
composes_with: []
---

# consensus decide tie-break: F#/C#/TS order by UTF-16 code unit, Rust by UTF-8 byte — the four oracles disagree on an astral-straddling tie

**Named, not fixed.** The residual left behind by the ordinal-minimum tie-break fix
(decision doc `docs/research/2026-08-15-the-consensus-tie-break-was-never-pinned-ordinal-minimum-reproduces-the-treaty-unchanged.md`).
The fix it follows is a strict improvement — it removed a divergence reachable on ordinary
ASCII values — and this is the strictly smaller one that remains.

## The fact, measured

`decide`'s tie-break is now "ordinal minimum of the values tied at the top count." Each oracle
uses its own native ordinal string order, and those orders are **not the same relation**:

| runtime | orders by | `"\u{FF3A}"` vs `"\u{10000}"` |
|---|---|---|
| F# (`compare` / `String.CompareOrdinal`) | UTF-16 code unit | `U+10000 < U+FF3A` |
| C# (`StringComparer.Ordinal`) | UTF-16 code unit | same as F# |
| TypeScript (`<`) | UTF-16 code unit | `a < b` is `false`, i.e. `U+10000 < U+FF3A` |
| Rust (`Ord for String`) | UTF-8 byte | `U+FF3A < U+10000` |

Measured, not inferred — three runtimes run directly:

```text
F#   compare a b = 1        (so U+10000 < U+FF3A)
JS   a < b : false          (so U+10000 < U+FF3A)
Rust a < b : true           (so U+FF3A < U+10000)
UTF-8 bytes: U+FF3A = [239,188,186]   U+10000 = [240,144,128,128]
```

So a vote tie whose values straddle the astral / high-BMP boundary commits **different values in
Rust than in the other three**. This is the "bit-perfect caveat" that
`.claude/rules/culture-invariant-by-default.md` already states out loud:

> C#/TS sort by UTF-16 code units, Rust `str` by UTF-8 bytes — they order non-BMP (astral)
> codepoints differently. So pick ONE canonical collation (codepoint ≡ UTF-8 byte order), lock it
> in the golden vectors, and make every oracle + the math conform.

## Why it was not fixed with the tie-break

Three reasons, in order of weight:

1. **The rule already names the canonical answer — codepoint ≡ UTF-8 byte order — and the repo has
   not adopted it anywhere.** Making `decide` the first adopter would either leave `decide`
   inconsistent with every other ordinal comparison in the repo, or drag a repo-wide collation
   migration through a tie-break PR. Choosing where that canonical collation is enforced is a
   treaty-level decision, not a local edit.
2. **Nothing in the system can currently reach it.** The only production vote type is
   `Consensus.MergeVerdict` (`Merge` / `Block of string`, whose strings are machine-generated PR
   gate messages). No astral value exists on any vote path, and no golden vector pins one — so the
   divergence is unreachable rather than latent-and-firing.
3. **It is bounded by the same n ∈ {2,3,6}** as the order-dependence it replaced: a tie must also
   reach quorum for the tie-break to be observable at all.

## What a fix looks like

Compare by UTF-8 bytes in the three UTF-16 oracles; Rust is already correct and needs no change.
The F# half is confirmed cheap — F# structural comparison on `byte[]` is already lexicographic
with the prefix ordering lexicographic order wants:

```text
compare [|1uy;2uy|] [|1uy|]                              =  1   (prefix is smaller)
compare [|239uy;188uy;186uy|] [|240uy;144uy;128uy;128uy|] = -1   (U+FF3A < U+10000, UTF-8 order)
```

The complication is that F#'s `decide<'T when 'T: comparison>` is generic, and "UTF-8 byte order"
is not defined for an arbitrary `'T`. Closing it properly means either a canonical byte-encoding
for the tie-break key or narrowing the treaty surface to strings — which is exactly the design
call that belongs in its own item rather than smuggled into a bug fix.

## Definition of done

- One canonical collation named for the four-oracle treaty (the rule proposes codepoint ≡ UTF-8
  byte order; that proposal is not yet adopted).
- All four oracles conform to it in `decide`'s tie-break.
- A golden vector in `src/Core.TypeScript/consensus/golden-vectors.json` that **straddles the
  boundary** — because per the schema precedent, a rule the vectors do not discriminate is not
  actually pinned, which is precisely the failure this whole lane found. JSON escapes keep it text
  and diffable (`.claude/rules/no-binary-in-proof-lineage.md`): `"Ｚ"` and `"𐀀"`.
- The mutation check: reverting any one oracle to its native UTF-16 order must fail that vector.

## Pointers

- `docs/research/2026-08-15-the-consensus-tie-break-was-never-pinned-ordinal-minimum-reproduces-the-treaty-unchanged.md` — the decision doc that produced this residual
- `.claude/rules/culture-invariant-by-default.md` — "pick ONE canonical collation"; this is that sentence coming due
- `src/Core/Consensus.fs` `decide` · `src/Core.CSharp/Consensus.cs` · `src/Core.TypeScript/consensus/consensus.ts` · `src/Core.Rust.Consensus/src/lib.rs`
- `tests/Tests.FSharp/Consensus.TieBreak.Tests.fs` — the permutation-invariance guard (unaffected: both orders are order-independent)
- PR #10738 (open) — the sibling finding this lane came from
