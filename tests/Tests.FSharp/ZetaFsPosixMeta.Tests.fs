module Zeta.Tests.ZetaFsPosixMetaTests

open System
open global.Xunit
open Zeta.Core

[<Fact>]
let ``unixNs is milliseconds times one million from the injected clock`` () =
    let env = Environment.createVirtual 4L :> ISimulationEnvironment
    Assert.Equal(0L, ZetaFsPosixMeta.unixNs env)
    let atOne =
        Environment.createVirtualAt (DateTimeOffset.FromUnixTimeSeconds 1L) 4L
        :> ISimulationEnvironment
    Assert.Equal(1_000_000_000L, ZetaFsPosixMeta.unixNs atOne)

[<Fact>]
let ``omitted setattr times stamp from nowNs; caller times are kept`` () =
    let id =
        ZetaFsNamespace.EntityId.mint (
            ZetaFsNamespace.Entropy(fun () -> 1L)
        )
    let born = ZetaFsPosixMeta.born id ZetaFsNamespace.EntityKind.File 10L
    let touched =
        ZetaFsPosixMeta.apply born ZetaFsPosixMeta.emptyPatch 20L
    Assert.Equal(20L, touched.MtimeNs)
    Assert.Equal(20L, touched.CtimeNs)
    Assert.Equal(ZetaFsPosixMeta.fileMode, touched.Mode)
    let patched =
        ZetaFsPosixMeta.apply
            born
            { ZetaFsPosixMeta.emptyPatch with
                Mode = Some 0o100600u
                MtimeNs = Some 42L
                CtimeNs = Some 43L }
            99L
    Assert.Equal(0o100600u, patched.Mode)
    Assert.Equal(42L, patched.MtimeNs)
    Assert.Equal(43L, patched.CtimeNs)
