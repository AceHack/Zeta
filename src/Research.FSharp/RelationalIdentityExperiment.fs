namespace Zeta.Research

open System
open Zeta.Core

/// Frozen synthetic panel. The fixture attestation table is not a signature algorithm.
[<RequireQualifiedAccess>]
module RelationalIdentityExperiment =
    module R = RelationalIdentity
    let private require = function Ok value -> value | Error error -> failwithf "fixture refused: %A" error
    let private demand condition message = if not condition then failwith message
    let private text (value: bigint) = value.ToString(Globalization.CultureInfo.InvariantCulture)

    let receipts: R.Receipt list =
        [ { EventId = "e0"; Actor = "A"; Counterparty = "B"; Interaction = "i0"; Channel = "vision"; Claim = "color"; Weight = 1L; Parents = [] }
          { EventId = "e1"; Actor = "A"; Counterparty = "B"; Interaction = "i1"; Channel = "vision"; Claim = "color"; Weight = -1L; Parents = [ "e0" ] }
          { EventId = "e2"; Actor = "B"; Counterparty = "A"; Interaction = "i0"; Channel = "vision"; Claim = "color"; Weight = 1L; Parents = [ "e0" ] }
          { EventId = "e3"; Actor = "A"; Counterparty = "B"; Interaction = "i2"; Channel = "receipt"; Claim = "ack"; Weight = 1L; Parents = [ "e1"; "e2" ] } ]

    let expected = receipts |> List.map _.EventId
    let table = receipts |> List.map (fun receipt -> R.canonical receipt, "fixture-" + receipt.EventId)
    let verify entries receipt token =
        if token = "unavailable" then R.Unavailable
        elif entries |> List.exists (fun (content, attestation) -> content = receipt && attestation = token) then R.Accepted
        else R.Rejected

    let view observer (items: R.Receipt list) : R.View =
        { Observer = observer
          Occurrences = items |> List.mapi (fun index receipt ->
              { Position = int64 index; Clock = int64 index; Receipt = receipt; Attestation = "fixture-" + receipt.EventId }) }

    type WireInvariant = { Receipts: R.Receipt[]; CausalPairs: string[][]; Claims: string[][] }
    let wire (value: R.Invariant) =
        { Receipts = List.toArray value.Receipts
          CausalPairs = value.CausalPairs |> List.map (fun (source, target) -> [| source; target |]) |> List.toArray
          Claims = value.Claims |> List.map (fun claim -> [| claim.Actor; claim.Counterparty; claim.Channel; claim.Claim; text claim.Weight |]) |> List.toArray }

    type Case =
        { Name: string; Status: string; Expected: string[]; MissingLeft: string[]; MissingRight: string[]
          UnverifiedLeft: string[]; UnverifiedRight: string[]; RejectedLeft: string[]; RejectedRight: string[]
          Conflicts: string[]; BoundaryParents: string[]; RepeatedLeft: int; RepeatedRight: int; Invariant: WireInvariant[] }

    let snapshot expected name (outcome: Result<R.Readout, R.Refusal>) =
        let empty status =
            { Name = name; Status = status; Expected = expected |> List.distinct |> List.sort |> List.toArray; MissingLeft = [||]; MissingRight = [||]
              UnverifiedLeft = [||]; UnverifiedRight = [||]; RejectedLeft = [||]; RejectedRight = [||]
              Conflicts = [||]; BoundaryParents = [||]; RepeatedLeft = 0; RepeatedRight = 0; Invariant = [||] }
        match outcome with
        | Error(R.InvalidInput _) -> empty "refused-input"
        | Error(R.InvalidCoordinates _) -> empty "refused-coordinates"
        | Ok value ->
            { Name = name; Status = value.Status; Expected = List.toArray value.Expected
              MissingLeft = List.toArray value.MissingLeft; MissingRight = List.toArray value.MissingRight
              UnverifiedLeft = List.toArray value.UnverifiedLeft; UnverifiedRight = List.toArray value.UnverifiedRight
              RejectedLeft = List.toArray value.RejectedLeft; RejectedRight = List.toArray value.RejectedRight
              Conflicts = List.toArray value.Conflicts; BoundaryParents = List.toArray value.BoundaryParents
              RepeatedLeft = value.RepeatedLeft; RepeatedRight = value.RepeatedRight
              Invariant = value.Invariant |> Option.map (wire >> Array.singleton) |> Option.defaultValue [||] }

    let rec private permutations = function
        | [] -> [ [] ]
        | items -> [ for item in items do for rest in permutations (items |> List.filter ((<>) item)) do yield item :: rest ]

    type Transport = { ArrivalOrders: int; TopologicalOrders: string[][]; Checks: int; InverseChecks: int; CompositionChecks: int; Invariant: WireInvariant }
    let transportPanel () =
        let left = view "A" receipts
        let baseline = R.compareViews (verify table) expected left left |> require
        let invariant = baseline.Invariant |> Option.defaultWith (fun () -> failwith "missing baseline invariant")
        let arrivals = permutations expected
        let topologies = arrivals |> List.filter (fun order ->
            let positions = order |> List.mapi (fun index event -> event, index) |> Map.ofList
            receipts |> List.forall (fun receipt -> receipt.Parents |> List.forall (fun parent -> positions.[parent] < positions.[receipt.EventId])))
        let byId = receipts |> List.map (fun receipt -> receipt.EventId, receipt) |> Map.ofList
        let mutable checks = 0
        for order in topologies do
            let original = view "B" (order |> List.map (fun event -> byId.[event]))
            let byEvent = original.Occurrences |> List.map (fun item -> item.Receipt.EventId, item) |> Map.ofList
            for arrival in arrivals do
                let shuffled = { original with Occurrences = arrival |> List.map (fun event -> byEvent.[event]) }
                for offset in [ -1000L; 0L; 1000L ] do
                    for scale in [ 1L; 7L ] do
                        let moved = R.rechart (fun p -> 3L * p + 5L) (fun t -> offset + scale * t) shuffled
                        let compared = R.compareViews (verify table) expected left moved |> require
                        demand (compared.Invariant = Some invariant) "valid chart changed invariant"
                        let restored = R.rechart (fun p -> (p - 5L) / 3L) (fun t -> (t - offset) / scale) moved
                        demand (restored = shuffled) "transport inverse failed"
                        let successive = moved |> R.rechart ((+) 3L) ((+) 11L) |> R.rechart ((*) 7L) ((*) 5L)
                        let direct = moved |> R.rechart (fun p -> 7L * (p + 3L)) (fun t -> 5L * (t + 11L))
                        demand (successive = direct) "transport composition failed"
                        demand ((R.compareViews (verify table) expected left direct |> require).Invariant = Some invariant) "composed chart changed invariant"
                        checks <- checks + 1
        { ArrivalOrders = arrivals.Length; TopologicalOrders = topologies |> List.map List.toArray |> List.toArray
          Checks = checks; InverseChecks = checks; CompositionChecks = checks; Invariant = wire invariant }

    let mutationPanel () =
        let left, right = view "A" receipts, view "B" receipts
        let update event change (value: R.View) = { value with Occurrences = value.Occurrences |> List.map (fun item -> if item.Receipt.EventId = event then change item else item) }
        let omit event (value: R.View) = { value with Occurrences = value.Occurrences |> List.filter (fun item -> item.Receipt.EventId <> event) }
        let run name entries cut a b = R.compareViews (verify entries) cut a b |> snapshot cut name
        let changed = { receipts.[2] with Claim = "green" }
        let forked = update "e2" (fun item -> { item with Receipt = changed; Attestation = "fixture-fork" }) right
        let forkTable = (changed, "fixture-fork") :: table
        let cyclic = { receipts.[0] with Parents = [ "e3" ] }
        let cycleTable = (cyclic, "fixture-cycle") :: table
        let cycle value = update "e0" (fun item -> { item with Receipt = cyclic; Attestation = "fixture-cycle" }) value
        let boundary = { receipts.[0] with Parents = [ "outside" ] }
        let boundaryTable = (boundary, "fixture-boundary") :: table
        let openCut value = update "e0" (fun item -> { item with Receipt = boundary; Attestation = "fixture-boundary" }) value
        let alternate = { receipts.[2] with EventId = "e4"; Channel = "auditory" }
        let extended = receipts @ [ alternate ]
        let extraTable = (alternate, "fixture-e4") :: table
        let fabricated: R.Receipt list =
            [ for a in 0..3 do
                for b in a+1..3 do
                    for actor, counterparty in [(a,b);(b,a)] do
                        yield { EventId = sprintf "f%d-%d" actor counterparty; Actor = sprintf "fake%d" actor
                                Counterparty = sprintf "fake%d" counterparty; Interaction = sprintf "pair%d-%d" a b
                                Channel = "fixture"; Claim = "exchange"; Weight = 1L; Parents = [] } ]
        let fabricatedTable = fabricated |> List.map (fun receipt -> receipt,"fixture-"+receipt.EventId)
        [| run "baseline" table expected left right
           run "identical-replay" table expected left { right with Occurrences = right.Occurrences @ [ { right.Occurrences.Head with Position = 10L; Clock = 99L } ] }
           run "changed-payload-old-attestation" table expected left (update "e2" (fun item -> { item with Receipt = changed }) right)
           run "substituted-key" table expected left (update "e2" (fun item -> { item with Receipt = { item.Receipt with Actor = "C" } }) right)
           run "authenticated-fork" forkTable expected left forked
           run "authenticated-causal-cycle" cycleTable expected (cycle left) (cycle right)
           run "missing-parent" table expected left (omit "e0" right)
           run "omitted-expected-event" table expected left (omit "e3" right)
           run "unavailable-verifier" table expected left (update "e2" (fun item -> { item with Attestation = "unavailable" }) right)
           run "conflict-with-missing-coverage" forkTable expected left (omit "e3" forked)
           run "different-observation-channel" extraTable (expected @ [ "e4" ]) (view "A" extended) (view "B" extended)
           run "coherent-fabricated-counterparties" table expected left right
           run "coherent-fabricated-complete-graph" fabricatedTable (fabricated |> List.map _.EventId) (view "A" fabricated) (view "B" fabricated)
           run "unverified-alternative-with-covered-id" table expected left
               { right with Occurrences = right.Occurrences @ [ { right.Occurrences.[2] with Position = 10L; Receipt = changed; Attestation = "unavailable" } ] }
           run "open-causal-boundary" boundaryTable expected (openCut left) (openCut right)
           run "causal-coordinate-reversal" table expected left (R.rechart (fun p -> 3L - p) id right)
           run "coordinate-collision" table expected left (R.rechart (fun _ -> 0L) id right)
           run "empty-cut" [] [] (view "A" []) (view "B" []) |]

    type Entropy = { Name: string; Outcomes: int[][]; MaximumProbability: string[]; JointMinEntropyBits: int; PairwiseIndependent: bool; OneBitConditionalPremise: bool }
    let entropyPanel () =
        let panels =
            [ "independent", [| for a in 0..1 do for b in 0..1 do for c in 0..1 do yield [|a;b;c|] |]
              "copies", [| for a in 0..1 do yield [|a;a;a|] |]
              "inversion", [| for a in 0..1 do yield [|a;1-a;a|] |]
              "pairwise-independent-xor", [| for a in 0..1 do for b in 0..1 do yield [|a;b;a ^^^ b|] |] ]
        panels |> List.map (fun (name, rows) ->
            let n = rows.Length
            let maxCount = rows |> Array.countBy id |> Array.map snd |> Array.max
            let gcd = System.Numerics.BigInteger.GreatestCommonDivisor(bigint maxCount, bigint n) |> int
            let pairwise =
                [ for a in 0..2 do
                    for b in a+1..2 do
                      yield [0..1] |> List.forall (fun x -> [0..1] |> List.forall (fun y ->
                        let cx = rows |> Array.filter (fun row -> row.[a] = x) |> Array.length
                        let cy = rows |> Array.filter (fun row -> row.[b] = y) |> Array.length
                        let both = rows |> Array.filter (fun row -> row.[a] = x && row.[b] = y) |> Array.length
                        both * n = cx * cy)) ] |> List.forall id
            let premise = [0..2] |> List.forall (fun column ->
                rows |> Array.groupBy (fun row -> row |> Array.take column) |> Array.forall (fun (_, group) ->
                    group |> Array.countBy (fun row -> row.[column]) |> Array.forall (fun (_, count) -> 2 * count <= group.Length)))
            let mutable ratio = n / maxCount
            let mutable bits = 0
            while ratio > 1 do ratio <- ratio / 2; bits <- bits + 1
            { Name = name; Outcomes = rows; MaximumProbability = [| string (maxCount / gcd); string (n / gcd) |]
              JointMinEntropyBits = bits; PairwiseIndependent = pairwise; OneBitConditionalPremise = premise }) |> List.toArray

    type Scaling = { Name: string; Identities: int; Required: int; Observed: int; Missing: int; Baseline: string; Relational: string; Total: string; Multiplier: string[] }
    let scalingPanel () =
        [| for n in [ 0;1;2;3;4;8;16;32;64 ] do
            let identities = [ for i in 0..n-1 -> string i, 32I ]
            for shape in [ "empty";"complete";"path";"star";"cycle" ] do
                let pairs =
                    match shape with
                    | "complete" -> [ for a in 0..n-1 do for b in a+1..n-1 do yield string a, string b ]
                    | "path" -> [ for i in 0..n-2 -> string i, string (i+1) ]
                    | "star" -> [ for i in 1..n-1 -> "0", string i ]
                    | "cycle" when n >= 3 -> [ for i in 0..n-1 -> string i, string ((i+1) % n) ]
                    | _ -> []
                let observed = if List.isEmpty pairs then [] else List.tail pairs
                let value = R.workload identities pairs observed 8I |> require
                let duplicate = R.workload identities (pairs @ (pairs |> List.map (fun (a,b) -> b,a))) observed 8I |> require
                demand (value = duplicate) "duplicate obligation changed workload"
                let rename value = "renamed-" + value
                let relabeled = R.workload (identities |> List.map (fun (key,cost) -> rename key,cost))
                                           (pairs |> List.map (fun (a,b) -> rename a,rename b))
                                           (observed |> List.map (fun (a,b) -> rename a,rename b)) 8I |> require
                demand (value = relabeled) "identity relabeling changed workload"
                yield { Name = sprintf "%s-%d" shape n; Identities = n; Required = value.Required; Observed = value.Observed; Missing = value.Missing
                        Baseline = text value.Baseline; Relational = text value.Relational; Total = text value.Total
                        Multiplier = value.Multiplier |> Option.map (fun (a,b) -> [|text a;text b|]) |> Option.defaultValue [||] } |]

    type Baseline =
        { Name: string; SharedController: bool; BitsA: int[]; BitsB: int[]; ChshA: AntiSybil.ChshRound[]; ChshB: AntiSybil.ChshRound[]
          Correlation: float; ReplayFlag: bool; SignatureOnly: string; ReceiptStatus: string; Spectrum: float[]
          ReplayFalsePositive: bool; ReplayFalseNegative: bool }
    let baselinePanel () =
        let a = [ 0;0;1;1;0;0;1;1 ]
        let streamA : AntiSybil.ChshRound list = [ for index in 0..7 -> { Setting = (index / 2) % 2; Outcome = 1 } ]
        let localB : AntiSybil.ChshRound list = [ for index in 0..7 -> { Setting = index % 2; Outcome = 1 } ]
        let conductedB : AntiSybil.ChshRound list = [ for index in 0..7 -> { Setting = index % 2; Outcome = if index % 4 = 1 then -1 else 1 } ]
        let cases =
            [ "exact-replay", true, a, localB
              "inverted-replay", true, a |> List.map (fun x -> 1-x), localB
              "shared-seed-orthogonal-code", true, [0;1;0;1;0;1;0;1], localB
              "independent-finite-collision", false, a, localB
              "distinct-controller-transcript", false, [0;1;0;1;0;1;0;1], localB
              "one-controller-same-transcript", true, [0;1;0;1;0;1;0;1], localB
              "conducted-chsh", true, [0;1;0;1;0;1;0;1], conductedB ]
        let left, right = view "A" receipts, view "B" receipts
        let status = (R.compareViews (verify table) expected left right |> require).Status
        let signatureOnly =
            if (left.Occurrences @ right.Occurrences) |> List.forall (fun item -> verify table (R.canonical item.Receipt) item.Attestation = R.Accepted)
            then "accepted" else "rejected"
        cases |> List.map (fun (name, shared, b, chshB) ->
            let correlation = AntiSybil.correlation a b
            let flag = correlation >= 0.8
            { Name = name; SharedController = shared; BitsA = List.toArray a; BitsB = List.toArray b
              ChshA = List.toArray streamA; ChshB = List.toArray chshB; Correlation = correlation; ReplayFlag = flag
              SignatureOnly = signatureOnly; ReceiptStatus = status; Spectrum = CoordinationSpectrum.ofClaims [ streamA; chshB ]
              ReplayFalsePositive = flag && not shared; ReplayFalseNegative = shared && not flag }) |> List.toArray
