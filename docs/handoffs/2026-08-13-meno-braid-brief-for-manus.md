# Meno braid — self-contained brief for an external model (Manus)

**Purpose.** Hand this to a model with **no access to the Zeta repository**. Everything needed to work
the open problems is reproduced inline. Nothing below requires reading our code.

**What we want back:** answers to §5. A clean *negative* is as valuable as a positive — see §6.

> **STATUS 2026-08-14 — ANSWERED IN-HOUSE. Do not re-send this brief as-is.**
> Q1 and Q3 are settled; Q4 is answered. Sending this unchanged would spend an
> external model's round on a solved problem, and its §5 framing of Q1 contains
> the misreading that caused the confusion.
>
> - **Q3 (checked first, as it gates Q1).** The obstruction is **NOT real** as
>   stated: the ambient `⊗_Kronecker` is not cartesian (it is not the product in
>   `Mod_ℤ`, and `unitObject` is not terminal), so Mathlib's
>   `Subsingleton (SymmetricCategory C)` does not apply. `braidR` is a braiding of
>   `⟨V⟩`, which is exactly the scope the code already claims. The premise "our
>   ambient tensor is described in our own source as cartesian" misreads
>   `Meno.fs:38`, which says the **deterministic subcategory** is cartesian. That
>   adjacent obstruction is real and sharper — see the note below.
> - **Q1.** `⟨V⟩` **IS balanced**, uniquely, with `θ_{V^n} = ρ(Δₙ²)` (Garside full
>   twist). `θ_V = id` is forced and correct, not degenerate. The reviews' worry
>   came from reading the axiom as `θ_{A⊗B} = θ_A ⊗ θ_B`; the real axiom is
>   `θ_{A⊗B} = (θ_A ⊗ θ_B) ∘ c_{B,A} ∘ c_{A,B}`, so `θ_V = id` forces
>   `θ_{V⊗V} = c²`, not `c² = id`. CHECKED for all `m+n ≤ 7` by two independent
>   implementations, four planted mutants rejected.
> - **Q4.** Balanced was worth the effort (it cost hours and it closed a line).
>   Above it buys nothing we need — ribbon's Markov trace is strictly weaker than
>   the faithful `Braid.equal` we already ship. **Stop here.**
>
> Full verdicts + the sharper Q3 finding (a cartesian category has a unique
> *braiding*, not merely a unique symmetric structure, so `⟨V⟩` must never admit
> copy/discard): the `MenoBraided.fs` module docstring. Follow-on work:
> `081KZZVC3DD087G0R0035SZN58` (Lean certificate), `081KZZVC6SE087G0R001SXE8BV`
> (the copy/discard guard).
>
> **Q2 (framed promotion) remains genuinely open** and is the only part still
> worth an external round — but note it is now a *curiosity*, not a blocker:
> `⟨V⟩` is already balanced without framing. The framed promotion would give the
> free *balanced* category on one object (ribbon braids, `ℤⁿ ⋊ Bₙ`, where
> `θ_V ≠ id`), which is a strictly larger object than we need.

---

## 1. The object

We have a braided monoidal structure built on braid-group words. The braiding is the **conjugation
rack** Yang–Baxter operator. Over a group `G`:

```text
R  (x, y) = (x·y·x⁻¹, x)
R⁻¹(u, v) = (v, v⁻¹·u·v)
```

The underlying object is `V = ℤ[F_n]` — the free ℤ-module on words in the free group `F_n`
(equivalently: formal ℤ-linear combinations of braid words, with negative coefficients meaningful —
they are retractions in a database sense, not an artefact).

`F_n` is **non-abelian**, and that is the entire point: it is what makes the braiding genuinely
braided rather than symmetric.

## 2. What is already proven (Lean 4 + Mathlib, machine-checked)

Do not re-derive these. All are `sorry`-free; `#print axioms` shows only `propext`,
`Classical.choice`, `Quot.sound`.

| Statement | Content |
|---|---|
| `braidRinv_braidR`, `braidR_braidRinv` | `R` is a bijection — a valid set-theoretic braiding candidate |
| `braidR_isSymmetric_iff_commute` | `R∘R = id` ⟺ **every pair in `G` commutes**. So symmetric ⟺ abelian |
| `braidR_not_symmetric_perm3` | Concrete witness in `S₃`: `(0 1)` and `(1 2)` do not commute, so `R∘R ≠ id` |
| `braidR_yangBaxter` | **`R₁₂∘R₂₃∘R₁₂ = R₂₃∘R₁₂∘R₂₃`** on `G×G×G` — the set-theoretic YBE |
| `conj_selfDistrib` | `(x▷y)▷(x▷z) = x▷(y▷z)` where `x▷y = xyx⁻¹` — the rack axiom underneath it |
| `mut_not_yangBaxter` | **Negative control**: a mutant replacing conjugation with plain multiplication is *rejected* by the same equation, so the YBE result discriminates |
| `braidR_yangBaxter_perm3_exhaustive` | YBE re-derived by exhaustive evaluation over all 216 triples of `S₃`, independent of the algebraic tactic |

**Net: braided ✓, symmetric ✗.** This is the repo's only non-symmetric braiding; everything else's
tensor swap is an involution.

Anchors we are working under: Joyal–Street 1993 (braided monoidal categories); Yang 1967 / Baxter
1972 (YBE); Joyce 1982, Fenn–Rourke 1992 (racks/quandles as set-theoretic YB solutions); Kassel,
*Quantum Groups*.

## 3. Where we are trying to go

The classification ladder above braided monoidal:

```text
braided  ->  balanced (a twist θ)  ->  ribbon / tortile (twist + duals)  ->  modular tensor category
```

We want Meno classified as far up this ladder as it honestly goes — **and we want to know precisely
where it stops, and why.** Stopping early with a proof is a good outcome.

## 4. What two independent reviews already CLOSED — do not spend time here

Both were checked against the code; treat as settled unless you can refute them directly.

- **Writhe is not the twist.** Writhe *is* computed in our code, and was the obvious θ candidate. It
  fails on type: a twist is a natural automorphism `θ_X ∈ Hom(X,X)`, while writhe is a ℤ-valued
  character on `H₁(B_n)` (the abelianization `B_n ↠ ℤ`, exponent sum). Wrong space entirely.
- **Ribbon is blocked at the object, not merely unproven.** Ribbon needs rigidity (dual objects with
  ev/coev). `V = ℤ[F_n]` is a free ℤ-module of **infinite rank** (`F_n` is infinite), and in `Mod_ℤ`
  dualizable ⟺ finitely generated projective. **`V` has no dual.**
- **Modular tensor is false, not open.** MTC requires finite semisimplicity and a non-degenerate
  S-matrix. `V` has infinitely many simples. Separately, our *ambient* tensor uses the plain swap, in
  which every object is transparent — S is maximally degenerate by construction.

## 5. The open questions — this is what we want from you

### Q1 (highest value). Does a non-trivial twist exist, or is Meno provably NOT balanced

Balanced requires a natural `θ` with

```text
θ_{A⊗B} = (θ_A ⊗ θ_B) ∘ c_{B,A} ∘ c_{A,B}
```

Two independent reviews converged on the same worry from different directions: the natural candidate
appears forced to `θ = id`, which would force `c² = id` — directly contradicting the proven
`braidR_not_symmetric_perm3`. If that is right, **Meno is provably not balanced**, and the ladder
stops one rung above where it currently sits.

One reviewer's specific reading: in the free braided monoidal category on one object, the balanced
structure is `θ_{V^⊗n} = ρ(Δ²_n)`, the Garside **full twist** (2π rotation of the whole strand
bundle) — and `Δ²_1 = id` because `B₁` is trivial, so θ is degenerate *on the generator* even if it
exists on higher tensor powers. Note: no full-twist / Garside element exists in our code at all; this
is unbuilt.

**Suggested cheap route:** a bounded existence search over small non-abelian groups (`S₃`, `S₄`, `Q₈`)
with an SMT solver — hours, not weeks — before anyone attempts a general proof. Please state which
you did.

### Q2. Does the *framed* promotion rescue it

`Braid.Word` in our code is a bare `Letter list` with **no framing datum**. Writhe is exactly the
integer that would fill such a field. Question: if `V` is promoted to carry a per-strand integer
framing (`V × ℤ`, roughly), does the conjugation rack then admit a non-trivial twist and become
genuinely balanced? If yes, what is the minimal such promotion?

### Q3 (possibly the most important, and it undercuts everything else). Is the braiding a braiding *of Meno*

Mathlib carries `Cartesian ⇒ Symmetric` together with `Subsingleton (SymmetricCategory C)` — a
cartesian monoidal category has *exactly one* symmetric structure and admits no other.

Our ambient tensor is described in our own source as cartesian. If that is literally true, then
`braidR` is **not a braiding of Meno at all** — only of some non-cartesian tensor on the sub-object
`⟨V⟩`, and that tensor **is not built**.

So: is the obstruction real? And if so, what is the minimal non-cartesian `⊗` on `⟨V⟩` that carries
`braidR`? This determines whether the proven results in §2 apply to the system or only to an object
we have not yet constructed.

### Q4. The honest one: does any of this buy a capability

We already decide braid isotopy *faithfully* via Artin's action (an implemented, tested `Braid.equal`).
Ribbon would buy a Markov trace giving a scalar link invariant of a computation history — which looks
**strictly weaker** than what we already have. MTC would buy anyon-style fault tolerance, which needs a
unitary ℂ-linear substrate we do not have and have not planned.

If the honest answer is *"balanced is worth the small effort, and above that buys nothing you need"*,
say so. We would rather stop with a reason than climb for the aesthetics.

## 6. Constraints and what a good answer looks like

- **Exact arithmetic only.** No floating point. Everything must be byte-lockable across independent
  implementations in F#, C#, Rust, and TypeScript — so ℤ, ℤ[t,t⁻¹], finite fields, and exact rationals
  are fine; ℝ and ℂ approximations are not. (This is why Burau over `ℤ[t,t⁻¹]` and Lawrence–Krammer are
  attractive if a finite-rank representation is needed for Q2/Q3.)
- **Mark every claim CHECKED or CONJECTURE**, and say what you actually ran versus what you reasoned
  about. We have been bitten repeatedly this week by confident claims that did not survive review —
  including one struck the same day it was written.
- **A negative result is a first-class deliverable.** *"Meno is provably not balanced, here is the
  obstruction"* closes a line of work and is worth more to us than a hedge. Please try to refute your
  own answer before sending it.
- **Cite the anchors.** Named human + paper, old and modern. An unanchored coinage is a debt here.

## 7. If you want the exact Lean

The full certificate is ~200 lines of Lean 4 against Mathlib (`v4.30.0-rc1`) and can be supplied on
request. The operative definitions are exactly as printed in §1; the theorem names in §2 are verbatim.
