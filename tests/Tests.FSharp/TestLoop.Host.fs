module Zeta.Tests.TestLoopHostTests

// THE XUNIT HOST ADAPTER + the first three migrated loops (B-1035 slice 1). xUnit is demoted to
// host: one thin shim runs any ITestLoop; CI/IDE tooling unchanged. All three exemplars are
// SEALED (no disk, no git, no tools — modeling the Reticulum-only clause before Reticulum):
// inputs are inline; the world is built from the seed.

open global.Xunit
open Zeta.Core

/// The whole adapter — the host owes the framework nothing but a pass/fail surface.
let private host (loop: ITestLoop<'w, 'm>) =
    let v = TestLoop.run loop
    Assert.True(v.Passed, sprintf "%s — %s [%s]" v.Name (defaultArg v.Failure "?") v.Replay)

// ── exemplar 1: a shape-acceptance loop (sealed — inline cartridge, no repoRoot/disk) ──
[<Fact>]
let ``LOOP 1 (acceptance): a minimal in-memory cartridge passes the hard gate — sim parses, mea gates, cut reads the verdicts`` () =
    host (
        TestLoop.make
            "acceptance: minimal cartridge through the hard gate"
            4UL
            (fun _ ->
                // the world: an inline cartridge (no file IO inside the loop — the sealed model)
                "meta\tname\tshape-vibes-free\nconstant\tn\t4\twhat\twhy\ntreaty\tfsharp\tbytes\tratified\tinline\n"
                |> MediaLines.parse)
            (fun world ->
                match world with
                | Ok d -> MediaLines.lint d |> List.length, MediaLines.treatiesOf d
                | Error e -> failwith e)
            (fun (lintCount, treaties) ->
                if lintCount <> 0 then Error(sprintf "%d lint findings on a clean cartridge" lintCount)
                elif not (treaties |> List.exists (fun (o, r, v) -> o = "fsharp" && r = "bytes" && v = "ratified")) then Error "treaty line lost"
                else Ok()))

// ── exemplar 2: a DST replay loop (chip8 from seed; the double-run check does the DST claim) ──
[<Fact>]
let ``LOOP 2 (DST): a chip8 run from the seed measures a stable display digest — replay equality is enforced BY the framework, not asserted by me`` () =
    host (
        TestLoop.make
            "dst: chip8 16-step display digest from seed"
            7UL
            (fun seed ->
                Chip8Cow.create seed
                |> Chip8Cow.loadRom [| 0xA3uy; 0x00uy; 0x60uy; 0x05uy; 0x61uy; 0x03uy; 0xD0uy; 0x14uy |]
                |> fun f -> { f with Mem = [ 0..3 ] |> List.fold (fun m k -> Map.add (0x300 + k) 0xF0uy m) f.Mem })
            (fun f0 ->
                let final = [ 1..16 ] |> List.fold (fun f _ -> Chip8Cow.step f) f0
                // the measurement: a textual digest of the lit cells (equatable, byte-comparable)
                [ for y in 0..31 do
                      for x in 0..63 do
                          if Chip8Cow.colorAt x y final <> 0uy then yield sprintf "%d,%d" x y ]
                |> String.concat ";")
            (fun digest ->
                if digest.Contains "5,3" then Ok() // the sprite's origin cell lit
                else Error(sprintf "expected the sprite at (5,3); digest=%s" digest)))

// ── exemplar 3: an io/red-light loop (sealed — in-memory capability sets) ──
[<Fact>]
let ``LOOP 3 (red light): the binding ladder renders honest lights — REC for live, off for mock`` () =
    host (
        TestLoop.make
            "red light: ladder bindings render their truth"
            4UL
            (fun _ ->
                let have = GeneratorRegistry.idOf "algebra.braid-memory" 1
                let want = GeneratorRegistry.idOf "algebra.z2-parity" 1
                have, want)
            (fun (have, want) ->
                let d =
                    sprintf "meta\tname\tdemo\nio\ttape\t%s\nio\tmic\t%s\n" have want
                    |> MediaLines.parse
                    |> function Ok d -> d | Error e -> failwith e
                MediaLines.bindingsReport (MediaLines.resolveIo (Set.ofList [ have ]) Set.empty) d
                |> List.map MediaLines.bindingLight
                |> String.concat "\n")
            (fun lights ->
                if not (lights.Contains "[REC ●] tape LIVE") then Error "live binding lost its light"
                elif not (lights.Contains "[off ○] mic MOCK") then Error "mock binding failed to declare itself"
                else Ok()))

// ── the boundary's own falsifiers (a gate never seen rejecting proves nothing) ──
[<Fact>]
let ``THE BOUNDARY REJECTS: an ambient-entropy loop fails the double-run check even though its cut passes`` () =
    let v =
        TestLoop.run (
            TestLoop.make "entropy smuggler" 4UL
                (fun _ -> ())
                (fun () -> System.Guid.NewGuid().ToString()) // ambient — exactly what the boundary exists to catch
                (fun _ -> Ok()))
    Assert.False v.Passed
    Assert.False v.Deterministic
    Assert.Contains("ambient entropy", v.Failure |> Option.defaultValue "")

[<Fact>]
let ``THE GLASS-SIDE RULING IS MECHANICAL: a loop that smuggles the wall clock into Mea fails the double-run check — no wall clock in the room`` () =
    // Aaron 2026-06-11: "glass-side only no wall clock in the room." Not a convention — the
    // boundary itself refuses the clock: two runs from one seed read two different timestamps.
    let v =
        TestLoop.run (
            TestLoop.make "clock smuggler" 4UL
                (fun _ -> ())
                (fun () -> System.Diagnostics.Stopwatch.GetTimestamp())
                (fun _ -> Ok()))
    Assert.False v.Passed
    Assert.False v.Deterministic
    Assert.Contains("ambient entropy", v.Failure |> Option.defaultValue "")

[<Fact>]
let ``THE BOUNDARY CATCHES THROWS: an exception in Mea becomes a named-phase Failure value, never an escaped throw`` () =
    let v =
        TestLoop.run (
            TestLoop.make "thrower" 4UL (fun _ -> ()) (fun () -> failwith "boom" |> ignore; 1) (fun _ -> Ok()))
    Assert.False v.Passed
    Assert.Contains("Mea threw", v.Failure |> Option.defaultValue "")
    Assert.Contains("seed 0x4", v.Replay)
