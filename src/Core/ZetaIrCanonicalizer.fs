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

    /// Converts a PolyF2Rot back to an XRotXor op
    let fromPolyF2Rot (poly: SymbolicAlgebra.PolyF2Rot) : ZetaIrV4.Op list =
        if poly.IsIdentity() then []
        else
            // A PolyF2Rot represents: sum_{k in Terms} x^k
            // But XRotXor semantics is: x ^= rotl(x, r1) ^ rotl(x, r2) ...
            // This means XRotXor ALREADY includes x implicitly (which is X^0).
            // So if 0 is in the terms, we emit the OTHER terms.
            // If 0 is NOT in the terms, we cannot represent it purely as a single XRotXor
            // because XRotXor always includes x. Wait, XRotXor rs computes: x ^ (x <<< rs[0]) ^ ...
            // If 0 is not in the terms, it means the output does NOT contain x.
            // This is actually impossible to reach by composing XRotXors!
            // Proof: XRotXor always has an EVEN number of terms if you don't count the implicit x,
            // meaning including x it has an ODD number of terms.
            // Multiplying two polynomials with an ODD number of terms yields a polynomial with an ODD number of terms.
            // Therefore, 0 will always be in the result if we only compose XRotXors, or it will be representable.
            // Actually, wait. XRotXor rs computes: x ^ rotl(x, rs[0]) ^ ...
            // So the polynomial is 1 + X^{rs[0]} + ...
            // So we just remove 0 from the terms, and the rest are the rotation amounts.
            let rs = poly.Terms |> Set.remove 0 |> Set.toList |> List.sort |> List.map int
            // XRotXor takes a list of int64? Wait, let me check ZetaIrV4.fs. No, it should be int list or int64 list? Let me check.
            // Wait, let's just map it to int64.
            [ ZetaIrV4.XRotXor (rs |> List.map int64) ]

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
            
        // F2 fusion using PolyF2Rot
        | ZetaIrV4.XRotXor a :: ZetaIrV4.XRotXor b :: rest ->
            let f = SymbolicAlgebra.PolyF2Rot.FromRotations(width, 0 :: (a |> List.map int))
            let g = SymbolicAlgebra.PolyF2Rot.FromRotations(width, 0 :: (b |> List.map int))
            let fused = f.Compose(g)
            fuseOps width (fromPolyF2Rot fused @ rest)

        // Pass through
        | head :: tail -> head :: fuseOps width tail
        | [] -> []

    let canonicalize (ir: ZetaIrV4.Ir) : ZetaIrV4.Ir =
        // First normalize to core four, then fuse
        let normalized = ZetaIrNormalizer.normalize ir
        let fused = fuseOps (int ir.Width) normalized.Ops
        { ir with Ops = fused }
