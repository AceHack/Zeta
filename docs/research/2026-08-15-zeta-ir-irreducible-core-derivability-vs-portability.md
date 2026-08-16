# The zeta-ir irreducible core: derivability and portability are two different axes

**Author:** the shadow (Otto's shadow-work role)
**Date:** 2026-08-15
**Register:** Mirror where noted; the algebra and the measurements are Beacon.
**Status of every claim below:** each one is either *executed* (a named test in
`tests/Tests.FSharp/ZetaIrMinimalSet.Tests.fs` reproduces it against the committed evaluator
and the committed golden vectors), *proved* (an algebraic argument, stated in full), or
explicitly labelled **open**. Nothing here is asserted on a coincidence of shape.

***

## 0. Why this note exists, and three corrections to the record

Aaron, 2026-08-15:

> "we did add some new ops, i think we have some math proof that says all our ops can be
> derived from some base two ops but i think we have like 6 or more ops now we want to
> support all but also we want to be minimalistic in our ops like our own vm like dotnet."

and, mid-task:

> "we also picked this ops set because it can be very agnostic to the hardware and substrate
> it runs on, we even have it working on q# and other exotic runtimes."

Three things on the record needed fixing before the question could be answered.

**Correction 1 — the proof on file says FOUR, not two.**
`docs/research/2026-06-20-lumen-zeta-ir-minimal-generating-set.md` establishes that the six
v1–v4 op families collapse to a **core four**: `mul`, `add`, `xshrxor`, `xrotxor`. There is no
two-op result anywhere in the repo. The two reductions it gives are
`xorshr s -> xshrxor [s]` and `rotl r -> xrotxor [0; r]`, both implemented in
`src/Core/ZetaIrNormalizer.fs` and both genuinely correct.

**Correction 2 — one of that note's irreducibility arguments is false as written.**
It says `mul k` is irreducible because *"it is the only operation that propagates carries
upward across bit boundaries."* `add k` propagates carries too — that is exactly why it is not
F₂-affine. The `mul` line needs a different argument, and §6 below reports that I did not find
one and did not settle it. The `add` line in the same section **is** sound and is the template
worth keeping.

**Correction 3 — the v4 `add` "necessity proof" is an illustration, not a proof.**
`src/Core/ZetaIrV4.fs`'s header points at "the necessity proof in ZetaIrV4.Tests". The test
that carries the name is:

```fsharp
let k = 1442695040888963407UL
let add0 = (0UL + k)
Assert.Equal(k, add0)
...
Assert.Equal(0UL, mul0 6364136223846793005UL)
Assert.Equal(0UL, xorshr0 30)
Assert.Equal(0UL, rotl0 7)
```

That is `0 + k = k` plus three fixed instances of `f 0 = 0`, computed with inline arithmetic.
It never constructs a `ZetaIrV4.Op`, never builds a sequence, and never calls an evaluator — so
it passes unchanged if `Add` is deleted from the grammar. **The mathematics in the header
comment is correct and the test is not a falsifier for it.** §5 supplies the quantified version.
The header should say the argument lives in the header; a reader following the pointer today
finds an assertion, not a proof.

*(A fourth, smaller correction to my brief: `src/Core/ZetaIrEval.fs` is **not** on `main` —
PR #10807 is still `OPEN` at tip `3218df50b`. Everything below is therefore checked against
`ZetaIrNormalizer.evalOp64` / `evalOp32`, which is what `main` has. See §9 for the overlap.)*

***

## 1. The referent

Semantics come from `ZetaIrNormalizer.evalOp64` / `evalOp32`, dispatched on `ir.Width`, and
every end-to-end claim is replayed against the committed value fixtures under
`tests/cross-verification/<generator>/vectors.yaml` — seven routes covering all six ops at both
widths:

| route | ops exercised | width |
|---|---|---|
| `fmix64` | `mul`, `xorshr` | 64 |
| `xoshiro256ss` | + `rotl` | 64 |
| `nasam` | + `xrotxor`, `xshrxor` | 64 |
| `lcg64_mmix` | + `add` | 64 |
| `lcg32_glibc`, `lcg32_numerical_recipes` | `mul`, `add` | 32 |
| `murmur3_32_tail` | `rotl`, `mul`, `add` | 32 |

A derivation that does not reproduce those numbers is wrong, and is reported as wrong.

***

## 2. The algebra, in one screen

Write **R** for right-shift-by-one and **X** for rotate-left-by-one. Composition of ops on the
single accumulator is multiplication of the corresponding polynomial, because every one of
these ops is F₂-linear:

| op | denotation | lives in |
|---|---|---|
| `XorShr s` | `1 + R^s` | `F₂[R]/(R^W)` |
| `XShrXor [s₁…sₙ]` | `1 + R^{s₁} + … + R^{sₙ}` | `F₂[R]/(R^W)` |
| `Rotl r` | `X^r` | `F₂[X]/(X^W − 1)` |
| `XRotXor [r₁…rₙ]` | `1 + X^{r₁} + … + X^{rₙ}` | `F₂[X]/(X^W − 1)` |
| `Mul k` | `x ↦ k·x` | `ℤ/2^W` — **not** F₂-linear |
| `Add k` | `x ↦ x + k` | `ℤ/2^W` — **not** F₂-linear, not even F₂-affine |

Two facts do all the work below, and both depend on **W being a power of two** (32 and 64 are):

- `R` is **nilpotent** (`R^W = 0`), so `F₂[R]/(R^W)` is local and **`p` is a unit ⟺ its
  constant term is 1**.
- `X^W − 1 = (X + 1)^W` over F₂ when W is a power of two, so `F₂[X]/(X^W − 1)` is *also* local,
  with maximal ideal `(1 + X)`, and **`p` is a unit ⟺ `p(1) = 1` ⟺ `p` has odd Hamming
  weight**.

Anchors (Beacon): the ring structure is the standard cyclic-code picture — Berlekamp,
*Algebraic Coding Theory* (1968) / MacWilliams & Sloane (1977) for `F₂[X]/(X^n − 1)`; the
"repeated root" collapse at `n = 2^m` over `F₂` is the classical fact that `X^{2^m} − 1 =
(X − 1)^{2^m}` in characteristic 2. The `1 + R^s`-is-invertible argument is the one the repo's
own Q# sketch already uses (§7).

***

## 3. The list ops are not the same kind of thing

The task brief's hypothesis was that the two list-taking ops "are fused folds rather than
primitives — check that first, it may be the cheapest win." That hypothesis is **half right,
and the half it gets wrong is the interesting half.**

### 3a. `XShrXor` IS a fused fold — it factors back into a `XorShr` sequence

**Claim.** For any list with all `sᵢ ≥ 1`, `XShrXor [s₁…sₙ]` equals a *sequence* of
single-shift `XorShr` ops.

**Proof.** `p = 1 + Σ R^{sᵢ}` has constant term 1, so it is a unit, and the units of
`F₂[R]/(R^W)` are exactly `1 + R·F₂[R]/(R^W)` — a group of order `2^{W−1}`. The elements
`1 + R^m` generate that group: given `u = 1 + R^m + (higher)` with `m` minimal,
`u·(1 + R^m) = 1 + (terms of degree > m)`, so induction on the lowest non-constant degree
terminates. Multiplying by `(1 + R^m)^{-1} = 1 + R^m + R^{2m} + …` gives the factorisation
directly. ∎

**Executed** — `XShrXor list is a fused fold -- it factors back into a XorShr SEQUENCE, both
widths`, and end-to-end in `the XShrXor factorisation reproduces the nasam golden vectors`
(nasam is the only committed generator that uses `xshrxor`; both of its `XShrXor [23;51]` ops
are rewritten and the committed vectors replay exactly).

**And the cost is real, which is the point of measuring it:**

| target | width | `XorShr` ops produced |
|---|---|---|
| `XShrXor [23; 51]` (nasam) | 64 | **2** |
| `XShrXor [33]` | 64 | 1 |
| `XShrXor [13; 27]` | 32 | 2 |
| `XShrXor [1; 2; 3; 5; 7]` | 64 | **35** |

nasam is cheap by luck of arithmetic — `23 + 51 = 74 ≥ 64`, so the cross term `R^{74}` falls off
the end and `(1+R^{23})(1+R^{51})` *is* `1 + R^{23} + R^{51}`. A list whose shifts are small
relative to the width blows up toward the `W − 1` bound. So "derivable" here does not mean
"free": the fold is a **compression** of up to `W−1` steps into one op.

### 3b. `XRotXor` is NOT a fused fold — arity 2 is primitive

**Claim.** `XRotXor [a; b]` is not any composition of `Rotl` ops.

**Proof.** `Rotl r` denotes the monomial `X^r`, and monomials are closed under multiplication:
`Rotl a` then `Rotl b` is `Rotl ((a+b) mod W)`. So the *entire monoid* generated by `Rotl` at
width W is the W rotations — nothing else is reachable, ever. `XRotXor [a; b]` denotes
`1 + X^a + X^b`, which has three terms. Three ≠ one. ∎

**Executed** — `XRotXor [a; b] is NOT any composition of Rotl -- exhaustive over the rotation
monoid` checks all W rotations at both widths (this is exhaustive, not sampled, precisely
because of the closure lemma), and the closure lemma itself is checked over all `W²` pairs in
`the Rotl monoid really is closed`.

### 3c. Why the two rings differ

The asymmetry is not an accident of notation, and it is worth stating plainly because it is the
actual answer to "are the lists folds?":

- In `F₂[R]/(R^W)`, `R` is **nilpotent**, so `1 + R^s` is always a unit and those units
  *generate everything invertible*. The fold is decomposable.
- In `F₂[X]/(X^W − 1)`, `X` is a **unit**, so `Rotl` only ever reaches the cyclic group of
  monomials — a group of order W inside a unit group of order `2^{W−1}`. The fold reaches
  outside it and cannot be walked back.

**So the cheapest-win answer is: one list collapses, one does not.** `xshrxor`'s list is
sugar over a `xorshr` sequence; `xrotxor`'s list is a genuine primitive from arity 2 up.

***

## 4. What the `0` in a list actually buys

Both list ops accept `0`, and that is not a wart — it is the escape hatch that makes the fold
express non-folds. `ZetaIrV4.validate` places no bound on the terms at all, so all of these are
grammatical today:

| written | denotes | note |
|---|---|---|
| `XRotXor [0; r]` | `X^r` = `Rotl r` | the reduction already on file |
| `XRotXor [0]` | `0` — the **zero map** | `1 + X^0 = 0` |
| `XShrXor [0; s]` | plain `x >>> s` | a **shift**, not a xor-shift |
| `XShrXor [0]` | `0` — the zero map, `= Mul 0` | |

**Executed** — `XShrXor with 0 in the list is NOT a XorShr product -- it is the non-unit case`.
Those two are exactly the elements the factorisation of §3a cannot produce: they are non-units
(constant term cancelled), and every `1 + R^m` factor is a unit.

This settles the arity question cleanly:

> `XShrXor`'s list needs arity **2** (to reach plain shift and zero), not arity n.
> `XRotXor`'s list needs arity **2** (`[0;r]` for rotation, `[a;b]` for the weight-3 units).

***

## 5. `add`: the one op with a real necessity argument

The argument in `ZetaIrV4.fs`'s header is sound and is the template every other irreducibility
claim in this file should be held to:

> Every non-`add` op maps `0 ↦ 0` (`k·0 = 0`; `0 ⊕ (0 >> s) = 0`; `rotl(0,r) = 0`; and the two
> folds are XORs of those). Composition preserves that. So **every sequence of non-`add` ops
> sends 0 to 0**, while `add k` sends 0 to `k`. Hence `add k` (k ≠ 0) is outside the v3
> grammar's reach — not "we did not find a way", but a structural invariant the whole fragment
> preserves and this op breaks.

**Executed as a falsifier** — `every non-Add op sequence fixes 0, and Add does not -- the add
necessity argument` draws 4000 random sequences of length 1–8 from all five non-`add` families
(over the full shift/rotation ranges) at both widths, evaluates each at 0, and requires 0; then
exhibits the witnesses that leave the fragment. Unlike the existing test, this one fails if
`Add` is folded into the other families or if any op's 0-fixing is broken.

***

## 6. `mul`: **open** — and labelled open

I did not settle whether `Mul k` is derivable from `{Add, XShrXor, XRotXor}`, and I am not going
to round that up.

What is established:

- `Mul 0` **is** derivable: it is `XShrXor [0]` (executed, both widths).
- `Mul 2^j` is a left shift — F₂-linear, but it lies in *neither* polynomial fragment: it is
  not circulant (so not in the `XRotXor` algebra) and it shifts the wrong way (so not in the
  `XShrXor` algebra).
- The 2026-06-20 note's stated reason ("only op that propagates carries") is **false** —
  see Correction 2.

What I tried and abandoned, recorded so nobody repeats it blind: an exhaustive enumeration of
the function monoid generated by `{Add, XShrXor, XRotXor}` at width 4 (functions `ℤ/16 → ℤ/16`
as 64-bit table keys, BFS with a 4·10⁶ cap). It exceeded 10 minutes without converging and was
killed. A width-4 decision is still the right next experiment, with a better representation
(the monoid is a product of a translation part and a linear part; enumerating those separately
is almost certainly tractable) — but it is *not done*, and until it is, "mul is irreducible" is
**a conjecture with no falsifier**, i.e. `toy` under
`.claude/rules/toy-is-free-metered-must-be-earned.md`.

Note that this does not threaten `mul`'s place in the grammar for one moment: §7 gives an
independent reason to keep it that does not depend on the derivability question at all.

***

## 7. Portability is a second axis — and the same invariant governs both

Aaron's constraint: the op set was chosen to be substrate-agnostic, "we even have it working on
q# and other exotic runtimes." This changes what counts as a win, and it turns out to connect
to the algebra above rather than sitting beside it.

### 7a. The F₂-unit criterion decides **reversibility**, exactly

`src/Core.QSharp.ReferenceOracle/QuantumArithmeticMix.qs.sketch` lifts `xorshr` to a reversible
circuit with this argument, in its own words:

> "The map is `M = I + S^s` where `S` is the down-shift; `S` is nilpotent (`S^n = 0`) so `M` is
> invertible over GF(2). Hence `xorshr` is a bijection…"

That is precisely the constant-term/unit condition of §2 — and it generalises to the whole op
set. The predicted criterion:

| op | invertible ⟺ |
|---|---|
| `Mul k` | `k` odd |
| `Add k` | always |
| `Rotl r` | always |
| `XorShr s` | `s mod W ≠ 0` |
| `XShrXor ss` | `0` occurs an **even** number of times in `ss` (constant term survives) |
| `XRotXor rs` | `1 + Σ X^{rᵢ}` has **odd Hamming weight** |

**Executed** — `the F2-unit criterion predicts bijectivity EXACTLY (exhaustive at width 16)`:
22 cases, exhaustive over all 65 536 inputs, prediction and measurement agree 22/22. (The
width-parametric reference evaluator used for width 16 is first pinned against the committed
32/64 evaluator in `the width-parametric reference agrees with the committed evaluator at 32 and
64`, so it is not a second opinion — it is the same one, extended.)

So the same invariant that decides *whether a list op factors* decides *whether a reversible or
quantum lane can carry the op without ancillas*. That is one structure doing two jobs, not two
coincidences: both are "is this element a unit of the local ring".

**The operational consequence for reductions:** a rewrite can preserve denotation and still
change the *reversibility profile of the program*. Rewriting `XShrXor [23;51]` into two `XorShr`
ops keeps every intermediate step a bijection (all factors are units by construction) — safe.
A rewrite that introduces `XShrXor [0; s]` inserts a **lossy** step into a program that had
none, and a reversible lane must then carry garbage it did not carry before. The core-four
normalisation on file is safe by this test: `xorshr s -> xshrxor [s]` and
`rotl r -> xrotxor [0; r]` both map units to units.

### 7b. The state of the Q# lane — looked at, not inferred

This part is **read from the code**; I could not execute it and I am not going to claim I did.

- `tests/cross-verification/_harness/cross-verify-ir.ts` is the seven-lane harness
  (`ORACLE_LANES = typescript, python, go, csharp, rust, fsharp, qsharp`). Its op type is
  `interface IrOp { op: string; k?: number; s?: number; k_bigint?: string }` — **there are no
  `r`, `rs`, or `ss` fields**. Every one of its seven emitters, Q# included, handles `mul` and
  `xorshr` and ends with `return "";`. An IR containing `rotl` / `xrotxor` / `xshrxor` / `add`
  would be emitted as a program with those ops **silently dropped**, and all seven lanes would
  agree with each other on the wrong answer. It is only ever invoked on `splitmix64` and
  `fmix32`, which are pure `mul`/`xorshr`, so this is latent rather than live.
- `tests/cross-verification/_harness/codegen-from-ir.ts` is the emitter that *does* cover all
  six ops (and refuses an unknown op rather than dropping it — `"Refusing to emit."`). It has
  **six lanes and no Q# lane**.
- The Q# route needs `qdk` in `src/Core.Python/.venv`. That package is not installed on this
  machine (checked in the shared checkout's venv as well as my clone), so `generateAndRunQSharp`
  returns `qdk not available` and the lane is reported **dark** by the per-route floor.

**Therefore: the Q# lane has never executed an op outside `{mul, xorshr}`.** That is a narrower
statement than "Q# doesn't work here" — the Q# *reference oracle*
(`ZetaReferenceOracle.qs`, `qsharp-golden.json`) is real and live for quantum observables, and
`QuantumArithmeticMix.qs.sketch` is a serious design artifact that says of itself **"SKETCH
ONLY. NOT compiled. NOT gated."** The honest register: **Q# is a real lane in this repo, and the
IR's non-v1 ops have not crossed it.** Peeling the hype does not shrink the truth here; the
portability *design intent* is genuine and documented, the *coverage* is two of six ops.

### 7c. The grammar has two admission criteria and only writes down one

`add` was admitted on **necessity** (§5). If `rotl` and the list ops are kept because every
substrate can implement them directly and a derived form would make each backend reconstruct
them — a legitimate reason — then the grammar admits ops on **two** criteria and the v4 header
states only the first. Saying so plainly is part of this note's point:

> **Necessity** — no sequence of existing ops has this denotation (a structural invariant is
> broken). **Portability** — the op is the unit every substrate implements directly; deriving it
> would push a lowering step, and a correctness risk, into every backend.
>
> These are independent. An op can be derivable and still earn its place.

***

## 8. The core / derived split

Both axes, reported separately, because they disagree and the disagreement is the finding.

| op | derivable? | derivation | verified | keep primitive? | why |
|---|---|---|---|---|---|
| `Add k` | **no** | — | necessity argument executed (§5) | **yes** | the only op that breaks `0 ↦ 0` |
| `Mul k` | **open** (`Mul 0` = `XShrXor [0]`) | — | §6 | **yes** | the only ℤ/2^W-multiplicative op; every substrate has multiply; the two folds cannot make a left shift |
| `XRotXor` arity ≤ 2 | **no** | — | exhaustive over the rotation monoid (§3b) | **yes** | reaches units of odd weight > 1 that monomials never reach |
| `XRotXor` arity ≥ 3 | *probably* — **not established** | product of arity-≤2 factors, by the same local-ring elimination as §3a | **not verified** — my valuation-table search only produced generators of power-of-two valuation and did not close | **yes** | see §10; leaving the general list is free, removing it is not |
| `XShrXor` arity ≥ 2, all `sᵢ ≥ 1` | **yes** | product of `(1 + R^{mⱼ})` = a `XorShr` sequence | executed, both widths, replays the nasam goldens | **yes** | it is a fold: up to `W−1` steps compressed into one op, and the arity-2 form with `0` is not derivable at all |
| `XShrXor` with `0` | **no** | — | executed (§4) | **yes** | non-unit: plain shift and the zero map |
| `XorShr s` | **yes** | `XShrXor [s]` | executed, every `s`, both widths | derived | the reduction on file; Lean-proved at 64 |
| `Rotl r` | **yes** | `XRotXor [0; r]` | executed, every `r`, both widths | **yes, on portability** | every ISA and every emitter has a rotate; forcing `XRotXor [0;r]` makes each backend re-derive it, and it is *less* legible, not more |

**The irreducible core, stated as the answer to the question asked:**

> **`Mul`, `Add`, `XShrXor` (arity ≤ 2 suffices), `XRotXor` (arity ≤ 2 suffices).**
> `XorShr` and `Rotl` are derived. That is the on-file core four, now with the arity bound
> added and with `XorShr`'s and `XShrXor`'s relationship shown to run *both* ways.

Not two ops. Not obviously fewer than four.

***

## 9. A defect this work found, and fixed

`ZetaIrCanonicalizer.fromPolyF2Rot` converted a fused F₂-rotation polynomial back into an op by
unconditionally deleting the constant term:

```fsharp
let rs = poly.Terms |> Set.remove 0 |> Set.toList |> List.sort |> List.map int
[ ZetaIrV4.XRotXor (rs |> List.map int64) ]
```

with an in-code comment arguing that the constant term can never be absent. **It can.** At
width W, `(1 + X^{W−1})·(1 + X) = 1 + X + X^{W−1} + X^W = X + X^{W−1}`, because `X^W = 1` — the
constant term cancels against the wrap-around. `XRotXor` always re-adds the implicit `x`, so the
canonicalizer emitted a map off by exactly `x`. Three distinct defects, all executed:

| input | old output | correct denotation |
|---|---|---|
| `XRotXor [63]; XRotXor [1]` @64 | `XRotXor [1;63]` — **wrong by `x`** (`f(1)`: `…810` vs `…811`) | `X + X^63` |
| `XRotXor [31]; XRotXor [1]` @32 | `XRotXor [1;31]` — **wrong by `x`** | `X + X^31` |
| `XRotXor [0]; XRotXor [1]` | `XRotXor []` = **identity** | the **zero** map |
| — | `XRotXor []` is also **rejected by `ZetaIrV4.validate`** (term lists must be non-empty) | |

Fixed in two places, because the first fix alone introduces a second bug — recorded because I
walked straight into it:

1. `fromPolyF2Rot` now splits three cases: zero polynomial → `Mul 0`; constant term present →
   emit the other terms; **constant term absent** → factor out the lowest monomial `X^r`
   (spelled `XRotXor [0; r]`) and emit the cofactor `X^{-r}·p`, which does contain `0`.
2. That third case needs **two** ops — so `fuseOps`, which rewrites `XRotXor a :: XRotXor b`,
   would rewrite two `XRotXor` ops into two `XRotXor` ops and **re-enter the same case
   forever**. My first cut did exactly that and hung. The fusion now fires only when the result
   is strictly shorter than the pair it replaces; otherwise the pair is left unfused.
   Termination had to be part of the fix, not an afterthought — my error, caught by the sweep.

Regression tests: `XRotXor fusion whose constant term cancels still preserves denotation`,
`XRotXor fusion that annihilates to the zero map does not become the identity`,
`the canonicalizer never emits an op the v4 validator would reject`, and — the one that pins
termination as well as soundness — `XRotXor fusion is denotation-preserving over EVERY
single-rotation pair, both widths`, exhaustive over all `W²` pairs (1024 at width 32, 4096 at
width 64). All fail on the old code; the sweep also hangs on my intermediate cut.

**Why it survived a Lean certificate.** `src/Core.Lean4/Lean4/CanonicalizerCorrect.lean` proves
`fuseOps_preserves_eval` — but it **re-declares its own `fuseOps`**, and that Lean function's
`xrotxor` case is a single hardcoded literal pattern:

```lean
| Op.xrotxor [1] :: Op.xrotxor [2] :: rest => fuseOps (Op.xrotxor [2, 1, 3] :: rest)
```

The F# function it is named after implements *general polynomial multiplication*. The one
instance Lean pins is correct; the general rule the F# runs was not covered by anything. This is
the vacuity class wearing a proof's clothes: the certificate and the code share a name and not a
definition. Naming it is worth more than the fix.

**`src/Core.Lean4/Lean4/NormalizerCorrect.lean` is sound but narrow.** It is stated over
`UInt64` only; there is no width-32 statement anywhere in it. The good news is structural: both
reduction identities use only `a ⊕ a = 0` and `rot(x,0) = x`, so they are width-agnostic in
form. The width-32 half is now *executed* (`…every shift, both widths` / `…every rotation, both
widths`) rather than proved. Lifting the Lean proof to a width parameter is the honest follow-up.

**Overlap with in-flight work (PR #10807, `ZetaIrEval`, still OPEN).** That PR's evaluator reads
the width from the IR and **refuses shifts `≥ width`** rather than inheriting .NET's shift-count
masking. That refusal is right and it matters here: today `ZetaIrV4.validate` bounds nothing, so
`XorShr 64` is grammatical, and it means *different things* at the two widths under the
`main` evaluator (`x >>> 64` masks to `x >>> 0`, so `XorShr 64` at width 64 is the **zero map**,
while at width 32 `XorShr 32` is likewise zero — but `XorShr 32` at width 64 is a real shift).
When #10807 lands, the checks in this note should be re-pointed at `ZetaIrEval` and the
`s ≥ width` cases in my algebra (`§4`) re-read under its stricter grammar. **Sibling agents:**
the silently-dropped ops in `cross-verify-ir.ts` (§7b) belong to the corruption-exposure audit,
not to me; I looked and did not touch it.

***

## 10. Recommendation: document the split, do not change the grammar

A grammar change is a **v5 bump**, and it is not cheap. Priced:

- a fifth frozen layout module + validator + three-layer→four-layer firewall tests;
- `ofV4` widening and every downstream `ZetaIrV3/V4` reference;
- the emitters: `codegen-from-ir.ts` × 6 lanes, plus the 7-lane `cross-verify-ir.ts`;
- new frozen goldens (`zeta-ir-v5.golden.json`) and a re-run of every `vectors.yaml` route;
- the Lean oracles (`NormalizerCorrect`, `CanonicalizerCorrect`) restated over the new set;
- and — the reason to say no — **every lane must move together**, while the Q# lane cannot
  currently carry four of the six ops it already has (§7b).

Against that, the benefit of *removing* `xorshr` and `rotl` is negative on the portability axis:
both are single instructions everywhere, and deriving them pushes a lowering step into every
backend. The core/derived split is worth **knowing**; it is not worth **enforcing** in the
grammar.

So: **no v5.** What should change is smaller and all documentation-or-test shaped:

1. `ZetaIrV4.fs`'s header should stop pointing at `ZetaIrV4.Tests` for a "necessity proof" — the
   argument is in the header itself, and the quantified falsifier is now in
   `ZetaIrMinimalSet.Tests.fs`.
2. The 2026-06-20 note's `mul` irreducibility line should be struck (Correction 2) and its
   status set to **open** (§6).
3. Add the arity bound to the core-four statement: `XShrXor`/`XRotXor` need arity ≤ 2.
4. **Bound the term lists in `ZetaIrV4.validate`** (`0 ≤ s,r < width`, no duplicates) — today the
   grammar admits shifts whose meaning depends on the host's shift-masking. This is the one
   change I would actually argue for, and it is a validator tightening, not a grammar change.
   (#10807 does the equivalent at the evaluator; doing it at the validator too is belt-and-braces.)
5. Lift `NormalizerCorrect.lean` off `UInt64` to a width parameter.

***

## 11. What is metered and what is still toy

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`:

- **metered** — the two on-file reductions at both widths; the `XShrXor → XorShr` factorisation
  (falsifier: the nasam goldens); `XRotXor` non-derivability from `Rotl` (falsifier: exhaustive
  over the closed rotation monoid); the `add` necessity argument (falsifier: 4000 random
  non-`add` sequences); the unit⇄bijectivity criterion (falsifier: exhaustive at width 16); the
  three canonicalizer regressions (all fail on the old code).
- **unmetered** — the claim that `XRotXor` arity ≥ 3 factors into arity-2 pieces. The elimination
  argument is plausible and the search I wrote found generators only at power-of-two valuations
  and did not close. Stated as open, not as a result.
- **toy** — nothing here is promoted on a matching count. Per
  `.claude/rules/numerology-vs-number-theory.md`, note explicitly that the appealing coincidence
  in this work — *"the invertibility criterion equals the derivability criterion"* — is **not**
  numerology: it is one theorem (`p` is a unit of a local ring) with two corollaries, and both
  corollaries are computed, not matched by cardinality.

## Pointers

- `tests/Tests.FSharp/ZetaIrMinimalSet.Tests.fs` — every executed claim above
- `src/Core/ZetaIrNormalizer.fs` · `src/Core/ZetaIrCanonicalizer.fs` (fixed here) · `src/Core/ZetaIrV4.fs`
- `docs/research/2026-06-20-lumen-zeta-ir-minimal-generating-set.md` — the 6→4 note this corrects and extends
- `docs/research/2026-06-21-lumen-zeta-ir-canonicalizer-design.md`
- `src/Core.Lean4/Lean4/NormalizerCorrect.lean` (UInt64-only) · `CanonicalizerCorrect.lean` (re-declared `fuseOps`)
- `src/Core.QSharp.ReferenceOracle/QuantumArithmeticMix.qs.sketch` — the reversibility argument this note generalises
- `tests/cross-verification/_harness/cross-verify-ir.ts` (7 lanes, 2 ops) · `codegen-from-ir.ts` (6 lanes, 6 ops)
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the governing rule
