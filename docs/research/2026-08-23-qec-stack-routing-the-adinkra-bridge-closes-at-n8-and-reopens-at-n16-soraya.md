# QEC stack routing — the adinkra→quantum-code bridge is CLOSED at N=8 and REOPENS at N=16 with [[16,6,4]]

**Date:** 2026-08-23
**Author:** Soraya (formal-verification-expert) — routing verdict, no specs written, no production code.
**Asked by:** Aaron — *"we have some adinkra ecc that can run in q# i believe but either way it would be nice to have a QEC stack with multiple oracles on it, good roadmap to add."*
**Operational status:** routing verdict + milestone ladder + four minted work-items. Every algebraic claim below was **computed**, not inferred; the enumerations are stated with their sizes so they can be re-run.
**Related:** `docs/research/2026-08-23-rl-control-of-quantum-error-correction-*` (the Sivak/Morvan comparison, landing in parallel — not duplicated here) · `docs/research/2026-06-12-gates-ecc-tsirelson-math-team-REPORT-6-the-code-is-the-bell-inert-half-the-span-is-nebe-rains-sloane.md` (the CRSS leg, already in-tree) · `docs/research/2026-08-01-adinkra-mod2-clifford-e8-a-y-not-a-chain-soraya-metering-verdict.md` (my prior metering verdict on the same code).

---

## 0. The premise check — answered by grep, not by inference

> *"we have some adinkra ecc that can run in q#"*

**Refuted, precisely.** There is no adinkra code, no error-correcting code, and no QEC of any
kind in the Q# tree. The eight `.qs` files under `src/Core.QSharp.ReferenceOracle/` declare
DBSP operators, a Z-set ISA, heat-signal labels, a schema-evolution Grover oracle, and Pauli/
Clifford gate wrappers. Grepping the directory for `adinkra|hamming|error.correct|stabiliz|
syndrome|steane|css` returns **five hits, all comments and none code**:

| hit | what it actually is |
|---|---|
| `QuantumPersistentLog.qs:20` | a docstring quoting the `only-the-irreducible-is-primitive` rule ("regenerating from the irreducible IS error-correction") |
| `README.md:17` | "CSS" meaning **Cascading Style Sheets** / LLMTV room frames — not Calderbank–Shor–Steane |
| `gen-zset-isa.ts:18,23` | names `AdinkraCode.project` as the *idempotence* precedent for the generator |
| `generate-qsharp-golden.py:210` | a checks-label string mentioning `AdinkraViz odd-face parity` |

What `src/Core.QSharp.ReferenceOracle/` **is**: a byte-lock parity oracle for the
finite-resolution qubit model. Its own README states the contract — *"compare probabilities,
CHSH correlators, and interference visibility"* — and explicitly bars state-vector comparison
as an acceptance surface. It is a **measurement-agreement harness**, not a QEC stack, and it
was never meant to be one.

Where the adinkra code actually lives, all F#: `src/Core/AdinkraCode.fs` (the [8,4,4] generator
+ its exhaustive property proofs), `BinaryCode.fs`, `AdinkraClock.fs`, `AdinkraViz.fs`, plus
one Lean file — `src/Core.Lean4/ImaginaryStack/ErasureDistance.lean`, which proves the
**classical** erasure-correction principle (distance ⇒ correctable). Nothing quantum.

**One correction to the ferry that preceded me**, in its favour: it reported "no syndrome
extraction anywhere." A *classical* mod-2 syndrome does exist — `AdinkraCode.syndrome`
(`AdinkraCode.fs:166`), with three consumers (`PrivacyPreservingIdentity.fs`,
`YinYangCell.fs`). What does not exist is **quantum** syndrome extraction: no stabiliser
group, no ancilla measurement, no decoder. And every in-tree occurrence of the token
"stabilizer" is the **group-theoretic** stabiliser (`ClaimLane.fs`, `aut-budget.ts` —
Aut-budget orbit counting), which is a different object that shares a word. `Cl3.fs:11`
already flags exactly this collision in its own header.

---

## 1. The blocking fact is a theorem, not an accident

The brief carried the k=0 observation. It is correct, and it is worth restating in the form
that makes the roadmap decidable, because "our code happens to encode nothing" and "no code
of this kind can encode anything" are very different roadmap inputs.

CSS(C₁, C₂) with C₂^⊥ ⊆ C₁ yields **[[n, k₁ + k₂ − n, d]]**. Taking C₁ = C₂ = C:

> **k_q = 2·dim(C) − n.** A **self-dual** code has dim(C) = n/2 by definition, therefore
> **k_q = 0 identically.** Not for our code — for *every* self-dual code, at every length.

Verified on the committed generator (`AdinkraCode.generator`, all 16 codewords enumerated):
weights {0,4,8}, doubly-even ✓, self-orthogonal ✓, |C^⊥| = 16 and C = C^⊥ ✓. So
**CSS(C,C) = [[8,0,4]]** — a stabiliser *state*, not a code. REPORT #6 derived the same object
from the other direction and named it correctly: a doubly-even self-dual code lifts to a
**maximal** commuting family of involutions in the extraspecial group Γ. Maximal is exactly
the problem — a maximal isotropic subspace leaves no centraliser quotient, hence no logical
qubit. The report's phrase "the Bell-**inert** half" and the coding-theory phrase "k = 0" are
the same fact in two vocabularies.

**So the honest headline: we do not currently have a quantum code at all.** Not a weak one —
none. Every downstream QEC ambition starts from zero.

---

## 2. The brief's proposed route (puncture → Steane) works, and costs more than it looks

Puncturing [8,4,4] at **any** coordinate gives [7,4,3] — I checked all eight, and all eight
give d=3, which is not luck: Aut(C) = AGL(3,2) is transitive on the 8 coordinates, so the
puncture is *canonical rather than a choice*. That is a genuinely nice property and it means
Steane can be exhibited from our own committed matrix with a one-line operation and no
imported code table.

Then C = [7,4,3], C^⊥ = [7,3,4] ⊂ C ✓, and **CSS(C,C) = [[7,1,3]]** — Steane, k=1, verified.

**But the puncture exits the adinkra category, and the brief does not say so.** Measured
weight distribution of the punctured code: **{0¹, 3⁷, 4⁷, 7¹}**. Weight 3 and weight 7 are odd.
Therefore the punctured code is:

- **not doubly-even** — so it is not an adinkra code under Doran–Faux–Gates–Hübsch–Iga–Landweber;
- **not self-orthogonal** — so the CSS condition holds only in the C^⊥ ⊂ C direction, not by self-duality.

The correspondence our whole adinkra lineage rests on is *doubly-even code ↔ adinkra
chromotopology*. Puncture, and it is gone. The claim the milestone can honestly carry is:

> **"Steane's classical ingredient is one puncture from our committed generator."** Provenance,
> not inheritance. Our adinkra code does not *become* a quantum code; a code derived from it by
> an operation that destroys its defining property does.

That is still worth exhibiting — deriving Steane from our own matrix rather than a textbook is
a real byte-lock artefact. It is not worth *claiming* as an adinkra quantum code.

---

## 3. The N=8 adinkra category is exhaustively closed — and this is the doc's first result

If the puncture leaves the category, the obvious question is whether staying inside it can
work. The adinkra correspondence needs doubly-even; it does **not** need self-dual — self-dual
is only the maximal case. A doubly-even **self-orthogonal, non-self-dual** code C of dim k
gives CSS(C^⊥, C^⊥) = [[8, 8−2k, d]] with k_q > 0. So the category is not obviously empty.

**I enumerated it.** Every doubly-even self-orthogonal binary code of length 8, at every
dimension, taking the best achievable distance at each:

| dim C | quantum code | corrects |
|---|---|---|
| **0 (uncoded — the full 8-cube)** | **[[8,8,1]]** | **nothing; d=1 is no encoding at all** |
| 1 | **[[8,6,2]]** | nothing (detects 1) |
| 2 | **[[8,4,2]]** | nothing (detects 1) |
| 3 | **[[8,2,2]]** | nothing (detects 1) |
| 4 (self-dual) | **[[8,0,4]]** | corrects 1, **encodes nothing** |

> **Verdict — exhaustive over its domain, and the domain is now stated exactly (see §3a).**
> Over **CSS codes of the form CSS(C^⊥, C^⊥) for C a doubly-even self-orthogonal binary code
> of length 8** — which is the adinkra category — there is **no code that both encodes a qubit
> and corrects an error.** You get d=4 with k=0, or k>0 with d≤2. Five rows, and no sixth.

This is the kind of result that should stop a roadmap, and it is cheap: the enumeration is
seconds of compute over ≤ 2^8 vectors. **Finding out that a direction is closed, in seconds,
before anyone writes a spec, is the entire point of routing before authoring.** What it does
*not* license is the phrase "the direction is permanently retired", which is broader than what
was computed — §3a is the correction.

---

---

## 3a. ADDENDUM 2026-08-23 — the second adinkra family, and the scope §3 actually has

Added after the doc shipped. Aaron, relayed by the coordinator:

> *"We also have a 2nd type of adinkra — a non-coded adinkra that keeps homoiconicity. For our
> regular coded adinkra it's not homoiconic except in its colored sub-algebras, from what I
> remember. We generate the E8 Lie **group** from one and the E8 **algebra** from the other type."*

He hedged (*"from what I remember"*), and his own filed caveat is that he indexes memory by
resonance. **On this one the index retrieved correctly, to a level of technical precision worth
recording: two of his three claims are in-tree theorems with mechanised falsifiers, and the third
is off by exactly one rung.** He is remembering work, not an intention.

### The second family is real, and it is a theorem, not prose

| claim | status | where |
|---|---|---|
| a non-coded adinkra exists and **keeps homoiconicity** | **PROVEN, in-tree** | The uncoded `N`-cube is a homoiconic pair `(A, M, ρ)`: `M` is the **regular representation** of `Cl(0,N)`, `2^N` vertices against a `2^N`-dimensional algebra, `Q_I` literally left-multiplication by `γ_I`. |
| the **coded** one is **not** homoiconic | **PROVEN** | Quotienting collapses the vertex module to `2^(N−k)` while `Cl(0,N)` stays `2^N`. `defect = dim A / dim M = 2^k`, quantised — *there is no "nearly homoiconic"*. Our `[8,4]`: 16 vertices, 256-dimensional algebra. |
| **"except in its colored sub-algebras"** | **PROVEN, verified exhaustively** | `M` **is** free of rank 1 over a `Cl(0,N−k)` subalgebra generated by `N−k` of the colours. Exactly `k` colours act without being named. |

Sources, both Lumen and both predating this doc:
`docs/research/2026-08-14-adinkra-minimal-homoiconicity-the-half-rotation-tower-and-where-the-obstruction-actually-lives-lumen.md`
and `docs/research/2026-08-18-is-there-a-coded-adinkra-that-is-still-a-regular-representation-proven-no-and-the-seam-it-names-lumen.md`
(V1–V5; `20,248` subalgebras tested, `0` free at the wrong size). **It is mechanised** —
`tests/Tests.FSharp/HomoiconicSeam.Tests.fs`. So this is not a `proposed` row; it is a
falsifiable one that a test already guards.

The phrase to keep, because it is sharper than "two families":
**a coded adinkra is homoiconic for a sub-language of its own colours** — and *which* `k` colours
are the mute ones is a **convention** (56 of 70 valid choices at N=8), not a fact.

### Does this narrow §3? Yes — but not where the coordinator expected

The concern was that a non-coded family sits **outside** the enumeration's domain. **It does not.**
Under Doran–Faux–Gates–Hübsch–Iga–Landweber the uncoded `N`-cube *is* the `C = 0` case — the
trivial code, `dim C = 0`. That is inside the domain, and I simply **omitted the row as
degenerate**, which was a presentation error rather than a gap. Computed:

> `dim C = 0` ⇒ `C^⊥ = 𝔽₂⁸` ⇒ **[[8,8,1]]**. Distance 1: corrects nothing, detects nothing.

The row is now in the §3 table. Adding it **strengthens** the closure — the uncoded family is not
a missing escape hatch, it is the trivial end of the same ladder, and it is the *worst* row in it.
This is the same shape as §1: the uncoded adinkra buys homoiconicity by **not quotienting**, and a
quantum code's protection comes from **exactly** the quotient it declines to take. Homoiconicity
and error correction are trading against the same coordinate, in opposite directions.

### Where §3 was genuinely over-claimed — and it is a different place

My enumeration ranges over **CSS codes of the form CSS(C^⊥, C^⊥)**. It does **not** cover:

1. **Asymmetric CSS** — `CSS(C₁, C₂)` with `C₂ ⊊ C₁`, two different codes. Not run.
2. **Non-CSS stabiliser codes** — under CRSS, stabiliser codes are isotropic subspaces of the
   symplectic 𝔽₂ geometry, and CSS is only the subclass whose subspace **splits** into an X-part
   and a Z-part. Most do not split. Not run.

And (2) matters, because it is **not** empty: **[[8,3,3]]** is a known optimal 8-qubit stabiliser
code (Calderbank–Rains–Shor–Sloane 1997) that encodes 3 qubits and corrects 1 error. **Cited, not
computed** — I did not enumerate the 8-qubit stabiliser space and am not claiming to have.

So the honest scope, replacing "the direction is permanently retired":

> **Closed over the adinkra category** — i.e. over CSS codes from doubly-even self-orthogonal
> length-8 codes. **Not** closed over all 8-qubit stabiliser codes. `[[8,3,3]]` exists and beats
> every row in the table — but its stabiliser does not split into X and Z parts, so it does **not**
> come from a binary code at all, doubly-even or otherwise, and it is therefore **not an adinkra
> object.** The roadmap conclusion is unchanged; its justification is narrower and now says so.

**A result that states exactly what it covers is worth more than one that overreaches.** The
routing verdict (§7 decline #3: do not build the N=8 stack) stands, because the reason was never
"no 8-qubit code exists" — it was "no code *in our lineage* at N=8 is useful", which is what was
computed.

### The E8 claim — two of three, and the third is off by one rung

This is the sharpest of Aaron's three and the one where the correction is real. `src/Core/CliffordPeriodicity.fs`
§"THE SECOND TOWER" (lines 172–231) answers it directly, and it was written 2026-08-18 in response
to Aaron asking almost this question:

| family | construction | object produced |
|---|---|---|
| **coded** ([8,4], Construction A) | `L_A(C) = {x ∈ ℤ⁸ : x mod 2 ∈ C}` | the E8 **lattice** / **root system** — 240 minimal vectors (`E8Lattice.fs`, in-tree, integer, proven) |
| **uncoded** (bivector/spinor tower, no quotient) | `e₈ = so(16) ⊕ Δ⁺₁₆`, `120 + 128 = 248` | the E8 **Lie algebra** (`e8FromSpinors = (16, 248)`) |

> **Verdict.** The *split* is real and it is exactly Aaron's — the file's own comment says the
> bivector route "is the door out of the coded tower… quotients nothing", and states outright that
> "the two routes do not produce the same *object*". **His "algebra" half is exactly right and
> attached to the right family.** His "group" half is off by one rung: the coded route yields the
> **lattice**, not the **Lie group**. Nothing in the tree constructs the E8 Lie group — the compact
> 248-dimensional manifold — and group/algebra/lattice are three different objects, so this is a
> correction rather than a quibble.

The bridge between them is also already in-tree and is not exotic: `248 = 8 + 240 = 120 + 128`,
two decompositions of one Lie algebra against two different maximal subalgebras — the Cartan
(a ℤ⁸ grading) versus `so(16)` (a ℤ₂ grading). The lattice route's 240 minimal vectors **are** the
240 roots. Anchor: J. F. Adams, *Lectures on Exceptional Lie Groups*; Kostant. Standard, which is
the point — it is checkable.

### Consequences for the roadmap

**None of M1–M4 change.** The k=0 theorem is about **self-duality**, a property of codes, and
RM(1,4) is a code either way. The N=16 `[[16,6,4]]` bridge is untouched.

**One thing is added, and it is cheap:** M1's closure test should carry the `dim C = 0` row
explicitly rather than starting at dim 1. A table that silently omits its degenerate end invites
exactly the question this addendum answers, and the row costs one line.

**One thing is declined.** Building a QEC construction from the *uncoded* adinkra is not worth
scoping. It is `[[8,8,1]]`: homoiconicity is bought by declining the quotient, and the quotient is
where the protection lives. That is a genuine structural tension worth naming, and it is also a
reason not to spend a milestone on it.

**Register:** the homoiconicity and E8 rows above are **PROVEN in-tree by others** (Lumen) with a
mechanised falsifier, and are cited here rather than re-derived. The `dim C = 0` row is **computed**
here. `[[8,3,3]]` is **cited, not computed**. §3's narrowing is a **scope correction**, not a
refutation — no number in the original table changed.

## 4. The bridge REOPENS at N=16 — [[16,6,4]], and the defining code is genuinely doubly-even

Having closed N=8 I checked whether the closure is structural or length-specific. It is
length-specific, and the reopening is strictly better than the Steane route on every axis.

Take **RM(1,4)**, the first-order Reed–Muller code of length 16. Computed, not cited:

- dim 5, weight distribution **{0, 8, 16}** → **doubly-even ✓**
- **self-orthogonal ✓**, and **not** self-dual (5 < 8) — so k_q > 0 is available
- **RM(1,4)^⊥ = RM(2,4)** exactly (dim 11) ✓, so the CSS condition holds
- k_q = 2·11 − 16 = **6**; d = min weight in RM(2,4) \ RM(1,4) = **4**

> **CSS(RM(2,4), RM(2,4)) = [[16, 6, 4]]** — six logical qubits, distance 4, corrects any
> single-qubit error. And its defining code RM(1,4) **is doubly-even and self-orthogonal**,
> i.e. a *bona fide* adinkra code at **N = 16 supercharges**. Nothing is punctured. Nothing
> leaves the category.

**Not a coinage — this is a known code, and saying so is the anchor discipline.** Quantum
Reed–Muller CSS codes are Calderbank–Shor 1996 / Steane 1996; the [[16,6,4]] is standard. What
is *ours* is the observation that it sits inside the adinkra category while [[8,0,4]] and
[[7,1,3]] do not — the first at k=0, the second by leaving.

**And it closes a loop already open in-tree.** RM(1,4)'s weight enumerator (0, 8, 16) is the
Barnes–Wall BW₁₆ datum under Construction A, and REPORT #3 of this lineage already cites
Nebe–Rains–Sloane, *The invariants of the Clifford groups* (2001) — 𝒞ₖ = Aut(BW_{2^k}),
invariant ring spanned by weight enumerators of doubly-even self-dual codes. The N=8 rung of
that tower is E8 (`E8Lattice.fs`, 240 roots, in-tree and proven). The N=16 rung is BW₁₆. The
QEC stack lands on the rung above the one we already own.

**Numerology guard applied.** "16 and 16" is a count. The identification is structural: dim 5,
weight distribution exactly {0,8,16}, dual **equal** to RM(2,4) as a set (not merely
same-dimension), and CSS distance computed as a minimum over an explicit coset. All four were
computed; none was matched by cardinality.

---

## 5. Routing table — the property class, the tool, and the wrong-tool cost

| # | Layer | Property class | **Tool** | Wrong-tool cost if mis-routed |
|---|---|---|---|---|
| L1 | doubly-even / self-orthogonal / dim / CSS condition, for RM(1,4) ⊂ RM(2,4) | **finite** algebraic identity, 2^11 = 2048 codewords | **Direct enumeration in the four oracles.** NOT Lean. | Lean: ~2–3 human-weeks to state Reed–Muller in Mathlib and prove d(RM(2,4))=4, for **zero** additional confidence over a loop that cannot be wrong. Lean buys *generality over parameters*; there is one fixed parameter. |
| L2 | quantum distance d = min wt (C₁ \ C₂^⊥) | same, finite | **Direct enumeration** | as above |
| L3 | the N=8 closure of §3 (the negative result) | exhaustive over ≤2^8 | **Direct enumeration** — and this is what makes the "don't" *metered* rather than an opinion | Leaving it as prose: the closure is the load-bearing reason not to build the N=8 stack, and an unchecked reason is a check that did not run. |
| L4 | decoder correctness: corrects **every** weight-1, and the **exact** set it fails on | exhaustive: 48 single-qubit Paulis + 1080 weight-2 | **Direct enumeration — a TOTAL discharge.** NOT FsCheck. | Property testing would **sample** a space we can **exhaust**. Strictly weaker than the trivial loop, and it would report a probabilistic answer where a certain one is free. This is the single most tempting mis-route in the whole ladder. |
| L5 | cross-oracle agreement | byte-lock | **Golden vectors, hex-in-JSON** (`no-binary-in-proof-lineage`) | this is the distinctively-ours layer; it is the *reason* the roadmap is worth having |
| L6 | syndrome-extraction **circuit** ≡ the intended stabiliser measurement | Clifford-circuit equivalence | **Q# + stabiliser simulation.** Gottesman–Knill ⇒ exact and poly-time. | The one genuinely quantum layer, and the one place Q# earns its keep. It is also the **BP-16 second tool**: L1–L4 are one instrument (enumeration); Q# is independent. |
| — | concurrency / protocol / temporal / refinement | **absent** | **TLA+ — NO.** | There is no protocol, no concurrency, no liveness, no refinement anywhere in this stack. Encoding GF(2) linear algebra in TLA+ is human-weeks, and TLC would state-explode on 2^16. `tlaps-proof` went green again yesterday (#14176 — the prover step had not run for seven weeks) and my prerequisite list is satisfied. **It is still the wrong tool, and "we just got it working" is not a routing argument.** Routing TLA+ here would be precisely the "any invariant worth proving is a TLA+ invariant" drift my own skill names as the repo's standing failure mode. |
| — | unbounded arithmetic identities | **absent** | **Z3 — NO.** | GF(2) linear algebra at fixed finite dimension is decided by enumeration faster than the SMT encoding can be written. Z3 earns its keep on unbounded `Int` — which is exactly what `tools/Z3Verify/Program.fs` already does and should keep doing. |
| — | RL control of the decoder | **nothing to control** | **NO TOOL. Do not build.** | See §7. |

### The Lean call, stated against the capability that actually landed

The brief offers `Zeta23/LinAlg` (#13913, 2026-08-22 — von Neumann trace inequality,
Sylvester both directions, rank–trace, inertia, Weyl) as a reason Lean is newly routable.
I checked the files rather than the changelog. Every one of them opens:

```lean
variable {𝕜 : Type*} [RCLike 𝕜]
```

`RCLike` is **ℝ or ℂ**. 𝔽₂ is not an `RCLike` field, and none of it is. The port is Hermitian
matrices, positive-semidefiniteness and quadratic-form inertia over the reals — a genuinely
valuable capability that has **zero** applicability to binary coding theory. Naming a
capability that exists but does not apply is itself a wrong-tool cost, so: **the new Lean
capability does not move this routing call by one inch.**

**Where Lean *would* earn its keep here — one place, and it is a stretch goal, not a
milestone.** The **parameterised** CSS theorem: for any C₂^⊥ ⊆ C₁, the code has
k = k₁ + k₂ − n and d ≥ min wt (C₁ \ C₂^⊥). That is general over n and k, which is exactly the
shape enumeration cannot reach — and it *generalises a file we already have*:
`ImaginaryStack/ErasureDistance.lean` already proves the classical
`erasure_correctable_of_min_distance` over `ZMod 17`. The quantum statement is its sibling.
Route it **after** L1–L5 land, and only because the neighbouring file makes it cheap. If it
turns out not to be cheap, drop it — nothing downstream depends on it.

---

## 6. The milestone ladder — what is bounded, and what is not

**Bounded. All four fit in a small number of sessions.**

- **M1 — `081M0QFQTS1087G0R002WHZFR7`.** The classical layer, four-oracle: RM(1,4)/RM(2,4)
  construction, the doubly-even/self-orthogonal/dual checks, and **the §3 closure enumeration
  landed as a test** so the "don't build N=8" verdict is metered rather than asserted. Golden
  vectors hex-in-JSON. Compute: milliseconds.
- **M2 — `081M0QFQYDK087G0R0028FQSM2`.** Syndrome table + decoder for [[16,6,4]], with the
  exhaustive weight-2 failure witness (see §8). Compute: ~1100 rows.
- **M3 — `081M0QFQYEQ087G0R003SW6VD8`.** Q# stabiliser-simulation cross-check of the
  syndrome-extraction circuit. **This is the BP-16 second instrument** — without it the whole
  stack rests on one tool (enumeration), and single-tool P0 evidence is insufficient.
- **M4 — `081M0QFQYFV087G0R00267NRTC`.** The anti-vacuity witness (§8).

**Not bounded — and I am not scoping it.** A surface-code stack with a real decoder at d=5,
which is what the Sivak/Morvan work runs, is Google Quantum AI plus DeepMind plus hardware.
The honest statement is not "later"; it is **there is no path from here to there that runs
through this repo**, because the missing ingredient is a physical device, not code.

**If only one thing ships, ship M1.** The closure result is the highest-value single artefact
in this doc: it is a *negative* that permanently retires a direction, and negatives are the
cheapest thing a routing authority can bank.

---

## 7. What is NOT worth doing — the declines

**1. Do not build an RL control loop. This is the vacuity class, and it is not close.**
Sivak/Morvan's RL agent tunes a real device against real drift — leakage, crosstalk,
calibration wander. We have no hardware, no drift, and no noise process that is not one we
wrote ourselves. An RL agent optimising against a noise model we authored measures **our own
noise model**, and reports its own assumptions back as a result. There is no falsifier that
can fail. **Decline.**

**2. Do not route TLA+ here.** Green again, still wrong. See the table.

**3. Do not build the N=8 stack — [[8,0,4]] or any of the d=2 rows.** §3 is exhaustive. Note
this decline is *provable*, which is the only kind worth having.

**4. Do not make Steane [[7,1,3]] the headline milestone.** It is a fine warm-up and its
provenance from our own matrix is genuinely nice, but it is k=1/d=3 *outside* the adinkra
category, where [[16,6,4]] is k=6/d=4 *inside* it. If M2 wants a smaller first target, Steane
is the right smaller target — as a rung, not as the destination.

**5. Do not claim the adinkra lineage "gives" us quantum error correction.** §1 is a theorem:
self-duality forces k=0. The true claim is narrower and still good — *one* member of the
adinkra family, at N=16, is a useful CSS code, and we can exhibit it from first principles
in four languages.

---

## 8. The falsifier — and why the brief's version needs strengthening

The brief proposed: *a decoder that provably corrects every weight-1 error and provably fails
on some weight-2 error.* Right instinct — a decoder that never reports failure is the vacuity
class. But "some" is weaker than what is available, and I would rather bank the strong form.

**Measured on Steane [[7,1,3]] as the worked instance** (parity check
`[[1,0,0,1,0,1,1],[0,1,0,1,1,0,1],[0,0,1,1,1,1,0]]`, computed from our punctured generator):

- all **7** weight-1 errors have **distinct, nonzero** syndromes — 7 errors, 7 nonzero
  syndromes, a bijection;
- therefore **all 21 of 21** weight-2 errors alias onto a weight-1 correction. Not *some*.
  **All of them.** Example: the error on qubits {0,1} carries the syndrome of a single error on
  qubit 6, and the decoder miscorrects with no failure flag.

And the 21/21 is *structure, not a coincidence*: the Hamming code is **perfect**, so every
nonzero syndrome is already claimed by exactly one weight-1 error, leaving no syndrome free
to signal "weight 2". So the falsifier can be stated in the total form:

> **F1.** Every single-qubit Pauli error is corrected. **F2.** The set of miscorrected
> weight-2 errors is enumerated **exactly** and matches the computed set — for Steane, all 21;
> for [[16,6,4]], whatever the enumeration says, pinned as a number. A decoder whose weight-2
> failure set is *empty* or *unenumerated* fails the milestone.

F2 is the half that matters. F1 alone is satisfiable by a decoder that lies.

**Plus the anti-vacuity witness for the byte-lock (M4), which is the brief's and is correct:**
flip **one bit** of **one** syndrome in **one** oracle; the lock must go red. Without this the
four-oracle claim is unfalsified — and per
`.claude/rules/no-binary-in-proof-lineage.md` condition 2, a golden vector nothing reads is
"the vacuity class in its purest form." A golden vector nothing can *disagree with* is the
same failure one level up.

**Register: everything in this doc is `unmetered` until M1 lands.** The enumerations in §§1–4
were run and are reproducible, but they ran in a scratch script outside the tree — which is
exactly the state `toy-is-free-metered-must-be-earned` says to label rather than round up. The
one thing that is already metered is a **negative**: §3's closure, which is what M1 makes
permanent.

---

## 9. Anchors (Beacon)

- **Calderbank & Shor** (1996), **Steane** (1996) — the CSS construction and quantum
  Reed–Muller codes. [[16,6,4]] is theirs; the adinkra-category observation in §4 is ours.
- **Calderbank, Rains, Shor & Sloane**, *Quantum error correction and orthogonal geometry*
  (PRL 1997) and *…over GF(4)* (1998) — codes as isotropic subspaces of the symplectic
  𝔽₂ geometry. **Already derived in-tree**, REPORT #6 §1.
- **Gottesman** (1997) / **Knill–Gottesman** — stabiliser formalism; the poly-time exact
  simulation that makes L6 cheap. Flagged in `Cl3.fs:11`.
- **Doran, Faux, Gates, Hübsch, Iga, Landweber**, *Relating doubly-even error-correcting
  codes, graphs, and irreducible representations of N-extended supersymmetry* (J. Phys. A
  2008, arXiv:0806.0051) — the adinkra ↔ doubly-even correspondence the whole category
  question turns on. Cited in `AdinkraCode.fs`.
- **Gleason** / **Mallows–Sloane** — doubly-even self-dual codes exist only at length ≡ 0
  (mod 8). This is why the ladder's rungs are 8, 16, 24 and not anything between.
- **Nebe, Rains & Sloane**, *The invariants of the Clifford groups* (Des. Codes Cryptogr. 24,
  2001) and *Self-Dual Codes and Invariant Theory* (2006) — 𝒞ₖ = Aut(BW_{2^k}). The BW₁₆
  connection in §4.
- **Sivak, Morvan et al.**, *Reinforcement learning control of quantum error correction*
  (Nature **655**, 879–884, 2026) — the trigger. Compared in the parallel doc; §7 is this
  doc's only claim about it, and it is a decline.

---

## 10. Portfolio note

Formal-coverage denominator gains four rows (M1–M4). Ring implications for
`docs/TECH-RADAR.md`: **Q# moves from an undeclared position to a named instrument** with one
specific job (L6, stabiliser-circuit equivalence) — Aaron's premise was wrong about what Q#
holds *today*, but right that Q# is where a QEC stack's genuinely quantum layer belongs. Lean 4
stays Adopt and stays **out** of this stack except for the §5 stretch goal. TLA+ stays Adopt
and is **declined here on the merits**, which is worth recording precisely *because* it just
came back green — a tool returning to service is when the pressure to use it is highest.

---

## 11. ADDENDUM 2026-08-24 — M1 has LANDED, and the enumerations are now code a test can fail

**Author:** Lumen (mathematical-physics expert). **Work-item:** `081M0QFQTS1087G0R002WHZFR7`.
**Status change:** §8 closed with *"everything in this doc is `unmetered` until M1 lands"*, because the
§§1–4 enumerations ran in a scratch script outside the tree. They now run in the tree.

### Every algebraic claim in §§1–4 was independently recomputed before any of it was implemented

Not re-read — **recomputed**, from the definitions, in a language that shares no code with the
original script, before a line of F# was written. All four reproduce exactly:

| doc | claim | independent recomputation |
|---|---|---|
| §1 | `AdinkraCode.generator` is doubly-even, self-dual, weights `{0¹,4¹⁴,8¹}`, `CSS = [[8,0,4]]` | ✔ reproduced |
| §2 | all **8** punctures give `[7,4,3]`; weights `{0¹,3⁷,4⁷,7¹}`; **not** doubly-even, **not** self-orthogonal; `CSS = [[7,1,3]]` | ✔ reproduced |
| §3 | the closure table, `dim 0..4 → [[8,8,1]], [[8,6,2]], [[8,4,2]], [[8,2,2]], [[8,0,4]]` | ✔ reproduced |
| §4 | `RM(1,4)` dim 5, weights `{0,8,16}`, doubly-even, self-orthogonal, **not** self-dual; `RM(1,4)^⊥ = RM(2,4)` **as a set**; `CSS = [[16,6,4]]` | ✔ reproduced |

No number in §§1–4 changed. The enumeration now also reports a datum the doc did not carry: there
are exactly **902 distinct doubly-even codes of length 8**, and that count is pinned by a test —
without it, a search that silently explored one code would still satisfy every row assertion.

### What shipped

| file | what it is |
|---|---|
| `src/Core/CssCode.fs` | GF(2) codes as bitmasks: span, dual, doubly-even, self-orthogonal, self-dual, weight distribution, `RM(r,m)` **from the monomial definition**, the CSS parameter map, the length-8 closure enumeration, puncture, reduced-echelon bases, syndromes, hex + SHA-256 serialisation. |
| `tests/Tests.FSharp/CssCode.Tests.fs` | 25 tests, every enumeration **exhaustive** rather than sampled (routing table L4: property testing would *sample* a space we can *exhaust*). |
| `src/Core.QSharp.ReferenceOracle/css-stabilizer-treaty.json` | the golden vectors, **hex-in-JSON**, produced by the F#. |
| `src/Core.QSharp.ReferenceOracle/CssStabilizerCodes.qs` | the L6 layer: stabiliser rows, ancilla-based X/Z syndrome extraction, the CSS commutation predicate. |
| `src/Core.QSharp.ReferenceOracle/css-stabilizer.test.ts` | the **second oracle** — re-derives Reed–Muller, duals and the CSS parameters in TypeScript, calling none of the F#, and checks its own answers against the treaty and against the Q# source's declared rows. |

### The oracle count, stated honestly rather than rounded up to four

M1's title says "four-oracle". What landed is **two independent implementations** (F#, TypeScript)
plus **one declaration cross-checked as text** (Q#). That is three surfaces, not four, and the third
is weaker than the first two because Q# is not executed on every lane — QDK is an opt-in install, so
the `.qs` is checked by *parsing its declared rows and comparing them*, not by running the circuit.

That is worth stating precisely because it is exactly the kind of number that inflates. **The Q#
cross-check earned its keep anyway: the first draft of `CssStabilizerCodes.qs` declared the Steane
rows as `0x70, 0x2D, 0x1B`, and the correct rows are `0x55, 0x33, 0x0F`. The test caught it.** A
transcription that nothing compares is a golden vector wearing a disguise.

Rust and Go remain unwritten. Naming that is cheaper than implying coverage that does not exist.

### Mutation report — 14 mutations, and the survivors are named

A test that survives mutation is not a falsifier, so every mutation run is listed, including the
three that survived and why. Exit codes captured directly, never through a pipe.

**Killed (11).** doubly-even `mod 4 → mod 2` (3 fail) · `k_q` off by one (7) · RM monomial predicate
`(p∧s)=s → (p∧s)≠0` (7) · puncture keeps the dropped coordinate (5) · dual predicate weakened (13) ·
digest separator (1) · closure takes `min` instead of `max` distance (2) · containment guard deleted
(1, *after* the guard test was added — it survived before) · **one hex digit flipped in one committed
golden vector** (1) · one Q# stabiliser row corrupted (TS, 1) · one treaty closure row altered (TS, 1).

The hex-digit flip is **M4's anti-vacuity witness** discharged early: the byte-lock can go red.
The TypeScript oracle also carries a **sabotage control** — breaking its own Reed–Muller construction
turns 3 tests red — so a green TS run is not a run that did nothing.

**Survived (3), all three EQUIVALENT MUTANTS, and each is now documented rather than left dangling:**

1. **Digest separator `"," → ";`"** — the substitution landed on the enumeration's *dedup key*, not
   the digest. Re-run targeted at the digest: **killed**. Not a survivor; a mis-aimed mutation.
2. **Drop the back-substitution in `echelonBasis`.** It survived, and it caught a real overclaim:
   the basis was row echelon, and the docstring said *canonical*. **Fixed in the code, not softened
   in the prose** — the basis is now genuinely reduced, `isReducedEchelon` is asserted for every
   committed code, and the mutant survives only because these four particular codes were already
   reduced. Also removed an unfalsifiable test: "same rows from a reversed list" cannot fail when the
   function sorts internally.
3. **`min` over `C \ C^⊥` → `min` over `C \ {0}`.** These coincide unless the code is **degenerate**
   (minimum weight attained *inside* `C^⊥`). A bounded search found **no degenerate symmetric
   `CSS(C,C)` code at length 8**, and that equivalence is now itself a test, with its scope stated:
   length 8, symmetric form only. Degenerate codes certainly exist in the asymmetric form
   `CSS(C₁,C₂)` — Shor's `[[9,1,3]]` is the textbook one — and nothing here says otherwise.
4. *(bonus)* Deleting the `isSelfOrthogonal` guard in `cssFromAdinkraCode` survives **provably**:
   the inner containment check is `(C^⊥)^⊥ ⊆ C^⊥`, which by involution of the dual *is*
   self-orthogonality. The involution test in the same file is the proof of the equivalence.

### Register

`src/Core/CssCode.fs` is **metered**: it has falsifiers, they were run, and they fail without the
code. The doc's §§1–4 move from `unmetered` to `metered` **for the enumerations only**. §3's closure
keeps the narrower scope §3a gave it — closed over `CSS(C^⊥, C^⊥)` for `C` doubly-even of length 8,
**not** over all 8-qubit stabiliser codes; `[[8,3,3]]` remains **cited, not computed**, and the test
name and the treaty both say so.

**M2/M3/M4 are untouched.** M4's witness is discharged early; the milestone is not, because M4 is the
witness for the *[[16,6,4]] decoder's* lock, which does not exist yet.

### The demarcation, restated where the code can be read

Everything above is **GF(2) linear algebra**. `[[n,k,d]]` are three integers produced by arithmetic —
the parameters a stabiliser code *would* have. Running the CSS recipe is checkable and is what this
repo can earn. **Holding an encoded qubit is a physical claim, is not made, and would need a device
this repo does not have.** The statement is carried in the module docstring, in the test header, in
the Q# header, and in the treaty's own `register: "structural"` field — the last because a
demarcation that lives only in a doc becomes a physical claim the first time the JSON is quoted
without it.

---

## 12. ADDENDUM 2026-08-24 — is the metered membrane QEC, or is it avoidance? A claim checked, and partly REFUTED

**Author:** Lumen. **Register: CONJECTURE (Z-tier) throughout.** Nothing in this section is
frozen-core, and none of it is proven — it is a mapping with a named falsifier, handed to Soraya.

The claim under test, made to Aaron by the coordinating agent and now being acted on:

> *"Our metered membrane is not decoherence-avoidance but QEC-with-syndrome-extraction. Dynamical
> decoupling (Viola & Lloyd 1998) and decoherence-free subspaces (Zanardi & Rasetti 1997; Lidar,
> Chuang & Whaley 1998) are both **avoidance** — neither ever looks at what the environment did. Our
> membrane **records** every crossing, which is a measurement, so it belongs to the detect-and-correct
> family, with the meter playing the role of the syndrome."*

It was offered as checkable so that it could fail. **It partly fails.** The conclusion survives for
one half of the membrane; the stated reasoning is invalid; and the exclusive form is refuted by a
falsifier the claim itself supplied.

### 12.1 The syndrome property is real — but it is weaker on our side than it looks

The property the claim leans on does hold, and its exact statement matters. In the stabiliser
formalism the syndrome is the tuple of eigenvalues of the stabiliser generators `gᵢ`. Two facts do
the work: `gᵢ` fixes the codespace (`gᵢ|ψ⟩ = |ψ⟩`), and every logical operator lies in the
**normaliser** of the stabiliser group, so `[gᵢ, L] = 0`. Measuring `gᵢ` therefore does not disturb
the logical state **and** returns an outcome statistically independent of it. You learn what the
environment did without learning — or damaging — what you stored.

**Does our meter have anything playing the role of "commutes with the logical operators"?** Yes, and
it is already a manifesto specification: **§13 noninterference** (Goguen & Meseguer 1982). The
requirement that the meter's reading be a function of the *crossing* and not of the *protected
content* is the same condition, and it is checkable and can fail.

**But half the theorem does no work for us, and this is the honest weakening.** In QEC, commutation
additionally buys **no back-action** — the reason the property is remarkable is that measurement
normally collapses, and stabiliser measurement dodges the collapse. Classically there is no collapse
to dodge. So what transfers is the strictly weaker structural statement:

> *There exists an observable algebra that detects perturbation while carrying zero mutual
> information about the protected content.*

That is real, checkable, and ours to earn. The deep content of the quantum theorem — measurement
**without** collapse — has no classical referent, and a mapping that quietly keeps it is claiming
physics rather than shape.

**The falsifier for our side:** if any meter observable is a function of the protected content, the
analogy breaks *at the joint* and what we have is a logical measurement — decoherence — not syndrome
extraction. `.claude/rules/local-time-never-enters-the-shared-fold.md` is precisely this failure mode
already written down: the instant a local clock filters the evidence entering the shared fold, nodes
fold different sets and diverge.

### 12.2 The DFS falsifier FIRES — the symmetry group can be named, so the exclusive claim is wrong

The claim supplied its own falsifier: *DFS requires naming the symmetry group under which the encoded
subspace is invariant; if such a group can be named for our membrane, the claim is wrong.*

**It can be named.** For the commutative/CRDT fold the noise class is **reorder, duplicate, delay**;
the group is the **permutation action on the message multiset together with idempotent
re-delivery**; and the fold's value is invariant under it *by construction* — the fold is a function
of the evidence **set**, so the group acts trivially. That is exactly the DFS shape: noise confined
to a group action under which the encoded value transforms by the trivial one-dimensional irrep. No
measurement is involved anywhere, and none is needed.

So **the membrane is not exclusively QEC.** Part of it is passive, symmetry-based avoidance.

The corrected claim is more useful than the one it replaces:

> The membrane is a **hybrid**. Against the *symmetric* noise class — reorder, duplicate, delay — it
> is **passive and DFS-shaped**: the CRDT symmetry makes the protected value invariant and nothing
> needs to be observed. Against the *asymmetric* class — content crossings, entropy injection — no
> symmetry exists, and the membrane must **actively detect and record**.

And that explains why the meter exists at all: **the meter is needed exactly where the symmetry runs
out.** The DFS half is free; the QEC half has to be paid for. That is a mapping with a metered
consequence rather than a restatement.

The literature already holds the object the dichotomy was missing: **operator quantum error
correction** (Kribs, Laflamme & Poulin, PRL 94, 2005) unifies passive protection (DFS / noiseless
subsystems) with active QEC in one framework. Real fault-tolerant designs concatenate both. The
either/or was the error, not the choice of branch.

### 12.3 The fourth option exists, and it fits BETTER than either — noiseless subsystems

**Noiseless subsystems** (Knill, Laflamme & Viola, PRL 84, 2000) generalise DFS: decompose
`H = (H_A ⊗ H_B) ⊕ K` where the noise acts only on `H_B`; information stored in the **subsystem**
`H_A` survives. DFS is the special case `dim H_B = 1` — a *subspace*, where NS is a *tensor factor*.

**Zeta's structure is the subsystem one, and this is a structural discrimination rather than a name
match** — the two frameworks differ in a way our design decides between:

- A **DFS** says *some states* are safe.
- A **noiseless subsystem** says *some factor of every state* is safe.

Two carved rules already assert the second, neither citing this literature:

- `docs/writer-actor-routing-model.md` / `.claude/rules/shared-checkout-is-view-only.md` — **persona
  = owner ("what remains") vs actor = clone/loop ("what acts")**, and *"a bus/routing address is not
  identity."* The routing address is a gauge factor, deliberately unprotected, and the persona is the
  protected factor. That is `H_A ⊗ H_B`.
- `.claude/rules/local-time-never-enters-the-shared-fold.md` — local wall-clock and receive-order
  steer **only local actions**; the shared fold sees **only agreed phase**. That is literally *"the
  noise acts only on the `H_B` factor"*, and the rule's own stated failure mode — a local clock
  filtering evidence into the shared fold makes nodes diverge — is literally *"leaking `H_B` into
  `H_A` destroys the noiseless subsystem."*

**This is the most valuable thing the check turned up**, and it was not in the claim at all: the repo
already contains, in two independently-derived rules, the decomposition that NS names. The rules were
right before the anchor was found, which is the good direction for an anchor to arrive from.

### 12.4 Zeno breaks the stated REASON — "avoidance = no measurement" is false

The reasoning was: *avoidance never measures; ours measures; therefore ours is correction.* The
**quantum Zeno effect** (Misra & Sudarshan, J. Math. Phys. 18, 1977) is a direct counterexample:
frequent projective measurement **freezes** evolution. It is measurement-based like QEC and
avoidance in effect like DFS. So the inference is invalid as stated, independently of whether its
conclusion is true.

**The correct discriminator is not "does it measure?" but "is the outcome USED?"**

| family | measures? | outcome | protection comes from |
|---|---|---|---|
| dynamical decoupling | no | — | the control pulses |
| DFS / noiseless subsystems | no | — | a symmetry |
| **quantum Zeno** | **yes** | **discarded** | the measurement's own projection |
| **QEC** | **yes** | **recorded and conditioned on** | a recovery map indexed by the syndrome |

Under the corrected discriminator the conclusion **does** survive for the recording half: the meter
posts to a ledger and the ledger is acted on. A membrane that measured every crossing and threw the
reading away would be Zeno-shaped, not QEC-shaped.

**And part of ours genuinely is Zeno-shaped: budget refusal.** A crossing that would blow the entropy
budget is *refused* — measured, and the transition **prevented** rather than corrected. That is
Zeno's structure exactly, and it sits in the same membrane as the recording half.

The distinction earns its keep because **the two halves fail differently, and one of the failures is
invisible**:

- **Zeno-shaped protection fails silently, by freezing.** A membrane that refuses everything is
  perfectly protected and completely useless — the vacuity class with a safety story attached.
- **QEC-shaped protection fails loudly, by miscorrection.** A wrong recovery is a wrong *value*, and
  wrong values are the kind of failure this repo is already built to catch.

Falsifiable consequence, and it is cheap: **a membrane whose refusal rate tends to 1 is not maximally
safe, it is maximally vacuous.** Refusal rate is already a metered quantity. A membrane that has
never refused *and* one that refuses almost everything are both suspect, for opposite reasons, and
only the second currently looks like success.

### 12.5 The demarcation — including the quantity that CANNOT be placed

| claim | register |
|---|---|
| CSS / stabiliser algebra over GF(2) applies to our classical codes | **WEAK / structural** — landed and metered in §11 |
| "the meter observable carries zero mutual information about the protected content" | **WEAK / structural** — an information-theoretic property of our meter; §13 noninterference; checkable, can fail |
| the (protected factor, gauge factor) decomposition of the routing model | **WEAK / structural** — a property of the design, checkable against the two rules cited |
| physical decoherence occurs at our membrane | **STRONG / physical — NOT CLAIMED** |
| measurement back-action occurs anywhere in Zeta | **STRONG / physical — NOT CLAIMED** |
| a DFS symmetry protects us against a physical environment | **STRONG / physical — NOT CLAIMED** |

**And one quantity cannot be placed on either side, which is the most useful finding available here,
because the whole thesis is that the meter draws that line.**

> **The "distance" of the membrane is not measurable, and the reason is not that we have not measured
> it yet.**

In QEC, `d` is the minimum weight of a logical operator. It presupposes **sites** (tensor factors)
and **weight** (how many sites an error touches), and what it bounds is protection against
**independent, bounded-weight** noise. Our adversary is neither independent nor bounded-weight: it is
correlated and adaptive. So a membrane "distance" has no referent — **not because the number is hard
to compute, but because the noise model that gives `d` its meaning is not our noise model.**

The trap this avoids is a live one. It would be easy to compute something distance-shaped — say, the
number of channels an attacker must compromise — and quote it as a QEC distance. That number would be
perfectly real *and would not mean what `d` means*, and the resemblance is precisely what would make
the substitution invisible. A quantity that was not measured must never look like one that was.

### 12.6 What is handed to Soraya

**Conjecture Z-M (membrane subsystem decomposition). CONJECTURE tier, not frozen-core.**

> There exists a decomposition of the membrane's observable state into a **protected factor `A`** and
> a **gauge factor `B`** such that (i) every declared meter observable is a function of the crossing
> and of `B` alone, and is statistically independent of `A`; and (ii) the reorder / duplicate / delay
> noise class acts only on `B`.
>
> Clause (i) is the **noninterference** condition (§13; Goguen–Meseguer 1982) and is the analogue of
> "the syndrome commutes with the logical operators". Clause (ii) is the **noiseless-subsystem**
> condition (Knill–Laflamme–Viola 2000) and is the analogue of "the noise acts only on `H_B`".

**Falsifier.** Exhibit a single meter observable whose value differs between two runs that agree on
`B` and on the crossing sequence but differ on `A`. One such observable refutes clause (i).
`local-time-never-enters-the-shared-fold` names the most likely place to find one.

**Scheme-independence the claim must survive.** The decomposition must not depend on the choice of
`B` — a different gauge factor (say, receive-order instead of wall-clock) must yield the same
protected `A`. A conjecture that holds for exactly one choice of gauge has fixed a scheme rather than
found a structure.

**Why this routes to Soraya and not to a physicist:** stated this way it is a **noninterference proof
obligation over a classical system**, with no quantum content whatsoever. The quantum literature
supplied the *shape* and the vocabulary; the obligation is one her tools already handle. That is the
mapping doing its proper job — physics grounds the metering discipline, and the proof is ours.

### 12.7 Two things deliberately NOT re-derived here

- **Destructive interference in the quorum fold is already answered in-tree.**
  `src/Core.TLA/specs/QuorumPhaseCancellation.tla` (Soraya, 2026-08-13) models exactly this and
  states its own one-way limit: reachability transfers up from the 4th-roots-of-unity restriction,
  non-reachability does not. Repeating it would be a second observation counted as new evidence.
- **No bound in this work is a Tsirelson bound.** `1/(3√2)` appears in this repo as a **design
  parameter**; `S ≤ 2√2` is a different object arising from a different argument. They are adjacent
  in the literature this section cites, which is exactly why the guard is written down here.

### 12.8 Verdict, plainly

**The claim as made to Aaron is wrong in its exclusive form, and right in a narrower one.**

- **Wrong:** "not avoidance **but** QEC." A symmetry group *can* be named for one noise class, so
  part of the membrane is genuinely DFS-shaped. The exclusive disjunction is refuted by the
  falsifier the claim itself proposed.
- **Wrong reasoning, separately:** "avoidance = never measures" is false — quantum Zeno measures and
  is avoidance. The inference was invalid even where the conclusion holds. The repaired
  discriminator is **whether the outcome is used**, not whether a measurement occurs.
- **Right, narrowly:** under the repaired discriminator, the *recording* half of the membrane is
  QEC-shaped — the meter's readings are kept and conditioned on. And the syndrome property the claim
  relied on is real, with §13 noninterference as its checkable analogue, though it transfers in a
  strictly weakened form because there is no collapse here to dodge.
- **Missing, and better than either branch:** **noiseless subsystems**, which fit the persona/actor
  and shared-fold/local-time decompositions the repo already carries — and **operator quantum error
  correction**, which is the published framework for exactly the hybrid this membrane turns out to be.

Aaron is routing QEC work on the strength of this claim. **The routing is still correct** — §11 is
real work with real falsifiers regardless of how the membrane analogy resolves, and the two are
independent. But the membrane framing that motivated it needed all four corrections above, and it
should be carried in the corrected form from here.
