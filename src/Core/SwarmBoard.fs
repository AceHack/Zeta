namespace Zeta.Core

open System.Threading.Tasks

/// SwarmBoard — **081KTSZN10008QG0R0003SDRWD slice 1: the board room** (Aaron 2026-06-11: "sit down and see the swarm and
/// where I need to go help, and join and conference-room remotely — everyone in society should be able
/// to do that, even CHIP-8s").
///
/// The board is a ROOM: its state folds ONLY from membrane crossings (presence, navigation, heat
/// reports), so any citizen — human, agent, CHIP-8 — sits at it the same way, and a recorded session
/// replays byte-identically (DST; session = campaign, `saves/` discipline).
///
/// The render is the **D&D narrator** (the feel charter): not a dashboard — a dungeon-master voice.
/// "You are in the dev-room. The forge to the north runs HOT. Exits: N, E, SELF. Present: aaron, max."
///
/// Crossings (text, treaty register):
///   `join:<who>:<room>` · `part:<who>` · `go:<who>:<room|hottest>` · `heat:<room>:<millis>`
/// All other traffic passes by (honest refusal). Wire shape = the MeshPong/Citizen pattern; over the
/// real mesh the same payloads ride Reticulum packets.
[<RequireQualifiedAccess>]
module SwarmBoard =

    /// One room on the map: name, exits (the Zork compass — ratified direction vocabulary), and its
    /// current heat (the friction/heat ledger value last reported; 0 = cool).
    type MapRoom =
        { Name: string
          Exits: (string * string) list // direction → room name
          Heat: float }

    /// The board state: the map + who is where. Folds only from crossings.
    type Board =
        { Rooms: Map<string, MapRoom>
          Presence: Map<string, string> } // who → room name

    /// A fresh board over a static map (heat all cool; nobody present).
    let create (rooms: (string * (string * string) list) list) : Board =
        { Rooms =
            rooms
            |> List.map (fun (n, exits) -> n, { Name = n; Exits = exits; Heat = 0.0 })
            |> Map.ofList
          Presence = Map.empty }

    /// The hottest room (ties: lexicographic — deterministic). None on an empty map.
    let hottest (b: Board) : string option =
        if Map.isEmpty b.Rooms then
            None
        else
            b.Rooms
            |> Map.toList
            |> List.maxBy (fun (name, r) -> r.Heat, name)
            |> fst
            |> Some

    // ── the crossings ──

    let private parse3 (prefix: string) (p: string) : (string * string) option =
        if p.StartsWith prefix then
            match p.Substring(prefix.Length).Split(':') with
            | [| a; b |] when a.Length > 0 && b.Length > 0 -> Some(a, b)
            | _ -> None
        else
            None

    /// Fold one crossing payload into the board (pure; unknown traffic passes by unchanged).
    let apply (payload: string) (b: Board) : Board =
        match parse3 "join:" payload with
        | Some (who, room) when Map.containsKey room b.Rooms -> { b with Presence = Map.add who room b.Presence }
        | Some _ -> b // unknown room — honest refusal
        | None ->
            match parse3 "go:" payload with
            | Some (who, target) ->
                let dest =
                    if target = "hottest" then hottest b
                    elif Map.containsKey target b.Rooms then Some target
                    else
                        // a compass direction from the walker's current room
                        b.Presence
                        |> Map.tryFind who
                        |> Option.bind (fun cur -> Map.tryFind cur b.Rooms)
                        |> Option.bind (fun r -> r.Exits |> List.tryFind (fun (d, _) -> d = target))
                        |> Option.map snd

                match dest, Map.tryFind who b.Presence with
                | Some d, Some _ -> { b with Presence = Map.add who d b.Presence }
                | _ -> b // not present yet, or no such exit — honest refusal
            | None ->
                match parse3 "heat:" payload with
                | Some (room, millis) ->
                    match System.Int32.TryParse millis, Map.tryFind room b.Rooms with
                    | (true, m), Some r when m >= 0 ->
                        { b with Rooms = Map.add room { r with Heat = float m / 1000.0 } b.Rooms }
                    | _ -> b
                | None ->
                    if payload.StartsWith "part:" then
                        { b with Presence = Map.remove (payload.Substring 5) b.Presence }
                    else
                        b

    /// The board handler — the room's fold, drivable by `driveK` (the same loop every room runs).
    let handler: SoftScheduler.HandlerK<Board> =
        SoftScheduler.handlerK
            "swarm-board"
            (function
            | OperatorMessageArrived _ -> true
            | _ -> false)
            (fun intr _ctx b ->
                match intr with
                | OperatorMessageArrived p -> Task.FromResult(Ok(apply p b))
                | _ -> Task.FromResult(Ok b))

    // ── the narrator (the D&D voice; the feel charter's render) ──

    /// Narrate the board for one sitter: where you are, what runs hot, the exits, who's here.
    /// Deterministic text (ordinal-sorted) — the Mono1/ANSI bindings render this same string.
    let narrate (who: string) (b: Board) : string =
        match Map.tryFind who b.Presence |> Option.bind (fun r -> Map.tryFind r b.Rooms) with
        | None -> sprintf "%s is not at the table. (join:<who>:<room> to sit down.)" who
        | Some room ->
            let hot =
                b.Rooms
                |> Map.toList
                |> List.filter (fun (_, r) -> r.Heat > 0.0)
                |> List.sortByDescending (fun (n, r) -> r.Heat, n)
                |> List.truncate 3
                |> List.map (fun (n, r) -> sprintf "%s (%.3f)" n r.Heat)

            let exits =
                room.Exits |> List.map fst |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

            let here =
                b.Presence
                |> Map.toList
                |> List.filter (fun (w, r) -> r = room.Name && w <> who)
                |> List.map fst
                |> List.sortWith (fun a b -> System.String.CompareOrdinal(a, b))

            [ sprintf "You are in %s." room.Name
              (if List.isEmpty hot then "All rooms run cool." else "Running hot: " + String.concat ", " hot + ".")
              (if List.isEmpty exits then "No exits." else "Exits: " + String.concat ", " exits + ".")
              (if List.isEmpty here then "You are alone here." else "Also here: " + String.concat ", " here + ".") ]
            |> String.concat " "
