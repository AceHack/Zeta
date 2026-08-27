namespace Zeta.Core

/// **`E8ChevalleyGroup` — the split algebraic group, generated from the
/// Chevalley basis of `e₈`.** The third E8 *object* (a group with a
/// checked multiply), not the compact Lie group manifold.
///
/// Chevalley 1955; Carter, *Simple Groups of Lie Type* (1972) ch. 4:
/// the root group `U_α` is
///
/// ```text
///     x_α(t) = exp(t · ad e_α) = I + t ad + (t²/2) ad²
/// ```
///
/// because `ad(e_α)³ = 0` for simply-laced finite type. The `1/2` is
/// integral on a Chevalley basis (`ad²` lands even). Over ℤ this is
/// the split (untwisted) form; specialising the scalars gives
/// `E₈(q)` for any field.
///
/// **What is measured** (each can fail):
///   • `ad³ = 0` on every root vector — nilpotency that makes exp a
///     polynomial. Falsifier: `ad(h_i)` is *not* nilpotent (Cartan is
///     semisimple).
///   • `ad²` even — so `x_α(1)` has integer entries.
///   • `x_α(s) x_α(t) = x_α(s+t)` — the root group is `(ℤ, +)`.
///   • `x_α(0) = I` and `x_α(t) x_α(−t) = I`.
///
/// **Honest limit.** This is E8 as a **split Chevalley group**
/// (algebraic, over ℤ). The compact real Lie group remains the
/// Killing-form substitute in `E8LieAlgebra` (existence/uniqueness,
/// no manifold multiply). Matching dimension 248 does not identify
/// them — the adjoint representation of both is 248
/// (`.claude/rules/numerology-vs-number-theory.md`). Weyl group is
/// still a fourth object (`CliffordE8Roots` versors).
///
/// Wikipedia's four properties of compact E8 (trivial centre,
/// compact, simply connected, simply laced) still describe the
/// *compact* form; `centreOrder = 1` and simply-laced are already
/// metered on the algebra. Compactness is the Killing substitute.
[<RequireQualifiedAccess>]
module E8ChevalleyGroup =

    let dim = E8LieAlgebra.dimension

    /// Columns of `ad(e_α)`: column `j` is `[e_α, b_j]` as a sparse
    /// `(row, coeff)` list. `rootIndex` is a root-basis index `0..239`.
    let adColumns (rootIndex: int) : (int * int)[][] =
        Array.init dim (fun j -> E8LieAlgebra.bracket rootIndex j)

    let apply (cols: (int * int)[][]) (v: int64[]) : int64[] =
        let w = Array.zeroCreate dim

        for j in 0 .. dim - 1 do
            let s = v.[j]

            if s <> 0L then
                for row, c in cols.[j] do
                    w.[row] <- w.[row] + int64 c * s

        w

    let private basis (j: int) : int64[] =
        let v = Array.zeroCreate dim
        v.[j] <- 1L
        v

    let private isZero (v: int64[]) : bool =
        let mutable ok = true
        let mutable i = 0

        while ok && i < v.Length do
            if v.[i] <> 0L then
                ok <- false

            i <- i + 1

        ok

    /// `ad(e_α)³ = 0` on the adjoint. Simply-laced finite type.
    let adCubeIsZero (rootIndex: int) : bool =
        let a = adColumns rootIndex
        let mutable ok = true
        let mutable j = 0

        while ok && j < dim do
            let v3 = apply a (apply a (apply a (basis j)))

            if not (isZero v3) then
                ok <- false

            j <- j + 1

        ok

    /// `ad(e_α)²` lands even, so `(t²/2) ad²` is integral for `t ∈ ℤ`.
    let adSquareIsEven (rootIndex: int) : bool =
        let a = adColumns rootIndex
        let mutable ok = true
        let mutable j = 0

        while ok && j < dim do
            let v2 = apply a (apply a (basis j))
            let mutable i = 0

            while ok && i < dim do
                if v2.[i] % 2L <> 0L then
                    ok <- false

                i <- i + 1

            j <- j + 1

        ok

    /// Column-major integer matrix of the adjoint representation.
    type AdjMatrix = int64[][]

    let identity : AdjMatrix =
        Array.init dim (fun j ->
            let col = Array.zeroCreate dim
            col.[j] <- 1L
            col)

    /// `x_α(t) = I + t ad + (t²/2) ad²`. Requires `adSquareIsEven`.
    let xOfRoot (rootIndex: int) (t: int) : AdjMatrix =
        let a = adColumns rootIndex
        let t64 = int64 t

        Array.init dim (fun j ->
            let v0 = basis j
            let v1 = apply a v0
            let v2 = apply a v1
            Array.init dim (fun i -> v0.[i] + t64 * v1.[i] + t64 * t64 * (v2.[i] / 2L)))

    let mul (a: AdjMatrix) (b: AdjMatrix) : AdjMatrix =
        Array.init dim (fun j ->
            let col = Array.zeroCreate dim
            let bj = b.[j]

            for k in 0 .. dim - 1 do
                let s = bj.[k]

                if s <> 0L then
                    let ak = a.[k]

                    for i in 0 .. dim - 1 do
                        col.[i] <- col.[i] + ak.[i] * s

            col)

    let equal (a: AdjMatrix) (b: AdjMatrix) : bool =
        let mutable ok = true
        let mutable j = 0

        while ok && j < dim do
            let mutable i = 0

            while ok && i < dim do
                if a.[j].[i] <> b.[j].[i] then
                    ok <- false

                i <- i + 1

            j <- j + 1

        ok

    let isIdentity (m: AdjMatrix) : bool = equal m identity

    /// Root group law: `x_α(s) x_α(t) = x_α(s+t)` ≅ `(ℤ, +)`.
    let oneParameterHolds (rootIndex: int) (s: int) (t: int) : bool =
        equal (mul (xOfRoot rootIndex s) (xOfRoot rootIndex t)) (xOfRoot rootIndex (s + t))

    /// Every root vector is ad-nilpotent of index ≤ 3.
    let everyRootAdCubeIsZero () : bool =
        let mutable ok = true
        let mutable a = 0

        while ok && a < E8LieAlgebra.rootCount do
            if not (adCubeIsZero a) then
                ok <- false

            a <- a + 1

        ok

    let everyRootAdSquareIsEven () : bool =
        let mutable ok = true
        let mutable a = 0

        while ok && a < E8LieAlgebra.rootCount do
            if not (adSquareIsEven a) then
                ok <- false

            a <- a + 1

        ok

    /// Simple-root groups generate; check the one-parameter law on each.
    let simpleRootOneParameterHolds (s: int) (t: int) : bool =
        E8LieAlgebra.chevalleyE |> Array.forall (fun a -> oneParameterHolds a s t)
