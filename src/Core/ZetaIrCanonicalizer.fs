namespace Zeta.Core

module ZetaIrCanonicalizer =
    open Zeta.Core

    /// Converts an AffineZ2W back to a sequence of core-four ops
    let fromAffine (aff: SymbolicAlgebra.AffineZ2W) : ZetaIrV4.Op list =
        let a = int64 aff.A
        let b = int64 aff.B
        match a, b with
        | 1L, 0L -> []
        | 1L, _  -> [ ZetaIrV4.Add b ]
        | _, 0L  -> [ ZetaIrV4.Mul a ]
        | _, _   -> [ ZetaIrV4.Mul a; ZetaIrV4.Add b ]

    /// Converts a `PolyF2Rot` back into core-four ops.
    ///
    /// A `PolyF2Rot` denotes the F2-linear map `x |-> XOR_{k in Terms} rotl(x, k)`, i.e. the
    /// polynomial `SUM_{k in Terms} X^k` in `F2[X]/(X^W - 1)` where `X` is `rotl(.,1)`.
    /// `XRotXor rs` denotes `x ^ rotl(x,r_1) ^ ...`, so its polynomial is `1 + SUM X^{r_i}` —
    /// the constant term `1` is ALWAYS present. Three cases therefore have to be split, and
    /// blindly dropping `0` from the term set (the previous behaviour) is wrong in two of them:
    ///
    ///  - `Terms = {}`        — the ZERO map. `XRotXor []` denotes the IDENTITY, not zero, and is
    ///                          also rejected by `ZetaIrV4.validate` (term lists must be non-empty).
    ///                          The core-four spelling of the zero map is `Mul 0`.
    ///  - `0 IN Terms`        — directly representable: emit the other terms.
    ///  - `0 NOT IN Terms`    — reachable: the constant term CAN cancel under composition, e.g. at
    ///                          W=64 `(1 + X^63)(1 + X)  =  1 + X + X^63 + X^64  =  X + X^63`
    ///                          (because `X^64 = 1`). Factor out the lowest monomial `X^r`
    ///                          (spelled `XRotXor [0; r]`, whose polynomial is `1 + 1 + X^r = X^r`)
    ///                          and emit the cofactor `X^-r * poly`, which does contain `0`.
    let fromPolyF2Rot (poly: SymbolicAlgebra.PolyF2Rot) : ZetaIrV4.Op list =
        let emitContainingZero (terms: Set<int>) : ZetaIrV4.Op list =
            // Precondition: `0 IN terms`. `{0}` is the identity, so it emits nothing.
            let rs = terms |> Set.remove 0 |> Set.toList |> List.sort |> List.map int64
            if List.isEmpty rs then [] else [ ZetaIrV4.XRotXor rs ]

        if poly.IsZero() then
            [ ZetaIrV4.Mul 0L ]
        elif poly.IsIdentity() then
            []
        elif Set.contains 0 poly.Terms then
            emitContainingZero poly.Terms
        else
            let w = poly.Width
            let r = Set.minElement poly.Terms
            let cofactor = poly.Terms |> Set.map (fun t -> ((t - r) % w + w) % w)
            ZetaIrV4.XRotXor [ 0L; int64 r ] :: emitContainingZero cofactor

    /// Normalizes and fuses operations. Slice 1 & 2: Ring Fusion (Mul/Add) and F2 Fusion (XRotXor).
    let rec fuseOps (width: int) (ops: ZetaIrV4.Op list) : ZetaIrV4.Op list =
        match ops with
        // Identity elimination first!
        | ZetaIrV4.Mul 1L :: rest -> fuseOps width rest
        | ZetaIrV4.Add 0L :: rest -> fuseOps width rest
        | ZetaIrV4.XShrXor [] :: rest -> fuseOps width rest
        | ZetaIrV4.XRotXor [] :: rest -> fuseOps width rest
        
        // Zero absorption
        | ZetaIrV4.Mul 0L :: rest ->
            // Mul 0 absorbs all MULTIPLICATIVE operations before it, but we can't drop what comes AFTER it.
            // Wait, if it's `x = x * 0`, then the state becomes 0.
            // If the next op is `Add b`, then state becomes `0 + b = b`.
            // So `Mul 0 :: Add b :: rest` is equivalent to `Mul 0 :: Add b :: rest`.
            // Actually, `Mul 0` is just a constant assignment. We should just process the rest normally.
            // Wait, if we drop `rest`, we change semantics! `x = x * 0; x = x + 5;` -> `x = 5`.
            // If we drop `rest`, we get `x = x * 0` -> `x = 0`. This is a BUG in the F# code!
            ZetaIrV4.Mul 0L :: fuseOps width rest

        // Mul/Add fusion using AffineZ2W
        | ZetaIrV4.Mul a :: ZetaIrV4.Mul b :: rest ->
            let f = SymbolicAlgebra.AffineZ2W.Mul(width, uint64 a)
            let g = SymbolicAlgebra.AffineZ2W.Mul(width, uint64 b)
            let fused = f.Compose(g)
            fuseOps width (fromAffine fused @ rest)
        
        | ZetaIrV4.Add a :: ZetaIrV4.Add b :: rest ->
            let f = SymbolicAlgebra.AffineZ2W.Add(width, uint64 a)
            let g = SymbolicAlgebra.AffineZ2W.Add(width, uint64 b)
            let fused = f.Compose(g)
            fuseOps width (fromAffine fused @ rest)

        | ZetaIrV4.Mul a :: ZetaIrV4.Add b :: rest ->
            // Already in canonical order, check if we can fuse with the next
            match rest with
            | ZetaIrV4.Mul c :: tail ->
                // (a*x + b) * c = (a*c)*x + (b*c)
                let f : SymbolicAlgebra.AffineZ2W = { Width = width; A = uint64 a; B = uint64 b }
                let g = SymbolicAlgebra.AffineZ2W.Mul(width, uint64 c)
                let fused = f.Compose(g)
                fuseOps width (fromAffine fused @ tail)
            | ZetaIrV4.Add c :: tail ->
                let f : SymbolicAlgebra.AffineZ2W = { Width = width; A = uint64 a; B = uint64 b }
                let g = SymbolicAlgebra.AffineZ2W.Add(width, uint64 c)
                let fused = f.Compose(g)
                fuseOps width (fromAffine fused @ tail)
            | _ -> ZetaIrV4.Mul a :: ZetaIrV4.Add b :: fuseOps width rest
            
        // F2 fusion using PolyF2Rot.
        // The rewrite must make PROGRESS: `fromPolyF2Rot` needs two ops whenever the product's
        // constant term cancelled (see its docstring), and rewriting two XRotXor ops into two
        // XRotXor ops would re-enter this same case forever. So fuse only when the result is
        // strictly shorter than the pair it replaces; otherwise leave the pair alone.
        | ZetaIrV4.XRotXor a :: ZetaIrV4.XRotXor b :: rest ->
            let f = SymbolicAlgebra.PolyF2Rot.FromRotations(width, 0 :: (a |> List.map int))
            let g = SymbolicAlgebra.PolyF2Rot.FromRotations(width, 0 :: (b |> List.map int))
            let fused = fromPolyF2Rot (f.Compose(g))
            if List.length fused < 2 then
                fuseOps width (fused @ rest)
            else
                ZetaIrV4.XRotXor a :: fuseOps width (ZetaIrV4.XRotXor b :: rest)

        // Pass through
        | head :: tail -> head :: fuseOps width tail
        | [] -> []

    let canonicalize (ir: ZetaIrV4.Ir) : ZetaIrV4.Ir =
        // First normalize to core four, then fuse
        let normalized = ZetaIrNormalizer.normalize ir
        let fused = fuseOps (int ir.Width) normalized.Ops
        { ir with Ops = fused }
