module Zeta.Tests.EvolutionWindowTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module EW = Zeta.Core.EvolutionWindow

// The backward-projection constraint mechanized: expand-into vN is safe iff every live reader is >= vN.

[<Fact>]
let ``no readers => expand-into anything is vacuously safe`` () =
    Assert.True(EW.mayExpandInto 5 EW.empty)
    Assert.Equal<Result<unit, string>>(Ok(), EW.guardExpandInto 5 EW.empty)
    Assert.Equal(None, EW.minLiveVersion EW.empty)

[<Fact>]
let ``an older live reader blocks expand-into; guard names it`` () =
    let w = EW.empty |> EW.readerJoins 1 |> EW.readerJoins 3
    Assert.False(EW.mayExpandInto 2 w) // reader at v1 < 2 blocks
    Assert.Equal(Some 1, EW.minLiveVersion w)
    match EW.guardExpandInto 2 w with
    | Error msg -> Assert.Contains("v1", msg)
    | Ok () -> Assert.Fail "expected the v1 reader to block expand-into v2"

[<Fact>]
let ``after the old reader leaves (contract), expand-into becomes safe`` () =
    let w = EW.empty |> EW.readerJoins 1 |> EW.readerJoins 2
    Assert.False(EW.mayExpandInto 2 w)
    let w2 = EW.readerLeaves 1 w // contract: retire the v1 reader
    Assert.True(EW.mayExpandInto 2 w2)
    Assert.Equal<Result<unit, string>>(Ok(), EW.guardExpandInto 2 w2)

[<Property>]
let ``law: mayExpandInto targetV iff every live reader >= targetV`` (readers: int list) (targetV: int) =
    let w = readers |> List.fold (fun acc v -> EW.readerJoins v acc) EW.empty
    EW.mayExpandInto targetV w = (readers |> List.forall (fun v -> v >= targetV))

[<Property>]
let ``law: guardExpandInto is Ok exactly when mayExpandInto is true`` (readers: int list) (targetV: int) =
    let w = readers |> List.fold (fun acc v -> EW.readerJoins v acc) EW.empty
    (EW.guardExpandInto targetV w = Ok()) = EW.mayExpandInto targetV w
