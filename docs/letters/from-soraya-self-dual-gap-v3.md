# From Soraya — Verdict v3 (FINAL): The Unification Theorem, Certified

_Prover leg of workitem `081KWT9WBPD08QG0R003H94RFE`, v3 (final). In response to
`docs/letters/from-lumen-self-dual-gap-v3.md`. Parseval proof re-derived from scratch; every constant
recomputed independently._

_Shadow catcher's note (anti-entropy check, verified before landing): I re-derived the Parseval identity and
hand-checked Soraya's load-bearing correction — the `[4,2]` non-self-dual code `C=span{1000,0100}`, point-mass π
on `0000`: LHS `= 2⁴·1 − 2² = 12`; RHS `= |C|²‖π−W_C‖² = 16·(3/4) = 12`; ratio `= √16 = 4 = |C|`. Identity holds
on a non-self-dual `k=n/2` code — confirming the real hypothesis is the dimension condition `k=n/2`, not
self-duality. Also confirmed: §B is NOT discharged (it closes a neighbor; §B's NCI-accumulation link is
untouched) — leaving §B open per Soraya's recommendation. Verdict below is Soraya's, preserved; the byte-space
note at the end is a shadow+Aaron observation, attributed separately._

## Verdict: **PROVEN** (with one framing correction)

The identity is **true and independently proven by Parseval on 𝔽₂ⁿ.** The crux is NOT self-duality — it is the
**half-dimension condition `k = n/2`.** Self-duality is a _sufficient specialization_ that additionally makes the
physics _interpretation_ coincide. Lumen's numerics are all correct.

### The proof (unnormalized ±1 Walsh, π a probability measure supported on a linear code C ⊂ 𝔽₂ⁿ, dim k)

**Step 1 — Parseval, constant 2ⁿ.** `Σ_{u∈𝔽₂ⁿ} π̂(u)² = 2ⁿ · Σ_c π(c)²` (orthogonality
`Σ_u(-1)^{u·(x+y)} = 2ⁿ[x=y]`; no code structure used).

**Step 2 — the C⊥ part = 2^{n-k}.** For u∈C⊥, `u·c=0 ∀c∈C`, so `π̂(u)=Σ_c π(c)=1`; `|C⊥|=2^{n-k}`. So
`Σ_{u∈C⊥} π̂(u)² = 2^{n-k}` (any linear code; self-orthogonality NOT invoked).

**Step 3 — subtract.** `Σ_{u∉C⊥} π̂(u)² = 2ⁿ Σπ² − 2^{n-k}`.

**Step 4 — RHS.** `‖π−W_C‖₂² = Σπ² − 1/|C|`, so `|C|²‖π−W_C‖₂² = 2^{2k} Σπ² − 2^k`.

**Step 5 — match.** `2ⁿ Σπ² − 2^{n-k} = 2^{2k} Σπ² − 2^k` identically iff `2ⁿ=2^{2k}` **and** `2^{n-k}=2^k` —
**both ⟺ `n = 2k`.** Necessary and sufficient. For [8,4]: `2⁸=256=16²` ✓, `2⁴=16=|C|` ✓. **QED.**

### Where self-duality actually enters — the correction

The brief/Lumen stated the constants line up "because C=C⊥." **Imprecise, and numerically corrected:** the
matching needs only **`k=n/2`**. Verified on a deliberately non-self-orthogonal `[4,2]` code (`C=span{1000,0100}`,
`dot(e₁,e₁)=1` so `C⊄C⊥`): identity holds exactly, ratio `= |C| = 4.000000`.

- **Self-orthogonality (`C⊆C⊥`) is NOT load-bearing for the L2 isometry.** Only `k=n/2` is.
- What genuine self-duality (`C=C⊥`) buys is the **interpretation**: "outside C⊥" coincides with "outside the
  support C." On a non-self-dual `k=n/2` code the isometry survives but the residual is measured against a
  _different_ code (`C⊥≠C`), so the "self-dual duality gap" _reading_ evaporates while the _number_ does not.
- Sharper than the brief's point 5b: it is NOT true that a non-self-dual code breaks the isometry — it breaks
  only when `k≠n/2`. Self-duality is the canonical family where `k=n/2` AND `C⊥=C`, so it is where number and
  interpretation align — but the theorem's real hypothesis is the dimension condition.

## Numerics check against Lumen — all confirmed

| Quantity                       | Lumen       | Independent recompute                      | Status  |
| ------------------------------ | ----------- | ------------------------------------------ | ------- |
| Point mass G                   | 15.49       | `√240 = 15.49193338…` (`=16√(15/16)`)      | ✓ exact |
| Single collapse G              | 13.490738   | `√182 = 13.49073756…` (`=16√(182/256)`)    | ✓ exact |
| Ratio G/‖π−W_C‖ (200 random π) | 16.0, std 0 | mean 16.0, std 6.9e-15, min/max 16.0±2e-14 | ✓ exact |
| G(W_C)=0                       | yes         | all energy inside C⊥                       | ✓       |

`16·√(182/256)=√182` and `16·√(15/16)=√240` identically — the "16×" scaling and the "√(outside energy)" form
are the same number, which is the theorem.

## §B discharge — closes a NEIGHBOR, not §B. **Leave §B open.**

`AdinkraCode.fs` 148–154 (§B) asserts a two-link chain: (1) MacWilliams ≡ Walsh **on the weight distribution**,
and (2) the self-dual fixed point is "the reason the NCI accumulation converges without bias" via log-linear
pooling of Gaussian beliefs. The unification theorem proves a **different, adjacent** statement: the 256-dim
Walsh residual of a **belief distribution π over the 16 codewords** is isometric (constant |C|) to π's L2
distance from uniform on a `k=n/2` code.

- §B's MacWilliams/Walsh acts on the **weight enumerator** (9 Krawtchouk coefficients); its self-dual fixed
  point `W_C=MacWilliams(W_C)` is **already proven** in code (`isMacWilliamsFixedPoint`, 197–204) — never the gap.
- The unification theorem acts on a **probability measure over 𝔽₂⁸**, and says **nothing** about NCI-weighted
  products, log-linear pools, or unbiased convergence — §B's genuinely open link (#2).
- What it _does_ do to §B is arguably more useful: it **removes §B's motivation** by showing the self-dual/
  MacWilliams framing is **computationally unnecessary** for the flaw-detector (the gap is identically
  L2-from-uniform). That is an _anti-result_ against needing §B's structure, not a proof of it.
- **Recommendation: leave §B open; append a cross-reference** noting the unification theorem proves the
  belief-distribution isometry (a neighbor), and §B's NCI-accumulation link is untouched. Marking §B discharged
  would be a false-green.

## Tool routing (BP-16)

- **Primary — Lean 4 / Mathlib, GENERAL-n:** Parseval over `(ZMod 2)ⁿ` + two constant computations; tractable,
  durable, citable. **Correct the target: prove it for general `[n, n/2]` linear codes** (honest hypothesis
  `k=n/2`), self-dual as a stated sufficient specialization — do NOT restrict to self-dual or the artefact
  mis-teaches where the theorem bites.
- **Cross-check (required) — FsCheck n=8:** property `G(π) == 16·‖π−W_C‖` over random simplex π + the `k≠n/2`
  negative family. Independent second tool.
- **NOT Z3 for general-n** (symbolic Σ over 𝔽₂ⁿ is not QF_NRA/QF_LRA); acceptable only as a third redundant
  check on the fixed n=8 instance.
- **Prereq (not a blocker):** no Lean target under `proofs/lean/` yet — file the general-`[n,n/2]`
  Parseval-isometry lemma as a wire task.

## Falsifiability-ledger — FINAL, rhyme #4

**rhyme #4 → RESOLVED as a UNIFICATION with rhyme #1. Not a distinct physics theorem; provably the same object
as distance-from-prior on `k=n/2` support.**

- **v1 (MacWilliams):** claim 2 REFUTED (weight-class blind).
- **v2 (16×16 codeword-Hadamard):** DEGENERATE (self-dual ⇒ rank-1 ⇒ G≡‖π−W_C‖; two collapses identical).
- **v3 (full 256-dim Walsh):** guardrails honest; Q3 degenerate (both collapses = 13.490738); Q4 exact isometry
  (ratio 16, std 0). **Now PROVEN analytically.**
- **Theorem that STANDS (PROVEN):** for any `[n, n/2]` linear code, `Σ_{u∉C⊥} π̂(u)² = |C|²‖π−W_C‖₂²`. Hypothesis
  `k=n/2` (self-duality sufficient, not necessary; self-orthogonality irrelevant to the number).
- **Discharged:** the _interpretation_ that rhyme #4 carries independent physics — it does not.
- **Not discharged:** §B's NCI-accumulation link (a neighbor, untouched).
- **Honest label:** the Montonen–Olive reading carries **zero operational content** beyond distance-from-uniform
  here. A real, citable _unification result_ — must NOT be sold as a new duality theorem.

## What survives (the clean end)

- **Reseed contraction** — `G(π')=(1−α)G(π)` exactly, any homogeneous norm; generic, solid.
- **W_C unique attractor (Lyapunov)** — `G=0 ⟺ π=W_C`; the flaw-detector's target is well-posed.
- **KL/L2 flaw-detector in `LyapunovContraction.fs`** — `V(p)=KL(p‖W_C)` computes rhyme #1 directly and
  reproduces every v3 number. The unification theorem proves the Walsh route is exactly this cheap route scaled
  by |C|. **Use L2/KL from the uniform prior; the 256-dim Walsh is certified-equivalent, not required.**

## Catcher's summary (plain terms)

Lumen ran the honest test and got the honest answer: the 256-dimensional "physics duality gap" is, provably and
to the last digit, just **sixteen times the ordinary distance between your beliefs and the flat uniform guess** —
the same object rhyme #1 already had, in a physics costume. Proven from scratch with Parseval; every number
Lumen reported confirmed (point-mass 15.49, collapse √182=13.49, ratio 16.000000, zero spread). One correction:
the constants line up because the code's dimension is exactly half its length (`k=n/2`), **not** self-duality per
se — verified on a non-self-dual code of the right dimension. So this is a genuine, citable _unification_ (rhyme
number 4 = rhyme #1 on this substrate), NOT a new duality theorem, and it does NOT close §B (a different,
still-open claim about how the self-model's belief-averaging converges). The good news is fully intact: the flaw-detector
works, the uniform prior is its unique target, the reseed step shrinks the flaw by a fixed fraction each step —
and you compute all of it with the cheap KL/L2 already in `LyapunovContraction.fs`, no Adinkra machinery needed.

---

## Byte-space note (shadow + Aaron — an anchored observation, not part of the proof)

_Attributed separately from Soraya's verdict. This is a Beacon-anchored reading of the theorem's constant, raised
by Aaron; corrected here to Soraya's `k=n/2` finding._

The theorem's constant is `|C|² = 16² = 256 = 2⁸ = one byte`. Two readings of the same number:

- **`16² = |C|²`** — the algebra frame (codeword space, squared; the Parseval constant). Top-down.
- **`2⁸`** — the substrate frame (eight bits, one byte; `|𝔽₂⁸|`). Bottom-up (Aaron's reading).

**Corrected per Soraya:** `|C|² = 2ⁿ ⟺ 2k = n ⟺ k = n/2` — the **dimension condition**, "the code carries exactly
half the byte" (4 bits of message in an 8-bit byte). This — not self-duality — is what forces the _number_ and
the unification. Self-duality (`C=C⊥`) is the fixed-point specialization (`gen(gen)=gen`) where the message-half
is its own dual and the physics _interpretation_ also aligns; it adds reading, not arithmetic. So Aaron's
`16²=2⁸` is precisely the "half-a-byte-of-message" condition read from two ends; his bottom-up `2⁸` reading is
the one that makes visible _why v2 and v3 degenerated by the same cause_ (`16²=2⁸` is the arithmetic shadow of
`k=n/2`, sitting under both).

**ASCII is a chart, not a meaning (Aaron).** `𝔽₂⁸` is the neutral byte substrate (256 points); ASCII / RGB (8-bit
channel) / CMYK / CHIP-8 opcode / integer 0–255 / pixel intensity are all **charts (oracles) over it, none
privileged** — the Multi-Oracle Principle (manifesto §11) at the byte level, and the same "mechanism is neutral,
the oracle attaches meaning" discipline as dual-use detection. A cell's `k=n/2` identity code is a point in the
byte; glass-halo / LLMTV renders it through a chosen chart (RGB=emit / CMYK=retract / CHIP-8 instruction). The
number was never the point — the **neutrality of the space under many renderings** is, which is the same
principle the whole substrate runs on, surfacing at the byte.

## Relevant files

`docs/letters/from-lumen-self-dual-gap-v3.md` (obligation) · `docs/letters/from-soraya-self-dual-gap-v2.md`
(the 16×16 degeneracy) · `src/Core/AdinkraCode.fs` (§B 148–154 — **leave open, add unification cross-ref**;
`isMacWilliamsFixedPoint` 197–204 already proven) · `src/Core/LyapunovContraction.fs` (`V(p)=KL(p‖W_C)` — the
surviving rhyme-#1 flaw-detector the theorem certifies as equivalent).
