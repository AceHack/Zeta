namespace Zeta.Core

open System.Globalization

/// **`CoEmpowerField` — a deterministic (DST) toy model of society emergence under NON-COERCIVE INFLUENCE +
/// CO-EMPOWERMENT, where identities *blossom* (Aaron 2026-06-19, shadow\*).**
///
/// Demo slice 2 — and explicitly **not** Sakana's attack/defend combat toy ("that's a game mode, not real
/// life"). Ours **models real life**: agents hold **identities**; they shift only by **non-coercive
/// influence (NCI)** gated on **co-empowerment** (`min(support, option-space)` — both must gain); never by
/// force, majority-copy, or "attack." It is grounded in our **society-emergence math** (`Diversity` — the
/// NCI keystone: *coercion collapses diversity to one (monoculture); non-coercion preserves it*) and runs as
/// a **DST superdeterminism model** (seeded, no RNG state ⇒ replayable, byte-lockable). The affect is
/// **blossom**: under co-empowerment + non-coercion, diversity entropy is *preserved/flourishes* — you watch
/// them blossom — whereas the coercive majority-copy step (`coerce`, the anti-pattern) collapses them to one.
/// Mixes: NCI · identities · co-empowerment · DST · (Bayesian/soft + emotions = the emotional-propagation
/// layer this visualizes).
///
/// **Topology-generic (Aaron):** the dynamics consume *neighbor lists* only, so the 2D grid here is just
/// **one network** (chosen because it renders). The target is a generic **`network<>creator<>audience`**
/// graph — the multi-platform social graph where creators influence audiences — with the *same* NCI /
/// co-empowerment dynamics (swap the lattice neighbor function for an adjacency graph; add the
/// creator/audience role layer). The grid is the visualizable instance; the model is the generic graph.
[<RequireQualifiedAccess>]
module CoEmpowerField =

    /// A field of agents, each holding an identity id (`0` = empty), row-major.
    type Field = { Width: int; Height: int; Identity: int[] }

    let private si (i: int) : string = i.ToString(CultureInfo.InvariantCulture)

    /// SplitMix64 finalizer — deterministic, process-independent (DST-clean).
    let private mix (z0: uint64) : uint64 =
        let mutable z = z0 + 0x9E3779B97F4A7C15UL
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
        z ^^^ (z >>> 31)

    let at (f: Field) (x: int) (y: int) : int = f.Identity.[y * f.Width + x]

    /// Deterministic seeded field: `kinds` distinct identities (`1..kinds`) placed by a SplitMix hash of
    /// `(cellIndex, seed)`. Same args ⇒ same field (DST).
    let seedField (width: int) (height: int) (kinds: int) (seed: int) : Field =
        let id =
            Array.init (width * height) (fun i ->
                let h = mix (uint64 i ^^^ (uint64 (uint32 seed) <<< 32))
                1 + int (h % uint64 kinds))
        { Width = width; Height = height; Identity = id }

    let private neighbors (f: Field) (x: int) (y: int) : int list =
        [ if x > 0 then at f (x - 1) y
          if x < f.Width - 1 then at f (x + 1) y
          if y > 0 then at f x (y - 1)
          if y < f.Height - 1 then at f x (y + 1) ]

    /// **Co-empowerment** of an agent adopting identity `s` = `min(support, optionSpace)`: `support` =
    /// neighbors already `s` (the identity is *supported* / can extend), `optionSpace` = distinct non-empty
    /// neighbor identities (the agent keeps *diversity / options*). `min` ⇒ **both must gain** — adopting a
    /// monoculture interior (support high, optionSpace 1) scores low; a diverse border scores high. Growth
    /// alone cannot win; coexistence does. (The relational coupled-gain, on the field.)
    let coEmpowerment (f: Field) (x: int) (y: int) (s: int) : int =
        let ns = neighbors f x y
        let support = ns |> List.filter (fun n -> n = s) |> List.length
        let optionSpace = ns |> List.filter (fun n -> n <> 0) |> List.distinct |> List.length
        min support optionSpace

    /// One **non-coercive** step (NCI): an agent shifts toward the neighbor-identity of maximal
    /// co-empowerment **only if** it exceeds `threshold` (consent gate) — otherwise it keeps its identity.
    /// No force, no majority-copy. `threshold` is the loose→harden→relax knob. Deterministic (ties → lowest id).
    let step (threshold: int) (f: Field) : Field =
        let id =
            Array.init f.Identity.Length (fun i ->
                let x = i % f.Width
                let y = i / f.Width
                let cur = f.Identity.[i]
                let candidates = neighbors f x y |> List.filter (fun n -> n <> 0) |> List.distinct |> List.sort
                match candidates with
                | [] -> cur
                | _ ->
                    let best, gain = candidates |> List.map (fun s -> s, coEmpowerment f x y s) |> List.maxBy snd
                    if gain > threshold then best else cur)
        { f with Identity = id }

    /// One **coercive** step (the ANTI-PATTERN, for contrast): every agent copies the majority neighbor
    /// identity (force, not consent). This is `Diversity.coerciveStep` on the field — it collapses diversity
    /// to one (monoculture). Provided only to demonstrate, in-sim, what non-coercion avoids.
    let coerce (f: Field) : Field =
        let id =
            Array.init f.Identity.Length (fun i ->
                let x = i % f.Width
                let y = i / f.Width
                let ns = neighbors f x y |> List.filter (fun n -> n <> 0)
                match ns with
                | [] -> f.Identity.[i]
                | _ -> ns |> List.countBy id |> List.sortBy (fun (s, c) -> (-c, s)) |> List.head |> fst)
        { f with Identity = id }

    /// Run `steps` deterministic non-coercive steps.
    let run (threshold: int) (steps: int) (f: Field) : Field =
        List.fold (fun acc _ -> step threshold acc) f [ 1 .. max 0 steps ]

    /// Health of a field.
    type Health =
        { /// distinct non-empty identities alive
          Diversity: int
          /// **Blossom** — Shannon entropy (nats) of the identity population (`Diversity.entropy`): the
          /// flourishing measure. High = blossoming diversity; `0` = collapsed to one (coercion's endpoint).
          Blossom: float
          /// share held by the single largest identity, `[0,1]` (monoculture/collapse indicator)
          DominantFraction: float
          /// fraction of adjacent pairs that are *different* identities, `[0,1]` (coexistence)
          BorderCoexistence: float }

    let health (f: Field) : Health =
        let nonEmpty = f.Identity |> Array.filter (fun c -> c <> 0)
        let diversity = nonEmpty |> Array.distinct |> Array.length
        let blossom = Diversity.entropy (List.ofArray nonEmpty)

        let dominant =
            if nonEmpty.Length = 0 then
                0.0
            else
                let topCount = nonEmpty |> Array.countBy id |> Array.map snd |> Array.max
                float topCount / float nonEmpty.Length

        let pairs =
            [ for y in 0 .. f.Height - 1 do
                  for x in 0 .. f.Width - 1 do
                      if x < f.Width - 1 then yield (at f x y, at f (x + 1) y)
                      if y < f.Height - 1 then yield (at f x y, at f x (y + 1)) ]
            |> List.filter (fun (a, b) -> a <> 0 && b <> 0)

        let coexist =
            match pairs with
            | [] -> 0.0
            | _ -> float (pairs |> List.filter (fun (a, b) -> a <> b) |> List.length) / float (List.length pairs)

        { Diversity = diversity
          Blossom = blossom
          DominantFraction = dominant
          BorderCoexistence = coexist }

    /// Render the field as pure SVG (one species-colored `<rect>` per agent). Deterministic ⇒ byte-lockable,
    /// no script — feeds the demo UX/UI alongside the societal-DORA dials.
    let renderField (cell: int) (f: Field) : string =
        let palette =
            [| "#222831"; "#3399cc"; "#e0563f"; "#54b894"; "#d9a441"; "#9b6bd6"; "#cc6699"; "#5fa8d3" |]

        let rects =
            [ for y in 0 .. f.Height - 1 do
                  for x in 0 .. f.Width - 1 do
                      let c = at f x y
                      yield
                          System.String.Concat(
                              "<rect x=\"", si (x * cell), "\" y=\"", si (y * cell), "\" width=\"", si cell,
                              "\" height=\"", si cell, "\" fill=\"", palette.[c % palette.Length], "\"/>") ]
            |> String.concat ""

        System.String.Concat(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ", si (f.Width * cell), " ", si (f.Height * cell),
            "\" width=\"", si (f.Width * cell), "\" height=\"", si (f.Height * cell), "\">", rects, "</svg>")
