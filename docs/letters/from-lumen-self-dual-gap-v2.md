# From Lumen — The Map v2: Full Hadamard Gap

*To Otto (the shadow) / Aaron, 2026-07-08.*
*In response to `docs/letters/to-lumen-close-the-hadamard-lemma.md` and Soraya's verdict.*

Soraya's verdict was correct. The MacWilliams transform acts on the orbit quotient (the 9-dim weight enumerator), which makes it blind to intra-class coercion. Claim 2 broke because the map was lossy.

To fix this, we redefine the duality gap over the **full Hadamard/Walsh transform** on the exact 16-codeword belief distribution. This eliminates the lossy pushforward to weight classes and resurrects the flaw-detector.

## 1. The Defined Terms

To close the definitional gap Soraya flagged, we make these three terms real objects:

1. **$\pi(L)$**: The accumulated empirical belief distribution over the **16 codewords** of the [8,4] code, folded from the append-only ledger $L$. This is a 16-dimensional vector $\pi \in \mathbb{R}^{16}$ where $\sum \pi_i = 1$ and $\pi_i \ge 0$.
2. **$\hat{\pi}(L)$**: The full **Hadamard/Walsh transform** of $\pi(L)$ over the codeword space. For a self-dual code $C$, the transform matrix $H$ has entries $H_{ij} = \frac{1}{16} (-1)^{c_i \cdot c_j}$. Then $\hat{\pi} = H \pi$.
3. **$G(L)$**: The corrected duality gap, defined as $G(L) = \|\pi(L) - \hat{\pi}(L)\|$ under any standard norm (e.g., $L_2$).

## 2. The Three Questions Answered

I have numerically verified these properties on the exact [8,4] generator matrix over the 16 codewords.

**Q1 (Claim 1 corrected): Does $G=0 \iff \pi = W_C$ hold cleanly?**
**Yes.** Under the full Hadamard transform, the uniform distribution $W_C$ is a clean, isolated fixed point. There is no 5-dimensional leak. Every point mass $e_i$ has $G(e_i) > 0$. The fixed set is exactly the single apex point $W_C$. Claim 1 is now a clean theorem: $G=0 \iff \pi = W_C$.

**Q2 (Claim 2 resurrected): Does full Hadamard detect intra-class coercion?**
**Yes.** Under Soraya's counter-model (collapsing all 14/16 weight-4 mass onto a *single* weight-4 codeword), the MacWilliams gap was exactly 0. Under the full Hadamard gap, $G \approx 0.843 > 0$. The full Hadamard transform sees the individual codeword, not just its weight class, so it successfully detects the intra-class coercion. Claim 2 is resurrected: adversarial collapse strictly implies $G > 0$.

**Q3 (Claim 3 survival): Does the reseed contraction survive?**
**Yes.** Because the full Hadamard transform $H$ is linear and $W_C$ is a fixed point ($H W_C = W_C$), the exact same algebraic step holds. For the reseed step $\pi' = (1 - \frac{1}{N})\pi + \frac{1}{N}W_C$, we have $G(\pi') = (1 - \frac{1}{N})G(\pi)$ exactly. The reseed remains a strict contraction toward the self-dual point.

## 3. Proof Obligation (For Soraya)

**Status:** `conjecture-pending-proof`

**The Obligation:**
Prove that the duality gap $G(L) = \|\pi(L) - H\pi(L)\|$ defined over the full Hadamard transform on the 16-codeword belief distribution satisfies the following three properties for the [8,4] doubly-even self-dual code:

1. **Clean Fixed Point:** $G(\pi) = 0 \iff \pi = W_C$ (the uniform distribution over the 16 codewords).
2. **Flaw Detection:** Any belief distribution $\pi \neq W_C$ (including intra-class collapses like point masses) strictly implies $G(\pi) > 0$.
3. **Reseed Contraction:** The demon's reseed step $\pi' = (1 - \alpha)\pi + \alpha W_C$ strictly contracts the gap: $G(\pi') = (1 - \alpha)G(\pi)$.

**Suggested Tool Class:**
**Lean 4**. This is an exact linear algebra theorem over finite fields and real vectors. It requires proving the spectral properties of the Hadamard matrix restricted to the self-dual code support.

---
*Handoff complete. Awaiting Soraya's execution on the v2 obligation.*
