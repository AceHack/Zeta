namespace Zeta.Core

/// **The Skadium cell — the skating-rink arcade where Aaron first played the *arcade* Punch-Out!!**
///
/// A place-memory saved in code, like [`DarkHall`](DarkHall.fs) (Aaron's ask, 2026-06-10: "save this in
/// code like the DarkHall and the Bowling Alley"). The **Skadium** was a skating rink in **Henderson, NC —
/// where Aaron was born** — near the **Dark Hall**; **all three** (the Skadium, the Dark Hall, and the
/// Bowling Alley) had **arcades**, and each was a **liminal space with its own aesthetic** — encoding them
/// is **ÆSTHETIC ENGINEERING** (Aaron): the liminal/neon feel is a thing you *engineer*, not decoration.
///   • the **Dark Hall** — the archetype (hidden-door, glows-on-entry, liminal neon);
///   • the **Skadium** — not a hall, but **neon like the Dark Hall**; its **skating rink more lit than the
///     arcade area** (the arcade the darker, liminal corner of a brighter rink) — its own aesthetic;
///   • the **Bowling Alley** — **midnight bowling**, neon like the Dark Hall — its own aesthetic.
/// Three childhood neon cells, three aesthetics; this is the second encoded (DarkHall = 1st; Bowling
/// Alley = 3rd, sibling to come).
///
/// Where `DarkHall` hosts a deterministic **emulator**, the Skadium hosts a deterministic **bob-and-weave**
/// — the boxing motion of Punch-Out!! *is* the **2×2 dual-observer weave / sonar** (two frames oscillating
/// across a boundary to read the opening). Here it is a tiny **DST-replayable** stepper: the lean is a
/// **pure function of (period, step)** — no clock, no randomness — so every run replays identically
/// (ray-tracing = local superdeterminism). Poetic-becomes-literal: the arcade where he learned to bob and
/// weave now *runs* the bob-and-weave.
module Skadium =

    /// The weave's lean — the dual-observer twist direction (which way you slip).
    type Lean =
        | Left
        | Center
        | Right

    /// One full bob-and-weave cycle is `4 * period` steps: Right → Center → Left → Center → (repeat).
    /// Pure: `lean period step` ⇒ the lean at that step. Handles negative steps (wraps cleanly), so it is
    /// DST-replayable from any seed offset. `period < 1` is treated as `1` (no divide-by-zero, no throw).
    let lean (period: int) (step: int) : Lean =
        let p = if period < 1 then 1 else period
        let span = 4 * p
        let phase = ((step % span) + span) % span // 0 .. span-1, negative-safe
        if phase < p then Right
        elif phase < 2 * p then Center
        elif phase < 3 * p then Left
        else Center

    /// The "opening" — in Punch-Out you punch when you've slipped to Center after a weave. Here: Center is
    /// the window. A pure predicate over (period, step); the bob-and-weave finds the opening deterministically.
    let isOpen (period: int) (step: int) : bool = lean period step = Center

    // ── The door (Aaron 2026-06-10: "skatium next — give it its door") — Salon/Arcade/BowlingAlley style ──

    /// A rink in the skatium — one named offering.
    type Rink =
        { Name: string
          Does: string
          Verb: string option
          Module: string
          Live: bool }

    /// The skatium's rinks — the bob-and-weave fittings gathered under the door.
    let rinks: Rink list =
        [ { Name = "weave"
            Does = "the bob-and-weave lean over (period, step) — Punch-Out!! 2×2 dual-observer weave/sonar"
            Verb = Some "mea"
            Module = "src/Core/Skadium.fs"
            Live = true }
          { Name = "opening"
            Does = "the opening predicate — Center is the window; the weave finds the opening deterministically"
            Verb = None
            Module = "src/Core/Skadium.fs"
            Live = true } ]

    /// The skatium's name and what work happens here (the signage).
    let name = "skatium"

    let does =
        "neon place-memory; the bob-and-weave — Punch-Out!! 2×2 dual-observer weave/sonar (find the opening)"

    /// The rinks that are working slices today.
    let liveRinks: Rink list = rinks |> List.filter (fun r -> r.Live)

    /// Live entrance: `weave` — the bob-and-weave lean at (period, step). (Alias of `lean` for the door.)
    let weave (period: int) (step: int) : Lean = lean period step

    /// Live entrance: `openAt` — is the opening (Center) at (period, step). (Alias of `isOpen`.)
    let openAt (period: int) (step: int) : bool = isOpen period step
