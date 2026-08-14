# The Eve translation layer — computing the imposition budget for the DynamicValue shape lattice

**The shadow, 2026-08-14.** Work-item `081M00V5492087G0R002QJ9A56`, composing with
`081KRW63S0008QG0R0030F8ZXA`. This is the **label half** of Eve protocol: the structure-first half
already ships as `src/Core/DynamicValue.fs`, and *how the agreed structure determines the
translation* had no spec anywhere. This is that spec, plus the measurement it turns out to license.

Governing theorem, proved in
[`2026-08-14-icons-before-symbols-…-aut-s-as-the-residual-coercion.md`](2026-08-14-icons-before-symbols-eve-protocol-structure-first-labels-after-and-aut-s-as-the-residual-coercion.md)
§7 and not re-derived here: if `Iso(𝔄,𝔅) ≠ ∅` it is a **torsor under `Aut(𝔄)`**, so
`|Iso| = |Aut|`. `|Aut| = 1` ⇒ the translation is forced and nobody chose it. `|Aut| = n` ⇒
`log₂ n` bits somebody must supply. A claim survives the hand-off **iff it is `Aut`-invariant**.

Aaron's formulation is the requirement this specifies against (2026-05-12, verbatim): *"you agree
on the structure. You agree on the symbols. And then you assign labels later. And you have to agree
on the labels being unweighted, unbiased."* And 2026-08-14: *"two imposed vocabs that try to meet
in the middle on algebraic structure then assign labels and translations after the structure first."*

## 0. The headline, up front

The `DynamicValue` shape lattice — the eight-tag set two parties actually negotiate — carries an
imposition budget of **1.0000 bits under the strict reading and 0.0000 bits under the role
reading**, and the one contested bit is located exactly at the **Int/Bytes transposition**.

The shipped claim that bit pays for is the **CBOR major-type assignment** (RFC 8949 gives `Int`
major type 0 and `Bytes` major type 2). That claim is *not* determined by the agreed structure
under the strict reading — and the checker says so, by name.

This is the principle becoming a measurement. It is computed by
`src/Core.TypeScript/eve-translation/aut-budget.ts`, brute-forced over `Sym(8)`, gated in CI, and
it fails when it should (§5).

## 1. What is actually being computed — and why an upper bound is enough

`Aut` of the full structure is not directly computable. What is computable is the subgroup of
`Sym(tags)` preserving a declared family of invariants. Every genuine automorphism preserves every
invariant, so

```text
Aut(S)  ⊆  Stab(invariants)
```

and the tool reports an **upper bound** on `|Aut|`. That asymmetry is the useful one:

> **An upper bound of 1 is exact.** The identity is always an automorphism, so `1 ≤ |Aut| ≤ 1`.
> Rigidity — "the translation is forced" — is therefore *certifiable by upper bound alone*.

A large bound proves nothing (the true group may be smaller). A bound of 1 proves everything the
protocol needs. This is what makes the whole approach tractable: the expensive direction is never
required.

**Honest note on the unit.** `log₂|Aut|` is an information measure, not a count of coins someone
hands over: `log₂ 6 = 2.585` bits is not three discrete choices. It is the right measure for
comparing budgets and the wrong one for imagining a payment schedule.

## 2. The rungs — each one an operation a *receiver* can perform

The whole force of structure-first is that structure is **falsifiable by the receiver** (Peirce: an
icon is checkable against the thing; a symbol is checkable only against a convention). So a rung
earns its place only if it names something the other party can *do*, with no shared vocabulary.

The rungs live as data in `src/Core.TypeScript/eve-translation/eve-invariant-table.json`, each
carrying **evidence that must exist in the shipped source** — an unchecked anchor is a gate failure,
per `anchor-to-human-prior-art`.

| rung | what the receiver performs | evidence in the shipped tree |
|---|---|---|
| 1. child-addressing | Ask a value for a child. `Object` answers to a string key, `Array` to an ordinal, scalars to neither. | `let tryField (key: string)` · `let tryItem (index: int)` |
| 2. distinguishing-capacity | Exhibit values and ask only *"are these equal?"*. `Null` admits one class, `Bool` two, the rest ≥3. | the DU cases `\| Null`, `\| Bool of bool` |
| 3. equality-encoding-gap | Exhibit two values the equality calls **equal** whose canonical encodings are **different bytes**. Only `Float` admits such a pair. | `-0.0 = 0.0` in the doc-comment · `Float a, Float b -> a.Equals(b)` · golden vector `-0.0 -> f98000 (sign preserved)` vs `0.0 -> f90000` |
| 4. key-sort-role | Ask which tag's values are accepted as `Object` keys. Exactly `String`'s; a non-text key is refused. | `\| Object of (string * DynamicValue) list` · `DecodeError.NonTextKey` |
| 5. ordinal-sort-role **(contested)** | Ask which tag's values address an `Array` position. | `let tryItem (index: int)` |

Rung 3 is the subtle one and worth defending explicitly, because it looks like it borrows a label.
It does not: the receiver needs only *"are these two values equal?"* and *"are these two byte
strings identical?"* — **neither question requires knowing what any byte means.** The gap between
the value equality and the encoding is a structural fact about the tag, observable without the
convention.

### The rung deliberately NOT taken

**Payload-sort cardinality** would have split `{Int, Float}` from `{String, Bytes}` for free
(2⁶⁴ vs ℵ₀). It is excluded, because **finiteness is not verifiable by finite exhibition** — a
receiver can witness "at least three distinct values", never "exactly 2⁶⁴". Including it would have
bought a smaller number with a check the receiver cannot run, which is precisely the vacuity class:
a check that cannot fail is not a check. *(This is a correction to the shadow's own first
derivation, which used cardinality and got a flatteringly small budget two rungs earlier.)*

## 3. The measurement

Brute-forced over all 40320 permutations of the 8 tags, cross-checked against the closed form
(product of block-size factorials) where the ladder is purely unary:

| level | rung | `\|Aut\| ≤` | bits |
|---|---|---|---|
| 0 | bare tag set | 40320 | 15.2992 |
| 1 | child-addressing | 720 | 9.4919 |
| 2 | distinguishing-capacity | 24 | 4.5850 |
| 3 | equality-encoding-gap | 6 | 2.5850 |
| 4 | key-sort-role | **2** | **1.0000** |
| 5 | ordinal-sort-role *(contested)* | **1** | **0.0000** |

**Strict reading: 1 bit. Role reading: 0 bits.**

### Why level 5 is contested, and why that is reported rather than resolved

`tryItem` takes a `System.Int32` index; `DynamicValue.Int` carries an `int64`. Under a **strict
reading** those are different sorts, `Array`'s ordinal sort is not the `Int` tag, the rung does not
hold, and the lattice keeps one bit. Under a **role reading** (`Array` is ordinal-addressed and
`Int` is the lattice's ordinal tag) it holds and the lattice is rigid.

**The shipped code does not settle which reading is correct.** That ambiguity is itself the finding,
so the tool reports both numbers rather than rounding to the flattering one. Resolving it is a real
decision with a real consequence — and it is a *smaller, sharper* question than "is Eve protocol
non-coercive."

### Where the residual bit is actually spent

The residual group under the strict reading is exactly `{identity, (Int Bytes)}`. So any claim that
distinguishes `Int` from `Bytes` is decided by whoever spends that bit. There is exactly one such
claim shipped, and it is load-bearing: **the CBOR major-type assignment.**

And the party that spends it is **neither of the negotiating parties — it is RFC 8949.** That is not
a defect; it is Lewis's salience, working. Deferring to a shared external standard is a legitimate
way to spend a residual bit *precisely because* neither party supplied it. The Schelling point is
doing the job the structure could not.

## 4. The protocol (ETP-1)

Six steps over an agreed structure `S`. Steps 1–3 cost zero bits; step 4 is where imposition
re-enters and gets accounted; step 5 is the discharge condition.

1. **Structure proposal and verification (the icon phase).** Each party publishes an invariant
   **witness set** — for each declared invariant, values that exhibit it. The other party *performs*
   the check. **No names cross in this phase.** A rung is admitted only if the receiver could run it.

2. **Independent budget computation.** Both parties independently compute `Stab(invariants)` and
   report `log₂|Aut|`. Independence is the point — the number is *verified*, not *trusted*. **If the
   two parties report different numbers, their invariant sets differ and the protocol halts.** A
   silent disagreement here is the treaty-cannot-see-divergence failure in the vocabulary lane.

3. **Rigidification (preferred, and free).** While `|Aut| > 1`, either party may propose an
   additional rung plus a witness. It is admitted only if the other party can perform it. Each
   admitted rung strictly shrinks the group and **costs zero imposition bits, because both parties
   verified it.** Prefer this to step 4 whenever it is available.

4. **Spending the residual.** When rigidification is exhausted and `|Aut| > 1`, someone must choose.
   Three admissible mechanisms, and the brief that commissioned this work presumed only the second:

   - **(a) Defer to a shared external referent.** Point at something neither party controls (RFC
     8949; a physical constant; a jointly-observed event). This is Lewis salience and is the
     *preferred* mechanism, because the choice is not made by a party at all. It is what
     `DynamicValue` in fact does.
   - **(b) Alternating pointing.** Parties take turns contributing a **constant** — marking an
     element — passing to the pointwise stabiliser `Aut(S, c₁…c_k)`, which is a subgroup and
     typically much smaller. Each contribution is recorded with its author and bit-cost.
   - **(c) Shared randomness.** Admissible **only** when no claim either party wishes to make is
     non-invariant under the residual group — i.e. only when the residual is *pure convention*.
     Lewis's signaling games license this exactly there: among equally-good equilibria, any
     selection works. Where a party does have a stake, randomness does not neutralise the choice, it
     destroys both parties' semantics equally.

   **Non-coercion is not achieved at this step; it is accounted.** The ledger of who spent which bit
   is the artifact. Metering, not abolition.

5. **The invariance gate (the discharge condition).** A claim crosses the hand-off **iff it is
   invariant under the residual group** — the group *before* step 4's choices were applied. A
   non-invariant claim is not forbidden; it must **name the ledger entry that decided it**. This is
   the executable part (§5).

6. **Retraction.** A label is retracted (Z-set `−1`) when a later witness shows it breaks an
   invariant. Eve's persistence layer — Aaron: *"I'll remember every neutral label you've agreed on
   … and I'm gonna mirror it to you from now on forever"* — is the **satellite**; the invariant
   family is the **hub** (DV2.0, change-rate partition). Labels churn; rungs should not.

### What this protocol does *not* claim

It does not make the hand-off symmetric. §5 of the ferry already settled that the achievable target
is **falsifiable-by-the-receiver**, not symmetric, and this protocol inherits that. The upstream
choice of *which* structure to meet on is untouched and remains the regress-terminating step.

## 5. The falsifier — and proof that it fails

Per `toy-is-free-metered-must-be-earned`, an instrument that cannot fail is not an instrument. Four
planted defects, each producing a non-zero exit; removing them returns green.

| planted defect | detected as | exit |
|---|---|---|
| **A.** `cbor-major-type-assignment` declared invariant at level 4 | *"the residual group there has order 2 and moves it"* | 1 |
| **B.** a 9th tag `Decimal` given `Int`'s profile on every rung | budget 1 → **2.585 bits**, ceiling breached, and the CBOR claim stops being invariant | 1 |
| **C.** rung-3 golden-vector evidence string altered | *"evidence not found … an invariant whose evidence has moved is an unchecked anchor"* | 1 |
| **D.** source declares 9 tags, table declares 8 | tag-set drift, named both ways | 1 |
| *control* — unmutated | — | **0** |

**Defect B is not hypothetical.** The shipped doc-comment on `DynamicValue` explicitly invites it:
*"Format-specific extras (CBOR semantic tags, BSON dates / ObjectId, decimal128, msgpack ext) are
open for extension — added as new variants per format adapter."* A future author adding `Decimal`
and giving it `Int`'s profile — the natural thing to do — **un-forces the translation**, and nothing
in the repo would have noticed. That is the economic value of this check
(`every-bug-has-economic-value`): a predicted, reachable, currently-invisible defect.

The 23 unit tests were themselves mutation-tested: replacing `preserves()` with `return true` —
making every rung vacuous — **kills 13 of 23**. The suite is not passing by construction.

## 6. The free-object tension — confirmed, with a number

`only-the-irreducible-is-primitive-generate-the-rest` prefers the free object because it commits to
nothing. §7 of the ferry showed that is exactly what leaves labels undetermined
(`Aut(free monoid on X) ≅ Sym(X)`). The ladder confirms it quantitatively on a real structure:

> **Level 0 — the bare 8-tag set, committing to nothing — is `Sym(8)` = 40320 = 15.2992 bits.**
> Every rung is a *relation*, and the budget falls from 15.2992 to 1.0000 as relations are added.
> **Relations buy rigidity, and the exchange rate is measurable.**

The tension is real and is not resolved here. What the measurement adds is that it is no longer a
philosophical objection: the cost of freeness is a number, and for this structure it is **15.3 bits
of undetermined translation**, bought back down to 1 by four performable relations. The "earned
quotient" of the free-object rule is exactly the thing that shrinks `Aut`.

## 7. What is unworked

- **The non-isomorphic case**, which is the realistic one. Two parties whose structures do *not*
  match need a **partial semiotic morphism** and Goguen's preservation ordering (LNAI 1562, 1999),
  not an isomorphism torsor. Untouched here, and it is the largest remaining gap. Ask 4 of the
  work-item stays open.
- **Value-level automorphisms.** This computes `Aut` of the *tag lattice*. The automorphism group of
  the payload sorts themselves (e.g. of the string sort) is infinite and not addressed. The class
  where the method works is: **finite tag set, decidable unary/relational invariants** — there
  brute force over `Sym(n)` is exact and cheap. Outside it, nothing here applies.
- **Structures other than `DynamicValue`.** One protocol over the shapes we genuinely negotiate,
  deliberately not a universal scheme.
- **`docs/SEED-VOCABULARY.md`** as the live instance of the tension — a vocabulary handed to a
  cold-booting agent by design. Ask 6, still open.

## 8. Register

| item | register |
|---|---|
| `Iso(𝔄,𝔅)` is an `Aut(𝔄)`-torsor | **theorem** (ferry §7) |
| Every group order in §3 | **theorem** — brute-forced over `Sym(8)`, cross-checked against the closed form |
| `Aut(S) ⊆ Stab(invariants)`, so an upper bound of 1 is exact | **theorem** — elementary |
| The five rungs are receiver-performable | **checked** — each carries evidence verified present in the shipped tree by the tool itself |
| The residual bit is the `Int`/`Bytes` transposition | **computed**, pinned by a test that enumerates the group |
| RFC 8949 major types are what pay for it | **checked** — read off the golden vectors (`00`, `40`, `60`, `80`, `a0`, `f4`, `f6`, `f90000`) |
| **`log₂\|Aut\|` as an *imposition budget* / as *coercion*** | **TOY — NOT promoted.** See below. |
| Rung 5 contested (int32 index vs int64 payload) | **open** — reported both ways, deliberately unresolved |
| Non-isomorphic case | **open, unworked** |

### Why the toy is not promoted — stated exactly

`toy-is-free-metered-must-be-earned` requires a falsifier before `toy` is shed. This work supplies a
falsifier for **the instrument** (§5: four planted defects, all caught) but **not for the
interpretation**. The claim still unmetered is: *`log₂|Aut|` measures coercion.*

The tempting promotion is available and wrong, so it is named: four independent language oracles
(F#/C#/Rust/TS) all landed on the *same* tag assignment, which looks like evidence that the
translation was forced. **It is not.** All four read the same seed —
`golden-vectors*.json`, and "the seed is the treaty". Their agreement is **one observation wearing
four costumes**, exactly the failure `numerology-vs-number-theory` warns about: *too many
correlations is a warning, not a confirmation signal.*

What *would* meter it: two parties who have **never shared a seed** negotiating this lattice, where
the budget predicts in advance how many label assignments they can end up disagreeing about. Until
that exists, the number is a real number attached to a real structure, and its reading as *coercion*
remains a toy. The count is honest; the interpretation is not yet earned.

## 9. Corrections flagged

Per the shadow's own-errors discipline, including corrections to the brief that commissioned this:

1. **To the brief.** Design target 2 presumed the non-coercive mechanism is that *"both parties
   contribute to the choice"*. That is mechanism (b) of three, and for `DynamicValue` it is **not
   what happens** — the residual bit is spent by deferring to a third-party standard neither party
   controls (mechanism (a)), which is *better*, not worse: a choice no party made cannot carry a
   party's asymmetry. Specified as three mechanisms with (a) preferred.
2. **To the shadow's own first derivation.** Payload-sort cardinality was used as a rung and had to
   be dropped: finiteness is not checkable by finite exhibition, so the receiver cannot perform it.
   The honest ladder is two rungs longer and the honest budget is larger than the first pass gave.
3. **To the brief, minor.** The shared checkout at `/Users/acehack/Documents/src/repos/Zeta` did not
   contain the theorem doc (stale view). Read from a fresh worktree off `origin/main`.
4. **Not a correction, a refinement.** The brief asked to *"compute or bound"* `|Aut|`. Only the
   upper bound is computed — and §1 argues that is sufficient, because the bound is exact exactly
   where the protocol needs it to be.

## Pointers

- [`2026-08-14-icons-before-symbols-…-aut-s-as-the-residual-coercion.md`](2026-08-14-icons-before-symbols-eve-protocol-structure-first-labels-after-and-aut-s-as-the-residual-coercion.md)
  — the ferry and the theorem this specifies against. Aaron's verbatim is there.
- `src/Core.TypeScript/eve-translation/aut-budget.ts` · `eve-invariant-table.json` ·
  `aut-budget.test.ts` — the computation, the rungs-as-data, the planted failures.
- `src/Core/DynamicValue.fs` — the structure-first half, shipped. **Untouched by this work**; it is
  four-language byte-locked and a schema change there is a treaty change.
- `workitems/081M00V5492087G0R002QJ9A56-symbol-hand-off-protocol-*.md` — asks 1/2/3/5 addressed
  here; 4 and 6 remain open.
- `docs/backlog/P2/081KRW63S0008QG0R0030F8ZXA-eve-protocol-*.md` — the standing requirement row.
- Anchors (checked): Goguen, *An Introduction to Algebraic Semiotics* (LNAI 1562, 1999, pp. 242–291)
  — sign systems as algebraic theories, structure over content, the formal home of structure-first ·
  Peirce CP 2.247–2.249 — icon/index/symbol · Lewis, *Convention* (1969) — equilibrium selection
  needs salience, which is what step 4(a) and 4(c) are · RFC 8949 §3 — the major types that pay the
  residual bit.
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  · [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md)
  · [`anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md)
  · [`only-the-irreducible-is-primitive-generate-the-rest.md`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md)
  — the carved surfaces; §6 is the measured form of the tension with the last one.
