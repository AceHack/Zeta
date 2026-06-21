namespace Zeta.Core.Tests

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.ZetaIrNormalizer

module NormalizerProperties =

    [<Property>]
    let ``normalizeOp produces only core-four ops`` (op: ZetaIrV4.Op) =
        let norm = normalizeOp op
        isCoreOp norm

    [<Property>]
    let ``normalizeOp is idempotent`` (op: ZetaIrV4.Op) =
        let norm1 = normalizeOp op
        let norm2 = normalizeOp norm1
        norm1 = norm2

    [<Property>]
    let ``normalizeOp preserves denotation over uint64`` (op: ZetaIrV4.Op) (state: uint64) =
        let expected = evalOp64 op state
        let actual = evalOp64 (normalizeOp op) state
        expected = actual

    [<Property>]
    let ``normalizeOp preserves denotation over uint32`` (op: ZetaIrV4.Op) (state: uint32) =
        let expected = evalOp32 op state
        let actual = evalOp32 (normalizeOp op) state
        expected = actual

    [<Fact>]
    let ``normalize program preserves denotation on frozen generators`` () =
        let ir = ZetaIrV4.lcg64_mmix
        let norm = normalize ir
        Assert.Equal(ir.Generator, norm.Generator)
        Assert.Equal(ir.Version, norm.Version)
        Assert.Equal(ir.Width, norm.Width)

    [<Fact>]
    let ``normalize program lowers all ops`` () =
        // fmix32 uses XorShr which must be lowered.
        // We'll construct a synthetic program with all ops to test the full fold.
        let ir = {
            ZetaIrV4.Generator = "test.synthetic"
            ZetaIrV4.Version = 4
            ZetaIrV4.Width = 64
            ZetaIrV4.Ops = [
                ZetaIrV4.Mul 5L
                ZetaIrV4.XorShr 33L
                ZetaIrV4.Rotl 17L
                ZetaIrV4.Add 42L
            ]
        }
        let norm = normalize ir
        Assert.True(norm.Ops |> List.forall isCoreOp)
        Assert.Equal<ZetaIrV4.Op list>(
            [
                ZetaIrV4.Mul 5L
                ZetaIrV4.XShrXor [33L]
                ZetaIrV4.XRotXor [0L; 17L]
                ZetaIrV4.Add 42L
            ],
            norm.Ops
        )
