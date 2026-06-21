namespace Zeta.Core

/// TestLoop — **081KTSZN10008QG0R002J0GE0Z slice 1: tests are sim·mea·cut loops on OUR interface; the boundary is
/// enforced ONCE, here** (Aaron: "move tests to our own interfaces, hexagonal, slowly… be anal
/// about before/after, enforce the boundary… every room won't have to do it itself").
///
/// THE PORT (form test, form (a) — a universal shape): a test declares
///   `Sim`  — arrange: build the world FROM THE SEED (the seed is REQUIRED by the type: a test
///            that cannot say its seed cannot exist on this interface),
///   `Mea`  — act + observe: bank the measurement (must be equatable — see why below),
///   `Cut`  — assert: the closure condition as a `Result` (failures are VALUES; an exception
///            escaping any phase is caught at the boundary and reported, never thrown onward).
///
/// THE BOUNDARY, ENFORCED ONCE (what every migrated test inherits with zero per-test code):
///   1. Seed capture + a replay line in every verdict (DST: the failure is reproducible by
///      construction — the line says exactly how).
///   2. THE DOUBLE-RUN CHECK: the framework runs Sim+Mea TWICE from the same seed and requires
///      byte-equal measurements — ambient nondeterminism inside a loop is now a mechanical
///      failure, not a review convention (the determinism lint's runtime twin).
///   3. Result-over-exception at the rim: any throw in Sim/Mea/Cut becomes a Failure verdict
///      with the phase named.
/// Enforcement slices landed 2026-06-12: Reticulum-only = the SEALED-ROOM marker + the gate
/// audit (tools/hygiene/audit-sealed-rooms.ts — .NET has no reliable in-proc syscall hook, so
/// the seal is self-declared and mechanically swept; the double-run check owns the entropy
/// half) + budget metering = ComplexityRegistry.budgetCheck (over-budget calls are REFUSED and
/// the refusal names in-budget strategies). Still later: golden-lock/red-light integration,
/// the chip9-board host.
///
/// F# cannot DEFINE default interface members, so per house idiom the "default impls" the
/// quartet names live as THIS module's functions over the interface — same weight-free shape.
/// xUnit is a HOST ADAPTER in the test project (one thin shim), never referenced from Core.
type ITestLoop<'World, 'Mea when 'Mea: equality> =
    /// The loop's name (the verdict's key; keep it sentence-honest like our test names).
    abstract Name: string
    /// THE DST SEED — required by the interface; the world may only be built from this.
    abstract Seed: uint64
    /// Arrange: the seeded world. No ambient entropy — the double-run check will catch it.
    abstract Sim: uint64 -> 'World
    /// Act + observe: the banked measurement (equatable so the boundary can compare runs).
    abstract Mea: 'World -> 'Mea
    /// Assert: Ok () = the cut holds; Error = the honest failure text.
    abstract Cut: 'Mea -> Result<unit, string>

[<RequireQualifiedAccess>]
module TestLoop =

    /// The verdict — everything the boundary tracked, as a value.
    type Verdict =
        { Name: string
          Seed: uint64
          Passed: bool
          Failure: string option
          /// The replay line (DST): how to rerun THIS loop at THIS seed.
          Replay: string
          /// Did Sim+Mea replay byte-equal? (false = ambient entropy inside the loop — a
          /// boundary violation regardless of whether the cut passed.)
          Deterministic: bool }

    /// Run one loop with the boundary enforced (see the type doc — this is the ONE place).
    let run (loop: ITestLoop<'w, 'm>) : Verdict =
        let replay = sprintf "TestLoop.run %s @ seed 0x%X" loop.Name loop.Seed
        let attempt (phase: string) (f: unit -> 'a) : Result<'a, string> =
            try Ok(f ())
            with e -> Error(sprintf "%s threw (%s: %s) — exceptions stop at the boundary" phase (e.GetType().Name) e.Message)

        match attempt "Sim" (fun () -> loop.Sim loop.Seed) with
        | Error f -> { Name = loop.Name; Seed = loop.Seed; Passed = false; Failure = Some f; Replay = replay; Deterministic = true }
        | Ok world ->
            match attempt "Mea" (fun () -> loop.Mea world) with
            | Error f -> { Name = loop.Name; Seed = loop.Seed; Passed = false; Failure = Some f; Replay = replay; Deterministic = true }
            | Ok mea ->
                // THE DOUBLE-RUN CHECK: same seed, fresh world, measurements must agree.
                let deterministic =
                    match attempt "Sim(replay)" (fun () -> loop.Mea(loop.Sim loop.Seed)) with
                    | Ok mea2 -> mea2 = mea
                    | Error _ -> false
                let cut =
                    match attempt "Cut" (fun () -> loop.Cut mea) with
                    | Ok r -> r
                    | Error f -> Error f
                let failure =
                    match cut, deterministic with
                    | Error f, _ -> Some f
                    | Ok (), false -> Some "BOUNDARY: Sim+Mea did not replay byte-equal from the same seed — ambient entropy inside the loop"
                    | Ok (), true -> None
                { Name = loop.Name
                  Seed = loop.Seed
                  Passed = failure.IsNone
                  Failure = failure
                  Replay = replay
                  Deterministic = deterministic }

    /// THE GOLDEN LOCK, boundary-blessed (081KTSZN10008QG0R002J0GE0Z final slice): a canned Cut that byte-locks a
    /// rendering against golden rows — rooms inherit the treaty discipline the cartridges have.
    /// Honest on divergence: the FIRST diverging row is named with both byte sequences' heads.
    let cutGolden (golden: string list) (render: 'm -> string list) : 'm -> Result<unit, string> =
        fun mea ->
            let actual = render mea
            if List.length actual <> List.length golden then
                Error(sprintf "GOLDEN LOCK: row count diverged — golden %d rows, actual %d" (List.length golden) (List.length actual))
            else
                match List.zip golden actual |> List.tryFindIndex (fun (g, a) -> g <> a) with
                | None -> Ok()
                | Some i ->
                    let g, a = List.item i golden, List.item i actual
                    Error(sprintf "GOLDEN LOCK: row %d diverged — golden '%s' vs actual '%s'" i (g.Substring(0, min 48 g.Length)) (a.Substring(0, min 48 a.Length)))

    /// THE LIGHT (universal/port Light, 081KTSZN10008QG0R002J0GE0Z final slice): the verdict's truth in one glance.
    /// [REC ●] = something real was verified AND it replayed byte-equal; [off ○] = the cut
    /// failed (rehearsal until fixed); [!! ●] = AMBIENT — the loop passed or failed but did NOT
    /// replay byte-equal, which outranks everything (a nondeterministic pass proves nothing).
    let light (v: Verdict) : string =
        if not v.Deterministic then
            sprintf "[!! ●] AMBIENT %s — Sim+Mea did not replay byte-equal (%s)" v.Name v.Replay
        elif v.Passed then
            sprintf "[REC ●] LOCKED %s (%s)" v.Name v.Replay
        else
            sprintf "[off ○] FAILED %s — %s (%s)" v.Name (v.Failure |> Option.defaultValue "?") v.Replay

    /// Inline constructor — most loops are three lambdas and a seed (keep migration cheap).
    let make (name: string) (seed: uint64) (sim: uint64 -> 'w) (mea: 'w -> 'm) (cut: 'm -> Result<unit, string>) : ITestLoop<'w, 'm> =
        { new ITestLoop<'w, 'm> with
            member _.Name = name
            member _.Seed = seed
            member _.Sim s = sim s
            member _.Mea w = mea w
            member _.Cut m = cut m }
