# What discretisation costs the BNN lane — and the natural-parameter embedding that does not truncate

**Measured at `origin/main` `6a23b9fc4546cac84e033606ff84616a1cbf5da5`.** Every number below came from a
probe run this pass; every "not in the tree" came from a search whose scope is named.

**Register:** the discretisation costs are **metered** (§1, falsifier ran). The natural-parameter
embedding is **metered as a monoid homomorphism** (§2, 20 000 pairs) and **unmetered as a design
direction** (§2.4 says what it does not buy). The dual-BNN correspondence is **refuted as a partition**
and survives only as a coordinate default (§3). Everything under "milestone" is **proposed**.

> Aaron, 2026-08-23: *"I think discretisation is okay — would it make some things unrepresentable?
> … Not sure if this helps connect BNNs to WSet via dual BNN or some sort of context-free/aware
> syntax/semantics split?"*

## 0. The answer in eight lines

| question | answer | where |
|---|---|---|
| Does discretisation make things unrepresentable? | **Yes — anything outside the grid.** And the failure is not small: a single observation outside a ±5 grid moved the posterior mean 2.38 away from exact **and made it 40× more confident**, with 51.4 % of the mass piled on two edge points | §1.2 |
| What else does it cost? | conjugacy (2 float adds → O(N) per update; measured 238× at N=20 001) and a grid choice you must make before you have seen the data | §1.1, §1.3 |
| Is there a better answer? | **Yes, and it is exact.** Put the *sufficient-statistic coordinates* in `'K`, not the sample space. A `Gaussian` **is** a `WeightedSet<NatCoord, ℝ>` with `|'K| = 2` | §2 |
| Does the monoid framing hold? | **Yes, and it is stronger than "same law"** — an injective monoid homomorphism, measured over 20 000 pairs, extending to the group (EP cavity ↦ `WeightedSet.subtract`) | §2.1 |
| Why did the naive unification fail, then? | `SoftValue` carries **probability** coordinates, where fusion is ⊗-then-renormalise; natural parameters fuse by ⊕. **The bridge is the log map**, measured to 1.1e-16 | §2.2 |
| Does "dual BNN" exist in the tree? | **No.** One prose line in one design doc plus its PR-review archive. No type, no interface, no test | §3.1 |
| Does syntax↔`'K` / semantics↔`'W` hold? | **Refuted as a partition** (state-splitting moves semantics into `'K`). Survives as a *default choice of coordinates*, which is weaker and still useful | §3.2 |
| Are the parsers semiring-generic? | **No.** `Sppf.fs` is hardcoded `float` — literal `1.0`, `*`, `+` — and single-oracle. The Aji–McEliece citation lives in `WSet.fs`, and the parser has never read it | §4 |

Cross-references, not restated here: `docs/design/2026-08-13-factor-graph-soft-value-heterogeneous-bnn-linguistic-seed-bridge.md`
(the parse-forest↔Bayesian story, the inverse-BNN-as-feature-map razor, ANTLR); the soft-regime map in
**PR #14243, still open** — its doc is not on `main`, so it is cited as in-flight; and
`docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-normal-gamma-natural-parameters-round-trips-student-t-does-not.md`
(NG4, PR #14268).

---

## 1. What discretisation costs, against the actual code

The exact path is `src/Bayesian/MinimalBnn.fs`: `likelihood` builds `{ PrecisionMean = x·τ; Precision = τ }`
and `update` does `state.LikelihoodProduct * likelihoodMessage`, where `( * )` at
`src/Bayesian/Message.fs:78` is componentwise addition of `(ν, τ)`. The grid path replaces that with a
weight vector over N sample points, multiplied pointwise by the likelihood and renormalised.

Probe: `/tmp/probe-discretise.ts` this pass, prior `N(0,1)`, observation variance 1.0. It replicates the
two paths side by side and reports the exact posterior against the grid posterior.

### 1.1 Conjugacy — you trade 2 adds for a quadrature

```
update cost: exact = 2 float adds, independent of N. grid = N mults + N adds per observation.
  N=    21  5 updates took 0.016 ms
  N=   201  5 updates took 0.049 ms
  N=  2001  5 updates took 0.465 ms
  N= 20001  5 updates took 3.812 ms
```

The exact form is `O(1)` in the resolution and the grid is `O(N)` — 238× at N=20 001 for the same five
observations. This is the ordinary, expected cost and it is the *least* important of the three.

### 1.2 Unbounded support — this is the one that bites, and it bites hard

```
in-range, 5 obs, grid ±5,  N=201   exact μ=0.833333 var=0.166667 | grid μ=0.833333 var=0.166667 | Δμ=6.66e-16  edgeMass=1.17e-24
one obs at 40 (outside grid)       exact μ=7.333333 var=0.166667 | grid μ=4.953864 var=0.004226 | Δμ=2.38e+0   edgeMass=5.14e-01
one obs at 40, grid ±50, N=201     exact μ=7.333333 var=0.166667 | grid μ=7.333340 var=0.166675 | Δμ=6.99e-6   edgeMass=0.00e+00
```

Read the middle row carefully, because the headline number is not `Δμ`.

- The mean is wrong by **2.38**.
- The variance collapses from `0.166667` to **`0.004226`** — the truncated posterior is **≈ 40× more
  confident** than the correct one.
- **51.4 % of the posterior mass sits on the two edge points**, which is the tell: the grid did not lose
  the outlier, it *relocated* it to the boundary and then treated the pile-up as evidence.

That combination — wrong mean, inflated confidence — is the exact failure class the lane already has
instruments for. `src/Bayesian/HeavyTailFold.fs` exists because *"a member may move the answer
arbitrarily far by raising the precision it claims"*; truncation manufactures precisely that claim with
no member to blame for it. So the answer to *"would it make some things unrepresentable?"* is:

> **The tails, and the tails are the input the non-Gaussian robustness work consumes.** `HeavyTailFold`'s
> redescending influence `ψ(z) = z(ν+1)/(ν+z²)` is a statement about what happens as `|z|` grows. On a
> finite grid `|z|` is capped by the grid, so the mechanism that is supposed to *discount* the outlier
> never sees one — it sees a boundary point with half the mass on it.

### 1.3 Grid placement becomes a modelling decision made before the data

The third row above is the fix and it is also the problem: `±50` is correct here only because we already
knew the observation was 40. The 2026-08-13 design doc anticipated this and made it an interface
obligation — `IBeliefProjection.Support` with *"Caller's choice, never defaulted — the projection is a
lossy decision and must be visible in the diff."* That interface was never built (§5.1). Making the grid
adaptive instead converts the problem into a particle filter, whose fusion step is resampling —
stochastic, hence neither associative nor replayable without carrying the RNG stream. The NG4 doc already
rejected particles for that reason.

---

## 2. The better answer — the shared object is the free module, and it is exhibited

### 2.1 A `Gaussian` already *is* a `WeightedSet`; the keys are the wrong thing to guess

`src/Core/WeightedSet.fs` is `Map<'K,'W>` with `add` folding `sr.Add` per key and **pruning `Zero`**
(`setW`). `src/Bayesian/Message.fs` is `{ PrecisionMean; Precision }` with `( * )` adding both fields and
`One = (0, 0)`.

Define `h : Gaussian → WeightedSet<NatCoord, ℝ>` over the two-element key set `{ν, τ}`, weight = the
coordinate's value. Then:

```
A homomorphism h(a*b)=h(a)+h(b): HOLDS over 20000 pairs
A identity      h(One)=empty:    HOLDS
```

(`/tmp/probe-monoid.ts` this pass, over verbatim-shaped replicas of both operations.) `h(One) = empty`
holds *because* `WeightedSet` prunes `Zero` — the flat message and the empty set are the same object,
which is the identity mapping to the identity. And because `WeightedSet.negate`/`subtract` take an
`IRing`, the homomorphism extends to the group: **the EP cavity `Gaussian.( / )` is
`WeightedSet.subtract`**, improper messages included, since neither carrier forbids `τ ≤ 0`.

**This is an exhibited shared object, not a resemblance.** The object is *the free `'W`-module on a finite
basis*. `WeightedSet<'K,'W>` is the free module on `'K`; a conjugate exponential family in natural
coordinates is a finite-dimensional vector space, i.e. the free module on its sufficient-statistic index
set. Gaussian: `|'K| = 2`. Normal-Gamma (NG4, PR #14268): `|'K| = 4`, `η = (−(β+λm²/2), λm, −λ/2, α−½)`,
fusion `η_post = η_prior + Σ η(data)`.

`numerology-vs-number-theory.md` asks *what else has this number* — and the honest answer is that
"commutative monoid" identifies nothing at all; almost everything in the repo is one. What discriminates
here is not the law but the **exhibited map with its identity and inverse**, checked on 20 000 pairs,
whose failure would be visible. The 8-length precedent is the right comparison and this clears it.

**Aaron's "universal tensor" instinct was right and mis-aimed by one level.** `WeightedSet` even
implements `ITensor<'K,'W>` — the phrase has a referent in the tree. The error was putting the *sample
space* in `'K`. Put the *sufficient statistic index* there and it is exact, finite, and already how the
code is written.

### 2.2 Why the naive unification failed — coordinates, not carriers

`SoftValue.combine a b = observe (fun d -> weightOf d b) a`: pointwise multiply, renormalise. Measured:

```
B combine (Bayes, prob coords) : x=0.30303  y=0.63636  z=0.06061
B WeightedSet.add (prob coords): x=0.7      y=1.0      z=0.3      ← sums to 2.0; not a belief
```

So in probability coordinates, ⊕ is **not** Bayesian fusion — ⊗-then-renormalise is. That is the whole
reason the unification "did not cover the BNNs": `SoftValue` was carried in mean/probability coordinates
where fusion is multiplicative, and `Gaussian` in natural coordinates where fusion is additive. Two
different operations wearing one type.

The bridge is the log map, and it is not approximate:

```
C log-domain add then renormalise vs combine: max abs diff = 1.110e-16
```

A discrete distribution over K points **is itself an exponential family**, whose natural parameters are
the log-probabilities. So in log coordinates its fusion is ⊕ too — which is exactly what
`src/Core.TypeScript/algebra/wset.ts:37`'s `LogProbRing` already is. The unification therefore holds, at
the level of *natural parameters*, for both the discrete and the continuous side. It never held at the
level of sample spaces, and that is the sentence PR #14266 was reporting.

### 2.3 What this buys that discretisation does not

| | discretise the sample space | embed the natural parameters |
|---|---|---|
| support | finite grid, tails truncated (§1.2) | all of ℝ, exactly |
| fusion | pointwise ⊗ + renormalise, `O(N)` | ⊕, `O(dim)` — 2 or 4 |
| error | quadrature + truncation; the truncation is unbounded | none (exact identity) |
| a choice made in advance | the grid | the family |
| `'K` size | as large as resolution demands | 2 (Gaussian) / 4 (NG4) |

The one thing the grid buys is **arbitrary shapes**: a non-conjugate posterior has no finite natural
parameterisation, and the grid does not care. That is a real advantage and it is why this document
recommends the embedding *as the default*, not as a prohibition.

### 2.4 Four honest limits — say these before anyone builds on it

1. **It is a monoid homomorphism, not a semiring homomorphism.** `WeightedSet`'s ⊗ (`scale`, `inner`)
   has no meaning under `h`: scaling a Gaussian's natural parameters is not multiplying Gaussians. This
   directly narrows the in-flight PR #14243 claim that *"a transfer between two parts is a semiring
   homomorphism"* — for this pair, only the additive monoid transfers. Stated as a falsifier: **any test
   asserting `h(scale c g) = scale c (h g)` under a Bayesian reading should fail, and if one passes it is
   testing float arithmetic, not the model.**
2. **The carrier has no properness invariant.** `WeightedSet<NatCoord, ℝ>` is all of ℝ²; proper Gaussians
   are the half-space `τ > 0`. The embedding is faithful *and* the codomain admits states the model does
   not. This is the opposite defect from truncation and it is not free — `Gaussian.isProper` exists for
   this reason and would have to be carried alongside, not inside, the weighted set.
3. **The type does not carry the interpretation.** A `WeightedSet<string, float>` over grid points and one
   over natural coordinates have the same type and adding them typechecks and means nothing. "One
   substrate" is a claim about carriers; it is not a claim about composability, and conflating the two is
   how a universal type becomes a universal bug.
4. **Float weights cannot legally reach shared state.** See §5.2 — this is the live consequence nobody
   has written down yet.

---

## 3. The dual BNN — checked, then tested

### 3.1 It is not in the tree

Searched at `6a23b9fc45`: `git grep -i 'dual[ -]?bnn'` over the whole worktree returns **nothing**. Widening
to `two BNNs|BNN pair|pair of BNNs|second BNN|paired BNN` returns exactly one line —
`docs/design/2026-08-13-…-linguistic-seed-bridge.md:376`, *"plausibly two BNNs at different depths"* —
and that line is a **reviewer's proposal being evaluated**, not a repo concept. `inverse bnn` returns the
same file plus its PR-review archive (`PR-10419`). No type, no interface, no test, no second module.

Nor were the interfaces that document proposed ever built: `ILexicalChannel`, `IChannelSplit`,
`IProductionPrior`, `IBeliefProjection`, `ICalibratedBelief` appear **only** in that doc and its archived
review. And `MinimalBnn` / `MultilayerBnn` have **zero consumers in `src/`** — the only files naming them
are themselves and their two test files.

So: Aaron is remembering an intention as work, which is the pattern already on file. It is a good
intention and the design doc that razored it (*"the inverse BNN is a feature map, not a second stack"*)
is still the strongest thing written about it. The upside of the emptiness is that there is nothing to
break.

### 3.2 Does syntax↔`'K` / semantics↔`'W` hold? Half of it is exhibited; as a partition it is refuted

The appealing half is real and checkable. `Sppf.expectedCounts : (int -> float) -> Forest -> Map<int, float>`
returns a map from production index to expected count. **That is a `WeightedSet<prodIndex, float>` in all
but the type name** — discrete grammar structure in the keys, continuous evidence in the weights. The
correspondence is not imagined; one function already returns the object.

The partition claim is where it fails, and the counterexample is standard rather than exotic:

> **State-splitting.** A context-sensitive distinction can be absorbed into the *key* by refining the
> nonterminal alphabet (latent annotations / parent annotation — Johnson 1998, Klein & Manning 2003,
> Petrov & Klein 2007; *cited from standing knowledge, not page-checked*). Semantics moves into `'K`.
> Conversely a purely structural preference can be expressed as a weight. **Neither side of the split is
> confined to its coordinate**, so `'K`/`'W` is not a partition of syntax/semantics.

What survives is weaker, true, and more useful than the analogy:

> **`'K` vs `'W` is a choice of where to put context, and the two choices have different algebraic
> consequences.** Enrich `'K` (context in the key) and the fold stays `'W`-linear, so it remains
> DBSP-incremental and stays inside the `WSet.apply` discipline — *"every operator here is `'W`-LINEAR;
> the ring's nonlinear step is applied at the OUTER BOUNDARY only, never inside the loop"*
> (`src/Core/WSet.fs` header). Condition `'W` on context instead and the operator is no longer linear in
> the weights, and that discipline is broken.

That is the real design fork behind Aaron's dual-BNN intuition, and it is decidable rather than
aesthetic. It also lines up with the interfaces the 2026-08-13 doc already drafted: `IProductionPrior`
(weight from the production alone) versus `IContextualProductionPrior` (weight from production *and*
span *and* features). The honest restatement of the dual BNN is therefore:

- **BNN₁ — context-free:** does not need a BNN at all. `Sppf.expectedCounts` is the inside–outside EM
  E-step; renormalise per LHS and iterate. That is Lari–Young, already implemented, exact on a DAG.
- **BNN₂ — context-aware:** the one place a BNN earns its keep, as a *function into the weight ring*.

And the Chomsky-hierarchy caveat has to ride along: soft weights do not move a grammar up the hierarchy.
A weighted CFG is a CFG. What changes is which parse wins.

---

## 4. Are the parsers semiring-generic? No — and this is the shortest gap to close

`src/Core/Sppf.fs` at `6a23b9fc45`:

```fsharp
let inside (weight: int -> float) (f: Forest) : Map<Node, float> =
    …
    let childProduct = fam.Kids |> List.fold (fun acc k -> acc * ins k) 1.0
    let w = if fam.Prod < 0 then 1.0 else weight fam.Prod
    w * childProduct
```

`float` in the signature, `1.0` as ⊗-identity, `*` as ⊗, `List.sumBy` as ⊕. `outside`, `marginals`,
`expectedCounts` and `weightedTrees` are the same. There is no `ISemiring<'W>` parameter anywhere in the
file. **The parser is the probability semiring, hardcoded.**

That is worth saying precisely because the repo *already carries the theorem that says it need not be*.
`src/Core/WSet.fs` and `src/Core.TypeScript/algebra/wset.ts` both quote Aji & McEliece 2000 verbatim, and
`wset.ts` ships `LogProbRing`, `TropicalRing` and `IntegerRing` side by side. **The citation is in the
substrate; the parser has never read it.** So the connection is *proposed*, not built, and not
coincidental — the identification is correct mathematics with an unbuilt code path.

What generalising would buy, concretely: Viterbi (max-×) is the *same* pass over the tropical semiring,
so `inside` over `TropicalRing` is the best-parse score with no second implementation; the log-probability
ring removes the underflow that a long product of production weights guarantees; and the counting
semiring makes `parseCount` and `inside` literally the same function. Today each of those is either a
separate implementation or absent.

Two further facts, both checked:

- **`Sppf` is single-oracle.** F# only — no C#/TS/Rust twin, no golden vectors. So the parse layer is
  outside the four-oracle byte-lock entirely.
- **There is still no parser combinator library**, and the 2026-08-13 finding stands. The
  `CustomOperation`/builder surfaces in `src/` are `ZetaSqlBuilder.fs`, `Result.fs`, `Meno.fs`,
  `AgentIntegrate.fs`, `Dsl.fs`, `SagaBuilder.fs`, `TriBoolean.fs` and **`LinguisticSeed.fs`** — the last
  of which is new relative to that doc and is *not* a parser.

### 4.1 The computational-expression tie-in, and a case where genericity is the wrong move

`src/Core/LinguisticSeed.fs` is the CE Aaron is remembering: `Kernel<'x> = 'x -> 'x -> float`, with
`sum`, `product` (Schur), `scale`, `pullback` and a `gram` witness — PSD by construction because only
Mercer-closure operations are exposed. Its `sum`/`product` **are** ⊕ and ⊗ and it is **also** hardcoded to
`float`.

But here the hardcoding is correct and generalising it would be a mistake. The module's entire value is
the theorem *"compositions outside the closure can't be expressed, so they can't break PSD"* — and PSD is
a property of ℝ with its order. Over the tropical or Boolean semiring there is no Schur product theorem to
preserve. **So `LinguisticSeed` is a case where `float` is the model, not an unparameterised default**,
and a sweep that "made the soft regime semiring-generic" would silently delete a proof. Worth recording
because the sweep is the obvious next thought after §4.

`Meno.fs`'s `MenoBuilder` (`Return`/`Bind` over `arr`) is the other half — the Kleisli CE. If a
"meta-language mapping" is wanted, the syntax already exists in these two builders; what is missing is
the weight-ring parameter, not the notation.

---

## 5. Two consequences nobody has written down yet

### 5.1 The 2026-08-13 design landed and its code did not

Five interfaces proposed, zero built, ten days on. The parse layer's integration surface is still *"one
function argument"* and the argument is still unsupplied. This is not a criticism of that document — it
is the reason the milestone in §6 is deliberately tiny.

One correction *to* that document, in its favour: its **B1** (`MultilayerBnn.backward` is an algebraic
identity) has since been **fixed**. The module header now records the defect and the cavity is real
(`Gaussian.divide (localBelief (i-1)) down.[i-1]`, line 237). B2 and B3 are not re-checked here.

### 5.2 A BNN posterior cannot legally cross into shared state — a live consequence of PR #14266

`src/Core/WireWeight.fs` makes "float never crosses the boundary" a property of signatures:
`WeightedSetWire.toDynamicValue` demands a `WireWeight<'W>`, the constructor is `internal`, and
**no `WireWeight<float>` exists**. A `Gaussian` is two floats. Therefore, under §2's embedding, a BNN
posterior encoded as a `WeightedSet<NatCoord, float>` is **local-only by construction** — it cannot be
gossiped, put in a golden vector, or entered into a society fold that crosses machines.

That is the correct outcome (float addition is not associative, so two nodes folding the same evidence in
different orders diverge), and it means **the exact-weight question is on the BNN lane's critical path,
not adjacent to it.**

And the exact path is not ready. `ProbabilitySemiring.Rational` is `{ Num: int64; Den: int64 }`; `rat`
guards `Int64.MinValue` and division by zero and **does not check overflow**. `WireWeight.fs` already
records this honestly — *"a long chain of exact multiplications will wrap silently … the unbounded fix is
a `bigint` rational — which is exactly what the TypeScript sibling `exact-weight.ts` already uses."* So
the defect is known. What is **not** recorded is what it does across the oracles.

**Measured this pass, same input `add(1/4·10⁹, 1/3·10⁹)` and `mul` of the same, verbatim replicas of each
oracle's own source:**

| oracle | `add` | `mul` | note |
|---|---|---|---|
| TypeScript (`probability-semiring.ts`, `number`) | `{n: 7, d: 12000000000}` | `{n: 1, d: 12000000000000000000}` | **mathematically exact** — both fit a double exactly |
| F# (`int64`, unchecked) | `{Num = -13671875; Den = 12591297018963968}` | `{Num = -1; Den = 6446744073709551616}` | wraps; **a negative probability** |
| Rust release (`i64`) | identical to F# | identical to F# | wraps |
| Rust debug — **the `cargo test` default** | *panic: attempt to multiply with overflow* | *panic* | different failure, not a different value |
| C# (`long`, no `CheckForOverflowUnderflow` in the csproj) | not separately executed | not separately executed | same runtime and unchecked IL as F#; **inferred, and labelled as inferred** |

Three distinct behaviours on one input: an exact answer, a silently wrong negative one, and a panic. And
`golden-vectors.json` carries no integer of six digits or more — its own header says *"Seed values stay
within the safe-integer range."* **A lock whose vectors never reach the divergent path is not a lock**,
which is the same lesson as the tie-break divergence found in PR #14266.

Note the direction, because it is counter-intuitive and matters for the fix: **TypeScript is the correct
one here.** Doubles are exact on integers up to 2⁵³ and *degrade by rounding* rather than wrapping above
it, so TS diverges from the `int64` oracles in *both* regimes — right below 2⁶³ and differently-wrong
above 2⁵³. Widening F#/C#/Rust to arbitrary precision does not by itself close this; the TS side must
move to `bigint` too, and `exact-weight.ts` shows that half is already written for the *other* WSet.

### 5.3 What a bigint widening actually costs — Aaron's cross-oracle requirement is the hard half

> *"f# has dotnet bigint as long as we bitlock it so all our bigints work the same across all language
> oracles."*

Correct on the first half — and `src/Core/WSet.fs` already uses `bigint` for its sequence numbers
(lines 169, 177, 184, 193, 200, 205, 210–211, 218, 301, 348) and `ClaimLane.fs:312` for factorials. So
`int64` in `ProbabilitySemiring` was a **choice**, made in a file two doors from arbitrary precision.

The second half is where the work is:

- **Rust has no std bigint.** Zero matches for `num-bigint` / `BigInt` anywhere under `src/`. This is a
  **dependency decision**, not a syntax change, and it is the first thing to settle.
- **Division and modulo sign.** Verified this pass rather than assumed, because `normalize` runs a gcd
  and places a sign: **.NET `BigInteger` and JS `bigint` agree** — `-7/2 = -3`, `-7 % 2 = -1`,
  `7 / -2 = -3`, `7 % -2 = 1`; both truncate toward zero and `%` takes the dividend's sign. Rust
  `num-bigint` is **unverified** here (the crate is not in the tree).
- **Which side carries the negative.** All four current implementations normalise the sign into the
  numerator with a positive denominator, and F# is the only one that rejects `Int64.MinValue`. Rust's
  `n.abs()` on `i64::MIN` panics in debug and wraps in release; TS has no equivalent value. That guard
  asymmetry disappears under bigint, which is a real simplification.

**If bigint rationals are adopted, the golden vectors must include a negative rational and a gcd
reduction that only bites above 2⁶³** — because that is where the conventions differ, and a vector that
stays in the safe range is decoration.

---

## 6. The bounded first milestone

The smallest thing that makes one of these checkable, and it is deliberately *not* the biggest one.

> **`src/Bayesian/MessageWeightedSet.fs` (or an equivalent in `Zeta.Core`): `toWeightedSet` /
> `ofWeightedSet` between `Gaussian` and `WeightedSet<NatCoord, float>`, plus the property tests that
> make the homomorphism a falsifier rather than a claim.**

Four tests, three of which must be able to fail for the right reason:

1. `toWeightedSet (a * b) = add (toWeightedSet a) (toWeightedSet b)` over generated pairs (positive).
2. `toWeightedSet Gaussian.One = WeightedSet.empty` (identity ↦ identity; depends on `Zero` pruning).
3. `toWeightedSet (a / b) = subtract (toWeightedSet a) (toWeightedSet b)`, **including improper results** —
   the EP cavity must survive the round trip, since forbidding `τ ≤ 0` would break Minka 2001.
4. **The negative control, and the one that stops this being numerology:** a discrete belief's
   `SoftValue.combine` is **not** `WeightedSet.add` in probability coordinates, **and is** `WeightedSet.add`
   in log coordinates up to the normaliser. Measured this pass at `1.110e-16`; as a test it pins the
   sentence *"the bridge is the log map"* to something that fails if the sentence is wrong.

Roughly one file plus one test file. It touches no existing behaviour, adds no class, needs no `WireWeight`
(it is local-only by §5.2, honestly), and it is the object every later question rests on. `NatCoord` is a
two-case DU, so it satisfies `'K : comparison` without a wrapper.

**Deliberately not in the milestone,** each for a stated reason:

- Making `Sppf` semiring-generic — larger, and it should be preceded by a decision about whether the
  parse layer joins the four-oracle byte-lock at all (today it is F#-only).
- Widening `Rational` to bigint — blocked on the Rust dependency decision (§5.3), and it needs its own
  golden vectors on the divergent path. Filed, not folded in.
- Anything called a dual BNN — there is nothing to extend (§3.1), and the split it wants is a choice of
  where context lives (§3.2), not a second architecture.
- A grid/`IBeliefProjection` path — §1 says what it costs; if it is built later it should be built
  *knowing* it truncates, with the support in the signature as that doc already specified.

---

## 7. Anchors (Beacon)

**Checked in-repo this pass** (read at `6a23b9fc45`): `src/Bayesian/{Message,MinimalBnn,MultilayerBnn,HeavyTailFold}.fs`,
`src/Core/{WeightedSet,WSet,SoftValue,WireWeight,ProbabilitySemiring,Sppf,LinguisticSeed,Meno}.fs`,
`src/Core.CSharp/ProbabilitySemiring.cs`, `src/Core.Rust.ProbabilitySemiring/src/lib.rs`,
`src/Core.TypeScript/probability-semiring/`, `src/Core.TypeScript/algebra/{wset,exact-weight}.ts`,
`docs/design/2026-08-13-…-linguistic-seed-bridge.md`, the NG4 doc, and PR #14243's doc from its head
`fc2b4f37f3`.

**External, cited from standing knowledge and NOT re-opened or page-checked** — each is a citation whose
entailment has not been verified this pass:

- **Aji & McEliece 2000**, *The Generalized Distributive Law* — already quoted verbatim in `WSet.fs` and
  `wset.ts`; the theorem §4 says the parser has not yet used.
- **Kschischang, Frey & Loeliger 2001** (sum-product); **Minka 2001** (EP cavity) — already in `Message.fs`.
- **Baker 1979; Lari & Young 1990** (inside–outside); **Billot & Lang; Scott 2008** (SPPF) — already in `Sppf.fs`.
- **Johnson 1998; Klein & Manning 2003; Petrov & Klein 2007** — parent annotation / latent state-splitting;
  the counterexample in §3.2.
- **Chomsky 1956** — the hierarchy; the caveat at the end of §3.2.
- **Mercer; Schur** — the PSD closure `LinguisticSeed` depends on (§4.1).

### 7.1 The Gustafson anchor for "middle-out" — already in the repo, and it entails two of three

Checked, and the premise that this is an unanchored Mirror coinage is **false at the tree**:
`docs/PRIOR-ART-LIST.md` line 195 already carries ***"Gustafson unum/posit (= 'universal number';
variable-precision numbers that track their own resolution — the cousin anchor)"***, and
`docs/research/2026-08-14-ieee-754-is-the-rare-case-middle-out-floats-…md:39` names it again as prior art
the interface *"already names (Beacon)"*.

The useful thing left to do is the entailment check, so — **from standing knowledge, not page-checked**:

| repo claim for "middle-out" | Gustafson | verdict |
|---|---|---|
| a float that **tracks its own precision** | **Unum Type I** (*The End of Error*, 2015): the **ubit** marks exact vs "lies in the open interval between representables", with variable-width exponent/fraction fields carried in the number | **entailed** — this is the same property, published |
| **tapered precision** / most resolution in the middle of the range | **Posits** (Gustafson & Yonemoto, *SFI* 2017): run-length **regime** bits give maximum precision near 1.0, tapering to the extremes | **entailed** |
| the **middle field decodes the ends**, and the decoder itself can be *held* (`N`) | posit regime is **leading**; unum utag is **trailing**; neither is tri-valued and neither has an "I do not know how to read this" state | **not entailed** — this part is genuinely the repo's own |

And the difference the coordinator's hedge got right: **Gustafson's formats are lossy with tracked bounds;
a rational is exact.** Siblings, not the same thing — which is exactly why `exact-weight.ts` chose a
bigint rational over a ball/interval, with the reason stated in its own header (*"in the sum-product
domain the operations are purely {+, ×, negate} — all closed over ℚ"*). So the anchor holds for the
precision-tracking half, does not cover the middle-placement half, and does not cover exactness at all.
Nothing to add to `PRIOR-ART-LIST.md`; the row is already there and already correct.

## 8. Governing rules

`toy-is-free-metered-must-be-earned.md` (the register header; §2 is metered as a homomorphism and
unmetered as a direction) · `numerology-vs-number-theory.md` (§2.1 exhibits the shared object rather than
sharing a law; §3.2 refutes the appealing partition) · `anchor-to-human-prior-art.md` and the
checked-anchor doctrine (§7, §7.1 — entailment checked, page-checking honestly declined) ·
`interfaces-free-classes-earned-under-rules.md` (§6 adds two functions and a DU, no class) ·
`dv2-data-split-discipline-activated.md` #4 DST and #7 noninterference (§1.3: a particle filter's
resampling is why the grid's adaptive fix is not free) · `no-binary-in-proof-lineage.md` (§5.3: the
golden vectors that must reach the divergent path are hex/decimal-in-JSON, as they already are).
