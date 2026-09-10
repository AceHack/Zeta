namespace Zeta.Research

open System

/// Finite research receipts. Authentication and admission policy belong to the caller.
[<RequireQualifiedAccess>]
module RelationalIdentity =
    type Receipt =
        { EventId: string
          Actor: string
          Counterparty: string
          Interaction: string
          Channel: string
          Claim: string
          Weight: int64
          Parents: string list }

    type Occurrence = { Position: int64; Clock: int64; Receipt: Receipt; Attestation: string }
    type View = { Observer: string; Occurrences: Occurrence list }
    type Authentication = Accepted | Rejected | Unavailable
    type Refusal = InvalidInput of string | InvalidCoordinates of observer: string
    type ClaimBalance = { Actor: string; Counterparty: string; Channel: string; Claim: string; Weight: bigint }
    type Invariant = { Receipts: Receipt list; CausalPairs: (string * string) list; Claims: ClaimBalance list }
    type Readout =
        { Status: string
          Expected: string list
          MissingLeft: string list
          MissingRight: string list
          UnverifiedLeft: string list
          UnverifiedRight: string list
          RejectedLeft: string list
          RejectedRight: string list
          Conflicts: string list
          BoundaryParents: string list
          RepeatedLeft: int
          RepeatedRight: int
          Invariant: Invariant option }

    type private CheckedView =
        { View: View
          Accepted: Occurrence list
          Present: Set<string>
          Unverified: Set<string>
          Rejected: Set<string>
          Repeated: int }

    let private validId (value: string) = not (String.IsNullOrWhiteSpace value) && value.Length <= 128
    let private present (value: 'a) = not (isNull (box value))

    /// Stable parent-set encoding. Signature capabilities receive this exact typed content.
    let canonical (receipt: Receipt) = { receipt with Parents = List.distinct receipt.Parents |> List.sort }

    let private validate cut (view: View) =
        if not (validId view.Observer) || not (present view.Occurrences) || view.Occurrences.Length > 256 then
            Error(InvalidInput "view requires an observer and at most 256 occurrences")
        elif view.Occurrences |> List.exists (fun item ->
            not (present item) || not (present item.Receipt)
            || not (present item.Receipt.Parents) || item.Receipt.Parents.Length > 128
            || [ item.Receipt.EventId; item.Receipt.Actor; item.Receipt.Counterparty
                 item.Receipt.Interaction; item.Receipt.Channel; item.Receipt.Claim ] |> List.exists (validId >> not)
            || item.Receipt.Parents |> List.exists (validId >> not)
            || not (present item.Attestation) || item.Attestation.Length > 128) then
            Error(InvalidInput "receipt requires bounded typed IDs, parents and attestation")
        elif view.Occurrences |> List.exists (fun item -> not (Set.contains item.Receipt.EventId cut)) then
            Error(InvalidInput "occurrences must belong to the declared cut")
        elif view.Occurrences |> List.exists (fun item -> item.Position < 0L)
             || (view.Occurrences |> List.map _.Position |> List.distinct |> List.length) <> view.Occurrences.Length then
            Error(InvalidCoordinates view.Observer)
        else Ok view

    let private authenticate verify (view: View) =
        let items = view.Occurrences |> List.map (fun item -> { item with Receipt = canonical item.Receipt })
        let classified = items |> List.map (fun item -> item, verify item.Receipt item.Attestation)
        let ids state = classified |> List.choose (fun (item, outcome) -> if outcome = state then Some item.Receipt.EventId else None) |> Set.ofList
        let accepted = classified |> List.choose (fun (item, outcome) -> if outcome = Accepted then Some item else None)
        { View = view; Accepted = accepted; Present = items |> List.map _.Receipt.EventId |> Set.ofList
          Unverified = ids Unavailable; Rejected = ids Rejected
          Repeated = accepted.Length - (accepted |> List.map _.Receipt |> List.distinct |> List.length) }

    let private closure (receipts: Receipt list) =
        let events = receipts |> List.map _.EventId |> Set.ofList
        let initial = receipts |> List.collect (fun receipt ->
            receipt.Parents |> List.choose (fun parent -> if Set.contains parent events then Some(parent, receipt.EventId) else None)) |> Set.ofList
        let mutable pairs = initial
        for pivot in events do
            let before = pairs |> Set.filter (fun (_, target) -> target = pivot) |> Set.map fst
            let after = pairs |> Set.filter (fun (source, _) -> source = pivot) |> Set.map snd
            pairs <- Set.union pairs (seq { for source in before do for target in after do yield source, target } |> Set.ofSeq)
        pairs

    let private balances (receipts: Receipt list) =
        receipts
        |> List.groupBy (fun receipt -> receipt.Actor, receipt.Counterparty, receipt.Channel, receipt.Claim)
        |> List.choose (fun ((actor, counterparty, channel, claim), group) ->
            let weight = group |> List.sumBy (fun receipt -> bigint receipt.Weight)
            if weight.IsZero then None
            else Some { Actor = actor; Counterparty = counterparty; Channel = channel; Claim = claim; Weight = weight })
        |> List.sortBy (fun item -> item.Actor, item.Counterparty, item.Channel, item.Claim)

    let private ordered (pairs: Set<string * string>) (view: CheckedView) =
        // Replays are observations of an old event, not a new causal position for that event.
        let positions = view.Accepted |> List.groupBy (fun item -> item.Receipt.EventId)
                        |> List.map (fun (event, items) -> event, items |> List.map _.Position |> List.min) |> Map.ofList
        pairs |> Set.forall (fun (source, target) ->
            match Map.tryFind source positions, Map.tryFind target positions with
            | Some before, Some after -> before < after
            | _ -> true)

    /// Compare only the caller-declared cut. Non-detection never asserts distinctness.
    /// The supplied verifier must be total; this kernel implements no cryptographic primitive.
    let compareViews verify (expected: string list) (left: View) (right: View) =
        if not (present expected) || expected.Length > 128 || expected |> List.exists (validId >> not)
           || not (present left) || not (present right) then
            Error(InvalidInput "a cut requires at most 128 valid event IDs and two views")
        else
            let cut = Set.ofList expected
            match validate cut left, validate cut right with
            | Error error, _ | _, Error error -> Error error
            | Ok _, Ok _ ->
                let a, b = authenticate verify left, authenticate verify right
                let groups = (a.Accepted @ b.Accepted) |> List.map _.Receipt |> List.groupBy _.EventId
                let conflicts = groups |> List.choose (fun (event, items) -> if (List.distinct items).Length > 1 then Some event else None) |> List.sort
                let receipts = groups |> List.collect snd |> List.distinct |> List.sort
                let pairs = closure receipts
                let cycle = pairs |> Set.exists (fun (source, target) -> source = target)
                let boundary = receipts |> List.collect _.Parents |> Set.ofList |> fun parents -> Set.difference parents cut |> Set.toList
                let missing view = Set.difference cut view.Present |> Set.toList
                let unknown = not (Set.isSubset cut (a.Accepted |> List.map _.Receipt.EventId |> Set.ofList))
                              || not (Set.isSubset cut (b.Accepted |> List.map _.Receipt.EventId |> Set.ofList))
                              || not (List.isEmpty boundary)
                              || not (Set.isEmpty a.Unverified && Set.isEmpty b.Unverified)
                if List.isEmpty conflicts && not cycle && (not (ordered pairs a) || not (ordered pairs b)) then
                    Error(InvalidCoordinates(if not (ordered pairs a) then left.Observer else right.Observer))
                else
                    let status =
                        if not (List.isEmpty conflicts) then "authenticated-conflict"
                        elif cycle then "authenticated-causal-cycle"
                        elif not (Set.isEmpty a.Rejected && Set.isEmpty b.Rejected) then "authentication-rejected"
                        elif unknown then "unknown-coverage"
                        else "consistent-on-declared-cut"
                    Ok { Status = status; Expected = Set.toList cut
                         MissingLeft = missing a; MissingRight = missing b
                         UnverifiedLeft = Set.toList a.Unverified; UnverifiedRight = Set.toList b.Unverified
                         RejectedLeft = Set.toList a.Rejected; RejectedRight = Set.toList b.Rejected
                         Conflicts = conflicts; BoundaryParents = boundary
                         RepeatedLeft = a.Repeated; RepeatedRight = b.Repeated
                         Invariant = if status = "consistent-on-declared-cut" then Some { Receipts = receipts; CausalPairs = Set.toList pairs; Claims = balances receipts } else None }

    /// Coordinate transport is a candidate until compareViews validates the resulting chart.
    let rechart positions clocks (view: View) =
        { view with Occurrences = view.Occurrences |> List.map (fun item -> { item with Position = positions item.Position; Clock = clocks item.Clock }) }

    type Workload =
        { Identities: int
          Required: int
          Observed: int
          Missing: int
          Baseline: bigint
          Relational: bigint
          Total: bigint
          Multiplier: (bigint * bigint) option }

    /// Exact stipulated accounting, not a measured lower bound on an adaptive adversary.
    let workload (identityCosts: (string * bigint) list) (required: (string * string) list) (observed: (string * string) list) pairCost =
        if not (present identityCosts) || not (present required) || not (present observed)
           || identityCosts.Length > 64 || required.Length > 4096 || observed.Length > 4096
           || pairCost < 0I || identityCosts |> List.exists (fun (identity, cost) -> not (validId identity) || cost <= 0I)
           || (identityCosts |> List.map fst |> List.distinct |> List.length) <> identityCosts.Length then
            Error(InvalidInput "workload requires distinct identities, positive source costs and nonnegative pair cost")
        else
            let identities = identityCosts |> List.map fst |> Set.ofList
            let invalid (a, b) = a = b || not (Set.contains a identities) || not (Set.contains b identities)
            if List.exists invalid required || List.exists invalid observed then Error(InvalidInput "pair endpoints must be distinct declared identities")
            else
                let edge (a, b) = if String.CompareOrdinal(a, b) < 0 then a, b else b, a
                let needed = required |> List.map edge |> Set.ofList
                let seen = observed |> List.map edge |> Set.ofList
                if not (Set.isSubset seen needed) then Error(InvalidInput "observed obligations must belong to the declared required graph")
                else
                    let baseline = identityCosts |> List.sumBy snd
                    let relational = bigint needed.Count * pairCost
                    let total = baseline + relational
                    let multiplier =
                        if baseline.IsZero then None
                        else
                            let divisor = System.Numerics.BigInteger.GreatestCommonDivisor(total, baseline)
                            Some(total / divisor, baseline / divisor)
                    Ok { Identities = identities.Count; Required = needed.Count; Observed = seen.Count
                         Missing = Set.difference needed seen |> Set.count; Baseline = baseline
                         Relational = relational; Total = total; Multiplier = multiplier }
