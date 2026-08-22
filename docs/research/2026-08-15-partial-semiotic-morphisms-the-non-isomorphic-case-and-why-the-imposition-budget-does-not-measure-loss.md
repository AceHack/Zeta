# Partial semiotic morphisms — the non-isomorphic case, and why the imposition budget does not measure loss

**The shadow, 2026-08-15.** Work-item `081M00V5492087G0R002QJ9A56` ask 4, composing with
`081KRW63S0008QG0R0030F8ZXA`. Closes the gap
[PR #10733](2026-08-14-the-eve-translation-layer-computing-the-imposition-budget-for-the-dynamicvalue-shape-lattice.md)
named as *"the largest remaining gap"*: two parties whose structures are **not** isomorphic, where
`|Aut|` is undefined and the imposition budget says nothing.

Aaron's framing is about exactly this case (2026-08-14): *"two imposed vocabs that try to **meet in
the middle** on algebraic structure."* Meeting in the middle is what you do when you are **not**
already the same shape.

**The result is mostly negative, and the negative is the finding.** The budget generalises cleanly —
and is, on the shipped `DynamicValue` lattice, **demonstrably independent of how much was lost, in
both directions.** Same budget with different loss; same loss with budgets 7 bits apart. Both
exhibited below on real tag sets, not argued.

## 0. The headline

| # | question (from the brief) | answer |
|---|---|---|
| 1 | What replaces `\|Aut\|`? | `Aut` of the **meeting structure** (image / quotient). The torsor theorem applies verbatim — its real hypothesis was never bijectivity. The budget **generalises as a measurement and breaks as a criterion.** |
| 2 | What does a party lose, can it be measured? | Yes, but **not by a number and not by `Aut`**. The loss is the set of **rungs that stop separating** — and it is **non-local**: losing one tag can un-pin tags it never touched. |
| 3 | Is there a fairness condition? | Yes, and **symmetric loss is the wrong target** (it is levelling-down). The right one is the repo's existing **cede / defer / strip** shape plus **exit**. |
| 4 | Does the repo have an instance? | **Yes, shipped and load-bearing**: `DynamicValue.toCanonicalJson` is a literal partial morphism with named refusals (`FloatDeferred`, `BytesDeferred`), and the Rust `Json` tree is the coarser party. |

**The one-line version:** *silence is the cheapest vocabulary.* A party that can say nothing has an
imposition budget of exactly zero, and 37% of all meeting structures over this lattice score a
perfect 0.0000 bits — including the morphism that maps every tag to one tag.

## 1. The concrete instance (ask 4) — and it is not hypothetical

Two structures ship in this repo, in production, deliberately kept distinct:

| party | where | tags |
|---|---|---|
| **A** — `DynamicValue` | `src/Core/DynamicValue.fs` | `Null Bool Int Float String Bytes Array Object` (8) |
| **B** — `Json` | `src/Core.Rust.Observe/src/json.rs` | `Null Bool Number(f64) Str Array Object` (6) |

They are **not isomorphic** — different tag counts, and `DynamicValue`'s own doc-comment says why,
naming the two distinctions B lacks:

> *"`Json` … is JSON-specialized: one `Number(f64)` case and NO binary. `DynamicValue` distinguishes
> `Int` (int64) from `Float` … and carries native `Bytes` (the type every binary self-describing
> format … has and **JSON fakes with base64-in-a-string**)."*

And the shipped codec is **already a partial morphism in Goguen's exact sense**, with the partiality
surfaced as typed data rather than hidden:

```fsharp
type EncodeError =
    /// `DynamicValue.Float` has no canonical shortest-float form in plain JSON.
    | FloatDeferred
    /// `DynamicValue.Bytes` has no native JSON byte type.
    | BytesDeferred
```

`toCanonicalJson : DynamicValue -> Result<string, EncodeError>` — the source calls itself *"a partial
projection (6/8 shapes; Float/Bytes deferred)"*. **The non-isomorphic case is not a future problem.
It is the JSON codec.**

### Three shipped codecs, three different ways to be non-isomorphic

| codec | totality | how it fails to be an isomorphism |
|---|---|---|
| CBOR, Arrow | **total** | it does not — all 8 tags cross. #10733 applies as written. |
| **JSON** | **partial at the *tag* level** | two whole tags cannot cross (`FloatDeferred`, `BytesDeferred`). |
| **XML** | **partial at the *value* level** | every tag crosses; some *values* cannot (`NonRepresentable` — a `String`/key holding NUL or a forbidden C0 char). |

The XML row is the one to keep. The shipped comment calls `NonRepresentable` *"the XML analogue of
`BytesDeferred`"*, and structurally it is nothing of the kind — see §6, where it becomes this
method's named blind spot.

## 2. What replaces `|Aut|` (ask 1)

### The theorem needs no repair — it needs its hypothesis restated

#10733 §7 proved: if `Iso(𝔄,𝔅) ≠ ∅` it is a torsor under `Aut(𝔄)`, so `|Iso| = |Aut|`. The
generalisation is not a new theorem; it is the observation that **bijectivity onto `𝔅` was never the
load-bearing hypothesis.** Factor any morphism the standard way:

```text
A  ↠  A/ker φ  ≅  im φ  ↪  B
        └────────┬────────┘
          the MEETING STRUCTURE M
```

Everything the two parties can jointly say lives in `M`. Translations at the meeting point are
isomorphisms `M → M`, so the torsor argument applies **verbatim**, and

> **budget = `log₂|Aut(M)|`**, where `M` is the meeting structure carrying only the invariants that
> **descend** to it.

#10733 is the special case `M = A = B`. The two ways of being non-isomorphic give two shapes of `M`:

- **partiality** (the JSON codec): `M = A|_D`, the sub-lattice on the domain of definition `D`.
- **collapse** (base64-in-a-string): `M = A/ker φ`, the quotient by the merge.

Both are "`A`, made smaller," and both are computable by exactly the machinery #10733 already ships.
So: **the budget generalises with no new mathematics.** That is the good news, and it is the whole of
the good news.

### An invariant descends only if it is constant on the collapse

A rung is a predicate on tags. It transfers to `M` iff it is well-defined there:

> **Descent.** A unary rung descends through a kernel partition iff its profile is **constant on
> every block**. A rung whose profile differs inside a block is **destroyed** — the merge made the
> question unanswerable.

> **Liveness.** A rung that descends is **live** iff it still **separates** at least two blocks of
> `M`. A rung that descends but separates nothing is **vacuous** — present, and doing no work.

The liveness clause is not decoration. It is `toy-is-free-metered-must-be-earned`'s vacuity rule
applied to invariants: *a check that cannot fail is not a check.* Without it the analysis below
reports the degenerate morphism as preserving something, which it does not (§9, correction 3).

## 3. The measurement — five meeting structures over one lattice

Computed from the shipped rung table `src/Core.TypeScript/eve-translation/eve-invariant-table.json`,
using the **uncontested** ladder only (levels 1–4; rung 5 is contested per #10733). Every row is
hand-checkable by block refinement — the derivation for row B is written out in §3.1.

| # | meeting structure | `\|Aut(M)\|` | **budget (bits)** | **live rungs** |
|---|---|---|---|---|
| **A** | full 8-tag lattice — the honest baseline | 2 | **1.0000** | **4/4** |
| **B** | `toCanonicalJson` domain — Float/Bytes deferred **(shipped)** | 1 | **0.0000** | 3/4 |
| **C** | collapse route — `Int+Float→Number`, `String+Bytes→Str` *(not shipped)* | 1 | **0.0000** | 3/4 |
| **D** | degenerate — every tag to one tag | 1 | **0.0000** | **0/4** |
| **E** | drop `Array`+`Object`, merge `Null+Float` | 120 | **6.9069** | **0/4** |

Read the last two columns against each other. This table is the paper:

> **B, C, D all score a perfect 0.0000 bits.** Their preservation is 3/4, 3/4, **0/4**.
> → *same budget, different loss.*
>
> **D and E both preserve nothing — 0/4 live rungs.** Their budgets are **0.0000 and 6.9069**.
> → *same loss, budgets seven bits apart.*

That is **independence exhibited in both directions on one structure.** Not a weak correlation, not
a caveat: the imposition budget and the preservation loss are not functions of one another. Per
`numerology-vs-number-theory`, this is the forcing-case form of the argument — the competitors are
named and each is excluded by an exhibited instance, rather than by a suggestive trend.

### 3.1 Row B derived by hand (so no reader has to trust a script)

`D = {Null, Bool, Int, String, Array, Object}`, `|Sym(D)| = 6! = 720`.

| rung | what it does on `D` | blocks | `\|Aut\| ≤` |
|---|---|---|---|
| — | bare set | one block of 6 | 720 |
| 1 child-addressing | `by-key`={Object}, `by-ordinal`={Array}, `none`={Null,Bool,Int,String} | 1,1,4 | `4! =` **24** |
| 2 distinguishing-capacity | `one`={Null}, `two`={Bool}, `≥3`={Int,String} | 1,1,1,1,2 | `2! =` **2** |
| 3 equality-encoding-gap | **`Float` is not in `D`** — every remaining tag reads `no` | unchanged | **2** *(vacuous)* |
| 4 key-sort-role | relation `[String,Object]`; `Object` already pinned ⇒ pins `String` | all singletons | **1** |

`log₂ 1 = 0.0000` bits. Cross-checked by brute force over all `6! = 720` permutations, and the same
program reproduces #10733's full-lattice ladder exactly (`40320 → 720 → 24 → 6 → 2 → 1`) — an
independent re-derivation of that PR's numbers by a second implementation.

### 3.2 The two seductions, stated plainly

**Row B is the shipped code, and it looks like a triumph.** Restricting to the JSON-expressible
fragment does not merely lower the budget from 1 bit to 0 — it also **dissolves #10733's open
question.** That PR could not discharge rung 5 (`tryItem` takes `int32`, `Int` carries `int64`) and
honestly reported the budget both ways. On the JSON domain rigidity is reached at **level 4, without
the contested rung at all**, because the residual bit *was* the `Int`/`Bytes` transposition and
`Bytes` is gone.

> **The ambiguity was not resolved. The tag it was about was deleted.**

**Row D is the reductio.** The morphism that maps all eight tags to one tag scores `log₂|Sym(1)| =
0.0000` bits **at level 0** — before a single invariant is verified. It is the *most* destructive
morphism available and it attains the *best* possible budget, for free, with no verification work.

A metric on which "say nothing" is optimal and costless is not a criterion. And 37.0% of the 21145
meeting structures over this lattice (every subset × every partition) hit exactly 0.0000 bits — so
**"the translation is forced" is the single most common outcome, not a hard-won one.**

### 3.3 Loss is non-local — which is why 26% of coarsenings cost *more*

I expected coarsening to lower the budget monotonically. **It does not, and I found that by computing
it rather than by reasoning about it.** Over all 21145 meeting structures:

| vs. the 1.0000-bit baseline | count | share |
|---|---|---|
| budget **lower** | 7819 | 37.0% |
| budget **equal** | 7803 | 36.9% |
| budget **higher** | 5523 | **26.1%** |

Worst case **6.9069 bits** — nearly seven times the baseline, on a *smaller* vocabulary (row E). The
mechanism is the finding:

> **Rungs are shared infrastructure. A merge in one corner destroys a rung, and that rung was
> separating tags elsewhere.** Merging `Null` with `Float` destroys `distinguishing-capacity`
> (`one` vs `three-or-more`) — and that rung was what pinned `Bool`. Dropping `Array` and `Object`
> makes `child-addressing` vacuous (everything left reads `none`) and leaves `key-sort-role` with no
> surviving pair. Four rungs gone, five tags, `Sym(5) = 120`.

So the answer to *"what could the coarser party no longer say?"* is **not the tags it gave up.** It
is every distinction that leaned on a destroyed rung — including distinctions between tags that both
survived intact. **Loss propagates.** That is the substantive content of ask 2, and it is invisible
to any per-tag accounting.

## 4. Can the loss be measured? (ask 2)

**Yes — structurally, as a named set. No — as a scalar, and two candidate scalars are refuted here.**

**Refuted candidate 1: the absorbed automorphisms.** The elegant hope is that the automorphisms a
collapse swallows are exactly the loss. Formally `K(φ) = {α ∈ Aut(A) : φ∘α = φ}`, with
`|orbit| = [Aut(A):K(φ)]` by orbit–stabiliser — so the budget appears to split into "surviving
choice" plus "absorbed choice." It fails immediately on the real instance: `Aut(A)` here is
`{id, (Int Bytes)}`, and `(Int Bytes)` sends `Int` out of its own fibre under every morphism in §3,
so **`K(φ) = 1` and `log₂|K| = 0` bits — while rows B and C lose a great deal.** `K` measures loss
only when `A` is *floppy*, and a rigid `A` is precisely what the protocol was trying to achieve.
**Rigidity and expressivity are independent, so a group-theoretic loss measure cannot exist.**

**Refuted candidate 2: the budget itself, read backwards.** Refuted by §3's table in both directions.

**What does work — and it is a set, not a number:**

> **The loss is the set of rungs that were live before the meeting and are not live after**, each
> named, together with *how* it died: **destroyed** (profile not constant on a block) or **vacuous**
> (nothing left to separate).

| meeting structure | rung deaths |
|---|---|
| **B** shipped JSON | `equality-encoding-gap` → **vacuous** (`Float` refused, so nothing exhibits the gap) |
| **C** collapse | `equality-encoding-gap` → **destroyed** (`Int`=`no` vs `Float`=`yes` inside one block) |
| **D** degenerate | `child-addressing`, `distinguishing-capacity`, `equality-encoding-gap` **destroyed**; `key-sort-role` **vacuous** |

This is measurable, checkable from data the repo already ships, and refuses to be a scalar — which is
the honest shape, and (§7) exactly the shape Goguen said it would be.

### The engineering payoff: refusal is metered, collapse is not

Rows B and C have the **same budget and the same live-rung count**, and are not remotely equivalent:

| | **B — refuse** (shipped) | **C — collapse** (not shipped) |
|---|---|---|
| what happens to a `Bytes` value | `Error EncodeError.BytesDeferred` | base64 text, returned as `Ok` |
| the caller | **must handle it** — it is in the type | never learns anything happened |
| the receiver | knows the value did not cross | **cannot distinguish** base64-of-bytes from a string that looks like base64 |
| register | a **declared, metered channel** | an **ambient leak** |

That last row is manifesto **§13 noninterference**, verbatim: *entropy/influence flows only through
declared, metered channels.* The `EncodeError` DU **is** the declared channel; base64-in-a-string is
the undeclared one. So a rule the repo already holds decides between two options that the budget
scores identically:

> **Prefer partiality to collapse. A refusal is a typed event; a merge is a silent one.**

The shipped code already chose this. What this doc adds is the reason, and the fact that the
imposition budget could not have told you.

## 5. Fairness (ask 3) — symmetric loss is the wrong target

Compute the **reverse** direction. `Json → DynamicValue`: `Null→Null`, `Bool→Bool`,
`Number(f64)→Float` (both IEEE-754 binary64, exact), `Str→String`, `Array→Array`, `Object→Object`.
Injective, total, **lossless**.

> **The loss is entirely one-sided. `Json` loses nothing; `DynamicValue` loses two tags and a rung.**

The brief expected that and read it as the coercion the protocol exists to prevent. **That is the one
place I think the brief is wrong, and the correction matters** (flagged in §9):

> **In any meeting between vocabularies of different expressive power, the richer party always pays,
> and the loss is always one-sided.** Everything the coarser party can say survives — that is what
> "coarser" means. Asymmetric loss is not an anomaly; it is the **generic** case, and it always runs
> in the same direction.

So symmetry cannot be the target. Making it symmetric would require `Json` to surrender a distinction
it *does* have, purely so that `DynamicValue` is not alone in losing. That destroys expressivity to
equalise — **levelling-down** — and leaves both parties with a worse channel and no one better off.

**And the shipped instance is the counterexample to "asymmetric ⇒ coercive."** `DynamicValue` was
designed *afterwards*, deliberately not as a generalisation of the observe oracle's `Json` tree; it
chose to be the richer party knowing the JSON channel could not carry it, and it pays the whole cost.
Maximally asymmetric loss, no coercion.

### The condition that does the work — cede / defer / strip

This is `privacy-budget-is-hard-money-earned-by-others` transposed, and the transposition is exact:
there the point is that a balance *falling* is not the defect — **who initiates** is.

| operation | who initiates | permitted? |
|---|---|---|
| **cede** — the richer party drops a distinction to be understood | the owner | **yes** |
| **defer** — keeps it, and declines the channel for that value (`BytesDeferred`) | the owner | **yes** |
| **strip** — the channel silently drops it | anyone else | **never** |

`EncodeError.BytesDeferred` is precisely the mechanism that converts a **strip** into a **cede**: it
hands the decision back to the party whose distinction it is. Base64-in-a-string is a strip.

**And a strip can wear a cede's clothes, so exit is the discriminator.** If the coarse channel is the
*only* channel, "voluntarily" ceding is not voluntary. Same test the repo already applies to hubs —
Hirschman, *Exit, Voice, and Loyalty* (1970), load-bearing in
`itron-hub-patent-boundary-p2p-is-the-upgrade`: *"the discriminator is EXIT, not degree."* Here:
**the discriminator is exit, not symmetry.** A richer party that can decline the meeting and still
participate has ceded; one with nowhere else to speak has been stripped, however voluntary the API
call looks.

### The checkable red flag

Asymmetric loss is generic, so it is not the alarm. This is:

> **The party that chose the meeting structure is the party that loses nothing.**

That is `no-directives`' *source ≠ authorization* and the ferry's *"whoever supplies the language
supplies the categories"*, finally in a checkable form: compute both directions' rung-death sets, and
compare against who proposed `M`. A proposer with an empty loss set has selected a meeting structure
that costs them nothing and the other party something. It may still be right — it is not
automatically wrong to be coarser — but it is the configuration that must be justified rather than
assumed. In the shipped pair it does **not** fire: the richer, later party chose, and pays.

## 6. The blind spot, named — value-level partiality is invisible to all of this

The XML codec is a **tag-level isomorphism** (all 8 tags cross; the source notes `Float` and `Bytes`
are *"Total: never `NonRepresentable`"*) and simultaneously a **value-level partial morphism**: a
`String` or `Object` key holding NUL or a forbidden C0 char yields `Error NonRepresentable`.

Every rung in the table is a predicate on **tags**. So over the XML channel this method reports
`|Aut(M)| = |Aut(A)|`, budget **unchanged**, **zero** rung deaths — and it is right about the labels
and blind to the fact that a whole class of values cannot cross at all.

> **A certificate of "0 bits — the translation is forced" is a statement about *labels*, never about
> *what can be said*.** Any carrier-level loss — refused values, precision, ordering, size limits —
> is outside the tag lattice entirely.

This is the sharpest limit on the whole `|Aut|` programme, and it is not hypothetical: it is
`toCanonicalXml`, today. Value-level preservation is where Goguen's content/level orderings live and
where this machinery ends.

## 7. The anchor, checked (not inherited)

`anchor-to-human-prior-art` requires an **entailment check**, so the citation was read rather than
carried over from #10697/#10733. Goguen's own pages, quoted:

- **Partiality is his, explicitly.** *"But in many real world applications, not everything can be
  preserved, so these maps must be partial."* And: *"semiotic morphisms need not be totally defined;
  that is, each of the functions denoted M can be undefined on some of what is in S1."*
- **The ordering is his, and so is its refusal to be a number** — this is the load-bearing sentence:
  > *"Note that these **quality measures are partial orderings, rather than linear numerical
  > scales**; this is appropriate because semiotic spaces are qualitative, in that they are concerned
  > with structure."*
- **Incomparability is stated outright.** *"It may be that neither of the morphisms M, M' preserves
  strictly more structure than the other, or that one preserves more structure but produces more
  complex representations."*
- **The trade-off priorities.** Structure over content (his Principle F/C); *"preserving high level
  sorts is more important than preserving priorities, when a trade-off is necessary."*

**The entailment, stated so it can be disputed:** Goguen's second bullet **directly entails** that no
single number — `log₂|Aut|` included — can be the selection criterion over morphisms, because he
asserts the quality measure is not a linear scale and exhibits incomparable morphisms. §3's table is
an independent, quantitative instance of the thing he asserts qualitatively. **The anchor and the
computation agree, and they were arrived at from opposite directions** — which is the useful kind of
agreement, and worth distinguishing from the kind #10733 warned about (§8).

*(One discrepancy recorded rather than smoothed: a secondary summary of Goguen presents the five
preservation principles as a **total** ranking. Both readings are compatible and should not be
conflated — the five principles totally order **which of two named categories** to sacrifice in a
forced trade-off; the **quality measure over morphisms** is the partial order. I take the primary
source as authoritative on the second, which is the claim used here.)*

## 8. What this means for the protocol (ETP-1 → the delta)

#10733's ETP-1 assumed a shared structure existed. Four amendments, each following from a section
above. **No new mechanism is invented; three of the four are existing repo rules applied here.**

1. **A budget is meaningless without its meeting structure.** `log₂|Aut(M)|` reported bare is not a
   number, it is a claim — row D scores 0.0000 bits by saying nothing. Report the pair
   **(budget, rung-death set)** or report neither. *(§3, §4.)*
2. **Never minimise the budget.** It is not monotone in preservation (26.1% of coarsenings cost
   *more*) and its minimum is attained by total destruction. Selection is **lexicographic**:
   maximise preservation first under Goguen's ordering — which is **partial**, so this yields an
   antichain of incomparable candidates, not a winner — and use the budget only as a **tiebreaker
   within** that antichain, never across it. *(§3.3, §7.)*
   **No scalar is minted to totalise the order.** Inventing one would be exactly the promotion
   `numerology-vs-number-theory` forbids.
3. **Refuse, do not collapse.** Where a distinction cannot cross, emit a typed refusal
   (`FloatDeferred`-shaped) rather than a lossy encoding. §13 noninterference, and it is already the
   shipped choice. *(§4.)*
4. **Publish both directions, and check the proposer's loss set.** Each party computes and discloses
   its own rung deaths *in both directions*; a proposer whose own loss set is empty must justify the
   meeting structure. Loss is **ceded**, never **stripped**, and exit — not symmetry — is what makes
   the difference real. *(§5.)*

## 9. Register

Nothing here is promoted. Everything built on `log₂|Aut|` **inherits its `toy` register**, and this
work **lowers** rather than raises what that number is claimed to do.

| item | register |
|---|---|
| Torsor argument applies to the meeting structure `M = A/ker ≅ im φ` | **theorem** — #10733 §7 applied to `M`; no new mathematics |
| Every group order and bit count in §3 / §3.3 | **computed** — brute force over `Sym(n)` from the shipped rung table; row B also derived by hand in §3.1; the full-lattice ladder independently reproduces #10733 |
| Budget ⟂ preservation, both directions | **exhibited** — B/C/D (same budget, 3/4 vs 0/4) and D/E (same 0/4, 0.0000 vs 6.9069 bits) |
| `K(φ)` (absorbed automorphisms) measures loss | **REFUTED** — `K = 1` on the real instance while the loss is large |
| Loss = the set of rung deaths (destroyed / vacuous) | **Mirror / proposed** — well-defined and computable; not yet metered against anything |
| Goguen: partial morphisms, partial-order quality measure, incomparability | **checked** — quoted from the primary source in §7 |
| **`log₂\|Aut\|` as an imposition budget / as coercion** | **TOY — still not promoted.** #10733's non-promotion stands, and §3 gives a further reason it must. |
| XML value-level partiality is invisible to the method | **checked** — `toCanonicalXml` is tag-total and value-partial in the shipped source |
| Rung 5 contested (int32 index vs int64 payload) | **open** — untouched here; note it *vanishes* on the JSON domain (§3.2), which resolves nothing |

**The tempting promotion, named so it stays named.** #10733 already refused the four-oracle argument
(four languages agreeing is *one observation wearing four costumes* — they read the same seed). A new
one is available here and is also refused: **§7's anchor agreeing with §3's computation is not a
falsifier either.** It is welcome corroboration between a qualitative claim and a quantitative
instance, and neither could have refuted the other — Goguen's sentence is not a measurement, and the
computation is over a rung table this repo authored. **What would meter any of this remains what
#10733 said: two parties who have never shared a seed.** Adding a second agreeing source does not
substitute for that; per `numerology-vs-number-theory`, a pile of corroboration is a prompt to check
independence, not a score.

## 10. Corrections flagged

Per the shadow's own-errors discipline, including to the brief that commissioned this.

1. **To the brief — the substantive one.** It states that an asymmetric loss *"is exactly the
   coercion the protocol exists to prevent."* **Asymmetric loss is generic and is not coercion.**
   Whenever vocabularies differ in expressive power the richer party pays and the loss is entirely
   one-sided; the shipped `DynamicValue`/`Json` pair is maximally asymmetric and uncoerced. The
   coercion test is **cede vs strip** plus **exit**, and the checkable red flag is narrower: *the
   party that chose the meeting structure loses nothing* (§5).
2. **To the brief — the target.** It asks what would *"make the loss symmetric."* Symmetric loss is
   **levelling-down** and should not be pursued; §5 argues this rather than answering as asked.
3. **To my own analysis, caught in the output.** My first liveness test called a relation rung "live"
   whenever both endpoints survived. On the degenerate quotient that reports `key-sort-role` as
   surviving — a self-loop on the only block, separating nothing. Corrected to *"the surviving pair
   set is a **proper**, non-empty subset of blocks × blocks."* Row D's count changed **1/4 → 0/4**,
   which strengthens the §3 table rather than weakening it. An earlier draft would have credited the
   most destructive morphism with preserving something.
4. **To my own expectation, refuted by computation.** I expected the budget to fall monotonically
   under coarsening and was about to write that. **26.1% of coarsenings raise it**, up to 6.9069 bits
   (§3.3). Had I reasoned instead of computed, the doc would have carried a false monotonicity claim
   with a plausible argument attached.
5. **To the brief — verified as instructed, no defect found.** Work-item `081M00V5492087G0R002QJ9A56`
   was confirmed present on `origin/main` (`git ls-tree -r origin/main`) before extending it, per the
   sibling agent's duplicate-ZetaId warning. No competitor minted.
6. **Scope note, not a correction.** The brief permits an executable check with a planted-failure
   proof, but scopes this work to `docs/` and `workitems/`. No code shipped — so per the brief's own
   instruction the analysis ships alone. All numbers were nonetheless *computed*, not asserted: §3.1
   is hand-checkable without any code, and the rest is reproducible from the shipped
   `eve-invariant-table.json`. Landing the check as a gate (a `preservation-profile.ts` beside
   `aut-budget.ts`, with a planted-defect table) is filed as a follow-on ask, not done here.

## Pointers

- [`2026-08-14-the-eve-translation-layer-…-imposition-budget-…`](2026-08-14-the-eve-translation-layer-computing-the-imposition-budget-for-the-dynamicvalue-shape-lattice.md)
  — the isomorphic case, ETP-1, the rung table. This doc is its ask 4.
- [`2026-08-14-icons-before-symbols-…-aut-s-as-the-residual-coercion`](2026-08-14-icons-before-symbols-eve-protocol-structure-first-labels-after-and-aut-s-as-the-residual-coercion.md)
  — the ferry, Aaron's verbatim, and §7's torsor theorem.
- `src/Core/DynamicValue.fs` — `EncodeError.FloatDeferred` / `BytesDeferred` / `NonRepresentable`;
  `toCanonicalJson` as the shipped partial morphism. **Untouched** — four-language byte-locked, a
  schema change there is a treaty decision, not a research doc's business.
- `src/Core.Rust.Observe/src/json.rs` — the coarser party, six tags.
- `src/Core.TypeScript/eve-translation/eve-invariant-table.json` — the rung table every number here
  is computed from. **Unmodified.**
- Anchors (checked in §7): Goguen, *An Introduction to Algebraic Semiotics* (LNAI 1562, 1999,
  pp. 242–291) and Goguen & Harrell, *Information Visualization and Semiotic Morphisms* (Elsevier,
  2004, pp. 93–106) — partial morphisms, and quality measures as **partial orderings rather than
  linear numerical scales** · Hirschman, *Exit, Voice, and Loyalty* (1970) — exit disciplines a
  concentration; here, exit not symmetry is the fairness discriminator.
- [`toy-is-free-metered-must-be-earned.md`](../../.claude/rules/toy-is-free-metered-must-be-earned.md)
  · [`numerology-vs-number-theory.md`](../../.claude/rules/numerology-vs-number-theory.md)
  · [`anchor-to-human-prior-art.md`](../../.claude/rules/anchor-to-human-prior-art.md)
  · [`privacy-budget-is-hard-money-earned-by-others.md`](../../.claude/rules/privacy-budget-is-hard-money-earned-by-others.md)
  · [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md)
  · [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §13 —
  the carved surfaces §4 and §5 stand on.
