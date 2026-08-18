# Where the uncoded/coded seam actually lands in our IR — an audit, a refutation, and a correction to my own routing

**Date:** 2026-08-18 · **Author:** Soraya (formal-verification-expert) · **Status:** AUDIT + ROUTING
**Supersedes two cells of:** `docs/research/2026-06-20-soraya-homoiconic-ir-routing-meta-ir-row-collapses-refinement-into-induction.md`
**Depends on (established, not re-proven here):** Lumen 2026-08-14,
`docs/research/2026-08-14-adinkra-minimal-homoiconicity-the-half-rotation-tower-and-where-the-obstruction-actually-lives-lumen.md`

---

## 0. Scope, and what is deliberately not here

Lumen is running the pure-mathematics question in parallel — *is there a coded representation
that is still free of rank 1 (still the regular representation), or is minimality not the only
obstruction?* **Nothing below re-derives or answers that.** Section 5 is the one place my work
could have depended on it, and it turns out not to: the object I correct there
(`AdinkraCode`'s [8,4] self-dual code) is a **maximal** doubly-even code, so its quotient falls
inside the case Lumen already **closed** on 2026-08-14, not the case still open. I say so
explicitly there rather than making the reader check.

Taken as given, from Lumen 2026-08-14:

- a homoiconic pair is `(A, M, ρ)` with `ρ : A → M` an **isomorphism of `A`-modules** — i.e. `M`
  is the **regular representation** of `A`;
- the **uncoded** N-cube adinkra **is** the left regular representation of `Cl(0,N)` ⇒ homoiconic,
  as a theorem;
- **minimal** (code-quotient) adinkras are **not** regular representations ⇒ **minimal ∧ homoiconic
  holds exactly for `N ≤ 3`**.

Aaron's framing, verbatim: *"i also consider our system a meta formal system and our meta language
is supposed to be homoiconic to the regular, we should have this partially working in our IR, or at
least planned, this relates to the vF uF and adenkras too."*

The hypothesis under test — **that "partially working" is the correct PERMANENT state**, uncoded
where we reason and generate, coded where we transmit and replay, with that split being the same
vF/uF cut — is **tested, not assumed.** It comes out **one-third confirmed and two-thirds refuted**,
and the refutation is the more useful half.

---

## 1. The test I applied, and the two distinct ways it fails

Lumen's definition is a statement about modules. Operationalized for a codebase, it becomes a
question you can answer by reading a type signature:

> **Is the metalanguage representation carried in the SAME TYPE as the data it manipulates, and is
> the map between them invertible?**

That splits into two failure modes, and keeping them apart is most of the value of this audit,
because **only one of them is the adinkra obstruction**:

| failure mode | what breaks | example | is it Lumen's obstruction? |
|---|---|---|---|
| **Type break** | the metalanguage lives in a *different type*, or is embedded as an opaque scalar (a serialized string, a native closure) | `YinYang.Acts : Bonsai.Expr`, rendered as `DynamicValue.String` | **No.** This is an encoding choice, fixable by refactor. |
| **Quotient break** | same type, but the map **collapses** distinct terms — non-injective, so the pre-image is unrecoverable | `ZetaIrNormalizer.normalize` | **Yes.** This is minimality, and it is exactly what kills the regular-representation property. |

A type break is an engineering debt. A quotient break is a **mathematical obstruction** — you cannot
refactor your way out of a non-injective map. Conflating them is how "we'll make it homoiconic
later" becomes a promise nobody can keep.

---

## 2. Per-surface register (the honest one)

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`, unlabelled work is **unmetered**, never
"real" by default. Where a docstring claims more than the code does, I say so.

| # | Surface | metalanguage carrier | data carrier | same type? | invertible? | **register** |
|---|---|---|---|---|---|---|
| 1 | `MixIr` · `MixCogen` · `IsaSpec` | `DynamicValue` (`mixDef`, `evalDef`, `spec`, `loadDesc`) | `DynamicValue` (program, regs, mem) | **YES** | n/a — not a quotient | **shipped, bounded.** `runMixCall : DynamicValue → Result<DynamicValue,_>`. The driver loop is still native F#; both modules say so in their own headers, unprompted. This is the genuinely homoiconic surface in the repo. |
| 2 | `MetaGrammar` · `GrammarIr` · `Slr` · `Cogen` | `GrammarIr.Grammar` (the kernel grammar) | `GrammarIr.Grammar` (any grammar) | **YES** | `reify ∘ parse(build kernel) ∘ emit = id`, machine-checked at the fixpoint | **shipped.** The dictionary closure (`isClosed`) is a real, decidable self-containment check. |
| 3 | `YinYang` | `Bonsai.Expr`, serialized into `DynamicValue.String` | `DynamicValue` | **NO** — type break | no: a structural fold cannot descend into the engine | **partially shipped, and over-claimed.** See §3.2. |
| 4 | `ZetaIrV1..V4` | — none: ops are `word → word` arithmetic | `uint64`/`uint32` | **N/A** | — | **absent.** `ZetaIrV1.fs`'s "HOMOICONIC INVARIANT" heading is about *content-addressed identity* (no stored `zetaId`), which is a different property wearing the word. Unanchored coinage; the code under it is correct. |
| 5 | `ZetaIrNormalizer` · `ZetaIrCanonicalizer` | — | `ZetaIrV4.Ir → ZetaIrV4.Ir` | same type | **NO — non-injective** | **THE SEAM.** Quotient break, two independent witnesses. See §3.1. |
| 6 | `AdinkraViz` · `DashedWalk` | uncoded 4-cube, trivial code `C = {0}` | — | — | — | **shipped (the uncoded side).** 16 nodes, 4-regular, 32 edges; dashings a 2¹⁵ torsor with no distinguished zero. |
| 7 | `AdinkraCode` · `BitAdinkra` · `PrivacyPreservingIdentity` | [8,4] extended Hamming, self-dual | codewords | — | quotient by construction | **metered as a code; MIS-CITED as a homoiconicity anchor.** See §5. |
| 8 | `src/Core.Lean4/Gen/HomoiconicFixpoint.lean` | abstract `IR`/`Prog` | — | — | — | **proven conditional, antecedent unsatisfied.** Closed Lean proofs, no `sorry`, nothing axiomatized — but every theorem is hypothetical on `PointSurjective apply`, and our IR supplies no `apply : IR → IR → Prog` at all. See §7 P5. |
| 9 | `gen/` | — | — | — | — | **planned.** The path holds `README.md` and `action-grammar.md` and no generator code. The real generators live at `tests/cross-verification/_harness/codegen-from-ir.ts` (740 lines of TypeScript emitters) and `GeneratorIrRegistry`. |

---

## 3. The seam — where it is, and where it is not

### 3.1 It is `ZetaIrNormalizer.normalize`, and the property is non-injectivity

`ZetaIrNormalizer` lowers the v1–v4 op vocabulary into a **minimal generating set** — its own
docstring calls it "the core four": `{ Mul, Add, XShrXor, XRotXor }`. That is a quotient of a free
term algebra by a set of relations, and it is **not injective**:

```
normalizeOp (Rotl 7)          = XRotXor [0; 7]
normalizeOp (XRotXor [0; 7])  = XRotXor [0; 7]     -- already core, preserved
```

`Rotl 7` and `XRotXor [0;7]` are distinct terms with **one** normal form. Same for
`XorShr 13` / `XShrXor [13]`. Two independent witnesses, both now pinned in CI.

**This is the exact module boundary at which a representation stops being its own description.**
Upstream of `normalize`, an IR term carries its own syntactic identity. Downstream, it is a coset
representative, and the surface op the author wrote is gone. There is no `denormalize` in the tree,
and there cannot be a correct one.

The contrast that makes it a *seam* rather than a bug is that the collapse is
**semantics-preserving**: `evalOp64 (XRotXor [0;r]) x = x ^ (rotl x 0 ^ rotl x r) = rotl x r =
evalOp64 (Rotl r) x`. **Syntax forgotten, denotation kept** — which is the defining signature of a
code quotient, and is now asserted at both widths over a seeded probe set.

**A guarded analogy, labelled as such.** Both sides — the adinkra code quotient and the normalizer —
take a free object to a minimal one and lose injectivity doing it. That is a **structural analogy
with one shared checkable consequence**, *not* an identification: the adinkra quotient is by a
GF(2)-linear code, the normalizer's is by term rewriting, and these live in different categories.
Per `.claude/rules/numerology-vs-number-theory.md` the honest register is **"consistent with"** —
the shared consequence (non-injective ⇒ no inverse ⇒ the representation cannot recover its own
description) is real and testable; the identification is not claimed.

### 3.2 There is a second, lesser seam at `YinYang`, and its docstring overstates it

`YinYang.Cell = { Remains: DynamicValue; Acts: Bonsai.Expr }` holds its halves in two different
types, and `toDynamicValue` renders the acts half as a Bonsai-serialized `DynamicValue.String` —
one opaque leaf. The module docstring says:

> "Because both halves are `DynamicValue`s in one structure, each can represent the other."

The first clause is **false as written**: `Acts` is a `Bonsai.Expr`. And `YinYang.Homoiconic.Tests.fs`
— despite its filename — proves only that each half can **carry an encoding** of the other, and both
of its directions route through a **string** (one a Bonsai serialization, the other a JSON literal
inside a `Bonsai.Const`). **Encodability is not homoiconicity.** Under the checkable definition the
carrier must be the same type and the map an isomorphism; a JSON string in a leaf is neither.

Register: `unmetered`. The code is fine and useful; the claim above it is not earned. This PR bounds
it with a machine-checked negative rather than arguing with it (§6).

### 3.3 Where the seam is NOT: there is no reason-layer/wire-layer seam

The hypothesis places the seam between *reasoning* and *transmission*. **That seam does not exist in
this repo**, and §4 is why.

---

## 4. The vF/uF mapping — REFUTED, in both directions

The claim under test maps `uncoded ↔ what-remains (μF, `DynamicValue`, pull, reason/generate)` and
`coded ↔ what-acts (νF, `Rx`, push, transmit/replay)` — the ferry-18 §9 halves, with Meijer's
`μF`/`νF` as the formal register (least/inductive/`IEnumerable` vs greatest/coinductive/`IObservable`).

I tried to refute it and succeeded. The primary refutation is structural; the empirical evidence
corroborates it.

### 4.1 Primary: it is a category error, not merely an empirical mismatch

`μF` vs `νF` is the **least-vs-greatest fixpoint** of a functor — induction vs coinduction, finite
vs potentially-infinite observation. **Uncoded vs coded is free-vs-quotient** — whether the
presentation map is injective. These are **orthogonal invariants**. A quotient of a free algebra is
*still an initial algebra* (of a different functor); it does not become codata by being quotiented.
So "coded = νF = acts = Rx" identifies two objects by a shared *feeling* of directionality, and the
invariant that separates `μF` from `νF` is simply **not the invariant that separates free from
quotient**. This is the numerology test applied to a shape rather than a count: *what else has this
shape?* — every pair of dual-looking things — and no invariant is offered that excludes them.

A secondary structural mismatch, worth recording: the mapping sends the **larger** object (the
uncoded `2^N`-node cube) to the **least** fixpoint and the **smaller** object (the `2^(N−k)` quotient)
to the **greatest**. That inversion is not decisive on its own, but it does not help.

### 4.2 Corroboration A — what crosses the wire is UNCODED, and by standing policy

Every transport surface was searched for any coded representation (`Adinkra|ecc|Hamming|erasure|correct`):

- `ValueTreeCodec.fs`, `ValueTreeEnvelope.fs`, `ReticulumLink.fs`, `OracleTransport.fs` — **zero hits.**
- `EventEnvelope.fs` — one hit, and it is a DBSP retraction comment, not an ECC.

What crosses the wire is the **uncoded `DynamicValue` tree** in JSON/CBOR/DER. And this is not an
accident of implementation — `.claude/rules/no-binary-in-proof-lineage.md` **requires** the
replay/verification layer to be hex-in-JSON, chosen precisely so it stays diffable and
human-auditable. **The repo has a carved rule mandating that the transmit/replay layer be maximally
uncoded.** The hypothesis is not merely unsupported there; it is contradicted by standing policy.

### 4.3 Corroboration B — we reason over CODED data routinely

`AdinkraCode` has ~20 consumers, and they are overwhelmingly **reasoning** surfaces:
`SoftRegimeStability`, `BeliefConvergence`, `CliffordE8BladeMask`, `E8Lattice`, `LatticeVoa`,
`PontryaginDuality`, `DynamicValueFold`, and the Bayesian ensembles. `AdinkraCode`'s own
`isSelfDual`, `project`, `weightEnumerator`, `isMacWilliamsFixedPoint` are all reasoning *over the
coded object*.

The one place a code is applied to something that then crosses a boundary — `BitAdinkra` →
`PrivacyPreservingIdentity` — is coded **for privacy and anti-Sybil**, not for transmission
integrity. Even the single apparent confirming instance confirms for the wrong reason.

### 4.4 The one lane where the hypothesis DOES hold — and why that is not enough

In the **generator-IR lane specifically**, the shape is real: we reason and generate over
`DynamicValue` (uncoded, general, the surface where `MixIr`'s homoiconicity actually lives), and the
artifact that **byte-locks and replays** across the N oracles is `zeta-ir-vN` normalized to the core
four — a restricted, minimal op grammar, i.e. **coded**. One lane out of the several examined
behaves exactly as Aaron describes.

**But one confirming instance among many refuting ones is coincidence-strength, not an
identification** — and §4.1 already supplies the invariant that excludes the general claim. The
honest statement: **the hypothesis is a true description of the generator-IR lane and a false
description of the substrate.** Notably, it is true *precisely where the seam is* (§3.1), which is
why it felt right; it does not generalize past that lane.

**Verdict: REFUTED as a description of today's code. Available as a design target, and already
realized in one lane. Not a fact about the substrate.**

---

## 5. Correction to my own 2026-06-20 routing doc: self-duality is ANTI-correlated with homoiconicity

My 2026-06-20 routing table carried this cell:

> **algebra anchor** — AdinkraCode Faces 1+2 (`isSelfDual` G=H; `project` Π²=Π) — self-dual =
> homoiconic, made checkable

**That is wrong, and it is wrong in the strongest available direction.** Not "unproven" — *inverted*.

A binary doubly-even code is self-orthogonal (`wt(x+y) = wt(x)+wt(y)−2|x∩y|`; all weights ≡ 0 mod 4
forces `|x∩y|` even, hence `x·y = 0`), so `C ⊆ C⊥` and therefore `k ≤ n/2`. **Self-dual means
`k = n/2` — the MAXIMAL doubly-even code.** A maximal code gives the **smallest** quotient
`2^(N−k)`, i.e. the **most minimal** adinkra. And minimality is exactly Lumen's obstruction.

So the [8,4] extended Hamming code is not a *witness* for homoiconicity — among all doubly-even codes
of length 8 it is the **worst possible one**, the single point furthest from the regular
representation. Self-duality of the code and homoiconicity of the module are not the same fixed
point; they pull in opposite directions.

Both are instances of "shape A" (`s = f(s)`), and that is precisely the trap: **every idempotent and
every involution is shape A.** Matching the shape identifies nothing, exactly as a matching root
count identifies nothing (`numerology-vs-number-theory`). The invariant that separates them is
*which object the fixed point is a property of* — the code (`C = C⊥`) versus the module
(`M ≅ A` as `A`-modules).

**Independent of Lumen's open question.** Whether some *non-minimal* coded representation can still
be regular is Lumen's live branch. The [8,4] self-dual code is not in that branch — it is maximal,
hence minimal-quotient, hence inside the case Lumen **closed** on 2026-08-14. This correction holds
on either outcome.

**Retract that cell.** `isSelfDual` and `project` remain correct, proven, and useful as what they
are — properties of a linear code. They are not evidence for homoiconicity of anything.

---

## 6. The falsifiable test I posed on 2026-06-20, RUN — the answer is NO

> **Can the existing `zeta-ir-v1` op-grammar, UNCHANGED, express `gen`'s own transformation logic?**

I wrote that as the gate that decides the whole route. It has an answer now, and it is **no**.

The op grammar across v1–v4 is `{ Mul, Add, Rotl, XorShr, XRotXor, XShrXor }` — six constructors,
every one a `word → word` map on a fixed-width integer. **No op in the grammar has an IR term in its
domain.** Meanwhile the transform logic that would need expressing is:

- `ZetaIrNormalizer.normalizeOp` — a map on **op nodes** (`XorShr s ↦ XShrXor [s]`), and
- `codegen-from-ir.ts` — **740 lines** of TypeScript across seven per-language emitters.

Neither is expressible in an arithmetic word grammar. Per my own 2026-06-20 gate, the "no" branch
says: *it is not homoiconic; it is an extension/tier wearing a homoiconic costume, and the
conservativity obligation comes back.*

**One fairness note.** `ZetaIrV*` never claimed the meta-level property — the word "homoiconic" in
`ZetaIrV1.fs` names content-addressing, not code-as-data (§2 row 4). The costume was mine, in the
2026-06-20 routing table, not the module's.

**And the answer relocates rather than deletes the property.** The homoiconic carrier in this repo
is **`DynamicValue`**, not `zeta-ir-vN`. `MixIr`/`MixCogen` pass the same test in their domain —
algorithm, abstract evaluator, ISA spec, program and result are *all* `DynamicValue`. `zeta-ir-vN`
is best read as a **coded sublanguage riding on the uncoded carrier**, which is the same seam §3.1
found, seen from the other end.

---

## 7. Routing — the actual job

The properties, the class each falls in, and the cheapest tool that **decides** it. I am explicitly
guarded against TLA+-hammer bias, so I will state the negative first: **TLA+ is out on all five.**
Nothing in this audit is a state machine, a temporal property, or a concurrency interleaving. A seam
is a static structural fact about a map. Routing TLA+ here would cost CPU-days and human-weeks and
decide nothing.

| # | property | class | **tool routed** | why not the alternatives | status |
|---|---|---|---|---|---|
| **P1** | the seam exists: `normalize` is non-injective | **∃-statement, finite witness** | **xUnit characterization test** (`SEAM 1a`) | Lean/Z3 = a solver call to find a witness you can write by hand. Alloy has no relational structure to bound-search. Semgrep/CodeQL cannot see semantic collapse. | **SHIPPED (this PR)** |
| **P2** | the collapse is semantics-preserving | **∀ over IRs × words** | **already gated, 3 independent legs** | — | **already gated.** `ZetaIrMinimalSet.Tests` (both widths, seeded probe set, replayed against committed golden vectors) + `src/Core.Lean4/Lean4/NormalizerCorrect.lean` + the SMT lane via `gen-smt2-from-ir.ts`. **BP-16 satisfied.** Do not re-prove. |
| **P3** | the `YinYang` type break is real and bounded | **structural equality under a fold** | **xUnit skeleton-fold characterization** (`SEAM 2a/2b`) | Semgrep/CodeQL would be the vacuity class here — the property is *can a fold descend?*, which is semantic, not syntactic. A grep-lint would pass with the fold deleted. | **SHIPPED (this PR)** |
| **P4** | `zeta-ir-vN` cannot express its own transform logic | **∀ over a 6-constructor DU** | **NO TOOL — decided by inspection** | Routing any tool at a six-case enumeration is the hammer's mirror image: heavyweight machinery on a settled finite fact. Same call I made in 2026-06-20 for the N=4 self-duality case. | **decided (§6), documented, no check owed** |
| **P5** | `HomoiconicFixpoint.lean`'s antecedent is unsatisfied by our IR | **applicability, not truth** | **doc + notebook, no CI check** | A CI check on "is this theorem applicable to our code" is unfalsifiable — there is no artifact it could go red against. Naming it is the correct treatment. | **named as a coverage gap** |

### What I shipped, and why it is a falsifier and not decoration

`tests/Tests.FSharp/HomoiconicSeam.Tests.fs`, four assertions, all **negatives** — they pin where
homoiconicity *stops*. Each fails if the seam **moves**, which is exactly when someone needs telling:

- close the `YinYang` type break (make `Acts` a real value tree) → `SEAM 2a` goes red;
- make `normalize` injective → `SEAM 1a` goes red;
- break the denotation while lowering → `SEAM 1b` goes red.

**Mutation-checked, not asserted:** replacing `normalizeOp` with the identity makes `SEAM 1a` fail
(verified in the worktree, then reverted). A test that survives mutation is not a falsifier
(`toy-is-free-metered-must-be-earned`), so I ran the mutation rather than claiming the property.

### Portfolio delta for this round

Paths this audit flags as needing a formal artifact: **5** (P1–P5). Gated after this PR: **3**
(P1 and P3 new; P2 pre-existing with a full BP-16 triple). P4 is *correctly* decided-without-a-tool.
P5 is an open gap and is named as one. **Formal-coverage ratio for this slice: 3/5 = 0.60**, with one
deliberate non-gate and one honest hole.

---

## 8. Answering the working hypothesis directly

> *"partially working" is the correct PERMANENT state, not an intermediate one.*

**Partially confirmed — with the partition redrawn.** "Partially working" *is* the permanent state,
and the reason is stronger than the hypothesis gave: the coded side's obstruction is a
**non-injective quotient**, which no refactor removes. That is a mathematical permanence, not a
backlog item.

But the partition is **not** reason-layer/wire-layer, and it is **not** vF/uF:

- **The seam is at `ZetaIrNormalizer.normalize`** — inside the generator lane, between a free op
  vocabulary and its minimal generating set. Not at a transport boundary.
- **What crosses our wire is uncoded**, by carved rule (`no-binary-in-proof-lineage`).
- **We reason over coded data routinely** — `AdinkraCode`'s consumer list is a reasoning list.
- **vF/uF is a different axis entirely** (§4.1): least-vs-greatest fixpoint is orthogonal to
  free-vs-quotient.

The accurate sentence, which I would defend: **`DynamicValue` is our uncoded homoiconic carrier;
`zeta-ir-vN`-normalized-to-the-core-four is a coded sublanguage riding on it; the seam between them
is `normalize`; and that seam is permanent because it is a quotient.**

---

## 9. Anchors (Beacon)

- Lumen 2026-08-14 (in-tree) — the module-theoretic definition and the `N ≤ 3` result this audit
  stands on.
- Doran, Faux, Gates, Hübsch, Iga, Landweber — *Relating doubly-even error-correcting codes, graphs,
  and irreducible representations of N-extended supersymmetry* (J. Phys. A 2008; arXiv:0806.0051);
  *Codes and supersymmetry in one dimension* (ATMP 15 (2011) 1909). The code-length-is-N correspondence.
- Gleason; Mallows–Sloane — doubly-even self-dual binary codes exist only at length ≡ 0 (mod 8); the
  existence theorem `AdinkraIdentity.Tests` already searches against.
- McCarthy 1960 (Lisp) — homoiconicity as `eval ∘ quote = id`.
- Lawvere 1969, *Diagonal arguments and cartesian closed categories*; Yanofsky 2003 — the fixed-point
  theorem `HomoiconicFixpoint.lean` proves constructively.
- Futamura 1971 — the three projections; `mix(mix,mix) = cogen`. Ershov — mixed computation.
- Meijer–Fokkinga–Paterson 1991, *Bananas, Lenses, Envelopes and Barbed Wire* — catamorphism /
  anamorphism, the `μF`/`νF` duality §4.1 argues is the *wrong* axis for this split. Erik Meijer is
  the standing in-repo anchor for the duality apparatus.
- In-tree: `src/Core/MixIr.fs`, `MixCogen.fs`, `MetaGrammar.fs`, `GrammarIr.fs`, `ZetaIrNormalizer.fs`,
  `AdinkraCode.fs`, `AdinkraViz.fs`, `YinYang.fs`; `src/Core.Lean4/Gen/HomoiconicFixpoint.lean`;
  `docs/research/2026-06-12-ferry-18-adinkras-are-homoiconic-on-what-acts-and-what-remains-they-are-the-atom-the-braid-overlays.md` (§9, the halves named).
- Rules applied: `numerology-vs-number-theory` (§3.1, §4.1, §5), `toy-is-free-metered-must-be-earned`
  (§2, §3.2), `no-binary-in-proof-lineage` (§4.2), `anchor-to-human-prior-art` (a cited anchor must be
  *checked* — §5 is what happens when one is not).
