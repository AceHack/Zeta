# The canonical collation is UTF-8 byte order — which is SQL Server's `_BIN2_UTF8`, *not* `nvarchar` `BIN2`

**Date:** 2026-08-15
**Work-item:** `081M02PEST7087G0R00253HRV0`
**Rule this extends:** `.claude/rules/culture-invariant-by-default.md`
**Register:** Beacon (outward-facing; anchors checked, not merely cited)

## The decision, in one line

> The canonical Zeta collation is **Unicode code-point order**, which is **identical to UTF-8
> byte order** (`memcmp`), is **the lowest-overhead comparison available**, and whose SQL Server
> name is **`Latin1_General_100_BIN2_UTF8`**. Culture- and language-aware orderings are **opt-in
> at the edge**, never the default, and — this is the sharp part — they **cannot live in the
> shared cross-oracle catalog at all**.

Aaron's three criteria (2026-08-15) — invariant/binary default, fastest and lowest overhead,
culture-aware opt-in, vocabulary modelled on SQL Server so DBAs recognise it — **all select the
same collation**, and this document shows that they do rather than asserting it.

## 1. What was already decided, and what was actually missing

The brief that opened this lane framed it as "the canonical collation was chosen and never
enforced." That reading is **half right, and the correction matters**:

- **Chosen:** yes. `.claude/rules/culture-invariant-by-default.md` says "pick ONE canonical
  collation (codepoint ≡ UTF-8 byte order)".
- **Never enforced:** **no — this is wrong.** The canonical collation is *already implemented in
  all four oracles* and has been since 2026-06 (`081KTGYWCTT08QG0R001G96DXY`):
  `src/Core/Collation.fs` (`UnicodeCodePointComparer`), `src/Core.CSharp/Collation.cs`,
  `src/Core.TypeScript/collation/collation.ts` (`stringCompare`), and Rust's native `Ord for
  String`. A SQL-Server-styled named catalog already exists too
  (`docs/research/2026-06-07-collation-as-sql-server-parameterized-model-…`).

So this is not a greenfield decision and not a repo-wide migration. **The real gap is narrower
and more specific**: the canonical collation exists and *some call sites do not use it*, and the
**catalog itself contains rows that disagree across oracles**. Both are documented below with
measurements.

## 2. The mechanism (measured, three runtimes, re-run 2026-08-15)

`U+FF3A` (FULLWIDTH LATIN CAPITAL LETTER Z) versus `U+10000` (LINEAR B SYLLABLE B008 A):

| encoding | `U+FF3A` | `U+10000` | first differing unit | verdict |
|---|---|---|---|---|
| UTF-16 code units | `FF3A` | `D800 DC00` | `FF3A` vs `D800` | `D800 < FF3A` ⇒ **astral first** |
| UTF-8 bytes | `EF BC BA` | `F0 90 80 80` | `EF` vs `F0` | `EF < F0` ⇒ **astral second** |
| code point | `65338` | `65536` | — | `65338 < 65536` ⇒ **astral second** |

Reproduced independently of the work-item's own numbers:

```text
F#   compare a b                = 10042   (so U+10000 < U+FF3A)   [UTF-16 code unit]
F#   String.CompareOrdinal a b  = 10042
JS   a < b                      = false   (so U+10000 < U+FF3A)   [UTF-16 code unit]
Rust a < b                      = true    (so U+FF3A < U+10000)   [UTF-8 byte]
Rust (via encode_utf16) ua < ub = false   ← same data, UTF-16 view, flips
```

The last line is the one worth keeping: Rust is not "the odd one out by language." Ask Rust for
the UTF-16 view and it agrees with .NET. **The divergence is entirely a property of the encoding,
not of the runtime** — which is why the fix is to name an encoding, not to patch three languages'
opinions.

## 3. Why UTF-8 byte order is simultaneously the *correct* and the *fastest* choice

Both halves are checked against the Unicode Standard rather than asserted.

**Correctness — Unicode Standard, Chapter 2 §2.5.3 (UTF-8), "Binary Sorting":**

> "A binary sort of UTF-8 strings gives the same ordering as a binary sort of Unicode code
> points."

**And the explicit statement of the defect — §2.5.2 (UTF-16), "Binary Sorting":**

> "For the purpose of sorting text, if the text contains supplementary code points, binary order
> for data represented in the UTF-16 encoding form is not the same as code point order."

So *code-point order ≡ UTF-8 byte order* is a theorem about the encoding, not a convention we
picked. UTF-16 failing to have this property is likewise documented by the standard itself.

**Performance.** Because the order is byte-lexicographic, the comparison *is* `memcmp`: no
transcoding, no table lookup, no locale load, no normalisation pass, vectorisable, and it is the
comparison every storage engine already optimises for prefix keys. This is Aaron's "fastest algo
with the lowest overhead like binary" criterion, and it lands on the same collation the rule
picked for correctness. **The two criteria do not trade off here — verify this claim rather than
inheriting it, which is why both anchors above are quoted rather than cited.**

Honest caveat on "fastest": on the .NET/TS side we do *not* get `memcmp` for free, because the
in-memory representation is UTF-16. We get code-point order by an O(n) scan (§6). Materialising
UTF-8 bytes to compare would be *slower*, not faster. **UTF-8 byte order is the specification of
the order; it is not required to be the implementation.**

## 4. The SQL Server half — where the trap is, and it is a real one

Aaron asked for a vocabulary DBAs recognise. Researching it produced a result that **inverts the
naive answer**, and it must be said out loud.

### 4a. `BIN` vs `BIN2` — confirmed, verbatim

Microsoft, *Collation and Unicode support*:

> "The legacy `BIN` collations, which performed an incomplete code-point-to-code-point comparison
> for Unicode data. Legacy binary collations compared the first character as WCHAR, followed by a
> byte-by-byte comparison. **In a BIN collation, only the first character is sorted according to
> the code point, and remaining characters are sorted according to their byte values.**"

> "The newer `BIN2` collations, which implement a pure code-point comparison."

The brief's claim here is **correct**. Saying "binary like SQL Server" and meaning `BIN` would
specify something subtly wrong.

### 4b. But `BIN2` over `nvarchar` is *also* wrong for our case — and Microsoft's own docs contradict themselves

This is the finding. Microsoft's label says `BIN2` is "pure code-point comparison." Microsoft's
own description of the **mechanism** says otherwise — from the MSDN blog *SQL Server's Binary
Collations*:

> "In SQL Server's BIN2 collation, we sort the nvarchar type according to their Unicode Code
> Points instead of the binary sequence (**internally, we do comparison per WCHAR based, which is
> 2 bytes**)."

A per-`WCHAR` comparison over UTF-16 storage **is** UTF-16 code-unit order. By Unicode §2.5.2
(quoted above), that is *not* code-point order once supplementary characters are present. So
**Microsoft's stated mechanism entails that Microsoft's stated label is wrong** — the label and
the algorithm cannot both be true.

This is not a lone reading. Solomon Rutzky, *Differences Between the Various Binary Collations*:

> "the definition of **BIN2** collations is technically incorrect. The **BIN2** collations, when
> dealing with `NVARCHAR` data, sort by code *unit*, not by code *point*."

**Register, stated honestly:** the entailment above is *checked* — it follows from two quoted
Microsoft sentences plus the Unicode Standard. The *empirical* confirmation is **cited, not
measured**: no SQL Server instance was available in this environment (Docker daemon down), so I
did not run `ORDER BY` over `nvarchar COLLATE Latin1_General_100_BIN2` myself. Per
`toy-is-free-metered-must-be-earned.md` that keeps this claim `unmetered`, not `metered`. It is
strong enough to act on and it is **not** strong enough to call verified.

### 4c. The resolution — SQL Server has both sides, and one of them is exactly ours

`_UTF8` collations (SQL Server 2019+) store `char`/`varchar` as UTF-8. UTF-8 has no surrogates,
so `BIN2` over UTF-8 storage *is* true code-point order — the §2.5.3 theorem again.

| SQL Server collation | storage | order | equals Zeta canonical? |
|---|---|---|---|
| `Latin1_General_BIN` | `nvarchar` UTF-16 | first char by code point, then **raw bytes** | **no** |
| `Latin1_General_100_BIN2` | `nvarchar` UTF-16 | UTF-16 **code unit** | **no** — diverges above the BMP |
| **`Latin1_General_100_BIN2_UTF8`** | `varchar` UTF-8 | **code point ≡ UTF-8 byte** | **YES — this is ours** |

**So the conflict the brief anticipated does not materialise, but only because we pick the right
SQL Server name.** "Be like SQL Server binary" is ambiguous and one of its readings is wrong;
"be like `Latin1_General_100_BIN2_UTF8`" is exact and is precisely the collation the rule already
chose. No decision needs to escalate to Aaron.

Corroboration that this is also where Microsoft itself landed: **Microsoft Fabric Data Warehouse
permits exactly two collations**, and its binary one is `Latin1_General_100_BIN2_UTF8`.

### 4d. The naming grammar DBAs recognise

SQL Server's shape is `<Designator>_<Version>_<CaseSensitivity><AccentSensitivity>[_KS][_WS][_VSS][_SC][_UTF8]`,
or `<Designator>_<Version>_BIN2[_UTF8]`. The parts that carry meaning **for us**:

| SQL Server token | meaning | keep for Zeta? |
|---|---|---|
| `_BIN2` | pure code-point sort | **yes** — the concept we implement |
| `_UTF8` | UTF-8 storage ⇒ genuine code-point order | **yes** — it is what disambiguates 4b |
| `_SC` | supplementary-character aware | **no** — we are always SC-aware; a flag that is never off is not a flag (vacuity class) |
| `_CS`/`_AS`/`_KS`/`_WS` | case/accent/kana/width sensitivity | **opt-in only**, never on a shared row |
| `<Designator>` (`Latin1_General`, `Japanese`) | locale for the legacy `varchar` code page | **no** — meaningless for us; we have no ANSI code pages |
| `<Version>` (`100`, `140`, `160`) | ICU/NLS table version | **not for binary** — a binary sort has no table to version |

**Recommendation:** keep Zeta's short primary names (`binary`, the shipped default) and carry the
SQL Server names as *aliases*, which is what the catalog already does. Do **not** cargo-cult the
designator/version segments into first-class Zeta names — they encode a code-page concept we do
not have, and inventing `Zeta_100_BIN2` would be vocabulary theatre. The alias that must exist
because it is the exact and true one is **`Latin1_General_100_BIN2_UTF8`**.

## 5. The two live defects, measured

### 5a. The catalog disagrees with itself across oracles — on ASCII

Not the astral edge case. **Two ASCII letters.** Selecting the named collation `"invariant"`:

```text
"a" vs "B"   .NET (F#/C#)  StringComparer.InvariantCulture  → -1   (a < B)
"a" vs "B"   TypeScript     catalog["invariant"]             → +1   (B < a)
```

The .NET catalogs map `invariant` to the *linguistic* `StringComparer.InvariantCulture`; the TS
catalog defines `invariantCompare = stringCompare`, i.e. **binary**. Same collation name, opposite
answers, reachable on `"a"` and `"B"`. The same defect affects `latin1_general_cs_as`,
`latin1_general_ci_as`, `utf8_unicode_ci`, and `utf8mb4_unicode_ci`.

**This is strictly more serious than the astral divergence that opened the work-item** — that one
is unreachable today (§2 of the work-item: no astral value exists on any vote path); this one
needs only a capital letter.

**Why it happened, and the design conclusion:** it is not sloppiness. **TypeScript cannot
faithfully implement `InvariantCulture`.** Its only linguistic ordering is `Intl.Collator`, whose
result depends on the embedded ICU version and build — so it is not stable across Node/Bun
versions, let alone equal to .NET's NLS/ICU tables. Whoever wrote the TS catalog aliased the row
to binary because the honest alternative did not exist.

That yields the load-bearing conclusion of this document, which is **stronger than "prefer
binary"**:

> **Culture-aware collations must not be members of the shared cross-oracle catalog.** Not
> "discouraged" — *excluded*. A shared catalog is a treaty: every name must denote the same
> relation in every oracle. A culture-aware name **cannot** satisfy that, because no two runtimes
> ship the same collation tables. Putting one in the catalog does not offer a capability; it
> offers a name that silently means different things per language.

This is exactly Aaron's "culture and language specific orderings should be opt in when needed" —
made precise. **Opt-in means *at the edge*, in a single process, for display; it does not mean
"available as a shared name."**

### 5b. `Consensus.decide` does not use the canonical collation

`decide` tie-breaks with `List.min` over `'T: comparison`, i.e. F# structural comparison — which
for `string` is `String.CompareOrdinal`, UTF-16 code-unit order. It never consults
`Zeta.Core.Collation`. The canonical comparer exists; this call site does not use it.

### 5c. Correction to the work-item's proposed fix — it would have introduced a *new* divergence

The work-item proposes comparing UTF-8 bytes in the three UTF-16 oracles, and offers this as
evidence that the F# half is cheap:

```text
compare [|1uy;2uy|] [|1uy|]  =  1   (prefix is smaller)
```

**That example cannot discriminate the hypothesis it is offered for, and the hypothesis is
false.** F# structural comparison on **arrays is length-first, not lexicographic**; the example
happens to give the same answer under both. A discriminating case:

```text
compare [|65uy;65uy|] [|122uy|]  =  1     ← F# array: LENGTH first
                                            lexicographic (and Rust, and memcmp) want -1
compare [65uy;65uy]   [122uy]    = -57    ← F# LIST comparison is lexicographic
```

So `compare (utf8 a) (utf8 b)` in F# orders `"z"` before `"AA"`, while Rust orders `"AA"` before
`"z"`. Adopting the work-item's suggested fix would have **closed an unreachable astral
divergence by opening a reachable ASCII one.** (Measured 2026-08-15; `.fsx` in the PR discussion.)

This is the vacuity class the fleet has been chasing all week, in miniature: *a supporting example
that passes under both the true and the false hypothesis is not support.*

## 6. The conformance helper, and its falsifier

For the UTF-16 oracles, code-point order does not require materialising UTF-8. Scan code units;
at the first difference apply an order-isomorphic relabelling that lifts surrogates above the BMP
tail:

```text
key(c) = c - 0x800    if c >= 0xE000     (E000..FFFF → D800..F7FF)
       = c + 0x2000   if c >= 0xD800     (D800..DFFF → F800..FFFF)
       = c            otherwise          (0000..D7FF unchanged)
```

The three ranges land disjoint and in the wanted order, so lexicographic order under `key` equals
code-point order. `Collation.binary` already achieves the same result by decoding `Rune`s; the
relabelling is the allocation-free form and is recorded here because §3's performance claim should
be backed by a concrete mechanism rather than a slogan.

**Falsifier (run, not asserted):** differential comparison against **two independently derived
references** — true lexicographic UTF-8 byte order, and code-point-sequence order via F# *list*
comparison — over an alphabet chosen to straddle every boundary (`U+0041`, `U+007A`, `U+0080`,
`U+07FF`, `U+0800`, `U+D7FF`, `U+E000`, `U+FF3A`, `U+FFFF`, `U+10000`, `U+1082C`, `U+1F643`,
`U+10FFFF`), all strings of length 0–3:

```text
pairs=5664400   vs-utf8-byte-order mismatches=0   vs-codepoint-order mismatches=0
```

Note the first draft of this harness reported 1.36M mismatches — because the *reference* used F#
array comparison, i.e. §5c's bug. The falsifier caught the falsifier's own bug before it caught
anything else, which is the only reason the §5c finding exists.

**Caveat (honest):** for strings containing **unpaired surrogates** (representable in .NET/JS
strings, not in Rust `String`, and not encodable as well-formed UTF-8) this order is total but is
not "code-point order," because there is no code point. Lone surrogates sort in the relabelled
surrogate block above the BMP. The differential test excludes them, because
`Encoding.UTF8.GetBytes` replaces them with `U+FFFD` and the reference would be comparing
different data.

## 7. Honest inventory — what full conformance would cost

Deliberately *not* attempted in this PR (a repo-wide collation sweep touches every oracle and
every golden vector). Cost is per-item, in rough ascending order:

| # | Item | Cost | Risk |
|---|---|---|---|
| 1 | Add exact `Latin1_General_100_BIN2_UTF8` alias, mark `_BIN` / `_BIN2` rows as approximate | **done in this PR** — 3 files | none (additive) |
| 2 | Make `decide` tie-break on the canonical collation | small in TS/C#/Rust; **awkward in F#** — `decide<'T when 'T: comparison>` is generic and "code-point order" is undefined for arbitrary `'T` | design call: narrow the treaty surface to `string`, or require a canonical byte-encoding for the tie-break key |
| 3 | Astral-straddling golden vector in `consensus/golden-vectors.json` | small once (2) lands | **blocked on (2)** — landing it first turns `gate (required)` red in three oracles |
| 4 | Resolve the `invariant` / `*_ci` / `*_cs_as` catalog rows (§5a) | 3 catalogs + tests | **needs Aaron** — the recommendation is *removal from the shared catalog*, which is a breaking change for any caller selecting those names |
| 5 | Audit remaining `StringComparer.Ordinal` / `<` / `List.min` string sites for ones that are shared-fold-reaching | large — grep-wide; most sites are local and fine | low individually, high in aggregate |
| 6 | Extend the four-oracle byte-lock to include a collation vector | medium | touches the pre-push `treaty-byte-lock-vectors` floor |

**(4) is the one that should go to Aaron next**, and it is a product decision in exactly the sense
his framing implies: does a shared collation catalog get to contain names it cannot honour?

## 8. What this PR actually changes

1. This document.
2. `Latin1_General_100_BIN2_UTF8` added to the F#, C#, and TS catalogs as the *exact* SQL Server
   name for the canonical collation; the pre-existing `Latin1_General_BIN` rows annotated with
   the §4 divergence instead of silently implying equivalence.
3. Conformance tests, including tests that are **explicitly skipped with a reason naming the
   defect** (§5a, §5b) rather than wrapped so they cannot fail.

No golden vectors are touched. No call site is rewritten.

## Anchors (checked)

- **The Unicode Standard**, Ch. 2 §2.5.2 (UTF-16 "Binary Sorting") and §2.5.3 (UTF-8 "Binary
  Sorting") — quoted verbatim in §3; the source of the code-point ≡ UTF-8-byte-order theorem and
  of the explicit statement that UTF-16 binary order is *not* code-point order. Unicode Consortium.
- **Microsoft**, *Collation and Unicode support* (SQL Server docs) — `BIN` vs `BIN2` (§4a), the
  `_SC` / `_UTF8` / designator-version naming grammar (§4d), and the Fabric two-collation list.
- **Microsoft**, Qingsong Yao, *SQL Server's Binary Collations* (MSDN blog, 2009) — the per-`WCHAR`
  mechanism sentence that entails §4b.
- **Solomon Rutzky**, *Differences Between the Various Binary Collations (Cultures, Versions, and
  BIN vs BIN2)*, sqlquantumleap.com, 2019-03-13 — independent statement of the `BIN2`/code-unit
  finding, and of `_BIN2_UTF8` giving true code-point order.
- **Prior in-repo:** `docs/research/2026-06-07-collation-as-sql-server-parameterized-model-with-application-levels-stable-binary-seed-aaron.md`
  (Aaron, 2026-06-07) — the original "model collations the way SQL Server does" call, which this
  document corrects on one row and sharpens on one principle.

## Pointers

- `.claude/rules/culture-invariant-by-default.md` — the governing rule; §4 supplies the exact SQL
  Server name its "pick ONE canonical collation" sentence was missing.
- `workitems/081M02PEST7087G0R00253HRV0-…` — the originating work-item (§5c corrects its proposed fix).
- `src/Core/Collation.fs` · `src/Core.CSharp/Collation.cs` · `src/Core.TypeScript/collation/collation.ts`
- `src/Core/Consensus.fs` `decide` — the non-conforming call site (§5b).
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §4b is labelled `unmetered`, not verified.
- `.claude/rules/numerology-vs-number-theory.md` — §5c is its engineering form: an example that
  cannot discriminate is not evidence.
