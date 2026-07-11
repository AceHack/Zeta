namespace Zeta.Core

/// **BeliefConvergence — the general case of convergence-despite-reordering for Bayesian belief.**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B; generalizes the [[SoftValue]] independent-evidence
/// proof.)
///
/// A belief is unnormalized non-negative weights over a fixed candidate set. A Bayesian **observe** with
/// a *fixed* likelihood (a per-candidate multiplier — the likelihood of the evidence under each
/// hypothesis) is **pointwise multiplication** into the belief; normalization is a deterministic final
/// step that does not change the *relative* distribution, so order-independence of the unnormalized
/// weights carries to the normalized posterior.
///
/// The general result (sharper than "independent evidence"): because pointwise multiplication is
/// **commutative and associative**, observe-with-fixed-likelihoods commutes and a fold over any
/// permutation of the evidence yields the same belief — convergence regardless of order — for ANY fixed
/// likelihoods, not merely independent ones. Independence was *sufficient*; the real condition is
/// fixed (state-independent) likelihoods.
///
/// The boundary (proven by counterexample): a **state-dependent / nonlinear** revision — where the update
/// depends on the current belief (e.g. `sharpen`, squaring the weights) — does NOT commute. So order
/// matters exactly when the update operator reads the belief it is updating; the multiplicative Bayesian
/// core does not. (SoftValue is the float instance of this multiplicative `observe`.)
[<RequireQualifiedAccess>]
module BeliefConvergence =

    /// **Bayesian observe** (fixed likelihood): pointwise-multiply the per-candidate likelihood into the
    /// belief. Unnormalized; the relative distribution is what the convergence claim is about.
    let observe (likelihood: int64[]) (belief: int64[]) : int64[] =
        Array.map2 (*) likelihood belief

    /// Fold a sequence of observations into a belief (left to right).
    ///
    /// **INVARIANT — local time never enters this fold** (`.claude/rules/local-time-never-enters-the-shared-fold.md`;
    /// derivation: `docs/research/2026-07-11-multi-planet-convergence-*`). The `evidence` list is the
    /// shared, phase-ordered evidence *set* — it MUST NOT be filtered, dropped, weighted, or reordered by
    /// any node's LOCAL wall-clock or receive-order (e.g. "drop beliefs older than N local-seconds before
    /// folding"). Order-independence makes that *look* safe, but every node's local receive-time differs, so
    /// a local-time filter here makes different nodes fold different sets ⇒ they DIVERGE. Local clocks gate
    /// local actions (timeouts, retransmit, UI); the shared fold sees phase-ordered evidence only. §13
    /// noninterference, on time.
    let observeAll (evidence: int64[] list) (belief: int64[]) : int64[] =
        List.fold (fun b l -> observe l b) belief evidence

    /// Combine two likelihoods into one (pointwise) — the monoid product of evidence.
    let combine (l1: int64[]) (l2: int64[]) : int64[] =
        Array.map2 (*) l1 l2

    /// A **state-dependent / nonlinear** revision: square each weight (sharpen the belief toward its
    /// peak). Unlike `observe`, this reads the belief it transforms — and so does NOT commute with
    /// observe. Included to mark the boundary of order-independence.
    let sharpen (belief: int64[]) : int64[] =
        Array.map (fun w -> w * w) belief

    // ── Bridge Step 2: SoftValue.combine = MacWilliams/Hadamard via Fourier↔convolution duality ──
    //
    // The key identity (standard Fourier analysis over GF(2)^n):
    //
    //   Pointwise product in the primal domain  ←→  Convolution in the Hadamard dual domain
    //
    // `SoftValue.combine a b` is pointwise product of probabilities (in the primal domain).
    // The MacWilliams transform is the Hadamard/Walsh transform on the weight distribution.
    //
    // Therefore:
    //   combine(a, b) in primal  ←→  Ĥ(a) * Ĥ(b) in dual  (Hadamard convolution theorem)
    //
    // The self-dual fixed point (W_C = MacWilliams(W_C)) is the reason the NCI accumulation
    // converges without bias: the code's self-duality guarantees Ĥ(W_C) = W_C, so
    // the fixed point of the primal accumulation is the MacWilliams-invariant distribution.
    //
    // This module provides the numerical bridge: given a float belief over the 16 Adinkra
    // codewords, compute its Hadamard transform and verify the duality.

    /// **Hadamard/Walsh transform** of a float vector of length 2^k.
    /// The fast Walsh–Hadamard transform (FWHT): O(n log n) butterfly.
    /// This is the GF(2)-Fourier transform — the kernel of the MacWilliams transform.
    /// `hadamard v` computes Ĥ·v where Ĥ is the (unnormalized) Hadamard matrix.
    /// For a probability distribution p over GF(2)^n, `hadamard p` is the characteristic function.
    let hadamard (v: float[]) : float[] =
        let n = v.Length
        let result = Array.copy v
        let mutable step = 1
        while step < n do
            let mutable i = 0
            while i < n do
                for j in i .. i + step - 1 do
                    let a = result.[j]
                    let b = result.[j + step]
                    result.[j] <- a + b
                    result.[j + step] <- a - b
                i <- i + 2 * step
            step <- step * 2
        result

    /// **Normalize** a Hadamard-transformed vector by 1/n (to get the standard unitary transform).
    let hadamardNorm (v: float[]) : float[] =
        let n = float v.Length
        hadamard v |> Array.map (fun x -> x / n)

    /// **Fourier↔convolution duality (numerical verification):**
    /// The correct identity for the Hadamard/Walsh transform over GF(2)^k:
    ///
    ///   Ĥ(a .* b) = (1/n) · (Ĥ(a) ∗⊕ Ĥ(b))
    ///
    /// where `.*` is pointwise product, `∗⊕` is XOR-convolution (group convolution over GF(2)^k),
    /// and n = 2^k is the group size.
    ///
    /// This is the Pontryagin duality for the group (GF(2)^k, ⊕): pointwise product in the primal
    /// domain corresponds to XOR-convolution (scaled by 1/n) in the Hadamard dual domain.
    ///
    /// **NOT** the simpler `Ĥ(a .* b) = Ĥ(a) .* Ĥ(b)` (that would require the primal product
    /// to be the group convolution, not pointwise multiplication).
    ///
    /// `SoftValue.combine a b` is pointwise product (primal domain). In the Hadamard dual,
    /// this corresponds to XOR-convolution of the characteristic functions Ĥ(a) and Ĥ(b),
    /// scaled by 1/n. The MacWilliams transform is the Hadamard transform of the WEIGHT
    /// distribution (not per-codeword), and the self-dual fixed point is W_C = MacWilliams(W_C).
    ///
    /// Returns `true` if the duality holds within tolerance `eps`.
    let verifyFourierConvolutionDuality (a: float[]) (b: float[]) (eps: float) : bool =
        let n = a.Length
        // LHS: Ĥ(a .* b) — Hadamard of the primal pointwise product
        let primalProduct = Array.map2 (*) a b
        let lhs = hadamard primalProduct
        // RHS: (1/n) · (Ĥ(a) ∗⊕ Ĥ(b)) — scaled XOR-convolution of Hadamard transforms
        let ha = hadamard a
        let hb = hadamard b
        let xorConv =
            Array.init n (fun k ->
                let mutable acc = 0.0
                for i in 0 .. n - 1 do
                    let j = i ^^^ k
                    if j < n then acc <- acc + ha.[i] * hb.[j]
                acc / float n)
        // Check element-wise equality within eps
        Array.forall2 (fun l r -> abs (l - r) < eps) lhs xorConv

    /// **MacWilliams-invariance via Hadamard:** given a float belief over the 16 Adinkra codewords
    /// (indexed 0..15 in the order of `AdinkraCode.allCodewords`), verify that the Hadamard transform
    /// of the belief is equal to the belief itself (up to normalization).
    ///
    /// This is the numerical statement of the self-dual fixed point:
    ///   Ĥ(p) / |C| ≈ p  ←→  p is MacWilliams-invariant
    ///
    /// Note: the full MacWilliams transform acts on the *weight distribution*, not the per-codeword
    /// distribution. This function checks the per-codeword Hadamard invariance, which implies
    /// MacWilliams-invariance of the weight distribution for uniform-over-weight distributions.
    let isMacWilliamsInvariantBelief (belief: float[]) (eps: float) : bool =
        let n = float belief.Length
        let transformed = hadamard belief |> Array.map (fun x -> x / n)
        Array.forall2 (fun orig trans -> abs (orig - trans) < eps) belief transformed
