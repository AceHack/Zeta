namespace Zeta.Core

/// **`Cl3` — the geometric (Clifford) algebra Cl(3,0), the keystone substrate (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"combine our qubit and Clifford and geospatial for soft memory distance and represent forward
/// momentum here."* This is the shared algebra all three live in. **Disentangling the two Cliffords** (same
/// human — William Kingdon Clifford — distinct objects, bridged by Pauli):
///   - **Clifford *algebra* (this module)** = geometric algebra: multivectors + the geometric product. Carries
///     **geospatial distance** (the vector inner product *is* squared Euclidean distance — `distSq`) and
///     **forward momentum** (a vector/blade = an oriented direction with magnitude).
///   - **Clifford *group* (Gottesman–Knill)** = the poly-simulable stabilizer class — a *different* thing,
///     the normalizer of the Pauli group. The bridge is real: **Pauli generates Cl(3)** (σᵢσⱼ + σⱼσᵢ = 2δᵢⱼ),
///     so `QubitIso`'s Pauli operators are Cl(3) elements. Whether a given transform is poly-simulable is the
///     question "does it land in the Clifford *group*?" — to be **tested, not assumed** (general GA rotors do
///     not all land there).
///
/// **Cl(3,0)** is 2³ = 8-dimensional, graded: 1 scalar · 3 vectors (e₁e₂e₃) · 3 bivectors (e₁₂e₁₃e₂₃) · 1
/// pseudoscalar (e₁₂₃ = I). Basis blades are indexed by a 3-bit mask (bit0=e₁, bit1=e₂, bit2=e₃); the geometric
/// product is the canonical bitmask product (`mask = a XOR b`, sign from reordering, all squares +1 in this
/// signature). The **even subalgebra** {scalar + bivectors} ≅ the quaternions — i.e. `CayleyDickson`'s
/// `Doubled<Complex>` rotors live inside here (this module is the full algebra those were the even part of).
///
/// **Honest scope (peel):** Euclidean signature Cl(3,0) only (not yet the *conformal* CGA Cl(4,1) where a point
/// is a null vector and distance is a single inner product across *embedded* points — that is the next slice for
/// "Sequoia soft memory distance"; here `distSq` is the flat-space vector metric). Pure-float multivectors; no
/// SIMD. The Clifford-*group* / poly-simulability check is **not** implemented — this provides the algebra; the
/// stabilizer-membership test is a separate, deliberately-not-asserted piece.
[<RequireQualifiedAccess>]
module Cl3 =

    /// A multivector of Cl(3,0): 8 real coefficients, one per basis blade (mask order: S, e₁, e₂, e₁₂, e₃, e₁₃,
    /// e₂₃, e₁₂₃). Fields named by blade; `e₃₁ = -e₁₃` (we store canonical `E13`).
    type Mv =
        { S: float
          E1: float
          E2: float
          E12: float
          E3: float
          E13: float
          E23: float
          E123: float }

    let zero: Mv =
        { S = 0.0; E1 = 0.0; E2 = 0.0; E12 = 0.0; E3 = 0.0; E13 = 0.0; E23 = 0.0; E123 = 0.0 }

    /// Scalar (grade 0).
    let scalar (s: float) : Mv = { zero with S = s }

    /// The multiplicative identity (scalar 1).
    let one: Mv = scalar 1.0

    /// A Euclidean vector (grade 1) — a point/direction in 3-space; the geospatial + forward-momentum carrier.
    let vector (x: float) (y: float) (z: float) : Mv = { zero with E1 = x; E2 = y; E3 = z }

    // ---- bitmask <-> field plumbing for the geometric product (mask order, see Mv) ----

    let private toArr (m: Mv) : float[] =
        [| m.S; m.E1; m.E2; m.E12; m.E3; m.E13; m.E23; m.E123 |]

    let private ofArr (a: float[]) : Mv =
        { S = a.[0]; E1 = a.[1]; E2 = a.[2]; E12 = a.[3]; E3 = a.[4]; E13 = a.[5]; E23 = a.[6]; E123 = a.[7] }

    /// Reordering sign for the product of basis blades `a`·`b` (count anticommuting swaps; all squares +1).
    let private reorderSign (a: int) (b: int) : float =
        let mutable aShift = a >>> 1
        let mutable swaps = 0
        while aShift <> 0 do
            swaps <- swaps + System.Numerics.BitOperations.PopCount(uint (aShift &&& b))
            aShift <- aShift >>> 1
        if swaps % 2 = 0 then 1.0 else -1.0

    /// **The geometric product** — the defining operation (`uv = u·v + u∧v` for vectors). Bilinear; basis
    /// blades multiply by `mask = a XOR b` with the reordering sign. Associative, non-commutative.
    let gp (x: Mv) (y: Mv) : Mv =
        let xa, ya = toArr x, toArr y
        let r = Array.zeroCreate 8
        for i in 0..7 do
            if xa.[i] <> 0.0 then
                for j in 0..7 do
                    if ya.[j] <> 0.0 then
                        let k = i ^^^ j
                        r.[k] <- r.[k] + reorderSign i j * xa.[i] * ya.[j]
        ofArr r

    let add (x: Mv) (y: Mv) : Mv = ofArr (Array.map2 (+) (toArr x) (toArr y))
    let sub (x: Mv) (y: Mv) : Mv = ofArr (Array.map2 (-) (toArr x) (toArr y))
    let smul (s: float) (x: Mv) : Mv = ofArr (toArr x |> Array.map ((*) s))

    /// Reverse (`~x`) — reverses blade factor order; grade `g` blade gets sign `(-1)^(g(g-1)/2)` (grades 2,3 flip).
    let reverse (x: Mv) : Mv =
        { x with E12 = -x.E12; E13 = -x.E13; E23 = -x.E23; E123 = -x.E123 }

    /// Squared magnitude `⟨x ~x⟩₀` = sum of squared coefficients (Euclidean norm² on the 8-dim space).
    let normSq (x: Mv) : float = toArr x |> Array.sumBy (fun c -> c * c)

    /// Magnitude `‖x‖`.
    let norm (x: Mv) : float = sqrt (normSq x)

    /// **Vector inner product** = the scalar (grade-0) part of the geometric product. For two grade-1 vectors
    /// `a·b`; the metric. (For general multivectors this is the scalar part of `gp`.)
    let dot (x: Mv) (y: Mv) : float = (gp x y).S

    /// **Geospatial "memory distance":** squared Euclidean distance between two points (vectors) = `(a-b)·(a-b)`.
    /// The Clifford-algebra inner product *is* the distance metric — the basis of distance-addressed soft memory.
    let distSq (a: Mv) (b: Mv) : float =
        let d = sub a b
        dot d d

    let dist (a: Mv) (b: Mv) : float = sqrt (max 0.0 (distSq a b))

    /// A unit bivector for a coordinate plane (`e₁₂`, `e₂₃`, or `e₁₃`) — the generator of a rotation in it.
    let e12: Mv = { zero with E12 = 1.0 }
    let e23: Mv = { zero with E23 = 1.0 }
    let e13: Mv = { zero with E13 = 1.0 }

    /// **Rotor** for angle `θ` in the plane of unit bivector `b`: `R = cos(θ/2) − sin(θ/2)·b` (the even-subalgebra
    /// element ≅ a quaternion; `CayleyDickson` rotors are exactly these). Apply with `rotate`.
    let rotor (theta: float) (b: Mv) : Mv = add (scalar (cos (theta / 2.0))) (smul (-(sin (theta / 2.0))) b)

    /// **Apply a rotor:** `v ↦ R v ~R` — the sandwich product. Rotates a vector (or any multivector) rigidly.
    /// This is how **forward momentum** turns: a momentum vector `p` reoriented by a rotor is `rotate R p`.
    let rotate (r: Mv) (v: Mv) : Mv = gp (gp r v) (reverse r)

    /// **Forward momentum as a Cl(3) vector:** an oriented direction with magnitude (the agency/heading blade).
    /// `momentum dir speed` = the vector `speed · dir̂`; `‖·‖` = the momentum magnitude; `rotate` turns it.
    let momentum (dirX: float) (dirY: float) (dirZ: float) (speed: float) : Mv =
        let d = vector dirX dirY dirZ
        let n = norm d
        if n <= 1e-12 then zero else smul (speed / n) d

    /// **`Cl(3,0)` presented as a comparison-free `IStarRing<Mv>`** — the buildable Clifford leg of the
    /// adinkra → Clifford → E8 unfold (math-team handoff 2026-06-19, row 10, IStarRing Clifford leg; Face 3
    /// `mix(mix,mix)=cogen` stays BLOCKED on freeze-IR). This is the SAME spirit as `CayleyDickson.fs`'s
    /// `Doubled.algebra` / `Real.algebra` / `ImaginaryStack.*`: a *-ring is a pure dictionary of operations
    /// (`IStarRing<'A>` = `ISemiring` Zero/One/Add/Mul/Negate + the involution `Conj`), carrying NO state and
    /// requiring **no `IComparable`** — an `Mv` can BE an identity, comparison is explicit opt-in per the
    /// culture-invariant rule (`dot` / `normSq` are the opt-in metric, never an implicit ordering).
    ///
    /// **Folds, does not duplicate:** built directly on the existing `Cl3.Mv` + `gp` + `add` + `reverse`
    /// (the prior-art gate — `CliffordE8Bridge` reuses this same `Mv`; we add the *-ring instance, no parallel
    /// type). The even subalgebra {scalar + bivectors} ≅ ℍ, so this `IStarRing` *contains* `CayleyDickson`'s
    /// quaternion rotors — the two algebras agree on their overlap.
    ///
    /// **Involution = REVERSION (`~`, `Cl3.reverse`), NOT Clifford conjugation.** Reversion is the
    /// **anti-automorphism** `~(xy) = (~y)(~x)` — exactly the *-ring law `Conj(x·y) = Conj y · Conj x`. It is
    /// involutive (`~~x = x`), additive (`~(x+y) = ~x + ~y`), and fixes scalars (`~1 = 1`). Grade involution
    /// `x̂` (flip odd grades) is an *automorphism* `(xy)^ = x̂ŷ` — the WRONG order, so it is NOT the *-ring
    /// involution. Clifford conjugation `x̄ = ~(x̂) = (x̂)~` is *also* an anti-automorphism and would satisfy
    /// the *-ring laws too; reversion is chosen because it is the **norm-defining** involution here
    /// (`⟨x ~x⟩₀ = normSq x`, the metric `Cl3.reverse` already documents) and the one `rotate`'s sandwich uses.
    ///
    /// Anchors (Beacon): W. K. Clifford, *Applications of Grassmann's extensive algebra* (1878) — the geometric
    /// algebra; Hestenes & Sobczyk, *Clifford Algebra to Geometric Calculus* (1984) — reversion as the principal
    /// anti-automorphism / *-structure; Lounesto, *Clifford Algebras and Spinors* (2001) §3 — reversion vs grade
    /// involution vs conjugation. Sibling: `CayleyDickson.fs` (the hypercomplex tower as `IStarRing`).
    let algebra: IStarRing<Mv> =
        { new IStarRing<Mv> with
            member _.Zero = zero
            member _.One = one
            member _.Add(x, y) = add x y
            member _.Negate(x) = smul -1.0 x
            // The geometric product — associative, non-commutative; `One` (scalar 1) is its identity.
            member _.Mul(x, y) = gp x y
            // The *-ring involution: reversion (`~`), the anti-automorphism `~(xy) = (~y)(~x)`.
            member _.Conj(x) = reverse x }
