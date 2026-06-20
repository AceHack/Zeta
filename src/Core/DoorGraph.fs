namespace Zeta.Core

/// **`DoorGraph` — rooms connected by doors (the vault interior; #8775 door model).**
///
/// The *inside* counterpart to the metaspace outside-map. Within a vault, **rooms are leaves**
/// (rooms can't contain rooms — bounded downward) and a room may have **multiple doors to other rooms
/// in the same vault**, so the rooms form a **graph** (nodes = rooms, edges = doors), not a nesting
/// tree. A **door is a first-class portal = a declared, metered channel (#13 noninterference)**: you
/// move between rooms ONLY through doors, and traversal is **permission-gated** (consent-first #6) —
/// which also keeps the Universal Exit Principle (a room with a door out is a room you can leave).
///
/// Pure + deterministic ⇒ DST-replayable. Permission gating is an injected predicate (the only door),
/// so no ambient authority leaks in.
[<RequireQualifiedAccess>]
module DoorGraph =

    /// A door: a directed portal `From → To` between two rooms (by id), with a permission `Key` that a
    /// traverser must hold. Bidirectional connections are two doors (a room you can enter you can also
    /// be left — but each direction is independently gated).
    type Door =
        { From: string
          To: string
          Key: string }

    /// A vault interior: its room ids (the leaves) and the doors among them.
    type Vault =
        { Rooms: string list
          Doors: Door list }

    /// Build a door (directed, permission-gated).
    let door (from: string) (to': string) (key: string) : Door =
        { From = from; To = to'; Key = key }

    /// An empty vault interior.
    let empty : Vault = { Rooms = []; Doors = [] }

    /// Add a room (a leaf). Idempotent — a room already present is not duplicated.
    let addRoom (room: string) (v: Vault) : Vault =
        if List.contains room v.Rooms then v else { v with Rooms = room :: v.Rooms }

    /// Add a door — but ONLY between rooms that exist in THIS vault (doors stay intra-vault; the
    /// outside-map handles vault↔vault). Returns Error if either endpoint is absent or it self-loops.
    let addDoor (d: Door) (v: Vault) : Result<Vault, string> =
        if d.From = d.To then Error "a door cannot connect a room to itself"
        elif not (List.contains d.From v.Rooms) then Error $"door source room '{d.From}' is not in this vault"
        elif not (List.contains d.To v.Rooms) then Error $"door target room '{d.To}' is not in this vault"
        else Ok { v with Doors = d :: v.Doors }

    /// The doors leading OUT of `room` (its lateral exits within the vault).
    let exits (room: string) (v: Vault) : Door list =
        v.Doors |> List.filter (fun d -> d.From = room)

    /// **Universal Exit Principle:** every room has at least one door out. Returns the rooms that
    /// VIOLATE it (no exit) — empty list ⇒ no room is a trap.
    let roomsWithoutExit (v: Vault) : string list =
        v.Rooms |> List.filter (fun r -> List.isEmpty (exits r v))

    /// **Traverse a door (the metered crossing):** succeeds only if a door `from → to` exists AND the
    /// traverser's `heldKeys` include that door's `Key` (permission-gated, consent-first #6). Returns
    /// the destination room id. The `heldKeys` set is the only door for authority — no ambient grant.
    let traverse (heldKeys: Set<string>) (from: string) (to': string) (v: Vault) : Result<string, string> =
        match v.Doors |> List.tryFind (fun d -> d.From = from && d.To = to') with
        | None -> Error $"no door from '{from}' to '{to'}'"
        | Some d ->
            if Set.contains d.Key heldKeys then Ok to'
            else Error $"permission denied: door '{from}→{to'}' requires key '{d.Key}'"

    /// Can this traverser reach `to'` from `from` in one metered step (door exists + key held)?
    let canTraverse (heldKeys: Set<string>) (from: string) (to': string) (v: Vault) : bool =
        match traverse heldKeys from to' v with
        | Ok _ -> true
        | Error _ -> false
