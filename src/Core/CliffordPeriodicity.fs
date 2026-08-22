namespace Zeta.Core

/// **CliffordPeriodicity — the mod-8 clock, and the three eights it explains.**
///
/// Real Clifford algebras `Cl(p,q)` are classified by **`p − q (mod 8)`** alone, up to the
/// Morita class: the algebra type repeats with period 8 as the signature walks. This is the
/// **Atiyah–Bott–Shapiro** periodicity (Atiyah, Bott & Shapiro, *Clifford Modules*, Topology 3
/// (1964), Suppl. 1, 3–38), the real-case sibling of Bott periodicity.
///
/// ── **Why this module exists** ──
/// `AdinkraCode.fs` already stated *one consequence* of this clock — "a doubly-even self-dual
/// binary code exists ONLY at length ≡ 0 (mod 8)" — without holding the periodicity that
/// explains it. A repo that knows a corollary and not its theorem will keep rediscovering the
/// corollary. Added 2026-08-18 after the Geometric Unity ferry made the gap visible: GU builds
/// its whole spinor sector out of the `(7,7)` signature, and *why* `(7,7)` splits evenly is a
/// mod-8 fact, not a coincidence of that theory.
///
/// ── **THREE EIGHTS, ONE PERIODICITY** ──
/// These are not three sightings of the integer 8. They are one phenomenon in three categories
/// joined by known constructions, which is the difference between number theory and numerology
/// (`.claude/rules/numerology-vs-number-theory.md`):
///
///   1. `Cl(p,q)` depends only on `p − q (mod 8)`                        — Atiyah–Bott–Shapiro
///   2. doubly-even self-dual binary codes exist only at length ≡ 0 (8)  — Gleason
///   3. even unimodular lattices exist only in dimension ≡ 0 (mod 8)     — Milnor–Husemoller
///
/// Construction A (Conway–Sloane) carries (2) to (3): that is *why* the in-tree `[8,4]` extended
/// Hamming code of `AdinkraCode.fs` generates the **E8** lattice. Adinkra representation theory
/// closes at `N = 8` because of (1). The eight is the same eight throughout.
///
/// ── **WHAT THIS MODULE DOES NOT CLAIM** ──
/// It classifies algebras. It says nothing about physics, and nothing about whether any
/// particular signature is realised by anything. `toy`-vs-`metered`
/// (`.claude/rules/toy-is-free-metered-must-be-earned.md`): the classification below is
/// **metered** — every row is a theorem with a falsifier in the test suite, and the table is
/// checked against independently-known small cases (`Cl(0,1) ≅ C`, `Cl(0,2) ≅ H`,
/// `Cl(1,3) ≅ M₂(H)`, `Cl(3,1) ≅ M₄(R)`) rather than asserted. Any *use* of it to interpret a
/// decorrelation trajectory or a unification claim is a separate, unmetered question.
module CliffordPeriodicity =

    /// The division algebra a Clifford algebra's Morita class is built over.
    /// `Split` means the algebra is a direct sum of two matrix algebras rather than one.
    type Ground =
        | Real
        | Complex
        | Quaternionic

    /// The Morita type of `Cl(p,q)`: a matrix algebra over `Ground`, possibly split in two.
    /// `MatrixDim` is `n` in `M_n(K)`; `IsSplit` marks the `K ⊕ K` cases (`s = 1` and `s = 5`).
    type CliffordType =
        { Ground: Ground
          /// `n` such that the algebra is `M_n(Ground)` (or two copies of it when `IsSplit`).
          MatrixDim: int
          IsSplit: bool }

    /// Errors are values here, not exceptions — the repo's Result-over-exception convention.
    type PeriodicityError =
        | NegativeSignature of p: int * q: int

    /// `p − q (mod 8)`, normalised into `0..7`.
    ///
    /// .NET's `%` is remainder, not modulus: `(-2) % 8 = -2`. Every classification below indexes
    /// a table by this value, so an unnormalised remainder would index out of range or silently
    /// pick the wrong row for any signature with `q > p` — which is most of them in physics
    /// (Minkowski `(1,3)` gives `-2`). The `+ 8` before the second `%` is load-bearing.
    let signatureClass (p: int) (q: int) : int =
        (((p - q) % 8) + 8) % 8

    /// Classify `Cl(p,q)` up to Morita type.
    ///
    /// The table is the standard one (Lawson & Michelsohn, *Spin Geometry*, I.4): with
    /// `n = p + q` and `s = p − q (mod 8)`,
    ///
    /// ```
    ///   s = 0 → M(2^(n/2),     R)         s = 4 → M(2^((n-2)/2), H)
    ///   s = 1 → M(2^((n-1)/2), R) ⊕ same  s = 5 → M(2^((n-3)/2), H) ⊕ same
    ///   s = 2 → M(2^(n/2),     R)         s = 6 → M(2^((n-2)/2), H)
    ///   s = 3 → M(2^((n-1)/2), C)         s = 7 → M(2^((n-1)/2), C)
    /// ```
    ///
    /// Note the exponents differ per row: the quaternionic rows lose a factor of 2 (and the split
    /// quaternionic row two factors) because `H` is 4-dimensional over `R` while `C` is 2 and `R`
    /// is 1. Total real dimension is `2^n` in every row, which is what `realDimension` checks.
    let classify (p: int) (q: int) : Result<CliffordType, PeriodicityError> =
        if p < 0 || q < 0 then Error(NegativeSignature(p, q))
        else
            let n = p + q
            let s = signatureClass p q
            // Exponent of 2 in the matrix dimension, per row of the table above.
            let expo =
                match s with
                | 0 | 2 -> n / 2
                | 1 | 3 | 7 -> (n - 1) / 2
                | 4 | 6 -> (n - 2) / 2
                | _ -> (n - 3) / 2 // s = 5
            let ground =
                match s with
                | 0 | 1 | 2 -> Real
                | 3 | 7 -> Complex
                | _ -> Quaternionic
            Ok { Ground = ground
                 MatrixDim = pown 2 (max 0 expo)
                 IsSplit = (s = 1 || s = 5) }

    /// Real dimension of `Cl(p,q)`, which is `2^(p+q)` by construction (one basis element per
    /// subset of the `n` generators) and independent of the signature.
    ///
    /// This is the invariant that pins `classify`: reconstructing `dim_R` from the Morita type
    /// must return `2^(p+q)` for every signature, so the per-row exponents cannot be permuted
    /// without the check going red. A classification that cannot fail this way would be the
    /// vacuity class.
    let realDimension (p: int) (q: int) : int = pown 2 (p + q)

    /// Real dimension implied by a `CliffordType` — `n² · dim_R(K)`, doubled when split.
    let dimensionOfType (t: CliffordType) : int =
        let k =
            match t.Ground with
            | Real -> 1
            | Complex -> 2
            | Quaternionic -> 4
        let d = t.MatrixDim * t.MatrixDim * k
        if t.IsSplit then 2 * d else d

    /// Does the mod-8 clock permit a doubly-even self-dual binary code at this length?
    ///
    /// The `AdinkraCode.fs:66` condition, stated here against the clock it comes from rather
    /// than as a standalone fact. `length = 8` (the in-tree extended Hamming code) is the first
    /// positive length that passes.
    let admitsDoublyEvenSelfDualCode (length: int) : bool =
        length > 0 && length % 8 = 0

    /// Does the clock permit an even unimodular lattice in this dimension?
    ///
    /// Same residue, different category — the third of the three eights. Construction A carries
    /// a length-`n` doubly-even self-dual code to a dimension-`n` even unimodular lattice, which
    /// is why these two predicates agree on every input, and why the `[8,4]` code lands on E8.
    let admitsEvenUnimodularLattice (dimension: int) : bool =
        dimension > 0 && dimension % 8 = 0

    // ═══════════════════════════════════════════════════════════════════
    // THE TWO HALVES — and where the clock actually separates them.
    // ═══════════════════════════════════════════════════════════════════

    /// Clock position of the **even subalgebra** `Cl⁰(p,q)` — the grading-preserving half.
    ///
    /// `Cl⁰(p,q) ≅ Cl(p, q−1)`, so its class is `s + 1`: **the even half sits one tick forward
    /// on the clock.** This is the answer to "does the mod-8 clock separate the two halves?" —
    /// not at `s`, but at `s + 1`.
    ///
    /// Undefined for `q = 0` (there is no `q − 1`), which is a refusal rather than a wrap.
    let evenSubalgebraClass (p: int) (q: int) : Result<int, PeriodicityError> =
        if p < 0 || q < 1 then Error(NegativeSignature(p, q))
        else Ok(signatureClass p (q - 1))

    /// Do the two halves separate cleanly at this signature?
    ///
    /// The **odd** part swaps the halves (a supercharge `Q` carries bosons to fermions — it
    /// *acts*); the **even** part preserves them (`{Q,Q} = ∂_τ` stays inside a half — it
    /// *remains*). The even part separates into two independent pieces exactly when it lands on
    /// a **split** row, `s + 1 ∈ {1, 5}` — i.e. when `s ∈ {0, 4}`.
    ///
    /// So the clean two-half separation IS a mod-8 fact, one tick displaced. `N = 8` lands on
    /// `s = 0` and therefore separates; most signatures do not.
    ///
    /// NOTE this is a statement about the algebra's grading, NOT about the `IsSplit` field of
    /// `Cl(p,q)` itself. Those are different splits, and conflating them is the trap: `Cl(7,7)`
    /// is *not* split, yet its halves separate perfectly.
    let halvesSeparateCleanly (p: int) (q: int) : Result<bool, PeriodicityError> =
        evenSubalgebraClass p q
        |> Result.map (fun s -> s = 1 || s = 5)

    // ═══════════════════════════════════════════════════════════════════
    // THE SECOND TOWER — E8 from the UNCODED Clifford chain, no code involved.
    // ═══════════════════════════════════════════════════════════════════

    /// Dimension of the bivector space `Λ²(R^n)`, which **is** `so(n)` as a Lie algebra under the
    /// Clifford commutator. `n(n−1)/2`.
    ///
    /// This is the door out of the coded tower. `AdinkraCode.fs` reaches E8 by Construction A over
    /// the `[8,4]` code — which costs homoiconicity, because quotienting collapses the vertex
    /// module below `dim Cl(0,N)`. The bivector route quotients nothing.
    let bivectorDim (n: int) : int = n * (n - 1) / 2

    /// Dimension of an irreducible spinor module for `Cl(0,n)`.
    ///
    /// Even `n`: the full space is `2^(n/2)` and splits by chirality into two halves of
    /// `2^(n/2 − 1)`. Odd `n`: `2^((n−1)/2)`, no chirality split. Both are the mod-8 clock's
    /// arithmetic showing up as a dimension rather than as a Morita class.
    let halfSpinorDim (n: int) : int =
        if n % 2 = 0 then pown 2 (n / 2 - 1) else pown 2 ((n - 1) / 2)

    /// **`e₈ = so(16) ⊕ Δ⁺₁₆`** — the spinor construction of E8, reached without any code.
    ///
    /// `120 + 128 = 248`. The `so(16)` half is the bivectors of `Cl(0,16)`; the `128` is one
    /// chirality half of its spinor module. And the reason that half exists at all is the clock:
    /// `Cl(0,16)` sits at `s = 0`, so `Cl⁰(0,16) ≅ Cl(0,15)` sits at `s = 1` — **the split real
    /// row** — giving `M₁₂₈(R) ⊕ M₁₂₈(R)`. The two 128s are the even-subalgebra splitting, exactly
    /// as the two 64s were at `(7,7)` and the two 8s at `(0,8)`. One clock, three rungs.
    ///
    /// **This is a genuinely different route to E8 than Construction A**, and it answers Aaron's
    /// question (2026-08-18) — *"maybe some E8 or other Lie groups can be generated from the
    /// homoiconic version… we are never locked into one tower."* We are not. Note the two routes
    /// do not produce the same *object*: Construction A yields the E8 **lattice**, this yields the
    /// E8 **Lie algebra**. They are two faces of E8 (the lattice is the algebra's root lattice),
    /// reached by constructions that share only the periodicity.
    ///
    /// Anchor: the standard spinorial construction of `e₈` (J. F. Adams, *Lectures on Exceptional
    /// Lie Groups*; Kostant). Not ours and not new — which is the point: it is *checkable*.
    let e8FromSpinors = (16, 248)

    /// **The bridge between the two E8 routes — `248 = 8 + 240 = 120 + 128`.**
    ///
    /// Aaron asked (2026-08-18) whether there is a meaningful transformation between the two E8s.
    /// There is, and it is not exotic: **they are two decompositions of the same 248-dimensional
    /// Lie algebra against two different maximal subalgebras.**
    ///
    /// | route | decomposition | graded against |
    /// |---|---|---|
    /// | lattice / Construction A | `248 = 8 + 240` — Cartan ⊕ root spaces | the **Cartan** `h` (a `Z⁸` grading by roots) |
    /// | spinor / uncoded tower | `248 = 120 + 128` — `so(16) ⊕ Δ⁺` | **`so(16)`** (a `Z₂` grading by parity) |
    ///
    /// The lattice route's 240 minimal-norm vectors **are** the 240 roots, and `e₈ = h ⊕ ⊕_α g_α`
    /// with `dim h = 8`. So the two constructions are joined by the root system itself — the
    /// lattice is where the algebra's roots live, and Construction A builds exactly that lattice.
    ///
    /// **What is genuinely interesting rather than merely arithmetic:** these are two *different*
    /// what-remains / what-acts splits of one object. The Cartan is the maximal commuting
    /// subalgebra — what remains under the adjoint action. `so(16)` is the even part — what remains
    /// under the grading. Same algebra, two notions of "remains", and asking how they relate is a
    /// real question rather than a restatement.
    let e8RootDecomposition = (8, 240)

    /// **`f₄ = so(9) ⊕ Δ₉`** — `36 + 16 = 52`. The same recipe one exceptional algebra down, kept
    /// so the construction is tested at more than a single point. `n = 9` is odd, so there is no
    /// chirality split and the whole `16` is used.
    let f4FromSpinors = (9, 52)

    /// Spacetime: `Cl(1,3)`, the spacetime algebra whose **6 bivectors are the Lorentz
    /// generators** (3 rotations + 3 boosts) — the `HexCore.fs` six-wall rhyme.
    ///
    /// Two facts the clock supplies here, and the second is a genuine discriminator:
    ///
    /// 1. **The Lorentz generators live in the EVEN half.** Bivectors are grade 2, hence even,
    ///    hence grading-*preserving* — "what remains". `Cl⁰(1,3) ≅ Cl(1,2) ≅ M₂(C)`, and
    ///    `SL(2,C) = Spin(1,3)` sits inside it. Vectors (grade 1, odd) are what *acts*. So the
    ///    even/odd split of the spacetime algebra is the same what-remains / what-acts split the
    ///    adinkra's supercharges exhibit — one structure, two instances.
    ///
    /// 2. **Spacetime's halves do NOT separate cleanly.** `s = 1 − 3 ≡ 6`, so `s + 1 = 7` — the
    ///    complex row, not a split row. Contrast `Cl(0,8)` and `Cl(7,7)`, which both sit at
    ///    `s = 0` and DO separate. Chirality is therefore not a property spacetime has on its
    ///    own; it needs the larger signature. Stated as arithmetic, not as physics.
    let spacetimeSignature = (1, 3)

    /// The signature the `N = 8` adinkra's garden algebra lives at: `Cl(0,8)`.
    ///
    /// `GR(d,N)` is generated by `L_I R_J + L_J R_I = 2δ_IJ`, a Clifford relation, so an
    /// `N`-colour adinkra sits at signature `(0,N)`. At `N = 8`: `s = 0`, so by
    /// `halvesSeparateCleanly` its halves DO separate — `Cl⁰(0,8) ≅ Cl(0,7) ≅ M₈(R) ⊕ M₈(R)`,
    /// two independent `8 × 8` blocks for the **8 bosons** and **8 fermions** of the 16-node
    /// adinkra of `AdinkraCode.fs`. The block sizes are not chosen; they fall out of the clock.
    let adinkraN8Signature = (0, 8)

    /// The signature Geometric Unity builds its spinor sector from: `(7,7)`.
    ///
    /// Recorded as a named datum because the ferry
    /// (`docs/research/ip-questionable/2026-08-18-geometric-unity-iceberg-*.md`) turns on it:
    /// `s = 0`, the split-real row, which is why the 128-dimensional real spinor module splits
    /// evenly rather than into an unbalanced pair. Naming it here does NOT endorse GU; it makes
    /// the arithmetic checkable independently of the theory that motivated looking.
    let geometricUnitySignature = (7, 7)
