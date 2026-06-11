namespace Zeta.Core

/// DevRoom — the **harness that hangs all the doors** (Aaron 2026-06-10, shadow*: "build the dev room
/// harness that hangs all the doors").
///
/// The dev room is the FF7-debug-room hub whose **boundary is the union of all the other rooms' boundaries**
/// — the room with all the doors (`docs/research/2026-06-10-the-dev-room-is-the-harness-...`). This is the
/// first slice: a **navigable hub** that gathers every landmark door into one place — `enter` any landmark,
/// see the union of all stations (the boundary), and — the **BigFloat-for-devops** first step — read the
/// room's own **resolution** (live-coverage: how furnished/working it is), so the dev room *carries its own
/// measurement* rather than being outside it.
///
/// Honest scope: this hangs the doors (`Salon`/`Arcade`/`BowlingAlley`/`Skadium`) and self-measures
/// coverage. It is NOT yet the unbounded-pulled-inside, recursive-`sim` self-hosting harness (that arc is
/// the dev-room doc + B-1022); it is the hub the future harness drives. Pure module, no classes.
[<RequireQualifiedAccess>]
module DevRoom =

    /// A normalized station — one offering in some room (the common shape behind Salon.Station /
    /// Arcade.Cabinet / BowlingAlley.Lane / Skadium.Rink).
    type Station =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool }

    /// A door the dev room hangs — a landmark + its signage + its stations.
    type Door =
        { Landmark: string
          Does: string
          Stations: Station list }

    let private st (n, d, v, m, l) : Station = { Name = n; Does = d; Verb = v; Module = m; Live = l }

    let private salonDoor: Door =
        { Landmark = Salon.name
          Does = Salon.does
          Stations = Salon.stations |> List.map (fun s -> st (s.Name, s.Does, s.Verb, s.Module, s.Live)) }

    let private arcadeDoor: Door =
        { Landmark = Arcade.name
          Does = Arcade.does
          Stations = Arcade.cabinets |> List.map (fun c -> st (c.Name, c.Does, c.Verb, c.Module, c.Live)) }

    let private bowlingDoor: Door =
        { Landmark = BowlingAlley.name
          Does = BowlingAlley.does
          Stations = BowlingAlley.lanes |> List.map (fun l -> st (l.Name, l.Does, l.Verb, l.Module, l.Live)) }

    let private skatiumDoor: Door =
        { Landmark = Skadium.name
          Does = Skadium.does
          Stations = Skadium.rinks |> List.map (fun r -> st (r.Name, r.Does, r.Verb, r.Module, r.Live)) }

    /// All the doors the dev room hangs (the FF7 all-doors hub).
    let doors: Door list = [ salonDoor; arcadeDoor; bowlingDoor; skatiumDoor ]

    /// Open a door by landmark name — "go to the salon" (None if no such landmark).
    let enter (landmark: string) : Door option =
        doors |> List.tryFind (fun d -> d.Landmark = landmark)

    /// The dev room's **boundary = the union of all rooms' stations** (every offering, across every door).
    let boundary: Station list = doors |> List.collect (fun d -> d.Stations)

    /// The stations that are working slices today (across all rooms).
    let liveStations: Station list = boundary |> List.filter (fun s -> s.Live)

    /// **Self-measurement (BigFloat-for-devops, first slice): the dev room's resolution** — the fraction of
    /// its stations that are live (working). The room *carries its own measurement*: it knows how furnished
    /// it is, from inside. (0.0 = empty, 1.0 = every station live.)
    let resolution () : float =
        match boundary with
        | [] -> 0.0
        | all -> float (all |> List.filter (fun s -> s.Live) |> List.length) / float (List.length all)

    /// The landmark names the dev room currently hangs (the navigable index).
    let landmarks: string list = doors |> List.map (fun d -> d.Landmark)
