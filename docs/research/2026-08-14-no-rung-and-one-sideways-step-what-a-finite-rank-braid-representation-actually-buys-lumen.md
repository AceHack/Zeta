# No rung, and one sideways step — what a finite-rank braid representation actually buys

**Lumen, 2026-08-14.** Scoping answer to Aaron's *"should we investigate alternatives?"*, asked after
PR #10538 concluded **stop at balanced**. This is a scoping doc. Nothing here proposes an
implementation, and "build nothing" was a first-class candidate throughout.

---

## Verdict in one paragraph

**The stop stands. Do not resume the ladder, and do not build Lawrence–Krammer.** The MTC verdict is
unchanged by the amplitude-layer news, for a reason stronger than the one Q4 used. All three nominated
candidates die: two are dead on arrival (they buy a link invariant, strictly weaker than the faithful
`Braid.equal` we ship), and Turaev's construction does not sidestep the rigidity blocker — it restates
it. **But the question was worth the hour**, because asking *"what capability do we lack"* instead of
*"what is the next rung"* turned up exactly one real gap, and it is not on the ladder, not in the
candidate list, and — the part worth writing down — it is served by the **unfaithful** representation.
The one item worth filing is the **exact integer characteristic polynomial of the reduced Burau matrix
at `t = −1`**, as a one-way certified lower bound on braid dilatation. It needs no new number type, no
Laurent ring, and no category theory. It is a *sideways* step off an instrument we already ship and
already consume, and it is small.

---

## 1. Does the amplitude-layer news change the MTC verdict? No.

Q4 rejected MTC partly on *"needs a unitary ℂ-linear substrate we do not have **and have not
planned**."* That clause is now literally stale — the Born boundary was placed at the society/quorum
layer on 2026-08-13, with `AmplitudeEmu.Amp` (complex, combines by sum) above and `SoftValue` (real,
combines by product) below. The premise moved from *no substrate, no plan* to *substrate under design*.

The premise was never load-bearing, and the verdict does not move. Three reasons, in increasing order
of how much I like them.

**(a) The obstruction is a rank problem; an amplitude layer is a scalar problem.** MTC needs finite
semisimplicity — finitely many simple objects — and a non-degenerate S-matrix. The blocker on
`V = ℤ[F_n]` is that `F_n` is infinite, so `V` is free of **infinite rank**. Base-changing along
`ℤ → ℂ` gives `ℂ[F_n]`, still infinite-dimensional: **the rank of a free module is invariant under base
change**, so changing the ground ring cannot touch the obstruction. This is the dimensional-analysis
read — the two quantities are not the same kind of thing. Separately, the ambient tensor's plain swap
makes every object transparent, so S is maximally degenerate by construction; a scalar field does not
touch that either.

**(b) There is no functor on offer, only a shared adjective.** The proposed correspondence is "⟨V⟩ could
be ℂ-linear" and "the quorum is ℂ-valued." Both involve complex numbers. That is a **count-level
coincidence, not an identification** — the objects of the quorum layer are `Chip8Cow.Frame`s in a
superposition, and nobody has proposed a functor from `⟨V⟩` to that. Under `numerology-vs-number-theory`
this is a legitimate *generator* and an illegitimate *conclusion*, and it should be recorded as the
former.

**(c) The new substrate is float, so it is inadmissible under our own arithmetic discipline — and would
be even if (a) and (b) were solved.** **CHECKED** by reading `src/Core/AmplitudeEmu.fs`:
`Amp = (Chip8Cow.Frame * Complex) list` where `Complex` carries `Real: float; Imag: float`, and `merge`
drops any summed amplitude with `magSq ≤ 1e-12`. That is floating point with an epsilon threshold — not
byte-lockable across four oracles, which `universal/evidence.md` already concedes for float-valued
messages.

So the honest statement is: **the amplitude-layer news changes the timeline of nothing** — not even the
timeline, because the obstruction it would have to remove is not the one it addresses.

---

## 2. The reframe that made the rest of this productive

Q4's rejection rule — *"anything that only buys an invariant weaker than `Braid.equal` is dead on
arrival"* — is correct, and it is a rule about **decision procedures**. Faithfulness is exactly the
property that lets a representation *decide* whether two braids are equal. We have that, exactly, via
Artin's action.

It is not a rule about **measurements**. Extracting a number from a braid does not require injectivity,
and demanding it throws away the representations whose whole value is that they *forget* structure in a
controlled way. Stated as the inversion:

> **The faithful representation is the one we do not need. Faithfulness is required to decide; it is
> irrelevant to measure.**

That is the only reason anything survived §4.

---

## 3. What I measured (CHECKED)

Two independent re-implementations, exact integer arithmetic, no floats in any load-bearing step.

### 3a. `Braid.equal` is worst-case exponential, and the exponent is the braid's own geometry

An independent re-implementation of `src/Core/Braid.fs`'s Artin action, run on `(σ₁σ₂⁻¹)^k` in `B₃`:

| `k` | word length of β | max `|act(β, xᵢ)|` |
|---:|---:|---:|
| 4 | 8 | 67 |
| 8 | 16 | 3,193 |
| 12 | 24 | 150,049 |
| 14 | 28 | 1,028,457 |

The successive ratio converges to **2.6180381** at `k = 14`. The dilatation of `σ₁σ₂⁻¹` is
`(3+√5)/2 = 2.6180340`. So the blowup rate **is the pseudo-Anosov dilatation** — intrinsic geometry, not
an implementation defect, and no amount of care in `reduce` will remove it. Operationally: a
28-crossing braid produces a million-letter free-group word, and `Braid.equal` becomes infeasible at a
few dozen crossings of a pseudo-Anosov word. `MenoBraided.rep` inherits this exactly — it applies the
same `x·y·x⁻¹` conjugation per crossing.

This is **dual-use, and the repo already uses both sides**: it is a cost in `Braid.equal`, and it is the
*instrument* in `BraidEntropy.growthRate`, which measures precisely this growth rate to estimate
topological entropy (with a `cap = 300000.0` guard against the same blowup).

### 3b. The same number, exactly, from an integer matrix

**Reduced Burau specialized at `t = −1`** has *integer* entries — no Laurent ring, because `t` is gone.
For `B_n` it is `(n−1)×(n−1)`. Implemented, then verified:

- **Braid relations hold** — `σᵢσᵢ₊₁σᵢ = σᵢ₊₁σᵢσᵢ₊₁` and far commutation, for `B₃…B₆`.
- **Four planted mutants all REJECTED** by the same check (diagonal `t` instead of `−t`; subdiagonal
  dropped; subdiagonal sign flipped; superdiagonal dropped). An all-pass run with no mutant that dies is
  a tautology; these die.

Exact characteristic polynomials, over ℤ:

| braid | `charpoly(Burau(−1))` | largest real root > 1 | `exp(BraidEntropy growth)` |
|---|---|---:|---:|
| `σ₁σ₂⁻¹` (B₃) | `x² − 3x + 1` | 2.618034 | 2.618038 |
| `σ₁²σ₂⁻²` (B₃) | `x² − 6x + 1` | 5.828427 | — |
| `(σ₁σ₂⁻¹)²` (B₃) | `x² − 7x + 1` | 6.854102 | 6.854627 |
| `σ₁σ₂⁻¹σ₃` (B₄) | `x³ − 5x² + 5x − 1` | 3.732051 | 3.733476 |
| `σ₁σ₂⁻¹σ₃σ₄⁻¹` (B₅) | `x⁴ − 7x³ + 13x² − 7x + 1` | 4.390257 | 4.399461 |
| `σ₁σ₂` (B₃) | `x² − x + 1` | **none** | 1.020410 |
| `σ₁σ₂σ₃` (B₄) | `x³ − x² + x − 1` | **none** | 1.020374 |
| `σ₁²σ₂²` (B₃) | `x² + 2x + 1` | **none** | 1.020619 |

Three things fall out, and the third is the one that matters.

1. **The exact integer route reproduces the exponential float route** on every pseudo-Anosov case, to
   the accuracy of the float estimator. Two independent computations, one exact and polynomial-cost, one
   approximate and exponential-cost. `(3+√5)/2` and `3+2√2` are the classical dilatations of `σ₁σ₂⁻¹`
   and `σ₁²σ₂⁻²`, so this also checks against the literature, not only against itself.
2. **It costs `(n−1)²` integers.** `charpoly` is Faddeev–LeVerrier over ℤ. Nothing needs floats; the
   roots are only *displayed* as floats — the certified object is the integer polynomial.
3. **It is more correct at the discriminating boundary.** For the zero-entropy braids,
   `BraidEntropy.growthRate` returns a spurious residual of ≈0.0202 nats (`exp ≈ 1.0204`), which is why
   its own docstring says *"threshold it (a genuine pA sits well above)."* The integer char poly replaces
   that hand-tuned threshold with an exact question — *does this ℤ-polynomial have a real root of
   modulus > 1?* — decidable exactly by Sturm sequences, byte-lockable, no threshold.

**CONJECTURE (cited from standing knowledge, not page-checked):** the theory behind the bracket is that
reduced Burau at `t = −1` is the homological action on the double branched cover (Squier 1984), whose
spectral radius is bounded above by the dilatation (Nielsen–Thurston theory), while the raw Artin growth
bounds it from the other side — i.e. `ρ(Burau(−1)) ≤ λ ≤ exp(raw Artin growth)`. I observed this
ordering on every pseudo-Anosov case above; I did not prove it, and it should be filed for Soraya rather
than asserted.

---

## 4. The three nominated candidates — all rejected

### 4a. Linear/matrix structure the quorum amplitude layer could consume — **rejected**

The strongest candidate on the brief, and it fails on three independent grounds, any one sufficient.

- **The consumer cannot consume it.** `AmplitudeEmu` is float (§1c). Feeding it exact matrices over
  `ℤ[q^{±1}, t^{±1}]` would require rebuilding the layer in exact arithmetic first, at which point the
  braid part is the small half of the work.
- **The layer's actual gap is a phase *source with meaning*, and a braid is the wrong semantics.**
  `AmplitudeEmu`'s own docstring concedes *"CHIP-8 opcodes introduce no phase"* — so the gap is real and
  already named in our code. But the quorum's cancellation is meant to encode **disagreement between
  agents**, and a braid records **interaction order**. Injecting braid-generated phases would make the
  quorum cancel on the basis of who-crossed-whom rather than who-disagrees-with-whom. That is a
  physics-shaped decoration that cannot be metered: it would produce numbers, and no experiment would
  tell you they were wrong.
- **The known bug it would be aimed at needs something else.** B3 (six correlated agents summing to
  `precision = 66.0` on a wrong mean) is a *provenance* failure, and `universal/evidence.md` already
  names the fix: keyed removal via the EP cavity (Minka 2001), aimed by provenance. Phase does not aim
  it.

### 4b. Rack/quandle cohomology invariants (CJKLS) — **rejected, twice**

- **It needs a finite quandle.** Cocycle state-sums are computed by summing Boltzmann weights over
  *colorings* by a finite quandle. Ours is the conjugation quandle of the **free** group `F_n` —
  infinite. Passing to a finite quotient (`S₃`, `S₄`) discards faithfulness immediately, which is the
  one property we actually rely on.
- **What it produces is a link invariant** — an invariant of the *closure*, hence a quotient of the
  braid. Strictly weaker than `Braid.equal`. DOA by the stated rule, independently of the first point.

*The honest positive, recorded as a pointer and not a proposal:* quandle **cohomology** is the correct
home for the Q2 "framed promotion" question (a 2-cocycle assigns a group element per crossing; that is
what a framing datum would be). If anyone reopens Q2, CJKLS is the anchor to start from. For our
conjugation quandle the resulting invariant is abelian — and the abelian invariant we already compute is
the writhe.

### 4c. Turaev's enhanced Yang–Baxter operator — **rejected; it restates the blocker**

This was the one genuinely worth checking, because the brief's hypothesis — that it yields a link
invariant *without* a full ribbon category — is true as stated. It still fails.

An enhanced YB operator is `(R, μ, α, β)` with `R` invertible satisfying YBE, `μ` commuting
with `R`, and the enhancement conditions stated as a **partial trace**:
`tr₂(R^{±1} (id ⊗ μ)) = α^{±1}β · id`. **The partial trace `tr₂` is exactly what
rigidity provides**, and Turaev's setup assumes `V` is a finitely generated projective module over the
ground ring precisely so that `tr₂` exists. The enhancement conditions are a hands-on repackaging of
*twist + duals*, not an escape from them. Our blocker is `V = ℤ[F_n]` having infinite rank, and in
`Mod_ℤ` dualizable ⟺ finitely generated projective — so the blocker is inherited verbatim.

And even if it were sidestepped: what it yields is a scalar link invariant via a Markov trace, the same
thing Q4 already rejected as strictly weaker than `Braid.equal`. It dies twice, and the second death
does not depend on my reading of Turaev's definition.

**CONJECTURE / cited-not-page-checked** on the definitional detail (Turaev 1988, *Invent. Math.* 92);
the second, independent rejection does not rest on it.

---

## 5. The one thing that survives — and it is small

**Filed, not built:** the exact integer characteristic polynomial of reduced Burau at `t = −1`, as a
**one-way certified lower bound** on braid dilatation, complementing (never replacing)
`BraidEntropy.growthRate`.

**What it buys.** A capability we genuinely lack: a *certified*, *exact*, *polynomial-cost* statement
about a braid's forced entropy. Today `BraidEntropy` gives a float estimate, at exponential cost, capped
at 300k word length, with a documented false-positive floor and a hand-tuned threshold — and its own
docstring says so honestly ("an estimate, not a certified λ"). There is a live consumer: `OrbitBraid` →
`BraidEntropy` is the Thurston–Nielsen–Boyland bridge, cross-checked against `Orbit.largestLyapunov` in
the `silicon-alife-freedom-homoclinic-braid-bridge` trajectory. That cross-check is exactly where a
*certified* side would earn its keep — right now both sides are estimates.

**What it costs.** `(n−1)×(n−1)` integer matrices; Faddeev–LeVerrier over ℤ; an exact root-existence
test (Sturm). No new number type, no Laurent ring, no category theory, no change to `Braid.fs`. Small.

**The falsifier, stated up front.** Burau is **not faithful** for n ≥ 5 (Bigelow 1999; Moody 1991 for
n ≥ 9; Long–Paton 1993 for n ≥ 6). A pseudo-Anosov braid in the Burau kernel has trivial homological
action, so the char poly will have no root of modulus above 1 **even though the true entropy is
positive**. Therefore, stated as the discipline:

**It convicts, and it never acquits.** A spectral radius above 1 certifies λ ≥ ρ. A spectral radius
equal to 1 certifies *nothing* — it is `Unmeasured`, not `zero`.

That is the same one-way discipline `AntiSybil` and `DecorrelationExcess` already carry, and any
implementation that reports "entropy 0" from ρ = 1 has smuggled an acquittal. **This is the mutation
test the work-item must carry if it is ever picked up.** Note the pleasing consequence: Burau's
unfaithfulness — the defect that disqualifies it as a decision procedure — surfaces here as measurement
*weakness*, never as measurement *error*.

**Register placement:** CONJECTURE tier. The bracket ρ(Burau(−1)) ≤ λ ≤ exp(raw Artin growth) is a
math-shape correspondence with named anchors and no proof of mine; it does not graduate by being
convenient. Hand to Soraya.

---

## 6. What I am explicitly NOT recommending

**Lawrence–Krammer.** It is faithful (Bigelow 2001; Krammer 2002), and that is the problem: faithfulness
buys *decision* strength, and `Braid.equal` already decides exactly. What LK would additionally buy is a
polynomial-size certificate where ours is exponential (§3a) — a real gap — but it is the **wrong tool
for that gap**, on two counts. It needs bivariate Laurent-polynomial arithmetic implemented and
byte-locked in four languages, a new primitive with its own golden vectors. And it does not give a
*canonical form*, which is what the gap actually wants.

**Garside normal form is the right tool for that gap, and it is already on the board for an unrelated
reason.** Left-greedy normal form Δ^p · A₁⋯A_r is canonical, polynomial-time, and made of permutations
plus one integer — trivially byte-lockable, no new number system. A canonical form is strictly better
than an equality test: dedup keys and short fingerprints come free. And work-item
`081KZZVC3DD087G0R0035SZN58` (the general-n Lean certificate for θ = ρ(Δ²)) already needs the Garside
element Δ, which the brief notes *"does not exist in our code at all."* So if the exponential cost of
`Braid.equal` ever bites, the fix arrives as a side effect of work already scoped. **That is an
observation, not a proposal** — I am not recommending building it now either.

---

## 7. Two side-findings, handed off rather than pursued

Both are outside braid scope; both were found by reading the code this question pointed me at; neither
is mine to decide.

**(i) The quorum amplitude layer is not an instance of `universal/evidence`, and nothing says so.**
`universal/evidence.md` membership contract #2 requires combining by **join** — idempotent, commutative,
associative. `AmplitudeEmu.merge` **sums** complex amplitudes, deliberately, so that phases can cancel.
Summation is not idempotent (folding the same amplitude twice doubles it), and floating-point addition
is not associative, so the `EPS = 1e-12` drop makes *support membership* depend on fold order — a
discrete divergence from a continuous perturbation, in a fold that is supposed to be order-invariant.
This is a deliberate departure, not a bug; the finding is that **it is undeclared**, and it touches
manifesto §12 (idempotency). Someone should write down that the quorum layer is *not* an evidence-join,
and say what it is instead.

**(ii) If the amplitude layer is ever to be byte-locked, exact unitary amplitudes are available.** It
does not need floats. Unitary modular data lives in cyclotomic fields — twists are roots of unity
(Vafa 1988), and the Galois-symmetry / cyclotomicity results (de Boer–Goeree 1991; Coste–Gannon 1994;
Etingof–Nikshych–Ostrik 2005; Ng–Schauenburg 2010) put the S and T entries in ℚ(ζ_N). So ℤ[ζ_N] with
reduction mod the cyclotomic polynomial is an exact, byte-lockable home for complex amplitudes.
**PROPOSED, and firmly out of my scope to decide** — a note for whoever owns the amplitude layer, not a
braid rung. Filed here so it is not lost, not to advocate it.

---

## 8. Anchors

Named human + paper. **All cited from standing knowledge, not page-checked**, except where §3 records
what I actually ran.

- **Artin, E.** (1925) *Theorie der Zöpfe*; (1947) *Theory of braids* — the faithful action on F_n;
  what `Braid.fs` implements.
- **Burau, W.** (1936) *Über Zopfgruppen und gleichsinnig verdrillte Verkettungen* — the representation.
- **Bigelow, S.** (1999) *The Burau representation is not faithful for n = 5*, Geom. Topol. 3;
  **Moody, J.** (1991), n ≥ 9; **Long, D. & Paton, M.** (1993), n ≥ 6 — the non-faithfulness that makes
  §5's instrument one-way.
- **Bigelow, S.** (2001) *Braid groups are linear*, J. AMS 14; **Krammer, D.** (2002) *Braid groups are
  linear*, Ann. Math. 155; **Lawrence, R.** (1990) *Homological representations of the Hecke algebra*,
  CMP 135 — the faithful finite-rank rep we are declining.
- **Turaev, V.** (1988) *The Yang–Baxter equation and invariants of links*, Invent. Math. 92 — enhanced
  YB operators; the partial-trace requirement is the blocker.
- **Carter, Jelsovsky, Kamada, Langford & Saito** (2003) *Quandle cohomology and state-sum invariants of
  knotted curves and surfaces*, Trans. AMS 355 — CJKLS.
- **Joyce, D.** (1982); **Fenn, R. & Rourke, C.** (1992) — racks/quandles as set-theoretic YB solutions.
- **Squier, C.** (1984) *The Burau representation is unitary*, Proc. AMS 90 — the t = −1 / homological
  identification §3b's bracket rests on.
- **Thurston, W.** (1988) *On the geometry and dynamics of diffeomorphisms of surfaces*, Bull. AMS 19;
  **Fathi, Laudenbach & Poénaru** (1979) — Nielsen–Thurston, dilatation, the entropy bound.
- **Boyland, P.** (1994); **Fathi & Shub** — braid type forces h ≥ log λ (already anchored in
  `BraidEntropy.fs`).
- **Garside, F. A.** (1969) *The braid group and other groups*; **Thurston, W.** in Epstein et al.,
  *Word Processing in Groups* (1992) ch. 9 (greedy normal form); **Birman, Ko & Lee** (1998);
  **Dehornoy, P.** (1997) (handle reduction) — the normal-form route §6 declines to build.
- **Joyal, A. & Street, R.** (1993) *Braided tensor categories*, Adv. Math. 102; **Chow, W.-L.** (1948)
  (the centre of B_n) — the settled results this doc does not re-derive.
- **Vafa, C.** (1988); **de Boer & Goeree** (1991); **Coste & Gannon** (1994); **Etingof, Nikshych &
  Ostrik** (2005); **Ng & Schauenburg** (2010) — cyclotomicity of modular data (§7ii).
- **Minka, T.** (2001) — the EP cavity, the actual fix for B3 (§4a).
- **Freedman, Kitaev & Wang** (2002) — topological quantum computation: the capability MTC would have
  bought, and does not.

## 9. Pointers

- PR **#10538** — ⟨V⟩ IS balanced, θ = ρ(Δ²); the ladder stops there. Read first; not re-derived here.
- `src/Core/Braid.fs` · `src/Core/MenoBraided.fs` · `src/Core/BraidEntropy.fs` · `src/Core/OrbitBraid.fs`
- `docs/handoffs/2026-08-13-meno-braid-brief-for-manus.md` (ANSWERED) — the questions this follows.
- `docs/research/2026-08-13-what-does-253ms-mean-without-a-wall-clock-and-where-amplitudes-live.md` §2–3
  — the Born-boundary placement §1 evaluates.
- `universal/evidence.md` — the membership contract §7i finds undeclared.
- `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §A #24 — the braided claim that stands.
- Work-items `081KZZVC3DD087G0R0035SZN58` (Garside Δ, Lean) · `081KZZVC6SE087G0R001SXE8BV` (⟨V⟩ guard).
- `.claude/rules/numerology-vs-number-theory.md` — the register §1b applies to "both are complex."
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — why §5 is CONJECTURE and stays there.
