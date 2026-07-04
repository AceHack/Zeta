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


// ── 1-to-1 F# Translation of the schema_evolution.als Alloy Proofs ──

type FSharpSchemaEntry = { Name: string; Weight: int }
type FSharpSchemaZSet = { Entries: FSharpSchemaEntry list }
type FSharpConsumer = { Refs: Set<string> }

let activeFields (s: FSharpSchemaZSet) : Set<string> =
    s.Entries 
    |> List.filter (fun e -> e.Weight > 0)
    |> List.map (fun e -> e.Name)
    |> Set.ofList

let refCount (f: string) (consumers: FSharpConsumer list) : int =
    consumers |> List.filter (fun c -> c.Refs.Contains f) |> List.length

let safety (s: FSharpSchemaZSet) (consumers: FSharpConsumer list) (overlapOpen: int) : bool =
    let active = activeFields s
    consumers |> List.forall (fun c ->
        c.Refs |> Set.forall (fun f ->
            active.Contains f || overlapOpen > 0
        )
    )

let canConsolidate (s: FSharpSchemaZSet) (consumers: FSharpConsumer list) : bool =
    s.Entries 
    |> List.filter (fun e -> e.Weight <= 0)
    |> List.forall (fun e -> refCount e.Name consumers = 0)

let consumerRefsAreValid (s: FSharpSchemaZSet) (consumers: FSharpConsumer list) : bool =
    let allSchemaFields = s.Entries |> List.map (fun e -> e.Name) |> Set.ofList
    consumers |> List.forall (fun c ->
        c.Refs |> Set.forall (fun f -> allSchemaFields.Contains f)
    )

[<Property>]
let ``Alloy safety proof: SafetyHolds check (overlapOpen = 1 always guarantees safety)`` (entries: (string * int) list) (consumerRefs: string list list) =
    let s = { Entries = entries |> List.map (fun (n, w) -> { Name = n; Weight = w }) }
    let consumers = consumerRefs |> List.map (fun r -> { Refs = Set.ofList r })
    safety s consumers 1

[<Property>]
let ``Alloy safety proof: ConsolidateSafe check (canConsolidate implies safety with overlapOpen = 0)`` (entries: (string * int) list) (consumerRefs: string list list) =
    let s = { Entries = entries |> List.map (fun (n, w) -> { Name = n; Weight = w }) }
    let consumers = consumerRefs |> List.map (fun r -> { Refs = Set.ofList r })
    
    if consumerRefsAreValid s consumers && canConsolidate s consumers then
        safety s consumers 0
    else
        true
