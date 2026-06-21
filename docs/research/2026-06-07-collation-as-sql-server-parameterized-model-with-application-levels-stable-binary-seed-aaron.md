# Collation = the SQL-Server parameterized model (sensitivity flags + application levels), over a stable binary/ordinal seed (Aaron, 2026-06-07)

The design direction for 081KT07NV0008QG0R001YDB73K's collation selection. We model collation the way **SQL Server** does —
a parameterized string (locale + code page + a set of sensitivity flags), selectable at multiple
application levels — and we ship a **stable binary/ordinal default** that doesn't move no matter how rich
the parameter space gets. Faithful capture; Beacon-anchored.

## The stable seed (confirmed)

> Aaron: *"exactly — you found a stable seed even with all the parameters."*

No matter how many parameters a collation grows, two things are invariant and shipped first
(`src/Core/Collation.fs`, landed): the **default = binary / ordinal** (codepoint ≡ UTF-8 byte order; SQL
`_BIN2`-shaped) and **`Collation.forKey<'T>`** resolving strings to `StringComparer.Ordinal` (the 081KT07NV0008QG0R001YDB73K
fix) and everything else to `Comparer<'T>.Default`. The parameter space below *refines the catalog* over
time; the seed + default are fixed points.

## The parameterized model (SQL Server collation anatomy)

A SQL Server collation is a string like **`SQL_Latin1_General_CP1_CI_AS`**, decomposed as:

| Component | Meaning |
|-----------|---------|
| `Latin1_General` | locale / designator — the alphabet's linguistic sorting rules |
| `_CP1` | code page (1252) — non-Unicode encoding mapping |
| `_CI` / `_CS` | **case** in/sensitive (`_CS` sorts lowercase ahead of uppercase) |
| `_AI` / `_AS` | **accent** in/sensitive (`'a'` = `'á'` vs distinct) |
| `_KI` / `_KS` | **kana** sensitivity (Katakana vs Hiragana) |
| `_WI` / `_WS` | **width** sensitivity (half- vs full-width) |
| `_VSS` | variation-selector sensitivity (CJK ideograph variants) |
| `_UTF8` | UTF-8 storage for `char`/`varchar` |
| `_BIN` / `_BIN2` | **binary** sort — strict bit pattern / code point, NOT linguistic |

Our catalog grows toward this: a collation is **locale + encoding + a flag-set**, with `_BIN2` (codepoint
binary) as our shipped default. The seed module's named entries (`binary`, `ordinal`, `ordinal-ci`,
`invariant`, `invariant-ci`) are the first slice of this space — `-ci` is the `_CI` flag; accent/kana/width
flags + locale designators are future catalog entries, all **opt-in**, never displacing the binary default.

## Application LEVELS (scope + override precedence)

SQL collation is selectable at four boundaries, each overriding the broader one:

1. **Server instance** — installation default for all metadata.
2. **Database** — `CREATE/ALTER DATABASE COLLATE …`.
3. **Column** — `… VARCHAR(50) COLLATE … ` overrides the database default for one field.
4. **Query expression** — `… COLLATE DATABASE_DEFAULT` forces a collation on-the-fly (vital when joining
   columns of mismatched collation to avoid evaluation errors).

**Our analog (the precedence chain):**

| SQL level | Zeta analog |
|-----------|-------------|
| Server default | the shipped **`Collation.binary`** default (`forKey`) |
| Database | a substrate/cell-scoped default collation (a DynamicValue config factor) |
| Column | **comparer-is-part-of-identity** — the collation a value/primitive (G-Set/Z-set/Bag) *carries* (081KT07NV0008QG0R001YDB73K strategy (a)) |
| Query expression | an explicit collation passed to an operation (`ofSeqWith collation`, a join/merge override) |

Two collations only need to agree where they meet (a CRDT `union` / a join) — exactly SQL's
"`COLLATE DATABASE_DEFAULT` on the join" rule. Mismatched-collation merge is an **error to surface**, not a
silent reinterpret (the Mars-Climate-Orbiter lesson — units/order mismatches must not compound silently;
`.claude/rules/culture-invariant-by-default.md`).

## Ties

- 081KT07NV0008QG0R001YDB73K (the fix + strategy (a) + DB-collation framing) · `src/Core/Collation.fs` (the seed, landed) ·
  the algebra-ladder primitives G-Set/Z-set/Bag (consume `Collation.forKey` / carry a collation) ·
  `ZSetMerkle` (already ordinal — the reference order) · `.claude/rules/culture-invariant-by-default.md`
  (the canonical collation = the treaty).

## Beacon anchors

- **SQL Server collations** (Microsoft) — the parameterized-string + four-level model captured here. ·
  **PostgreSQL `COLLATE`** + `C`/`ucs_basic` (binary) · **ICU** locales (the linguistic engine behind
  accent/kana/width sensitivity) · **Unicode Collation Algorithm (UCA, UTS #10)** + **ISO/IEC 14651** —
  the standards for linguistic (non-binary) collation · **Unicode normalization (NFC/NFD)** — relevant to
  accent sensitivity. Honest novelty: none in the collation model itself (it's SQL's, deliberately); the
  contribution is applying it uniformly across a 4-language byte-locked substrate with a binary default
  that all four oracles reproduce bit-for-bit.
