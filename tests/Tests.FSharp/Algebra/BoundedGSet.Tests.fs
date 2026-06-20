module Zeta.Tests.Algebra.BoundedGSetTests

open System.Globalization
open System.IO
open System.Reflection
open System.Text.Json
open System.Text.Json.Nodes
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

let private rejectNew3 =
    { Capacity = 3
      ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

let private forgetHighest3 =
    { Capacity = 3
      ForgetPolicy = BoundedGSetForgetPolicy.ForgetHighest }

let private forgetLowest3 =
    { Capacity = 3
      ForgetPolicy = BoundedGSetForgetPolicy.ForgetLowest }

let private moduloReject4 =
    { Slots = 4
      CollisionPolicy = ModuloGSetCollisionPolicy.RejectCollision }

let private moduloReplace4 =
    { Slots = 4
      CollisionPolicy = ModuloGSetCollisionPolicy.ReplaceExisting }

let private unwrap =
    function
    | Ok value -> value
    | Error error -> failwithf "unexpected bounded GSet error: %A" error

let private unwrapModulo =
    function
    | Ok value -> value
    | Error error -> failwithf "unexpected modulo GSet error: %A" error

let private projectInts config values =
    BoundedGSet.ofSeq<int> config values |> unwrap

let private ofInts config values =
    (projectInts config values).State

[<Fact>]
let ``invalid capacity returns feedback instead of throwing`` () =
    let config =
        { Capacity = 0
          ForgetPolicy = BoundedGSetForgetPolicy.RejectNew }

    match BoundedGSet.empty<int> config with
    | Error(BoundedGSetError.NonPositiveCapacity 0) -> ()
    | other -> failwithf "expected NonPositiveCapacity feedback, got %A" other

[<Fact>]
let ``invalid modulo slots return feedback instead of throwing`` () =
    let config =
        { Slots = 0
          CollisionPolicy = ModuloGSetCollisionPolicy.RejectCollision }

    match ModuloGSet.empty<int> config with
    | Error(ModuloGSetError.NonPositiveSlots 0) -> ()
    | other -> failwithf "expected NonPositiveSlots feedback, got %A" other

[<Fact>]
let ``reject-new policy backpressures instead of forgetting`` () =
    match BoundedGSet.ofSeq<int> rejectNew3 [ 1; 2; 3; 4 ] with
    | Error(BoundedGSetError.CapacityExceeded(capacity, count)) ->
        capacity |> should equal 3
        count |> should equal 4
    | other -> failwithf "expected CapacityExceeded feedback, got %A" other

[<Fact>]
let ``forget policies keep the configured side and report heat`` () =
    let values = [ 5; 1; 4; 2; 3; 3 ]

    let keepLowest = projectInts forgetHighest3 values
    keepLowest.State |> BoundedGSet.toList |> should equal [ 1; 2; 3 ]
    keepLowest.Heat.Forgotten |> GSet.toList |> should equal [ 4; 5 ]
    keepLowest.Heat.Units |> should equal 2

    let keepHighest = projectInts forgetLowest3 values
    keepHighest.State |> BoundedGSet.toList |> should equal [ 3; 4; 5 ]
    keepHighest.Heat.Forgotten |> GSet.toList |> should equal [ 1; 2 ]
    keepHighest.Heat.Units |> should equal 2

[<Fact>]
let ``cold add reports backpressure with no heat`` () =
    let full = ofInts rejectNew3 [ 3; 4; 5 ]

    let result = BoundedGSet.add 6 full |> unwrap
    result.Admission |> should equal BoundedGSetAdmission.RejectedByBound
    result.State |> BoundedGSet.toList |> should equal [ 3; 4; 5 ]
    Assert.Empty(result.Heat.Forgotten |> GSet.toList)
    result.Heat.Units |> should equal 0

[<Fact>]
let ``rolling add reports admission rejection and forgetting heat`` () =
    let full = ofInts forgetLowest3 [ 3; 4; 5 ]

    let low = BoundedGSet.add 2 full |> unwrap
    low.Admission |> should equal BoundedGSetAdmission.RejectedByBound
    low.State |> BoundedGSet.toList |> should equal [ 3; 4; 5 ]
    Assert.Equal<int list>([], GSet.toList low.Heat.Forgotten)
    low.Heat.Units |> should equal 0

    let high = BoundedGSet.add 6 full |> unwrap
    high.Admission |> should equal BoundedGSetAdmission.Admitted
    high.State |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    high.Heat.Forgotten |> GSet.toList |> should equal [ 3 ]
    high.Heat.Units |> should equal 1

    let duplicate = BoundedGSet.add 5 high.State |> unwrap
    duplicate.Admission |> should equal BoundedGSetAdmission.AlreadyPresent
    duplicate.State |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    Assert.Equal<int list>([], GSet.toList duplicate.Heat.Forgotten)
    duplicate.Heat.Units |> should equal 0

[<Fact>]
let ``bounded union is idempotent and associative for one projection policy`` () =
    let a = ofInts forgetLowest3 [ 1; 5 ]
    let b = ofInts forgetLowest3 [ 2; 4 ]
    let c = ofInts forgetLowest3 [ 3; 6 ]

    BoundedGSet.union a a
    |> unwrap
    |> fun projection -> projection.State
    |> should equal a

    let left =
        BoundedGSet.union a b
        |> unwrap
        |> fun ab ->
            BoundedGSet.union ab.State c
            |> unwrap

    let right =
        BoundedGSet.union b c
        |> unwrap
        |> fun bc ->
            BoundedGSet.union a bc.State
            |> unwrap

    left.State |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    right.State |> BoundedGSet.toList |> should equal [ 4; 5; 6 ]
    left.State |> should equal right.State
    left.Heat.Units |> should equal 2
    right.Heat.Units |> should equal 2

[<Fact>]
let ``bounded union rejects mismatched projection policies`` () =
    let low = ofInts forgetHighest3 [ 1; 2; 3 ]
    let high = ofInts forgetLowest3 [ 4; 5; 6 ]

    match BoundedGSet.union low high with
    | Error(BoundedGSetError.ConfigMismatch(left, right)) ->
        left |> should equal forgetHighest3
        right |> should equal forgetLowest3
    | other -> failwithf "expected ConfigMismatch feedback, got %A" other

[<Fact>]
let ``bounded heat adapter exports forgotten finite-view loss to host sink`` () =
    let projection = projectInts forgetLowest3 [ 1; 2; 3; 4 ]
    let sink = RecordingHeatSink()

    match
        BoundedHeat.emit
            (sink :> IHeatSink)
            "bounded-gset-room"
            "bounded-gset.forgotten"
            "finite room projection forgot materialized keys"
            projection.Heat
    with
    | Error feedback -> Assert.Fail(sprintf "unexpected heat sink feedback: %A" feedback)
    | Ok () ->
        let signatures = sink.Signatures |> Seq.toList
        Assert.Single(signatures) |> ignore
        Assert.Equal("bounded-gset-room", signatures.Head.Source)
        Assert.Equal("bounded-gset.forgotten", signatures.Head.Kind)
        Assert.Equal(1, signatures.Head.Units)
        Assert.Equal(1_000_000L, signatures.Head.MassPpm)

[<Fact>]
let ``bounded heat adapter keeps empty heat cold`` () =
    let sink = RecordingHeatSink()

    match BoundedHeat.emit (sink :> IHeatSink) "bounded-gset-room" "bounded-gset.forgotten" "nothing forgotten" BoundedGSet.emptyHeat<int> with
    | Error feedback -> Assert.Fail(sprintf "unexpected heat sink feedback: %A" feedback)
    | Ok () -> Assert.Empty(sink.Signatures)

[<Fact>]
let ``modulo GSet rejects collisions without forgetting`` () =
    let start = ModuloGSet.empty<int> moduloReject4 |> unwrapModulo

    let first = ModuloGSet.add (fun value -> int64 value) 1 start |> unwrapModulo
    first.Admission |> should equal ModuloGSetAdmission.Admitted
    first.Slot |> should equal 1
    first.State |> ModuloGSet.toList |> should equal [ 1 ]

    let collision = ModuloGSet.add (fun value -> int64 value) 5 first.State |> unwrapModulo
    collision.Admission |> should equal ModuloGSetAdmission.RejectedByCollision
    collision.Slot |> should equal 1
    collision.State |> ModuloGSet.toList |> should equal [ 1 ]
    Assert.Empty(collision.Heat.Forgotten |> GSet.toList)
    collision.Heat.Units |> should equal 0

[<Fact>]
let ``modulo GSet replacement emits forgotten occupant as heat`` () =
    let start = ModuloGSet.empty<string> moduloReplace4 |> unwrapModulo

    let old = ModuloGSet.addWithSlot -1L "old" start |> unwrapModulo
    old.Admission |> should equal ModuloGSetAdmission.Admitted
    old.Slot |> should equal 3

    let replaced = ModuloGSet.addWithSlot 7L "new" old.State |> unwrapModulo
    replaced.Admission |> should equal ModuloGSetAdmission.Replaced
    replaced.Slot |> should equal 3
    replaced.State |> ModuloGSet.toSlotList |> should equal [ 3, "new" ]
    replaced.Heat.Forgotten |> GSet.toList |> should equal [ "old" ]
    replaced.Heat.Units |> should equal 1

[<Fact>]
let ``modulo GSet projection from GSet is deterministic and bounded`` () =
    let source = GSet.ofSeq [ 3; 0; 1; 0 ]

    let projected =
        ModuloGSet.ofGSet (fun value -> int64 (value % 3)) { moduloReplace4 with Slots = 3 } source
        |> unwrapModulo

    projected.State |> ModuloGSet.toSlotList |> should equal [ 0, 3; 1, 1 ]
    projected.State |> ModuloGSet.toList |> should equal [ 1; 3 ]
    projected.Heat.Forgotten |> GSet.toList |> should equal [ 0 ]
    projected.Heat.Units |> should equal 1
    projected.Rejected |> should equal 0

[<Fact>]
let ``modulo GSet projection counts cold collision backpressure`` () =
    let projected =
        ModuloGSet.ofSeq (fun value -> int64 (value % 2)) { moduloReject4 with Slots = 2 } [ 0; 2; 4; 1 ]
        |> unwrapModulo

    projected.State |> ModuloGSet.toSlotList |> should equal [ 0, 0; 1, 1 ]
    projected.State |> ModuloGSet.toList |> should equal [ 0; 1 ]
    Assert.Empty(projected.Heat.Forgotten |> GSet.toList)
    projected.Heat.Units |> should equal 0
    projected.Rejected |> should equal 2

let private repoRoot () : string =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln) from test assembly location."
    dir.FullName

let private moduloPolicy (value: string) : ModuloGSetCollisionPolicy =
    match value with
    | "reject-collision" -> ModuloGSetCollisionPolicy.RejectCollision
    | "replace-existing" -> ModuloGSetCollisionPolicy.ReplaceExisting
    | other -> failwithf "unknown modulo-gset collision policy: %s" other

let private moduloConfig (element: JsonElement) : ModuloGSetConfig =
    let config = element.GetProperty("config")
    { Slots = config.GetProperty("slots").GetInt32()
      CollisionPolicy = moduloPolicy (config.GetProperty("collisionPolicy").GetString()) }

let private admissionName (admission: ModuloGSetAdmission) : string =
    match admission with
    | ModuloGSetAdmission.Admitted -> "admitted"
    | ModuloGSetAdmission.AlreadyPresent -> "already-present"
    | ModuloGSetAdmission.Replaced -> "replaced"
    | ModuloGSetAdmission.RejectedByCollision -> "rejected-by-collision"

let private combineModuloHeat (left: BoundedGSetHeat<string>) (right: BoundedGSetHeat<string>) : BoundedGSetHeat<string> =
    { Forgotten = GSet.union left.Forgotten right.Forgotten
      Units = left.Units + right.Units }

let private jsonArray (nodes: JsonNode seq) : JsonArray =
    let array = JsonArray()
    for node in nodes do
        array.Add(node)
    array

let private stringArray (values: string list) : JsonArray =
    values |> Seq.map (fun value -> JsonValue.Create(value) :> JsonNode) |> jsonArray

let private slotArray (slots: (int * string) list) : JsonArray =
    slots
    |> Seq.map (fun (slot, value) ->
        let node = JsonObject()
        node["slot"] <- JsonValue.Create(slot)
        node["value"] <- JsonValue.Create(value)
        node :> JsonNode)
    |> jsonArray

let private admissionArray (admissions: (string * int) list) : JsonArray =
    admissions
    |> Seq.map (fun (admission, slot) ->
        let node = JsonObject()
        node["admission"] <- JsonValue.Create(admission)
        node["slot"] <- JsonValue.Create(slot)
        node :> JsonNode)
    |> jsonArray

let private errorOutput (error: ModuloGSetError) : JsonObject =
    let node = JsonObject()
    match error with
    | ModuloGSetError.NonPositiveSlots slots ->
        node["error"] <- JsonValue.Create("non-positive-slots")
        node["slots"] <- JsonValue.Create(slots)
    node

let private stateOutput
    (state: ModuloGSet<string>)
    (heat: BoundedGSetHeat<string>)
    (rejected: int)
    (admissions: (string * int) list)
    : JsonObject =
    let node = JsonObject()
    node["admissions"] <- admissionArray admissions
    node["exterior"] <- stringArray (ModuloGSet.toList state)
    node["heatForgotten"] <- stringArray (GSet.toList heat.Forgotten)
    node["heatUnits"] <- JsonValue.Create(heat.Units)
    node["rejected"] <- JsonValue.Create(rejected)
    node["stateSlots"] <- slotArray (ModuloGSet.toSlotList state)
    node

let private replayOps (vector: JsonElement) : JsonNode =
    let config = moduloConfig vector
    match ModuloGSet.empty<string> config with
    | Error error -> errorOutput error :> JsonNode
    | Ok start ->
        let mutable state = start
        let mutable heat = ModuloGSet.emptyHeat<string>
        let mutable rejected = 0
        let admissions = ResizeArray<string * int>()
        let mutable error: ModuloGSetError option = None

        for op in vector.GetProperty("ops").EnumerateArray() do
            if Option.isNone error then
                match ModuloGSet.addWithSlot (op.GetProperty("slot").GetInt64()) (op.GetProperty("value").GetString()) state with
                | Error e -> error <- Some e
                | Ok added ->
                    state <- added.State
                    heat <- combineModuloHeat heat added.Heat
                    if added.Admission = ModuloGSetAdmission.RejectedByCollision then
                        rejected <- rejected + 1
                    admissions.Add(admissionName added.Admission, added.Slot)

        match error with
        | Some e -> errorOutput e :> JsonNode
        | None -> stateOutput state heat rejected (Seq.toList admissions) :> JsonNode

let private stringList (element: JsonElement) : string list =
    [ for value in element.EnumerateArray() -> value.GetString() ]

let private replayFromGSet (vector: JsonElement) : JsonNode =
    let config = moduloConfig vector
    let slotOf (value: string) =
        int64 (System.Int32.Parse(value, NumberStyles.Integer, CultureInfo.InvariantCulture))

    let source = vector.GetProperty("sourceValues") |> stringList |> GSet.ofSeq
    match ModuloGSet.ofGSet slotOf config source with
    | Error error -> errorOutput error :> JsonNode
    | Ok projected -> stateOutput projected.State projected.Heat projected.Rejected [] :> JsonNode

let private replayModuloVector (vector: JsonElement) : JsonNode =
    match vector.GetProperty("mode").GetString() with
    | "ops" -> replayOps vector
    | "from-gset" -> replayFromGSet vector
    | other -> failwithf "unknown modulo-gset vector mode: %s" other

[<Fact>]
let ``F# replays modulo GSet treaty vectors and committed oracle output`` () =
    let root = repoRoot ()
    let vectorsPath = Path.Join(root, "tests", "cross-verification", "modulo-gset", "vectors.json")
    let outputPath = Path.Join(root, "tests", "cross-verification", "modulo-gset", "fsharp-output.json")

    use vectorsDoc = JsonDocument.Parse(File.ReadAllText(vectorsPath))
    use outputDoc = JsonDocument.Parse(File.ReadAllText(outputPath))

    Assert.Equal("hand-port", outputDoc.RootElement.GetProperty("_source").GetString())

    for vector in vectorsDoc.RootElement.GetProperty("vectors").EnumerateArray() do
        let id = vector.GetProperty("id").GetString()
        let expected = JsonNode.Parse(vector.GetProperty("expected").GetRawText())
        let actual = replayModuloVector vector
        let committed = JsonNode.Parse(outputDoc.RootElement.GetProperty(id).GetRawText())

        Assert.True(JsonNode.DeepEquals(expected, actual), sprintf "computed F# output diverged for %s" id)
        Assert.True(JsonNode.DeepEquals(expected, committed), sprintf "committed F# output diverged for %s" id)
