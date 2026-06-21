namespace Zeta.Tests

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core

module ZetaIrCanonicalizerTests =

    [<Fact>]
    let ``Mul-Mul fusion works`` () =
        let ir = {
            ZetaIrV4.Generator = "test"
            ZetaIrV4.Version = 1
            ZetaIrV4.Width = 64
            ZetaIrV4.Ops = [ ZetaIrV4.Mul 2L; ZetaIrV4.Mul 3L ]
        }
        let canon = ZetaIrCanonicalizer.canonicalize ir
        Assert.Equal(1, canon.Ops.Length)
        Assert.Equal(ZetaIrV4.Mul 6L, canon.Ops.[0])

    [<Fact>]
    let ``Add-Add fusion works`` () =
        let ir = {
            ZetaIrV4.Generator = "test"
            ZetaIrV4.Version = 1
            ZetaIrV4.Width = 64
            ZetaIrV4.Ops = [ ZetaIrV4.Add 5L; ZetaIrV4.Add 10L ]
        }
        let canon = ZetaIrCanonicalizer.canonicalize ir
        Assert.Equal(1, canon.Ops.Length)
        Assert.Equal(ZetaIrV4.Add 15L, canon.Ops.[0])

    [<Fact>]
    let ``Identity elimination works`` () =
        let ir = {
            ZetaIrV4.Generator = "test"
            ZetaIrV4.Version = 1
            ZetaIrV4.Width = 64
            ZetaIrV4.Ops = [ ZetaIrV4.Add 0L; ZetaIrV4.Mul 1L; ZetaIrV4.Add 5L ]
        }
        let canon = ZetaIrCanonicalizer.canonicalize ir
        // Since Mul 1L and Add 0L are removed, only Add 5L remains.
        // BUT wait, Mul 1L and Add 5L are adjacent, so they might be fused into Add 5L!
        // Actually, Add 0L is identity. Mul 1L is identity.
        // Add 0L :: Mul 1L :: Add 5L
        // The Canonicalizer uses normalizer first, which doesn't do anything here.
        // Then fuseOps:
        // ZetaIrV4.Add 0L :: ZetaIrV4.Mul 1L :: rest
        // wait, Add 0L is an identity, it should be removed.
        // But the pattern matching in Canonicalizer is:
        // | ZetaIrV4.Add a :: ZetaIrV4.Add b -> fuse
        // | ZetaIrV4.Mul a :: ZetaIrV4.Add b -> fuse
        // | ZetaIrV4.Add 0L :: rest -> fuseOps rest
        // If it matches Add 0L, it removes it.
        // Let's just assert the result is [Add 5L]
        Assert.Equal<ZetaIrV4.Op seq>([ZetaIrV4.Add 5L], canon.Ops)

    [<Fact>]
    let ``XRotXor fusion works`` () =
        let ir = {
            ZetaIrV4.Generator = "test"
            ZetaIrV4.Version = 1
            ZetaIrV4.Width = 64
            ZetaIrV4.Ops = [ ZetaIrV4.XRotXor [1L; 2L]; ZetaIrV4.XRotXor [2L; 3L] ]
        }
        let canon = ZetaIrCanonicalizer.canonicalize ir
        Assert.Equal(1, canon.Ops.Length)
        Assert.Equal(ZetaIrV4.XRotXor [1L; 5L], canon.Ops.[0])
