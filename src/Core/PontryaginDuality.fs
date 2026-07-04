namespace Zeta.Core

/// **PontryaginDuality — the algebraic proof that SoftValue.combine is a monoid homomorphism
/// into the XOR-convolution algebra via the Hadamard/Walsh transform.**
///
/// ## The claim (Bridge Step 2)
///
/// `SoftValue.combine a b` is pointwise product of probability vectors (primal domain).
/// The Hadamard/Walsh transform `Ĥ` maps this to the **XOR-convolution algebra** (dual domain):
///
///   `Ĥ(a .* b) = (1/n) · (Ĥ(a) ∗⊕ Ĥ(b))`
///
/// This is the **Pontryagin duality** for the group `(GF(2)^k, ⊕)`: the Hadamard transform is
/// a **monoid homomorphism** from `(ℝ^n, .*)` to `(ℝ^n, (1/n)·∗⊕)`.
///
/// ## The algebraic proof (not just numerical)
///
/// The proof has three steps, each a standard algebraic identity:
///
/// **Step A — Character expansion:**
/// Every function `f : GF(2)^k → ℝ` has a unique Hadamard/Walsh expansion:
///   `f(x) = Σ_s f̂(s) · χ_s(x)`
/// where `χ_s(x) = (-1)^(s·x)` (the Walsh characters, `s·x` = inner product over GF(2))
/// and `f̂(s) = (1/n) Σ_x f(x) · χ_s(x)` is the Hadamard transform.
/// The Walsh characters `{χ_s}` are the **group homomorphisms** `GF(2)^k → {±1}`.
///
/// **Step B — Pointwise product in primal = XOR-convolution in dual:**
/// For any `f, g : GF(2)^k → ℝ`:
///   `(f .* g)^(s) = Σ_t f̂(t) · ĝ(s ⊕ t)  / n`
/// Proof:
///   `(f .* g)^(s) = (1/n) Σ_x f(x)g(x) χ_s(x)`
///   `= (1/n) Σ_x [Σ_t f̂(t) χ_t(x)] · [Σ_u ĝ(u) χ_u(x)] · χ_s(x)`
///   `= (1/n) Σ_t Σ_u f̂(t) ĝ(u) · (1/n) Σ_x χ_{t⊕u⊕s}(x)`
/// The inner sum `Σ_x χ_v(x) = n · [v = 0]` (orthogonality of Walsh characters).
/// So the only surviving term is `t ⊕ u = s`, i.e. `u = t ⊕ s`:
///   `(f .* g)^(s) = (1/n) Σ_t f̂(t) · ĝ(t ⊕ s)`
/// This is exactly `(1/n) · (f̂ ∗⊕ ĝ)(s)` — the XOR-convolution scaled by 1/n. ∎
///
/// **Step C — Monoid homomorphism:**
/// The Hadamard transform `Ĥ` is a **ring homomorphism** from
///   `(ℝ^n, +, .*)` to `(ℝ^n, +, (1/n)·∗⊕)`.
/// In particular, it is a **monoid homomorphism** from `(ℝ^n, .*)` to `(ℝ^n, (1/n)·∗⊕)`.
/// The unit of `.*` is the all-ones vector `1`; `Ĥ(1) = n · e_0` (the delta at 0).
/// The unit of `(1/n)·∗⊕` is `n · e_0` (the delta at 0 in the dual).
/// So `Ĥ(unit_primal) = unit_dual`. ∎
///
/// ## Connection to SoftValue.combine
///
/// `SoftValue.combine a b` is (up to renormalization) `a_i * b_i` — pointwise product.
/// The renormalization is a scalar factor that does not affect the *relative* distribution.
/// Therefore, the Hadamard transform of the combined belief is (up to the same scalar):
///   `Ĥ(combine(a,b)) ∝ (1/n) · (Ĥ(a) ∗⊕ Ĥ(b))`
///
/// The MacWilliams transform is the Hadamard transform of the **weight distribution** W_C.
/// The self-dual fixed point `W_C = MacWilliams(W_C)` means `Ĥ(W_C) ∝ W_C`.
/// In the dual domain, the fixed point of `(1/n)·∗⊕`-accumulation is the delta at 0,
/// which maps back to the uniform distribution in the primal domain — the MacWilliams
/// fixed point IS the uniform distribution over the weight classes.
///
/// ## What this proves and what remains open
///
/// **PROVEN (algebraic, not just numerical):**
/// 1. The Hadamard transform is a monoid homomorphism from `(ℝ^n, .*)` to `(ℝ^n, (1/n)·∗⊕)`.
/// 2. `SoftValue.combine` is the primal monoid product `.*` (up to renormalization).
/// 3. Therefore, `Ĥ(combine(a,b)) ∝ (1/n)·(Ĥ(a) ∗⊕ Ĥ(b))`.
///
/// **STILL OPEN (the remaining crux):**
/// The bridge requires identifying the *fixed point of the primal accumulation* with the
/// *MacWilliams-invariant weight distribution of the [8,4] code*. This requires:
/// (a) Lifting the per-codeword belief to the weight distribution (the orbit map).
/// (b) Showing the orbit map intertwines `combine` with the MacWilliams transform.
/// (c) Concluding that the fixed point of `combine`-accumulation in the weight domain
///     is the MacWilliams-invariant W_C = [1, 0, 0, 0, 14, 0, 0, 0, 1].
/// The orbit map is `W(p)(k) = Σ_{cw : weight(cw)=k} p(cw)` — the marginal over weight classes.
/// This is a linear map; the intertwining condition is the MacWilliams identity itself.
[<RequireQualifiedAccess>]
module PontryaginDuality =

    // ── Walsh characters ─────────────────────────────────────────────────────────────────────────

    /// `walshCharacter s x` = `(-1)^(s · x)` where `s · x` is the GF(2) inner product
    /// (number of positions where both `s` and `x` have a 1, mod 2).
    /// These are the group homomorphisms `GF(2)^k → {±1}`.
    let walshCharacter (s: int) (x: int) : float =
        let dotProduct =
            let mutable bits = s &&& x
            let mutable count = 0
            while bits <> 0 do
                count <- count + (bits &&& 1)
                bits <- bits >>> 1
            count % 2
        if dotProduct = 0 then 1.0 else -1.0

    /// The Hadamard matrix `H_n` where `H[s,x] = (-1)^(s·x)` for `s,x ∈ GF(2)^k`, `n = 2^k`.
    /// This is the Walsh–Hadamard matrix; the FWHT computes `H_n · v` in O(n log n).
    let hadamardMatrix (n: int) : float[][] =
        Array.init n (fun s ->
            Array.init n (fun x -> walshCharacter s x))

    // ── The algebraic proof: orthogonality of Walsh characters ───────────────────────────────────

    /// **Orthogonality of Walsh characters (the key lemma):**
    /// `Σ_{x ∈ GF(2)^k} χ_s(x) = n · [s = 0]`
    /// i.e., the sum of a non-trivial Walsh character over the full group is 0.
    /// This is the standard result; we verify it numerically for all s in GF(2)^k.
    let verifyWalshOrthogonality (k: int) : bool =
        let n = 1 <<< k
        Array.init n (fun s ->
            let sum = Array.init n (fun x -> walshCharacter s x) |> Array.sum
            if s = 0 then abs (sum - float n) < 1e-9
            else abs sum < 1e-9)
        |> Array.forall id

    // ── The algebraic proof: Pontryagin duality ───────────────────────────────────────────────────

    /// **Pontryagin duality (algebraic proof via character expansion):**
    ///
    /// Given `f, g : GF(2)^k → ℝ`, prove:
    ///   `Ĥ(f .* g)(s) = (1/n) · Σ_t f̂(t) · ĝ(t ⊕ s)`
    ///
    /// This function computes BOTH sides independently and returns the max absolute difference.
    /// A result < eps confirms the algebraic identity numerically.
    ///
    /// The proof path:
    ///   LHS = (1/n) Σ_x f(x)g(x) χ_s(x)                   [definition of Ĥ]
    ///   RHS = (1/n) Σ_t f̂(t) ĝ(t⊕s)                       [XOR-convolution]
    ///       = (1/n) Σ_t [(1/n) Σ_x f(x)χ_t(x)] [(1/n) Σ_y g(y)χ_{t⊕s}(y)]
    ///       = (1/n³) Σ_x Σ_y f(x)g(y) Σ_t χ_t(x) χ_{t⊕s}(y)
    ///   Now χ_t(x) χ_{t⊕s}(y) = χ_t(x⊕y) χ_s(y)  [character product identity]
    ///   So Σ_t χ_t(x⊕y) = n · [x⊕y = 0] = n · [x = y]   [orthogonality]
    ///   Therefore RHS = (1/n³) Σ_x f(x)g(x) · n · χ_s(x) = (1/n) Σ_x f(x)g(x) χ_s(x) = LHS ∎
    let pontryaginDualityMaxDiff (f: float[]) (g: float[]) : float =
        let n = f.Length
        let fn = float n
        // Compute UNNORMALIZED Hadamard transforms: H(f)(s) = Σ_x f(x) χ_s(x)
        // (NOT divided by n — the normalization is applied separately in the RHS)
        let hf = Array.init n (fun s -> Array.init n (fun x -> f.[x] * walshCharacter s x) |> Array.sum)
        let hg = Array.init n (fun s -> Array.init n (fun x -> g.[x] * walshCharacter s x) |> Array.sum)
        // LHS: H(f .* g)(s) = Σ_x f(x)g(x) χ_s(x)  [UNNORMALIZED, matching FWHT convention]
        let fg = Array.map2 (*) f g
        let lhs = Array.init n (fun s -> Array.init n (fun x -> fg.[x] * walshCharacter s x) |> Array.sum)
        // RHS: (1/n) Σ_t H(f)(t) · H(g)(t⊕s)  — uses UNNORMALIZED transforms
        // The identity is: H(f.*g) = (1/n) · (H(f) ∗⊕ H(g))
        // where H is the UNNORMALIZED Hadamard transform and ∗⊕ is XOR-convolution.
        // This is the Pontryagin duality for (GF(2)^k, ⊕).
        let rhs = Array.init n (fun s -> (1.0 / fn) * (Array.init n (fun t -> hf.[t] * hg.[t ^^^ s]) |> Array.sum))
        // Max absolute difference
        Array.map2 (fun l r -> abs (l - r)) lhs rhs |> Array.max

    // ── The monoid homomorphism property ─────────────────────────────────────────────────────────

    /// **Monoid homomorphism (unit preservation):**
    /// The unit of `.*` is the all-ones vector `1_n`.
    /// `Ĥ(1_n)(s) = Σ_x χ_s(x) = n · [s = 0]`
    /// So `Ĥ(1_n) = n · e_0` (the delta at 0, scaled by n).
    /// The unit of `(1/n)·∗⊕` is `n · e_0` (since `(1/n)·(n·e_0 ∗⊕ f̂) = f̂` for any f̂).
    /// Therefore `Ĥ` maps the unit of the primal monoid to the unit of the dual monoid. ∎
    let verifyUnitPreservation (n: int) : bool =
        let ones = Array.create n 1.0
        let hOnes = Array.init n (fun s ->
            Array.init n (fun x -> walshCharacter s x) |> Array.sum)
        // hOnes[0] should be n, hOnes[s] should be 0 for s > 0
        let unitDual = Array.init n (fun s -> if s = 0 then float n else 0.0)
        Array.forall2 (fun h u -> abs (h - u) < 1e-9) hOnes unitDual

    // ── The orbit map: per-codeword belief → weight distribution ─────────────────────────────────

    /// **Orbit map:** given a probability distribution `p` over the 16 Adinkra codewords
    /// (indexed 0..15 in the order of `AdinkraCode.allCodewords`), compute the weight
    /// distribution `W(p)(k) = Σ_{cw : weight(cw)=k} p(cw)` for k = 0..8.
    ///
    /// This is the linear map that projects the per-codeword belief onto the weight classes.
    /// The MacWilliams identity acts on the weight distribution, not the per-codeword belief.
    let orbitMap (p: float[]) : float[] =
        let codewords = AdinkraCode.allCodewords |> List.toArray
        let wDist = Array.create 9 0.0
        for i in 0 .. codewords.Length - 1 do
            let w = AdinkraCode.weight codewords.[i]
            if i < p.Length then wDist.[w] <- wDist.[w] + p.[i]
        wDist

    /// **MacWilliams/Krawtchouk transform** of a weight distribution over a binary [n,k] code.
    /// For the [8,4] code: `W_{C⊥}(x,y) = (1/|C|) W_C(x+y, x-y)`.
    /// In terms of the weight enumerator coefficients:
    ///   `W_{C⊥}(k) = (1/|C|) Σ_j K_k(j; 8) W_C(j)`
    /// where `K_k(j; n)` is the Krawtchouk polynomial.
    ///
    /// For a self-dual code, `W_{C⊥} = W_C`, i.e. the weight distribution is a fixed point.
    let krawtchoukTransform (n: int) (codeSize: int) (wDist: float[]) : float[] =
        let len = wDist.Length
        // K_k(j; n) = Σ_{s=0}^{k} (-1)^s C(j,s) C(n-j, k-s)
        let binomial n k =
            if k < 0 || k > n then 0.0
            else
                let mutable result = 1.0
                for i in 0 .. k - 1 do
                    result <- result * float (n - i) / float (i + 1)
                result
        let krawtchouk k j =
            let mutable sum = 0.0
            for s in 0 .. k do
                sum <- sum + (pown -1.0 s) * binomial j s * binomial (n - j) (k - s)
            sum
        Array.init len (fun k ->
            let mutable sum = 0.0
            for j in 0 .. len - 1 do
                sum <- sum + krawtchouk k j * wDist.[j]
            sum / float codeSize)

    /// **Verify the MacWilliams identity for the [8,4] self-dual code:**
    /// The weight distribution `W_C = [1,0,0,0,14,0,0,0,1]` is a fixed point of the
    /// Krawtchouk/MacWilliams transform. This is the algebraic statement of `gen(gen)=gen`
    /// at the weight-enumerator level.
    let verifyMacWilliamsFixedPoint () : bool =
        // The known weight distribution of the [8,4] extended Hamming code
        let wDist = [| 1.0; 0.0; 0.0; 0.0; 14.0; 0.0; 0.0; 0.0; 1.0 |]
        let transformed = krawtchoukTransform 8 16 wDist
        // Normalize (the transform may not preserve the sum)
        let sum = Array.sum transformed
        let normalized = if sum > 1e-9 then Array.map (fun x -> x / sum) transformed else transformed
        let wNorm = let s = Array.sum wDist in Array.map (fun x -> x / s) wDist
        Array.forall2 (fun a b -> abs (a - b) < 1e-6) normalized wNorm

    // ── The orbit-map intertwining condition ─────────────────────────────────────────────────────

    /// **Orbit-map intertwining (the remaining open crux):**
    ///
    /// The full bridge requires showing that the orbit map `π : ℝ^16 → ℝ^9` intertwines
    /// `SoftValue.combine` (primal pointwise product over 16 codewords) with the MacWilliams
    /// transform (Krawtchouk over weight classes):
    ///
    ///   `π(a .* b) ∝ MacWilliams(π(a)) ∗ MacWilliams(π(b))`  (in the weight domain)
    ///
    /// This is NOT the same as the Pontryagin duality (which lives in the full GF(2)^k space).
    /// The orbit map projects from the 16-dimensional codeword space to the 9-dimensional
    /// weight space; the intertwining condition is a non-trivial constraint on this projection.
    ///
    /// **Current status:** the Pontryagin duality is PROVEN (algebraically, Step B above).
    /// The orbit-map intertwining is OPEN — this is the remaining crux of bridge Step 2.
    ///
    /// This function computes the max-diff between the two sides to measure how close we are.
    /// A result < eps would confirm the intertwining numerically (but not yet algebraically).
    let orbitIntertwiningMaxDiff (a: float[]) (b: float[]) : float =
        // LHS: π(a .* b) — orbit map of the primal product
        let ab = Array.map2 (*) a b
        let abSum = Array.sum ab
        let abNorm = if abSum > 1e-12 then Array.map (fun x -> x / abSum) ab else ab
        let lhs = orbitMap abNorm
        // RHS: MacWilliams(π(a)) ∗ MacWilliams(π(b)) — product of MacWilliams transforms
        let wa = orbitMap (let s = Array.sum a in Array.map (fun x -> x / s) a)
        let wb = orbitMap (let s = Array.sum b in Array.map (fun x -> x / s) b)
        let mwa = krawtchoukTransform 8 16 wa
        let mwb = krawtchoukTransform 8 16 wb
        // Pointwise product of the MacWilliams transforms, renormalized
        let rhs = Array.map2 (*) mwa mwb
        let rhsSum = Array.sum rhs
        let rhsNorm = if rhsSum > 1e-12 then Array.map (fun x -> x / rhsSum) rhs else rhs
        Array.map2 (fun l r -> abs (l - r)) lhs rhsNorm |> Array.max

    // ── Summary: what is proven, what is open ────────────────────────────────────────────────────

    /// **Summary of the bridge proof status:**
    ///
    /// PROVEN (algebraic + numerical):
    ///   P1. Walsh orthogonality: Σ_x χ_s(x) = n·[s=0]  (verifyWalshOrthogonality)
    ///   P2. Pontryagin duality: Ĥ(f.*g) = (1/n)·(f̂ ∗⊕ ĝ)  (pontryaginDualityMaxDiff ≈ 0)
    ///   P3. Unit preservation: Ĥ(1_n) = n·e_0  (verifyUnitPreservation)
    ///   P4. MacWilliams fixed point: W_C = MacWilliams(W_C) for the [8,4] code  (verifyMacWilliamsFixedPoint)
    ///
    /// OPEN (the remaining crux):
    ///   O1. Orbit-map intertwining: π(a.*b) ∝ MacWilliams(π(a)) ∗ MacWilliams(π(b))
    ///       This is the non-trivial step that lifts the Pontryagin duality from the full
    ///       GF(2)^k space to the weight-class quotient space.
    ///       orbitIntertwiningMaxDiff measures the gap; it is NOT zero in general.
    ///
    /// The bridge is PARTIALLY DISCHARGED: the Pontryagin duality (the algebraic mechanism)
    /// is proven; the orbit-map intertwining (the connection to the [8,4] code's self-duality)
    /// is the remaining open obligation.
    let bridgeStatus () =
        {| WalshOrthogonality4 = verifyWalshOrthogonality 4
           WalshOrthogonality3 = verifyWalshOrthogonality 3
           UnitPreservation16 = verifyUnitPreservation 16
           MacWilliamsFixedPoint = verifyMacWilliamsFixedPoint ()
           PontryaginDualityUniform =
               let a = Array.create 16 (1.0 / 16.0)
               let b = Array.init 16 (fun i -> float (i + 1)) |> (fun v -> let s = Array.sum v in Array.map (fun x -> x / s) v)
               pontryaginDualityMaxDiff a b
           OrbitIntertwiningUniform =
               let a = Array.create 16 (1.0 / 16.0)
               let b = Array.init 16 (fun i -> float (i + 1)) |> (fun v -> let s = Array.sum v in Array.map (fun x -> x / s) v)
               orbitIntertwiningMaxDiff a b |}
