namespace Zeta.Core

/// AnimFlow — **our own Rx for animations** (Aaron 2026-06-11: "we could use our own version of rx for
/// the animations / what remains; our quotes can be git-native friendly").
///
/// The Rx is OURS, meaning: the observable is a **pure function of generated time** (no callbacks, no
/// ambient clock, no subscription state) — `frameAt` maps a TimeGen tick to a frame name, and
/// `observe` materializes a bounded window of (tick, frame) events. The four corners carry the flow:
/// TIn = ticks (from the seeded generator), TOut = frame events, TOutFeedback = the viewer's pacing
/// (presence slows the SAMPLING, never the math — the presence throttle), TInFeedback = co-owned
/// drift/phase adjustment (TimeGen.feedback's twist). "What remains" is the persona=owner reading:
/// the animation's surviving state is just (anim definition, tick) — everything else regenerates.
///
/// Git-native quotes (the convention, captured here; plumbing is the runner's): a playable quote's
/// three parts are ALREADY text files, so a quote IS a git tree — savestate blob + recording blob +
/// MediaLines meta — addressed by its commit; `refs/quotes/<zetaid>` names it; take-the-controls =
/// BRANCH from the quote tip; sharing a quote = `git fetch` (no new transport invented — git is the
/// quote's wire). Diffable, mergeable, citable: LexisNexis over refs.
[<RequireQualifiedAccess>]
module AnimFlow =

    /// An animation: named frames cycled in order (parsed from a MediaLines `anim` entry's
    /// comma-list, e.g. "idle,idle,idle,blink").
    type Anim = { Name: string; Cycle: string list }

    /// Parse a MediaLines anim entry (None = not an anim / empty cycle — honest refusal).
    let ofEntry (e: MediaLines.Entry) : Anim option =
        if e.Kind <> "anim" then None
        else
            match e.Fields with
            | head :: _ ->
                let cycle = head.Split(',') |> Array.toList |> List.filter (fun s -> s.Length > 0)
                if List.isEmpty cycle then None else Some { Name = e.Name; Cycle = cycle }
            | [] -> None

    /// THE OBSERVABLE, our way: the frame at a generated tick — pure, total, replayable. No
    /// subscription object; time indexes the stream directly (DST is the scheduler).
    let frameAt (a: Anim) (tick: int) : string =
        a.Cycle.[((tick % a.Cycle.Length) + a.Cycle.Length) % a.Cycle.Length]

    /// Materialize a bounded window of events [t0, t0+count): the Rx "subscribe" as a value.
    /// Pacing is the CALLER's corner (TOutFeedback): a present human samples every wallclock-paced
    /// tick; headless samples as fast as it likes — same events either way.
    let observe (a: Anim) (t0: int) (count: int) : (int * string) list =
        [ for t in t0 .. t0 + max 0 count - 1 -> t, frameAt a t ]

    /// Drive the animation from a TimeGen generator: the tick comes from the SEEDED clock, so two
    /// nodes observing the same generator see the same frame at the same generated instant —
    /// distributed animation with no coordination (the lockstep property, free).
    let observeWith (g: TimeGen.Generator) (contributor: uint64) (a: Anim) (steps: int) : (int * string) list =
        [ for s in 0 .. max 0 steps - 1 ->
            let t = TimeGen.at g contributor s
            t.Tick, frameAt a t.Tick ]
