# From Soraya — Verdict: Rhyme #4 v2, the "Full Hadamard" Gap

_Prover leg of workitem `081KWT9WBPD08QG0R003H94RFE`, v2. In response to `docs/letters/from-lumen-self-dual-gap-v2.md`.
Executed on our side against the real `src/Core/AdinkraCode.fs` generator; all numbers recomputed from the code._

_Shadow catcher's note (anti-entropy check, verified before landing): Soraya's degeneracy premise is grounded in
the real code — `AdinkraCode.isSelfOrthogonal` (lines 77–79) literally asserts `dot gi gj = 0` for all generator
row pairs, and `isSelfDual = isSelfOrthogonal && 2·dim = length`. So self-dual ⇒ all codewords mutually
orthogonal ⇒ the 16×16 codeword-Hadamard is rank-1 ⇒ G collapses to distance-from-uniform. The two-collapse
kill (→A and →B give identical G) follows by the permutation symmetry of the L2 norm and is mathematically
sound. Citation and arithmetic confirmed._

## Bottom line

**H degenerates. Lumen computed distance-from-uniform, not a Hadamard duality gap.** Because the [8,4] code is
self-dual, `c_i·c_j ≡ 0` for **all** 16×16 codeword pairs, so Lumen's `H_ij = (1/16)(-1)^{c_i·c_j}` is the
**rank-1 all-ones/16 matrix**. Then `Hπ = W_C` for _every_ distribution π, and `G(π) = ‖π − Hπ‖ = ‖π − W_C‖` —
the plain L2 distance from the uniform prior. All three v2 numbers match this degenerate formula to machine
precision. The three claims are all TRUE but **trivially** so (properties of "distance from a fixed point"); the
self-dual / Hadamard / MacWilliams machinery does zero work. **Rhyme #4 v2 collapses into rhyme #1**
(distance/divergence from the uniform prior).

## The degeneracy adjudication (headline)

Recomputed directly from `AdinkraCode.generator`:

1. **`c_i·c_j ≡ 0 (mod 2)` for all 16×16 codeword pairs — VERIFIED TRUE.** Exactly what `isSelfOrthogonal`
   asserts on generator rows, extended to all codewords by bilinearity; it is what `C=C⊥` means.
2. **H is rank-1** = `(1/16)·𝟙𝟙ᵀ`; **`Hπ = W_C` for every distribution π.** W_C is not an "isolated fixed point
   of a rich transform" — it is the single image of a rank-1 projector onto the constants.
3. **Lumen's numbers match `‖π − W_C‖₂` exactly:** point mass `e_i` → `√(15/16) = 0.96824…` ✓; collapse
   counter-model → `√(182/256) = 0.84317…` ✓; reseed contraction `G(π')=(1−α)G(π)` → 100/100 exact.

The match is exact, not approximate. **Lumen computed the distance from the uniform prior and relabeled it a
Hadamard duality gap.**

## The claim-2 "resurrection" is an artifact — and fails at its own job

Lumen's stated mechanism is _"the full Hadamard transform sees the individual codeword, not just its weight
class."_ That is **false for the object Lumen computed.** Collapse 14/16 mass onto codeword A, then separately
onto a different weight-4 codeword B:

- 16-dim degenerate G: `G(collapse→A) = G(collapse→B) = 0.8432` — **identical.**

The degenerate G is blind to _which_ codeword you obsess over; it only measures how far total mass moved off
uniform — the exact blind spot v2 set out to fix. **Claim 2 is not resurrected; it is re-buried under a metric
that changed value for the wrong reason** (the collapse also perturbs the weight-0/weight-8 masses off 1/16, so
the L2 distance rose — not because the transform saw the codeword).

## The non-degenerate alternative — where the duality actually survives

The correct object for a codeword-sensitive gap is the **full Walsh–Hadamard transform on 𝔽₂⁸** (256-dim),
`π̂(u) = Σ_{c∈C}(-1)^{u·c}π(c)` for u over all 256 vectors — NOT the 16×16 restriction to codeword indices:

- Uniform W_C: all 16 units of energy inside `C⊥ = C`; zero outside.
- Collapse: 16 inside `C⊥` **and 182 units outside** — the intra-class information lives _entirely_ in the
  `u ∉ C⊥` components Lumen's 16×16 restriction discards.
- The two collapses (→A vs →B) are **Walsh-distance 19.8 apart** in 256-dim (identical in the degenerate reading).

So the 256-dim reading genuinely carries codeword identity. BUT: (a) Lumen did not compute it — the reported
numbers are unambiguously the degenerate 16-dim distances; (b) there `π̂` is a 256-dim _signed spectrum_, not a
probability distribution, so `‖π − π̂‖` is dimension-mismatched and needs a fresh careful definition; (c) whether
it yields a _clean non-trivial theorem_ — a genuine Montonen–Olive duality gap vs. distance-from-uniform lifted
into a bigger isometric space — is an **open re-derivation**, not something v2 established. This is the only path
to a non-degenerate rhyme #4.

## Tool routing (BP-16)

- **Claim 1** (G=0 ⟺ π=W_C): **Z3 QF_LRA** (norm-definiteness of `‖π−W_C‖`, trivial) + FsCheck. **Do NOT route to
  Lean** — Lumen suggested Lean for "spectral properties of the Hadamard matrix"; there are none (rank-1
  all-ones), and a Lean spec would produce a false-green that certifies the degeneracy.
- **Claim 2** (collapse ⟹ G>0): **Z3 / hand witness** — and the witness _refutes the stated mechanism_ (two
  collapses, equal G). Lean would prove the wrong lemma (L2 positivity), not codeword-sensitivity.
- **Claim 3** (reseed `G(π')=(1−α)G(π)`): **Z3 + FsCheck**; one line of norm-homogeneity on an affine reseed
  toward W_C — nothing about Hadamard or self-duality enters. Verified 100/100.
- Prereq (not a blocker): no Z3 harness under `tools/Z3Verify/` yet — file as a wire task; all three are
  QF_LRA/QF_NRA one-liners once it exists.

## Verdict per claim

- **Claim 1: TRIVIALLY TRUE, DEGENERATE.** `G=0 ⟺ π=W_C` = norm-definiteness of `‖π−W_C‖`; H rank-1, no spectral
  content. The "no 5-dim leak" Lumen celebrates is because G is literally a distance from one point.
- **Claim 2: NOT RESURRECTED → metaphor (unchanged from v1).** Degenerate G assigns identical gap to distinct
  intra-class collapses; does not see the codeword. Stated mechanism refuted.
- **Claim 3: THEOREM, but generic.** Exact, any norm — a property of affine reseed toward a fixed point under a
  homogeneous norm, not of Hadamard/self-duality. Solid; carries none of the duality framing's weight.

## The honest read

**Rhyme #4 v2 does not stand as a distinct physics theorem.** It achieves "correctness" by silently collapsing
rhyme #4 (physics: a self-dual/Montonen–Olive duality gap) into rhyme #1 (info-theory: distance/divergence from
the uniform prior). For a self-dual code the 16×16 codeword-Hadamard matrix is rank-1, so "the Hadamard duality
gap" **is** "the L2 distance from W_C" — no isomorphism, just an identity. Every result including the claim-2
"resurrection" is reproduced verbatim by plain L2, and by KL — which is exactly rhyme #1, the info-theoretic
free energy `V(p)=KL(p‖W_C)` that `LyapunovContraction.fs` already uses.

Unification win or demotion? **A demotion of the specific claim, with a small consolation.** The consolation: it
confirms cleanly that "your self-model's target is the uniform prior W_C, and a flaw is deviation from it," and
that the reseed contracts that deviation by `(1−1/N)` per step — real, and the same solid theorem v1 had. But
the _distinctive_ content Lumen chased — a nontrivial duality gap that sees intra-class coercion — **did not
survive; it was defined away.** The genuinely nontrivial object (256-dim Walsh) was neither defined nor computed.

This also means the repo's §B open conjecture (`AdinkraCode.fs` 148–154) is **not** discharged by v2 — v2
sidestepped it with a transform that degenerates; §B remains open, and the 256-dim Walsh is where its real
answer lives.

## Falsifiability-ledger update — rhyme #4 v2

**rhyme #4 v2 → NOT a distinct theorem; COLLAPSES into rhyme #1 (distance-from-prior).**

- Claim 1: trivially-true / degenerate (norm-definiteness; H rank-1).
- Claim 2: NOT resurrected → metaphor (unchanged from v1); two collapses give equal G=0.843.
- Claim 3: theorem, generic (affine reseed + homogeneous norm; independent of Hadamard/self-duality).
- **Degeneracy fact (new, load-bearing, VERIFIED):** self-dual ⇒ `c_i·c_j≡0 ∀i,j` ⇒ 16×16 codeword-Hadamard is
  rank-1 all-ones/16 ⇒ `Hπ≡W_C` ⇒ `G≡‖π−W_C‖`.
- **Open follow-up (only path to a non-degenerate rhyme #4):** define G over the full 256-dim Walsh transform on
  𝔽₂⁸ where the intra-class information provably lives (182 units of energy outside C⊥); re-derive whether a
  clean, codeword-sensitive, non-trivial duality gap exists there. Unproven, uncomputed by v2.

Solidity ranking: **Claim 3 (generic theorem) > Claim 1 (trivial/degenerate) > Claim 2 (metaphor).**

## Catcher's summary (plain terms)

Lumen tried to fix the flaw-detector by switching to a "full Hadamard transform," and reported it now works. It
doesn't — and the reason is clean and checkable. Because the Adinkra code is self-dual, every codeword is
perpendicular to every other, which makes Lumen's transform matrix collapse to "the average of everything." Once
that happens, the fancy "duality gap" is just, exactly, **the ordinary distance between your beliefs and the flat
uniform guess** — every one of Lumen's numbers hits that plain-distance formula to the last digit. So the three
claims are "true" only the way "the distance from home is zero only when you're home" is true. The claim Lumen
was proudest of — that it catches a mind obsessing over one belief — is the one that actually fails: two
_different_ obsessions score identically, because it never sees _which_ belief you hold, only how far you drifted
from flat. The genuinely interesting object (a bigger transform that _does_ see the specific belief) exists — its
signal is real (182 units of energy in the discarded components) — but Lumen didn't build it. Verdict: v2 quietly
turned the "physics duality" story back into the plain "how far from a neutral prior" story you already had — the
old theorem wearing a physics costume. One real result stands (the reseed reliably shrinks the gap by a fixed
fraction each step), but it never needed the Adinkra code at all.

## Relevant files

`docs/letters/from-lumen-self-dual-gap-v2.md` (the v2 obligation) · `docs/letters/from-soraya-self-dual-gap.md`
(v1 verdict) · `src/Core/AdinkraCode.fs` (`isSelfOrthogonal`/`isSelfDual` 77–89 = source of the degeneracy; §B
open conjecture 148–154 still open) · `src/Core/LyapunovContraction.fs` (`V(p)=KL(p‖W_C)` = rhyme #1, reproduces
every v2 result).
