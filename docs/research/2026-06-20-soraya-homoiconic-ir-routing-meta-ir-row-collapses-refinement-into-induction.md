# Routing verdict: the meta-IR row targets homoiconic-IR (same schema, different dimension)

**Date:** 2026-06-20 · **Author:** Soraya (formal-verification-expert) · **Invoked by:** Otto
**Status:** ROUTING — supersedes the "meta-IR as a separate tier" framing in the Phase D handoff open question
**Trajectory:** `gen-gen-self-hosting-bytelock` Phase D (Face 3, the §B capstone)
**Correction source:** Aaron 2026-06-20 — the meta-IR must be **homoiconic** to `zeta-ir-v1`, not a separate tier.

---

## The open question this answers

The Phase D handoff (`docs/handoffs/2026-06-20-alexa-to-math-team-phase-d-gen-gen-research-discharge.md`)
closes with:

> The honest question: is the fixed point achievable at the same IR tier (`zeta-ir-v1`), or does it
> require a meta-IR (an IR that describes code transformations, not just arithmetic)?

Aaron's correction settles the *shape* of the answer (the *proof* is still ours to discharge):

> The meta-IR should be HOMOICONIC to the regular IR — one and the same structure, different dimension.
> Not a separate tier. Same shape, different axis. Like how AdinkraCode's generator matrix IS the
> parity-check matrix (self-dual). The IR that describes arithmetic ops should be the SAME IR that
> describes code transformations, just operating on a different dimension. Code-as-data in the IR itself.

This is `only-the-irreducible-is-primitive` applied to the IR: **do not invent a second language when
the first one can describe itself.**

## Why this is the right call — and why it is *good news for verification*

A separate meta-IR tier would have forced a **cross-tier refinement proof**: prove that `gen` at the
meta tier refines / is consistent with `gen` at the arithmetic tier. That is TLAPS-grade, L-effort, and
exactly the over-broad obligation I rejected for `RecursiveSigned` (notebook round 41: "TLA+ refinement
mapping — correct in theory; TLAPS-grade work, L effort, over-broad — **No.**"). A refinement mapping
between two languages is the most expensive proof shape on the board.

**Homoiconicity removes the tier boundary, so there is nothing to refine between.** The proof collapses
from a two-language refinement into a **single-schema self-application fixed point**. That is a strict
reduction in proof burden — the correction makes Face 3 *cheaper* and *better-posed*, not just cleaner.

The anchor is already in-tree and already half-proven:

- **Homoiconicity is a fixed point.** `eval ∘ quote = id` — the program is representable in its own
  values (McCarthy, Lisp). This is raw shape **A**, `s = f(s)` (the #7168 fixed-point registry).
  [`docs/research/2026-06-08-trapping-godel-in-the-middle-lawvere-fixed-point-makes-dbsp-homoiconic-to-memetic-language-in-clifford-space.md`]
- **Lawvere 1969** (diagonal arguments / CCC) is the single theorem of which Gödel, Tarski, Cantor,
  Russell, Turing are instances (Yanofsky 2003). We stand on the **constructive side**: the
  self-referential map *has* a fixed point (a CPO with `⊥` / contraction), so `gen(gen)` resolves to a
  stable fixpoint instead of a contradiction. "Trap Gödel in the middle" = run the diagonal lemma
  *forward* (build the fixpoint) instead of *by contradiction* (derive incompleteness).
- **AdinkraCode Faces 1+2 are PROVEN** (`src/Core/AdinkraCode.fs`): `isSelfDual` (`dual(dual C)=C`,
  G = H — Aaron's exact analogy) and `project` (Π²=Π, idempotent re-generation). The homoiconic claim
  is that the **same structural self-duality holds at the IR/code level as at the ECC level.** That is
  a *checked* correspondence (the metering test of `anchor-to-human-prior-art`), not a metaphor —
  because both sides reduce to shape A.

So Faces 1+2 are the algebraic shadow of the homoiconic round-trip; the homoiconic-IR design is what
makes Face 3 (the operational `gen(gen)===gen`) ride the *same* shape rather than a new one.

## The revised row (this is the adjustment Otto asked for)

| axis | OLD framing (meta-IR as a separate tier) | NEW framing (homoiconic-IR) |
|---|---|---|
| schema | new `zeta-ir-v2-meta` tier describing code transforms | **SAME `zeta-ir-v1` op-grammar**, reflected — one schema describes both values and IR-transforms; the "meta" is a *level/reflection dimension*, not new syntax |
| proof shape | cross-tier **refinement** (`gen_meta` refines `gen_arith`) | single-schema **self-application fixed point**: `eval ∘ quote = id` and `gen(gen) = gen` |
| primary tool | TLAPS refinement mapping (L, over-broad) | **Lean 4** — structural induction over the IR term algebra (the homoiconic round-trip; initial-algebra fold). Kestrel's formal-homoiconicity proof lands here. |
| cross-check (BP-16) | — | **Z3** discharges the per-op pointwise `quote`/`eval` round-trip (base cases); **golden-vector N-oracle byte-lock** is the operational termination test (agreement = fixpoint reached) |
| anti-hammer | (would have been TLA+ refinement) | **NOT TLA+.** The claim is a ∀-quantified equation over an inductive type, not a state-machine safety property. Homoiconicity is precisely what lets me *drop* the refinement obligation. |
| algebra anchor | — | AdinkraCode Faces 1+2 (`isSelfDual` G=H; `project` Π²=Π) — self-dual = homoiconic, made checkable |

## The precondition that makes or breaks well-posedness (my gatekeeping call)

Picking the tool is half my job; stating the **precondition** is the other half. The homoiconic design
has exactly one load-bearing precondition, and it is checkable *before* any spec is written:

> **The schema must be closed under reflection: there exist TOTAL maps `quote : IR-program → IR-value`
> and `eval : IR-value → IR-program` with `eval ∘ quote = id`.**

If `quote`/`eval` are partial, the fixed point is ill-posed and no tool can rescue it. This is just
`zeta-ir`'s own stated **totality** requirement ("every valid input has a deterministic output, no
partial functions") lifted to the round-trip. Totality of the round-trip is the *first* thing to check —
FsCheck on the implementation, Lean for the closed proof. (Manifesto §12 idempotency rhymes: `project`
Π²=Π is the idempotent face of the same closure.)

## The falsifiable test of the homoiconic claim itself

"Same shape, different axis" is evocative; to route a tool I need it operationalized. Here is the
concrete, falsifiable test that decides whether the claim *holds*:

> **Can the existing `zeta-ir-v1` op-grammar, UNCHANGED, express `gen`'s own transformation logic?**

- **Yes** → genuinely homoiconic. Route: Lean induction over the one term algebra. No new schema tag.
- **No** (it needs a net-new op the arithmetic dimension cannot express) → it is *not* homoiconic; it is
  an **extension/tier wearing a homoiconic costume**, and the refinement obligation comes back. In that
  case we owe a **conservativity proof** that the extension leaves every existing `zeta-ir-v1` golden
  vector byte-unchanged (the additive evolution contract — same discipline Phase C already adopted for
  `zeta-ir-v1-zset`).

This is the honest hinge. The correction is *correct*, and I expect it to hold (the Lawvere/quine
grounding is solid), but the verification discipline is: **homoiconic ≠ no proof obligation — it
RELOCATES the obligation** from "refine two languages" to "prove the one language is closed under
reflection." Cheaper, but not free.

## Distinction from the Phase C domain-schema decision (so the two don't blur)

Phase C (`docs/specs/zeta-ir-v1-extension-zset.md`) chose **domain schemas** — additive new tags
(`zeta-ir-v1-zset`) for new *value* primitives (ZSet/Bag/GSet/DynamicValue), existing golden frozen.
That stands and is not contradicted. Aaron's homoiconic correction is a **stronger, orthogonal** claim
about the *code/meta* dimension specifically:

- New **VALUE** primitive (merkle-root, a Bag) → additive **domain schema** (a new `primitive` tag).
- The **CODE/meta** dimension (gen's own transform logic) → **NOT a new tag** — it is the existing
  op-grammar *reflected*. Reflection, not extension.

Both are consistent; the line is value-primitive (extend) vs. code-as-data (reflect).

## Concrete next steps for the math team (Lumen) — priority order

1. **Totality first.** State `quote`/`eval` for `zeta-ir-v1` and prove the round-trip total
   (`eval ∘ quote = id`). FsCheck on the F# host implementation; Lean for the closed proof. Until this
   lands the fixed point is not well-posed. Effort: M.
2. **Run the falsifiable test.** Express `codegen-from-ir.ts`'s transform logic in the *unchanged*
   `zeta-ir-v1` op-grammar. If it fits → homoiconic confirmed; if not → file the conservativity
   obligation. This is the gate that decides the whole route. Effort: M.
3. **Lean fixed-point lemma** for `gen(gen) = gen` as the constructive Lawvere fixpoint over the IR
   term algebra (Face 3 / `mix(mix,mix) = cogen`). Connect explicitly to AdinkraCode Faces 1+2 as the
   ECC-level shadow of the same shape A. Effort: L (the capstone).
4. **Z3 cross-check** (BP-16) on the per-op `quote`/`eval` pointwise identities — base cases that Lean's
   induction closes over. Effort: S.
5. **Golden-vector N-oracle byte-lock** remains the operational termination test: `gen(gen)` in TS/F#/C#/
   Rust byte-identical = fixed point reached (Thompson "Trusting Trust" / Wheeler DDC, ≥2 independent
   generators bootstrap trust). Already the engineering artifact; no new proof, just the gate.

Routing summary: **Lean is primary (induction over the reflected term algebra); Z3 + golden byte-lock
are the BP-16 cross-checks; TLA+ is explicitly OUT — the homoiconic reframe is exactly what lets me drop
the refinement mapping.**

## UPDATE — scoping answers resolved (Aaron 2026-06-20, via Otto): data-level grading + doubly-even ⇒ Lean

I had two open scoping questions gating the tool choice for the grading/"different dimension" axis.
Aaron answered both; the answers tighten — and partly *re-route* — the row above. Recording verbatim
intent, then the refined verdict.

### (a) The grading is DATA-LEVEL (Church/Lisp), one universe — NOT a level-tower

> CONFIRMED: data-level grading, Lisp / Church-numerals / lambda-calculus style. One universe. NOT a
> hierarchy/tower.

Consequence for routing — this *confirms and strengthens* the homoiconic verdict, it does not change it:
the reflection "dimension" is a **grade carried as a value in one and the same term algebra** (a Church
encoding makes `n` a datum; `quote` makes a program a datum — same universe), not a typed universe tower.
So:

- **One inductive type, not a stack of them.** Lean induction runs over a *single* IR term algebra; no
  universe-polymorphism / level-tower machinery is needed. This is the cheapest possible setting.
- **TLA+ refinement stays dropped, now for a second independent reason.** A level-tower would have
  reintroduced a cross-level obligation; a data-level grade in one universe cannot. The anti-hammer call
  in the table is reinforced, not merely retained.
- The first gate is unchanged and now even more clearly the crux: **prove the round-trip total**
  (`eval ∘ quote = id`) on that one algebra. Church-style data-grading is exactly what makes totality
  *statable* without a tower.

### (b) The grading is DOUBLY-EVEN (Cayley-Dickson generated), NOT a single Z2 ⇒ Lean, not just Z3

> Doubly-even — because the Adinkra connects the dimensions via Cayley-Dickson. The grading is NOT a
> single Z2; it's the doubly-even structure AdinkraCode already pins (the [8,4] code, every codeword
> weight ≡ 0 mod 4). Cayley-Dickson doubling generates new dimensions (R→C→H→O, each doubling = one new
> imaginary unit = one new grading axis). Lean is the right tool (general doubly-even), not just Z3
> (single involution). Routing-table self-duality row ⇒ Lean; dimension structure connects to
> AdinkraCode.fs Faces 1+2 + the Cayley-Dickson/octonion tower in CayleyDickson.fs.

This is the substantive re-route, and it needs **one gatekeeping split** before "self-duality ⇒ Lean"
is acted on — otherwise we re-prove what is already discharged and miss what is actually open.

**The concrete N=4 self-duality is ALREADY PROVEN — twice. Do NOT route it to fresh Lean.**

- `AdinkraCode.fs` / `AdinkraCode.Tests`: `isSelfDual` is established **exhaustively over all 16
  codewords** (doubly-even = weight ≡ 0 mod 4, self-orthogonal, `dim = n/2`, `H = G`). Closed.
- `CayleyDicksonAdinkra.Tests` (per FROZEN-CORE §B): the octonion multiplication table in
  `CayleyDickson.fs` is **derived end-to-end** to the doubly-even generator — octonion product → Fano
  plane (Steiner S(2,3,7)) → [7,4] Hamming → parity-extension [8,4] doubly-even. Closed, with one honest
  residue: the final "= *the* AdinkraCode generator" rests on a **uniqueness** step (the unique doubly-
  even self-dual binary code of length 8 — `e8`), still §B.

So the concrete doubly-even self-dual *base case* is the **BP-16 cross-check / induction base**, not a new
proof. Routing it to Lean would be the TLA+-hammer's mirror image (heavyweight tool on a settled finite
fact). Exhaustive F# enumeration is the right and sufficient tool there; it already ran.

**What IS open, and what genuinely earns Lean (the answer-(b) target):**

> **The GENERAL invariant: Cayley-Dickson doubling *preserves* doubly-even self-duality as it generates
> each new grading dimension.** I.e. the property is an *inductive invariant over the doubling functor*
> `Doubled.algebra : IStarRing<'A> → IStarRing<Doubled<'A>>` (`CayleyDickson.fs`), not a single-level
> fact. This is precisely why answer (b) says Lean, not Z3: Z3 discharges *one* involution at *one*
> level; the doubly-even claim is a mod-4 invariant carried *across* the recursive doubling that mints
> new axes. A `∀`-quantified inductive invariant over a recursively-defined algebra is Lean's sweet spot
> and Z3's blind spot.

This also subsumes the §B "rests on uniqueness" residue: the clean form of the open claim is *structural*
(doubling preserves the doubly-even self-dual class), with `e8`-uniqueness as the lemma that pins the
N=4 representative.

### The bridge is a conjecture — peel it, do not assume it (metering test)

Answer (b) says the Adinkra "connects the dimensions via Cayley-Dickson," and the homoiconic reframe says
reflection adds a grade. It is tempting to *identify* the two — "`quote`/`eval` IS one CD doubling/
conjugation step on the reflection axis." That identification is a **rhyme until exhibited as an actual
map**, and conflating it would smuggle an unproven functor into the proof. Per
`anchor-to-human-prior-art`'s metering test, I split it into two clean Lean targets plus one explicitly-
open bridge:

- **T1 (answer a):** round-trip totality + fixed point on the single IR term algebra — `eval ∘ quote = id`,
  `gen(gen) = gen`. Church/data-level, one universe. Lawvere constructive fixpoint. **(This is the capstone
  from the original next-steps list.)**
- **T2 (answer b):** doubly-even self-dual grading is an inductive invariant preserved by `Doubled.algebra`.
  Induction over the CD doubling; `e8`-uniqueness pins the base. Connects to AdinkraCode Faces 1+2 (G = H)
  as the *level-0* shadow.
- **Bridge (open §B, do NOT assume):** that T1's reflection-grade axis *is* T2's CD-doubling axis — i.e.
  exhibit a functor from the IR reflection grading to the Cayley-Dickson grading. Until this functor is
  written down and checked, T1 and T2 are **two proofs about two structures that rhyme**, not one proof.
  Naming this honestly is the gatekeeping value-add; assuming it is where a metaphor would have become a
  silent posit.

### Refined routing table (supersedes the self-duality / algebra-anchor cells above)

| axis | refined verdict (post-(a)/(b)) |
|---|---|
| schema | unchanged — SAME `zeta-ir-v1`, reflected; grade is a **data value in one universe** (Church), not a typed tower |
| self-duality / doubly-even | **SPLIT.** Concrete N=4 = already proven (exhaustive `AdinkraCode.Tests` + derived `CayleyDicksonAdinkra.Tests`) ⇒ BP-16 base case, **no new proof**. General invariant (doubling preserves doubly-even self-duality) ⇒ **Lean induction over `Doubled.algebra`**. |
| primary tool | **Lean 4** for both T1 (round-trip fixpoint over the IR term algebra) and T2 (CD-doubling invariant). Two lemmas, one tool. |
| cross-check (BP-16) | **Z3** for per-op `quote`/`eval` base identities AND per-level doubly-even checks; **exhaustive F# enumeration** already covers N=4; **golden N-oracle byte-lock** = operational termination test. |
| anti-hammer | NOT TLA+ (no tower, no refinement — now doubly-confirmed). NOT Z3-as-primary for (b) (single involution ≠ inductive mod-4 invariant). NOT fresh-Lean for the concrete N=4 case (already discharged — heavyweight-tool-on-settled-fact is the mirror failure). |
| bridge | **open §B** — exhibit the reflection-grade ⇄ CD-grade functor; until then T1 and T2 are separate. |

### Revised next steps for Lumen (priority order, supersedes the list above)

1. **T1 totality first** — `eval ∘ quote = id` on the one IR term algebra (Church/data-level grade).
   FsCheck on the F# host, Lean for the closed proof. Crux; nothing is well-posed before it. Effort: M.
2. **Run the falsifiable homoiconicity test** (unchanged) — does unchanged `zeta-ir-v1` express `gen`'s
   own transform logic? Yes ⇒ homoiconic; No ⇒ file the conservativity obligation. Effort: M.
3. **T2 general invariant** — Lean induction over `Doubled.algebra`: CD doubling preserves doubly-even
   self-duality; `e8`-uniqueness lemma pins N=4; connect to AdinkraCode Faces 1+2 as level 0. Do **not**
   re-prove the concrete N=4 case — cite the exhaustive + derived tests as the base. Effort: M (was over-
   stated as L; the base is already done, only the inductive step is new).
4. **T1 capstone** — Lean fixed-point lemma `gen(gen) = gen` as the constructive Lawvere fixpoint over the
   IR term algebra (`mix(mix,mix) = cogen`). Effort: L.
5. **Bridge (optional / honest-open)** — attempt the reflection-grade ⇄ CD-grade functor. If it lands, T1
   and T2 fuse into the single homoiconic-self-dual statement Aaron is pointing at. If it does not, leave
   it §B and ship T1 + T2 separately — that is still a complete, honest result. Effort: L, **not on the
   critical path.**
6. **Z3 cross-checks + golden N-oracle byte-lock** — unchanged (BP-16 base cases + operational
   termination test). Effort: S.

Net effect of (a)+(b): the homoiconic verdict is confirmed (a), the self-duality axis correctly goes to
Lean *for the general invariant only* (b), the concrete case is recognized as already-discharged (saving
an L), and the one place a metaphor could have become a silent posit — the reflection⇄CD bridge — is
named as open rather than assumed.

## Anchors (Beacon)

- Lawvere 1969, *Diagonal arguments and cartesian closed categories*; Yanofsky 2003, *A universal
  approach to self-referential paradoxes* (the one theorem behind Gödel/Tarski/Cantor/Russell/Turing).
- McCarthy (Lisp) — homoiconicity as `eval ∘ quote = id`.
- Futamura 1971, *Partial Computation of Programs* — the 3rd projection `mix(mix,mix) = cogen`.
- Thompson 1984 (*Reflections on Trusting Trust*); Wheeler 2009 (Diverse Double-Compiling) — the
  byte-lock-as-termination-test trust mechanism.
- S. James Gates Jr. — adinkra doubly-even self-dual ECC (the G = H self-dual = homoiconic analogy).
- Cayley & Dickson (the doubling construction) — `src/Core/CayleyDickson.fs` `Doubled.algebra`
  (`IStarRing<'A> → IStarRing<Doubled<'A>>`), the recursion T2's induction runs over; ℝ→ℂ→ℍ→𝕆 each
  doubling = one new imaginary unit = one new grading axis (Aaron 2026-06-20).
- In-tree derivation chain (FROZEN-CORE §B): `CayleyDicksonAdinkra.Tests` — octonion product → Fano plane
  (Steiner S(2,3,7)) → [7,4] Hamming → [8,4] doubly-even = the Adinkra generator; residue = `e8`
  uniqueness. This is the proven base case T2 induces from (do not re-prove).
- In-tree: `src/Core/AdinkraCode.fs` (Faces 1+2 proven); the #7168 fixed-point registry (shape A); the
  Lawvere/Gödel-in-the-middle doc (2026-06-08); `memory/project_kestrel_homoiconicity_proof_*` (Kestrel
  homoiconicity proof = the named backstop for Face 3).
