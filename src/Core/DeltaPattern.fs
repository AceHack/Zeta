namespace Zeta.Core

open System.Collections.Generic

/// **`DeltaPattern` — the physics of memory: content-address the *change*, not the state (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"memory never repeats exactly but the patterns of change do repeat… we should be able to figure out how
/// the branch affects the memory patches and find patterns we can control, or else state space will be infinite
/// even on CHIP-8."* The fix: absolute memory drifts forever (a counter/timer/RNG makes every frame unique →
/// `StateSpace` over the *full* `contentKey` is infinite), but the **per-step delta** (which cells changed, by how
/// much) **repeats**. So we content-address the **`Delta`** (the change signature) instead of the state — which is
/// exactly what DBSP already is (a Z-set *delta* engine). A repeating delta-signature = a loop *body* found, even
/// while the values it touches drift; that quotients the infinite state trajectory down to a finite *pattern* space.
///
/// **Anchors (Beacon):** first-difference / relative encoding (a sequence aperiodic in value can be periodic in
/// its differences); DBSP Z-set delta stream (Budiu et al.); abstract interpretation over *change relations*;
/// recognizing the transition *rule* (`v ← v+1`) which is finite even when the value trajectory isn't; periodic
/// orbits in delta-space (cf. `Orbit` — a system aperiodic in state can be a `Crystal` in delta).
///
/// **Honest scope (peel):** `Delta` is the *signed first difference* per register/timer + the set of flipped
/// display cells — a concrete, comparable signature; it is NOT yet a learned symbolic rule (no `v←v+k`
/// generalization, no input-causation classification — those are the next slices: classify a cell as
/// controllable iff its delta varies across input branches). Two transitions with the same `Delta` are treated as
/// the same pattern; that's an abstraction (it ignores *where* in memory, only *how much* — fine for cycle/period
/// detection, lossy if absolute position matters). Deterministic (DST).
[<RequireQualifiedAccess>]
module DeltaPattern =

    /// The pattern of change across one step — the signed first-difference signature (comparable ⇒ addressable).
    type Delta =
        { PC: int
          /// (register, signed delta) for every V register that changed.
          V: (int * int) list
          I: int
          Delay: int
          Sound: int
          /// display cells that flipped (the sprite-xor footprint).
          DisplayFlipped: int list }

    /// The change signature `b - a` — the "patch shape", independent of absolute values.
    let between (a: Chip8Cow.Frame) (b: Chip8Cow.Frame) : Delta =
        { PC = int b.PC - int a.PC
          V =
            [ for i in 0..15 do
                  let d = int b.V.[i] - int a.V.[i]
                  if d <> 0 then i, d ]
          I = int b.I - int a.I
          Delay = int b.Delay - int a.Delay
          Sound = int b.Sound - int a.Sound
          DisplayFlipped =
            // cells whose lit-state differs between a and b (the xor footprint = symmetric difference)
            let cells (m: Map<int, bool>) = m |> Map.toSeq |> Seq.filter snd |> Seq.map fst |> Set.ofSeq
            let ca, cb = cells a.Display, cells b.Display
            Set.union (Set.difference ca cb) (Set.difference cb ca) |> Set.toList }

    /// The delta sequence over `n` frames under a fixed held input (`keys`) — the change-pattern trajectory.
    let trajectory (cyclesPerFrame: int) (keys: bool[]) (n: int) (f0: Chip8Cow.Frame) : Delta list =
        let mutable prev = f0
        [ for _ in 1 .. max 0 n do
              let next = Chip8Cow.frameStep cyclesPerFrame { prev with Keys = keys }
              let d = between prev next
              prev <- next
              yield d ]

    /// **The period of the change-pattern** — the smallest gap at which a `Delta` signature recurs, or `None` if
    /// every step's pattern is unique within the trajectory. A counter ROM (value never repeats) yields period
    /// **1** here (its delta is constant) — the loop is found in delta-space though the state space is infinite.
    let detectPeriod (deltas: Delta list) : int option =
        let seen = Dictionary<Delta, int>()
        let mutable result = None
        let mutable i = 0
        for d in deltas do
            if Option.isNone result then
                match seen.TryGetValue d with
                | true, j -> result <- Some(i - j)
                | _ -> seen.[d] <- i
            i <- i + 1
        result

    /// Convenience: the change-pattern period over `n` frames under a held input. The finite handle on an
    /// otherwise-infinite (value-drifting) state trajectory.
    let patternPeriod (cyclesPerFrame: int) (keys: bool[]) (n: int) (f0: Chip8Cow.Frame) : int option =
        trajectory cyclesPerFrame keys n f0 |> detectPeriod

    /// **Distinct change-patterns** in a trajectory (the size of the *pattern* space actually visited) — finite
    /// even when the absolute state count is unbounded. The measure that says "the physics is small."
    let distinctPatterns (deltas: Delta list) : int =
        deltas |> List.distinct |> List.length
