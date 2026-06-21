namespace Zeta.Core

/// A foundational Computer Algebra System (CAS) for finite rings and fields.
/// Designed to support compiler optimizations, IR canonicalization, and cryptographic analysis.
module SymbolicAlgebra =

    /// Represents an affine transformation f(x) = (a * x + b) mod 2^W
    /// Operates in the modular ring Z/2^W Z.
    type AffineZ2W = {
        Width: int
        A: uint64 // Multiplier
        B: uint64 // Increment
    }
    with
        /// The identity transformation f(x) = x
        static member Identity(width: int) =
            { Width = width; A = 1UL; B = 0UL }

        /// Creates a transformation f(x) = a * x
        static member Mul(width: int, a: uint64) =
            let mask = if width = 64 then 0xFFFFFFFFFFFFFFFFUL else (1UL <<< width) - 1UL
            { Width = width; A = a &&& mask; B = 0UL }

        /// Creates a transformation f(x) = x + b
        static member Add(width: int, b: uint64) =
            let mask = if width = 64 then 0xFFFFFFFFFFFFFFFFUL else (1UL <<< width) - 1UL
            { Width = width; A = 1UL; B = b &&& mask }

        /// Composes two affine transformations: g(f(x))
        /// g(f(x)) = g.A * (f.A * x + f.B) + g.B = (g.A * f.A) * x + (g.A * f.B + g.B)
        member f.Compose(g: AffineZ2W) =
            if f.Width <> g.Width then failwith "Cannot compose AffineZ2W of different widths"
            let mask = if f.Width = 64 then 0xFFFFFFFFFFFFFFFFUL else (1UL <<< f.Width) - 1UL
            {
                Width = f.Width
                A = (g.A * f.A) &&& mask
                B = (g.A * f.B + g.B) &&& mask
            }

        /// Returns true if this is the identity transformation
        member f.IsIdentity() =
            f.A = 1UL && f.B = 0UL

        /// Returns true if this maps all inputs to a constant (a = 0)
        member f.IsConstant() =
            f.A = 0UL

    /// Represents a polynomial in the ring F2[X] / (X^W - 1)
    /// In this ring, multiplying by X is equivalent to a 1-bit rotation.
    /// Addition is bitwise XOR.
    type PolyF2Rot = {
        Width: int
        /// The coefficients of the polynomial.
        /// The presence of `k` in the set means the term X^k is present.
        Terms: Set<int>
    }
    with
        /// The identity transformation f(x) = x (which is X^0)
        static member Identity(width: int) =
            { Width = width; Terms = Set.singleton 0 }

        /// The zero transformation f(x) = 0
        static member Zero(width: int) =
            { Width = width; Terms = Set.empty }

        /// Creates a transformation representing x ^ rotl(x, r1) ^ rotl(x, r2) ...
        /// The terms are exactly the rotation amounts modulo W.
        static member FromRotations(width: int, rotations: int list) =
            // In F2, addition is XOR. So if a term appears twice, it cancels out.
            let foldTerm (acc: Set<int>) (r: int) =
                let rMod = r % width
                let rMod = if rMod < 0 then rMod + width else rMod
                if Set.contains rMod acc then Set.remove rMod acc else Set.add rMod acc
            
            let terms = List.fold foldTerm Set.empty rotations
            { Width = width; Terms = terms }

        /// Composes two polynomials: g(f(x))
        /// Since these are linear operators over F2, composition is polynomial multiplication
        /// reduced modulo (X^W - 1).
        member f.Compose(g: PolyF2Rot) =
            if f.Width <> g.Width then failwith "Cannot compose PolyF2Rot of different widths"
            
            // Multiply polynomials: for each term a in f, and b in g, we get a term (a+b) mod W.
            // Since coefficients are in F2, we XOR (symmetric difference).
            let foldGTerm (acc: Set<int>) (b: int) =
                let foldFTerm (innerAcc: Set<int>) (a: int) =
                    let p = (a + b) % f.Width
                    if Set.contains p innerAcc then Set.remove p innerAcc else Set.add p innerAcc
                Set.fold foldFTerm acc f.Terms
                
            let newTerms = Set.fold foldGTerm Set.empty g.Terms
            { Width = f.Width; Terms = newTerms }

        /// Returns true if this is the identity transformation
        member f.IsIdentity() =
            f.Terms = Set.singleton 0

        /// Returns true if this is the zero transformation
        member f.IsZero() =
            Set.isEmpty f.Terms
