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
