# CGA is M₂(Cl(3,0)) — Q4 answered, and the LP ceiling that prices a reservoir

**Register:** Beacon. Every number below is computed in this document's own checks
(`bun`, no network, deterministic), not cited, and they live in
`src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.ts` with 20
falsifiers next to them. Where something is taken on standing knowledge rather than
checked, it says so at that line.

Aaron 2026-08-26, two observations in one message:

> *"if it closes into a sphere then i think some of the recent AI advancements could
> help in some cases based on sphere packing in n dimensions."*

> *"the BNN and clifford are both multi towered, we have multiple different
> implementations and have not decided on a correct one for these use cases … you can
> improve too to better fit the tasks, or suggest alternatives."*

The two halves turn out to meet in one place, and this document is mostly about that
place. **The conformal embedding is the object where "spatial reasoning in n dimensions"
and "sphere packing in n dimensions" stop being an analogy and become the same algebra.**

---

## 0. The standing hold, and what this document does not do

`081M0R18878087G0R001XY5A2J` holds all Clifford-**GPU** work — no code, lowering,
classifier, or measurement — until five questions come back from the math team. Aaron
2026-08-23: *"route this to math team first, then we code after they have us some solid
theoretical formal analysis."*

**Nothing here starts implementation.** What it does is *answer Q4*, which is one of the
five exit conditions:

> **Q4** — Does CGA compose with the in-tree Clifford substrate (`Cl3.fs`,
> `CliffordPeriodicity.fs`, the `CliffordE8*` lineage), or are they distinct algebras
> sharing a name?

The row states its own exit: *"The math team returns on Q1–Q5. Each answer lands with its
refutation condition addressed."* Q4 is settleable with the module the repo already has,
so it is settled below. Q1, Q2, Q3, Q5 remain open and the hold remains in force.

---

## 1. Q4, answered: they are the same tower, one suspension apart

### The instrument

`src/Core/CliffordPeriodicity.fs` classifies `Cl(p,q)` up to Morita type by the
Atiyah–Bott–Shapiro clock `s = p − q (mod 8)`. It is labelled `metered` in its own
docstring, and the meter is real: `dimensionOfType` reconstructed from the Morita type
must equal `2^(p+q)` for every signature, so a permuted table row goes red.

The table was transcribed to TypeScript so the checks can run in jobs without a .NET
toolchain — and then **cross-verified against the F# module itself**, which is the check
that actually matters. `tools/setup/install.sh` provides dotnet 10.0.400;
`src/Core.TypeScript/research/testdata/dump-clifford-grid.fsx` loads
`CliffordPeriodicity.fs` directly and emits the authority's own classification for every
signature, and the transcription is diffed against that.

```
CHECK 0  cross-oracle vs Zeta.Core.CliffordPeriodicity, 169 signatures:  ZERO divergence
CHECK 1  dim invariant over 169 signatures (p,q ≤ 12):                        PASS
CHECK 2  Cl(0,1)=M₁(C)  Cl(0,2)=M₁(H)  Cl(1,3)=M₂(H)  Cl(3,1)=M₄(R):          PASS
CHECK 3  Cl(p+1,q+1) ≅ M₂(Cl(p,q)) over 121 signatures:                       PASS
```

CHECK 0 is the load-bearing one and it is deliberately **not** a re-export: the golden
vector is generated *by the F# module* and consumed *by the TypeScript*, so agreement is
evidence rather than self-consistency. A re-export would agree by construction and check
nothing — the vacuity class. The golden vector is text, per
`.claude/rules/no-binary-in-proof-lineage.md`, so every byte of it diffs and merges.

Break-red confirms all of it discriminates: seven mutations to the module (dropped `+ 8`
normalisation, permuted exponent row, dropped `½` in the embedding, flipped null-pair sign,
`5` for `6` in the budget, `2V=2E` for `3V=2E`, dropped `½` in α*) each turn tests red, as
does corrupting a single row of the golden vector or emptying it.

CHECK 2 is the same four independently-known small cases the F# test suite uses. CHECK 3
is the **suspension isomorphism** and it is the whole answer.

### The answer

| algebra | | s | Morita type | dim_ℝ |
|---|---|---|---|---|
| **CGA (3D)** | `Cl(4,1)` | 3 | M₄(**C**) | 32 |
| **in-tree** | `Cl(3,0)` | 3 | M₂(**C**) | 8 |
| CGA rotors | `Cl⁰(4,1) ≅ Cl(4,0)` | 4 | M₂(**H**) | 16 |
| in-tree | `Cl(8,0)` | 0 | M₁₆(**R**) | 256 |
| STA | `Cl(1,3)` / `Cl(3,1)` | 6 / 2 | M₂(H) / M₄(R) | 16 / 16 |

**They are not distinct algebras sharing a name.** `Cl(4,1)` and `Cl(3,0)` sit at the
*same* clock position `s = 3`, over the same ground field **C**, neither split — and by
the suspension isomorphism checked above,

> **CGA(3D) = Cl(4,1) ≅ M₂(Cl(3,0))**

32 = 4 × 8, and M₂(M₂(C)) = M₄(C). The in-tree `Cl3` is not a competitor to CGA. **It is
the entry type of the matrix CGA is built from.** Adding one positive and one negative
generator — exactly the two null directions `n₀`, `n∞` that the conformal embedding needs
— walks one step up the suspension ladder and changes nothing about the ground field.

**The one genuine discontinuity, and it is worth naming.** The *rotor* group does not
inherit. `Cl⁰(4,1) ≅ Cl(4,0)` lands on `s = 4`, which is **quaternionic** — M₂(H) — while
`Cl(3,0)`'s own rotors are complex. So conformal rotors are 2×2 quaternionic objects and
are **not** a reuse of the in-tree rotor path. Whoever implements them writes new
arithmetic. That is a cost, it is structural rather than incidental, and it should be in
the estimate.

### The refutation condition

Q4's answer is wrong if the suspension isomorphism fails, or if the ABS transcription is
wrong. Both are checked above and both are falsifiable by the checks themselves — CHECK 3
prints the offending signature on failure rather than a count.

### The limit of this answer

This settles the **algebraic** half of Q4 — do the two objects compose. It does not settle
whether CGA is the right *modelling* choice, which is Q3's territory (can a Normal-Gamma
posterior be exhibited as a region under a named metric, with a stated approximation
error). §3 below is external evidence bearing on it, not a proof.

---

## 2. The conformal embedding: distance IS the inner product, in any dimension

Aaron, earlier in the same thread:

> *"spatial reasoning can also be used for many distance metrics even those unrelated to
> 2d/3d, it can be generalized to n dimensions over any search space that can [have] a
> distance metric defined."*

This is exactly right and it has a name and an identity. The conformal embedding of ℝⁿ
into `Cl(n+1,1)` sends a point to a null vector,

```
P(x) = x + ½|x|²·n∞ + n₀        n₀² = n∞² = 0,   n₀·n∞ = −1
```

and then

```
P(x) · P(y) = −½ |x − y|²
```

Checked over 200 random pairs per dimension, seeded from `COMMON_SEED = 4` (no ambient
entropy):

```
  n=  1  Cl(2,1)     worst relative error  7.11e-15
  n=  2  Cl(3,1)                           1.42e-14
  n=  3  Cl(4,1)                           4.94e-15
  n=  4  Cl(5,1)                           7.15e-16
  n=  8  Cl(9,1)                           4.78e-16
  n= 16  Cl(17,1)                          3.77e-16
  n= 24  Cl(25,1)                          5.57e-16
  n= 64  Cl(65,1)                          1.49e-15
  n=256  Cl(257,1)                         2.05e-15

  P(x)·P(y) = −½|x−y|²  in every dimension tested: HOLDS (worst 1.42e-14)
  P(x)·P(x) = 0  (points lie on the null cone): worst |value| = 0.00e+0
```

**Why this is the load-bearing identity for the whole ask.** The generalisation Aaron
wants is not an aspiration to be engineered — it is a property of the construction. Give
the conformal embedding *any* set with a squared-distance function and the algebra's inner
product *is* that function. Nothing in the derivation mentions 3, or space. `Cl(n+1,1)` is
the general case and `Cl(4,1)` is the n=3 instance.

**And this is where the second half of Aaron's message lands.** In CGA a **sphere is a
grade-1 blade** — the same grade as a point, distinguished only by squaring positive
instead of null. Points, spheres, planes, circles and their intersections are all elements
of one linear space, and the operations on them are inner products of the kind checked
above. So:

> **Sphere packing in n dimensions and spatial reasoning in n dimensions are questions
> about the same objects in the same algebra.** Not an analogy — the same `Cl(n+1,1)`.

That is the connection Aaron asked for, and it runs through the conformal embedding rather
than through the pentagon count. §5 is about what does *not* connect.

---

## 3. External convergence — the same choice, arrived at empirically

The literature has run the tower comparison as an experiment. *Euclidean, Projective,
Conformal: Choosing a Geometric Algebra for Equivariant Transformers*
([arXiv:2311.04744](https://arxiv.org/abs/2311.04744), the GATr line) compares exactly the
three candidates and concludes, in its own abstract's words:

- **Euclidean** — *"computationally cheap, but has a smaller symmetry group and is not as
  sample-efficient"*
- **Projective** — *"not sufficiently expressive"*
- **Conformal**, and an improved projective — *"define powerful, performant
  architectures"*

Two things about this are worth stating precisely.

**It converges with §1 from an unrelated direction.** §1 is pure algebra: CGA is a
suspension of the in-tree Cl(3,0). The paper is empirical: plain Euclidean GA is the one
that underperforms on sample efficiency. Same conclusion, independent method — and note
the *reason* given is the symmetry group, which is precisely what the two extra null
generators buy.

**It is not a substitute for Q3.** Sample efficiency on equivariant transformers is not
the same claim as "a Normal-Gamma posterior is a region under a named metric with a stated
error." Convergent external evidence raises the prior on the tower choice; it does not
discharge the held question. The register stays `unmetered` for our use case.

**A caveat I am obliged to record:** the conclusions above are from the paper's abstract.
The full comparison, and the exact signatures each variant uses, were not read in this
pass. Treat the three bullets as reported, not verified.

Also surfaced in the same search and **not** assessed here: CliffordNet / Clifford Algebra
Network (Ji 2026), Versor rotor-based state evolution (Huy & Hirst 2026), Clifford Group
Equivariant Neural Networks (Ruhe et al. 2023,
[arXiv:2305.11141](https://arxiv.org/abs/2305.11141)) and its simplicial message-passing
successor ([arXiv:2402.10011](https://arxiv.org/pdf/2402.10011)). The last of these is the
closest to our factor-graph shape and is the one worth reading next.

---

## 4. The BNN towers — what is actually there, and the one gap that is not blocked

Aaron: *"instead of having pure traditional BNN layers we allow multiple layers to compose
under higher layers so it's more of a graph/dag rather than linear chain."*

Surveyed: **8,488 lines** of F# under `src/Bayesian/` (44 modules) and **8,067 lines** of
TypeScript across `src/Core.TypeScript/{bayesian,planning,oracle}/`. The relevant three:

| module | topology | status |
|---|---|---|
| `MinimalBnn.fs` (126 ln) | one inference cell | the unit |
| `MultilayerBnn.fs` (370 ln) | `Sequential` \| `SkipConnections of (int*int) list` | chain + residuals |
| `FactorGraph.fs` (227 ln) | **arbitrary**, generic over `IMessage<'M>` | already a DAG |

**The finding: the DAG already exists, one layer down, and `MultilayerBnn` does not use
it.** `FactorGraph` is a general bipartite sum-product engine over arbitrary topology,
generic in the message algebra. `MultilayerBnn` is a hand-rolled chain whose `Topology` DU
admits skip edges — which *is* a DAG — but whose backward sweep only walks the sequential
links. Its own docstring says so and names the fix:

> *"Under `SkipConnections` the graph is loopy: the forward sweep carries skip evidence but
> the backward sweep sends downward messages only along the sequential links, so the result
> is a first-order approximation rather than the exact marginal.
> `FactorGraph.runToFixpointDamped` is the upgrade path."*

So the swappable-capability composition Aaron wants is **not blocked by the Clifford hold
at all** — it is a re-expression of `MultilayerBnn` onto the factor-graph engine that is
already in the tree, and the module has been carrying a signed note saying which function
to call. Filed as a work item rather than started here, because it is a real slice and not
a drive-by.

`ThousandBrains.fs` (98 ln) already implements the Hawkins voting structure Aaron named —
independent columns, IV-weighted lateral votes, log-scaled so no column becomes a
dictator. It is **the natural consumer of a DAG topology** and currently has no spatial
component at all: a column's belief is a scalar Gaussian. That is the seam where §2's
conformal embedding would attach — a column believing about a *location* rather than a
*number* — and it is the concrete form of "Clifford inside the factor graphs," should Q1–Q5
come back favourably.

---

## 5. The reservoir: three senses of "hexagonal", and a curvature budget of 12

### The disambiguation, extended

The prior document in this thread separated two senses of "hexagonal" on Aaron's
instruction. Surveying the code turned up a **third**, and it changes the answer.

| sense | meaning | where |
|---|---|---|
| 1. hexagonal **architecture** | ports and adapters | `ace`, the verb/noun interface — Aaron explicitly excluded this |
| 2. hexagonal-**six** = **hexahedron** | a 6-**faced** solid: the cube | **`src/Core/HexCore.fs`** — the six reservoir walls |
| 3. hexagonal **tiling** | 6-**sided** faces | the buckyball sense Aaron invoked |

Senses 2 and 3 are *both* about reservoir walls and are *not* the same geometry.
`HexCore.fs` is explicit: *"the 12 words are the 12 edges of the Cube-of-Space hexahedron
and the 6 walls are its 6 faces."* That is V=8, E=12, F=6.

**8 − 12 + 6 = 2. The reservoir walls, as implemented, already close.** The buckyball
question — *"we need hexagonal walls for the reservoir to be fully closed"* — turns out to
apply to a wall geometry the repo does not currently have. Under sense 2 the closure Aaron
is asking for is already there; under sense 3 it needs twelve pentagons.

### The invariant that unifies both

For any **trivalent** closed polyhedron (three faces at every vertex), eliminating V and E
from `3V = 2E`, `2E = Σ k·F_k`, `V − E + F = 2` gives

> **Σ (6 − k)·F_k = 12**

Computed:

```
solid                          Σ(6-k)F_k    χ      closes?
tetrahedron                          12     2      sphere
cube (hexahedron)                    12     2      sphere
dodecahedron                         12     2      sphere
truncated tetrahedron                12     2      sphere
truncated octahedron                 12     2      sphere
truncated icosahedron (C60)          12     2      sphere
C70 fullerene                        12     2      sphere
C240 fullerene                       12     2      sphere
hexagons only (1000 of them)          0     0      TORUS — does not close
```

**The 12 is a curvature budget, and the solids differ only in how they spend it:**

```
  cube        6 squares   × (6−4)=2  = 12
  buckyball  12 pentagons × (6−5)=1  = 12
  tetrahedron 4 triangles × (6−3)=3  = 12
  hexagons               (6−6)=0     =  0   ← can never pay for closure
```

This *strictly generalises* the previous document's result. "Hexagons force exactly twelve
pentagons" is the `k ∈ {5,6}` special case of a budget that every closed trivalent solid
pays. And it dissolves the apparent conflict between senses 2 and 3: the cube and the
buckyball are **the same closure, differently financed**. The reservoir does not need
pentagons; it needs to pay 12, and six squares already do.

### A coincidence, labelled as one

`HexCore.fs` has 12 edges. The curvature budget is 12. **These are different twelves**, and
the check is one line:

```
  tetrahedron   edges=  6   budget=12   different
  cube          edges= 12   budget=12   EQUAL
  dodecahedron  edges= 30   budget=12   different
  C60           edges= 90   budget=12   different
```

The equality holds at the cube and nowhere else. Per
`.claude/rules/numerology-vs-number-theory.md` this is recorded as a **coincidence**, not
an identification — a memory index, with its register stored alongside it so it can never
quietly become a belief.

The same discipline disposes of a more tempting one: the **kissing number in 3D is also
12**. Different structure — the pentagon count is topological, exact, and independent of
the solid's size; the kissing number is a metric optimisation that took until
Schütte–van der Waerden (1953) to settle and whose easy area bound gives 14.9, not 12.
Same integer, unrelated forcing. *(Both attributions from standing knowledge, not
page-checked.)*

---

## 6. Sphere packing: what attaches, and what does not

Taking the constants from the paper Aaron pasted and checking the arithmetic:

```
α*  = ½log₂(2π/e)   = 0.604401
2^(−α*)             = 0.657745
√(e/2π)             = 0.657745        agree to 0.00e+00
```

So the two statements in the paper — the exact LP rate `lim LP_d^{1/d} = √(e/2π)` and the
bound `Δ_d ≤ 2^{−(α*+o(1))d}` — are **the same statement**, which is a good sign the
transcription is faithful. *(The comparison point, Kabatianskii–Levenshtein 1978 at 0.5990,
is taken on standing knowledge and not page-checked. The improvement in the exponent is
then 0.0054.)*

### What actually attaches: reservoir capacity is a spherical code

This is the real connection and it is Chapter 2 of the paper, not Chapter 1. A reservoir
with normalised state lives on `S^{d−1}`. Two states are distinguishable only if separated
by more than the noise floor — i.e. their angular separation exceeds some θ. **"How many
states can this reservoir hold" is therefore literally the maximum size of a spherical code
with minimum angle θ**, which is the object Chapter 2 bounds at λ* = ½log₂(2π/e).

Same constant as the packing exponent, and not by coincidence: both come from the same
Cohn–Elkies-style LP over positive-definite functions on the sphere. This is an
identification, not a resemblance — the reservoir's capacity question *is* the coding
question, under the stated normalisation hypothesis.

### The honest reading is a CEILING, not a speedup

The result Aaron hoped "could help" is, read carefully, mostly a **limitation theorem**,
and that is more useful than a small improvement would have been:

> `lim LP_d^{1/d} = √(e/2π)` is **exact**. The Cohn–Elkies linear program therefore
> **cannot** be pushed past `2^(−0.6044·d)` by any better choice of test function. Beating
> it requires a different method, not a better LP.

For us that is a design fact with teeth: if reservoir capacity gets framed as an LP bound,
the asymptotic ceiling of that framing is now known exactly, and effort spent hunting
better test functions is effort spent against a proved wall. What the improvement is worth
in the dimensions we might actually use:

```
  d=  8   bound is  1.0x tighter
  d= 24   bound is  1.1x tighter
  d= 64   bound is  1.3x tighter
  d=1024  bound is 46.2x tighter
```

Below d≈100 the improvement is not something a reservoir would feel. It is an asymptotic
result and should be cited as one.

And the gap it does *not* close, which dwarfs it: the best lower bound is still ~`2^(−d)`
(Minkowski–Hlawka), so the remaining uncertainty spans `2^(0.3956·d)` — a factor of 9 at
d=8, 721 at d=24, and 4.2 × 10⁷ at d=64. Anyone reaching for these bounds to *size* a
reservoir should know that the interval is exponentially wide and the new result narrows it
by half a percent of the exponent.

### What does NOT attach

**The twelve pentagons have nothing to do with sphere packing.** The curvature budget is
combinatorial topology on a 2-surface (discrete Gauss–Bonnet); the packing exponent is
metric density in ℝᵈ (harmonic analysis). No construction carries one to the other, and the
shared integer 12 was disposed of in §5. Recorded explicitly because "it closes into a
sphere, and sphere packing is about spheres" is precisely the shape of reasoning
`numerology-vs-number-theory.md` exists to catch — and it was the reasoning that opened
this thread.

The connection that survives is the one in §2: **CGA is the algebra in which both a
packing and a spatial belief are grade-1 blades.** That is a real bridge; the pentagon one
is not.

---

## 7. Register

Per `.claude/rules/toy-is-free-metered-must-be-earned.md`:

| claim | register | why |
|---|---|---|
| ABS classification table | **metered** | falsifier in `CliffordPeriodicity.Tests.fs`; re-pinned here by the dimension invariant on 169 signatures |
| `Cl(4,1) ≅ M₂(Cl(3,0))` | **metered** | suspension checked on 121 signatures; four known small cases reproduce |
| `P(x)·P(y) = −½|x−y|²` in `Cl(n+1,1)` | **metered** | checked to 1e-14 across 9 dimensions up to n=256 |
| `Σ(6−k)F_k = 12` | **metered** | checked on 9 solids incl. two non-closing controls |
| α* = ½log₂(2π/e) = 2^-exponent of √(e/2π) | **metered** | exact agreement |
| KL-1978 = 0.5990 comparison point | **cited, not checked** | standing knowledge |
| GATr's three-way empirical verdict | **cited, abstract only** | full paper not read |
| CGA is the right tower *for our BNN use case* | **toy** | no falsifier exists; Q3 is what would produce one |
| reservoir capacity ≡ spherical code | **toy** | the identification is sound *given* normalised state and an angular noise floor; neither hypothesis is measured against a built reservoir, because there is no reservoir implementation in `src/` |

That last row is the honest headline of §6. **There is no reservoir in the codebase** —
`grep -ril reservoir src/` returns `NovelMath.fs`, `HexCore.fs`, `society-evolution.ts`,
`shiva-weak-factor-graph.ts`, none of which implement one. The capacity argument is
therefore about an object we have described and not built, and it stays `toy` until there
is something to measure.

---

## 8. What this changes

1. **Q4 is answered and the answer is favourable**: existing `Cl3` work is the entry type
   of CGA, not a rival to be discarded. The rotor path is the part that does not transfer.
2. **The DAG-composition ask is unblocked and was already half-built** — `FactorGraph` is
   general; `MultilayerBnn` needs to be re-expressed onto it. Filed, not started.
3. **`ThousandBrains.fs` is the named seam** for spatial belief, and it is currently
   scalar.
4. **The reservoir walls already close** (sense 2, the hexahedron), which was not the
   expected answer.
5. **The sphere-packing result is a ceiling**, worth ~0.5% of the exponent and invisible
   below d≈100 — and the honest bridge to it is CGA, not the pentagons.

## Pointers

- `src/Core/CliffordPeriodicity.fs` — the instrument for §1; `evenSubalgebraClass` is what
  produces the quaternionic-rotor finding
- `src/Bayesian/{MinimalBnn,MultilayerBnn,FactorGraph,ThousandBrains}.fs` — §4
- `src/Core/HexCore.fs` — the hexahedron, six walls, twelve words
- `docs/research/2026-08-26-hexagonal-reservoir-walls-cannot-close-into-a-sphere-euler-forces-exactly-twelve-pentagons.md`
  — the prior document; §5 here generalises its result and corrects its framing
- `workitems/081M0R18878087G0R001XY5A2J-*` — the hold; Q4 discharged, Q1/Q2/Q3/Q5 open
- `workitems/081M0FT2JZV087G0R003HXFCEW-*` — the Fisher–Rao repair; §2 is why the
  conformal chart is the principled destination
- `.claude/rules/numerology-vs-number-theory.md` — applied twice in §5 and once in §6
