namespace Zeta.Core

/// Tsirelson — **the CHSH bound S² = 8, locked in pure integer arithmetic** (math REPORT #6's
/// build plan, executed; the no-binary/no-float proof-lineage carrier for quantum correlation
/// bounds).
///
/// Observables as bare extraspecial-group elements (the Pauli instance — REPORT #5 §3's group,
/// the adinkra dashing's extension group): A = X₁, A′ = Z₁, B = X₂, B′ = Z₂ — all integer 4×4
/// matrices; the π/4 rotation that usually decorates the observables lives in the state instead
/// (REPORT #6 §1), so every identity below is exact integer matrix algebra:
///
///   C  = X₁X₂ + X₁Z₂ + Z₁X₂ − Z₁Z₂          (the CHSH operator)
///   C² = 4·I − 4·Ω,   Ω = (X₁Z₁)⊗(X₂Z₂),   Ω² = I
///   ⇒ spec(C²) ⊆ {0, 8} ⇒ C⁴ = 8·C² ⇒ ‖C‖ = 2√2 — the irrational appears only at READOUT.
///
/// Ω is the **joint-parity element** (the volume element γ₁γ₂γ₃γ₄): ferry 25 §3's "shadow bind"
/// is the exact operator whose +1 eigenspace carries saturation. The cocycle is priced
/// executable: replace A′ with a commuting partner and C² = 4·I exactly — the classical bound
/// recovered; anticommutation (the odd-faces sign rule) is literally the term you pay for S > 2.
/// The doubly-even code appears NOWHERE in this module — that is REPORT #6's verdict made
/// visible: the code is the commuting, Bell-inert half; the bound spends the anticommuting
/// complement.
[<RequireQualifiedAccess>]
module Tsirelson =

    /// 4×4 integer matrices, row-major. The proof-lineage carrier: every entry stays an int.
    type M = int[][]

    let private init (f: int -> int -> int) : M = Array.init 4 (fun i -> Array.init 4 (f i))

    /// The identity.
    let identity : M = init (fun i j -> if i = j then 1 else 0)

    /// Matrix product (exact integers).
    let mul (a: M) (b: M) : M =
        init (fun i j -> Array.sumBy (fun k -> a.[i].[k] * b.[k].[j]) [| 0 .. 3 |])

    /// Sum, difference, integer scale.
    let add (a: M) (b: M) : M = init (fun i j -> a.[i].[j] + b.[i].[j])
    let sub (a: M) (b: M) : M = init (fun i j -> a.[i].[j] - b.[i].[j])
    let scale (s: int) (a: M) : M = init (fun i j -> s * a.[i].[j])

    /// Kronecker product of 2×2 integer matrices → 4×4.
    let kron (a: int[][]) (b: int[][]) : M =
        init (fun i j -> a.[i / 2].[j / 2] * b.[i % 2].[j % 2])

    // The real Pauli generators (2×2, integer): X = bit flip, Z = sign flip.
    let private x2 = [| [| 0; 1 |]; [| 1; 0 |] |]
    let private z2 = [| [| 1; 0 |]; [| 0; -1 |] |]
    let private i2 = [| [| 1; 0 |]; [| 0; 1 |] |]

    /// The four CHSH observables as extraspecial elements: Alice on qubit 1, Bob on qubit 2.
    let A : M = kron x2 i2 // X₁
    let A' : M = kron z2 i2 // Z₁
    let B : M = kron i2 x2 // X₂
    let B' : M = kron i2 z2 // Z₂

    /// The CHSH operator C = AB + AB′ + A′B − A′B′ (integer matrix).
    let C : M =
        sub (add (add (mul A B) (mul A B')) (mul A' B)) (mul A' B')

    /// The joint-parity element Ω = (X₁Z₁)(X₂Z₂) — the shadow bind as a matrix.
    let Omega : M = mul (mul A A') (mul B B')

    /// Build the CHSH operator from ARBITRARY observables (for the cocycle-pricing tests).
    let chshOf (a: M) (a': M) (b: M) (b': M) : M =
        sub (add (add (mul a b) (mul a b')) (mul a' b)) (mul a' b')

    /// The anticommutator {p, q} = pq + qp (zero ⟺ the pair anticommutes — the cocycle's sign).
    let anticommutator (p: M) (q: M) : M = add (mul p q) (mul q p)

    /// Apply a matrix to an integer vector.
    let apply (m: M) (v: int[]) : int[] =
        Array.init 4 (fun i -> Array.sumBy (fun k -> m.[i].[k] * v.[k]) [| 0 .. 3 |])
