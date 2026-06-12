namespace Zeta.Core

/// CapabilityLedger — **the resolver over the capability ledgers** (Aaron 2026-06-11: "keep a
/// list of capabilities generically — which ones are supported on which systems and languages —
/// so we know what to INJECT"; ratified 2026-06-12: "sounds good to me" on resolver wiring).
///
/// The ledgers (`db/capabilities/capabilities.lines`, `db/emus/<machine>/capabilities.lines`)
/// are MediaLines docs: `cap <name> <desc>` declares, `support <cap> <system> <status> <note>`
/// places. THIS module is pure over parsed text — the caller reads files (sealed-room friendly:
/// no IO here); `resolve` answers what a host can bind BEFORE asking, and refusals are USEFUL
/// (an unknown cap or system names what IS known, so the caller re-plans instead of guessing).
/// `lint` is the ledger's own honesty sweep: support rows must reference declared caps, statuses
/// come from the closed ladder set, and a declared cap with zero support rows is dark data.
[<RequireQualifiedAccess>]
module CapabilityLedger =

    /// The ladder (universal/port's Light, as data): how a (cap, system) pair is held.
    type Status =
        | Live // implemented here, first-class
        | Injected // bound from outside by design (e.g. tests-side engines)
        | Mock // the honest rehearsal rung
        | Absent // declared missing — a wish, visibly

    let parseStatus (s: string) : Status option =
        match s with
        | "live" -> Some Live
        | "injected" -> Some Injected
        | "mock" -> Some Mock
        | "absent" -> Some Absent
        | _ -> None

    type Support =
        { Cap: string
          System: string
          Status: Status
          Note: string }

    type Ledger =
        { Caps: Map<string, string> // name -> description
          Support: Support list }

    /// Parse a ledger from MediaLines entries (caller parses the text; we read the kinds).
    let ofDoc (d: MediaLines.Doc) : Ledger =
        let caps =
            MediaLines.ofKind "cap" d
            |> List.map (fun e -> e.Name, (e.Fields |> List.tryHead |> Option.defaultValue ""))
            |> Map.ofList
        let support =
            MediaLines.ofKind "support" d
            |> List.choose (fun e ->
                match e.Fields with
                | system :: status :: rest ->
                    parseStatus status
                    |> Option.map (fun st ->
                        { Cap = e.Name
                          System = system
                          Status = st
                          Note = rest |> List.tryHead |> Option.defaultValue "" })
                | _ -> None)
        { Caps = caps; Support = support }

    /// What can THIS system bind for THIS capability? Absent is an OK answer (declared missing);
    /// an unknown cap or unplaced system is an Error that names the known options (re-plan fuel).
    let resolve (cap: string) (system: string) (ledger: Ledger) : Result<Support, string> =
        if not (Map.containsKey cap ledger.Caps) then
            let known = ledger.Caps |> Map.toList |> List.map fst |> String.concat ", "
            Error(sprintf "unknown capability '%s' — the ledger declares: %s" cap known)
        else
            match ledger.Support |> List.tryFind (fun s -> s.Cap = cap && s.System = system) with
            | Some s -> Ok s
            | None ->
                let placed =
                    ledger.Support
                    |> List.filter (fun s -> s.Cap = cap)
                    |> List.map (fun s -> sprintf "%s=%s" s.System (string s.Status))
                    |> String.concat ", "
                Error(sprintf "capability '%s' has no support row for system '%s' — placed: %s" cap system placed)

    /// Every system that holds the capability at a given rung or better (Live > Injected > Mock > Absent).
    let private rank =
        function
        | Live -> 3
        | Injected -> 2
        | Mock -> 1
        | Absent -> 0

    let systemsAtLeast (cap: string) (floor: Status) (ledger: Ledger) : string list =
        ledger.Support
        |> List.filter (fun s -> s.Cap = cap && rank s.Status >= rank floor)
        |> List.map (fun s -> s.System)

    /// The ledger's own honesty sweep (the README's promised lint, as pure findings).
    let lint (d: MediaLines.Doc) : string list =
        let ledger = ofDoc d
        let declaredCaps = ledger.Caps |> Map.toList |> List.map fst |> Set.ofList
        let supportRaw = MediaLines.ofKind "support" d
        [ // a support row referencing an undeclared cap is a dangling pointer
          for e in supportRaw do
              if not (Set.contains e.Name declaredCaps) then
                  yield sprintf "support row references undeclared cap '%s'" e.Name
          // a status outside the closed ladder set is a typo wearing a vest
          for e in supportRaw do
              match e.Fields with
              | _ :: status :: _ when parseStatus status |> Option.isNone ->
                  yield sprintf "support row for '%s' carries unknown status '%s' (live|injected|mock|absent)" e.Name status
              | f when List.length f < 2 -> yield sprintf "support row for '%s' needs system and status" e.Name
              | _ -> ()
          // a declared cap with no support row is dark data — declare its absence honestly
          for KeyValue(cap, _) in ledger.Caps do
              if not (supportRaw |> List.exists (fun e -> e.Name = cap)) then
                  yield sprintf "cap '%s' has zero support rows — place it (absent is a valid placement)" cap ]
