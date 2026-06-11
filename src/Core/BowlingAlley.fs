namespace Zeta.Core

/// **The Bowling Alley cell — midnight bowling, neon like the Dark Hall (the 3rd childhood arcade cell).**
///
/// The sibling `Skadium.fs` promised: "the Bowling Alley — midnight bowling, neon like the Dark Hall — its
/// own aesthetic ... Bowling Alley = 3rd, sibling to come." Now it arrives. A place-memory saved in code
/// (Henderson, NC; the neon trilogy — Dark Hall, Skadium, Bowling Alley; **ÆSTHETIC ENGINEERING** — the
/// liminal/neon feel is engineered, not decoration), like `DarkHall.fs` and `Skadium.fs`.
///
/// Where `DarkHall` hosts a deterministic **emulator** and `Skadium` a deterministic **bob-and-weave**, the
/// Bowling Alley hosts a deterministic **look-ahead score fold** — because **bowling scoring IS a deferred
/// fold**: a *strike* scores `10 + the next two rolls`, a *spare* `10 + the next one roll`, so a frame's
/// value **cannot be known until future rolls arrive** — it *resolves later*. That is exactly the
/// substrate's deferred-execution / resolve-when-the-future-arrives shape (the saga/plateau: a frame is a
/// room that `res`olves once its look-ahead input lands; an unfinished frame is a held SoftValue). Pure,
/// no clock, no randomness ⇒ **DST-replayable** (every game replays identically from its rolls).
///
/// (Computation = the bowling look-ahead fold — the natural fit; Aaron assigned emulator/bob-and-weave to
/// the siblings, so he can reassign this if he'd rather it host something else.)
[<RequireQualifiedAccess>]
module BowlingAlley =

    /// Standard ten-pin scoring as a pure deferred fold over the roll sequence. A strike (10 in one roll)
    /// scores `10 + next two`; a spare (two rolls summing to 10) scores `10 + next one`; an open frame
    /// scores its two rolls. Ten frames. Missing future rolls (an unfinished game) count as 0 — a partial
    /// score that *settles* as the look-ahead rolls arrive (the deferred resolve). No `mutable` — a frame
    /// recursion (the look-ahead is reading `i+1`/`i+2` ahead = the deferred dependency).
    let score (rolls: int list) : int =
        let arr = List.toArray rolls
        let at i = if i >= 0 && i < arr.Length then arr.[i] else 0

        let rec go (frame: int) (i: int) (acc: int) : int =
            if frame = 10 then
                acc
            else
                let r0 = at i

                if r0 = 10 then // strike — look TWO rolls ahead (deferred)
                    go (frame + 1) (i + 1) (acc + 10 + at (i + 1) + at (i + 2))
                elif r0 + at (i + 1) = 10 then // spare — look ONE roll ahead (deferred)
                    go (frame + 1) (i + 2) (acc + 10 + at (i + 2))
                else // open frame — no look-ahead
                    go (frame + 1) (i + 2) (acc + r0 + at (i + 1))

        go 0 0 0

    /// Is the frame at roll-index `i` a strike / spare — i.e. does it carry a **deferred** (look-ahead)
    /// dependency on future rolls? (The "this frame hasn't resolved yet" predicate.)
    let carriesLookahead (rolls: int list) (i: int) : bool =
        let arr = List.toArray rolls
        let at j = if j >= 0 && j < arr.Length then arr.[j] else 0
        i < arr.Length && (at i = 10 || at i + at (i + 1) = 10)

    // ── The door (Salon/Arcade style) — the navigable gathering + a live entrance ──

    /// A lane in the alley — one named offering.
    type Lane =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool }

    /// The alley's lanes — the fittings gathered under the door.
    let lanes: Lane list =
        [ { Name = "score"
            Does = "the deferred look-ahead score fold — strike/spare resolve when future rolls arrive (res)"
            Verb = Some "res"
            Module = "src/Core/BowlingAlley.fs"
            Live = true }
          { Name = "carriesLookahead"
            Does = "does this frame still carry a deferred dependency on future rolls (unresolved)?"
            Verb = None
            Module = "src/Core/BowlingAlley.fs"
            Live = true } ]

    /// The alley's name and what work happens here (the signage).
    let name = "bowling alley"
    let does = "midnight-neon place-memory; the deferred look-ahead score fold (a frame resolves when its future rolls land)"

    /// The lanes that are working slices today.
    let liveLanes: Lane list = lanes |> List.filter (fun l -> l.Live)

    // ── Cell wiring (sibling to DarkHall/Skadium): the neon trilogy is complete ──

    /// This cell's place in the neon trilogy (Dark Hall = 1, Skadium = 2, Bowling Alley = 3).
    [<Literal>]
    let TrilogyIndex = 3
