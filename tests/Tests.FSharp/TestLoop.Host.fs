module Zeta.Tests.TestLoopHostTests

// SEALED-ROOM — 081KTSZN10008QG0R002J0GE0Z Reticulum-only clause: the loops in this file run sealed (no filesystem,
// process, network, clock, or ambient entropy). Enforced by tools/hygiene/audit-sealed-rooms.ts
// in the gate; deliberate violations in falsifiers carry a SEAL-WAIVER line.

// THE XUNIT HOST ADAPTER + the first three migrated loops (081KTSZN10008QG0R002J0GE0Z slice 1). xUnit is demoted to
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
                (fun () -> System.Guid.NewGuid().ToString()) // SEAL-WAIVER: falsifier — proves the boundary rejects ambient entropy
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
                (fun () -> System.Diagnostics.Stopwatch.GetTimestamp()) // SEAL-WAIVER: falsifier — proves the glass-side ruling is mechanical
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

// ── 081KTSZN10008QG0R002J0GE0Z FINAL SLICES: the golden lock + the light, boundary-blessed; the chip9-board host ──
let private chip9TreatyGoldenLines =
    [ "rom\ta300603c6a02d0a860026a1cd0a8603c6a1cd0a860006a0cd0a1603cd0a16c006d183f01dcd1f601603c6a12d0a1f101d0a0"
      "plane\t1"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "1111111100000000000000000000000000000000000000000000000000001111"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000006666"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "1111111100000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0000000000000000000000000000000000000000000000000000000000000000"
      "0011111111000000000000000000000000000000000000000000000000001111"
      "0011111111000000000000000000000000000000000000000000000000001111"
      "0011111111000000000000000000000000000000000000000000000000001111"
      "0011111111000000000000000000000000000000000000000000000000001111" ]

[<Fact>]
let ``THE GOLDEN LOCK IS BOUNDARY-BLESSED: cutGolden locks byte-for-byte and names the first diverging row honestly`` () =
    let cut = TestLoop.cutGolden [ "row-a"; "row-b" ] id
    Assert.Equal(Ok(), cut [ "row-a"; "row-b" ])
    match cut [ "row-a"; "row-X" ] with
    | Ok() -> failwith "divergence must refuse"
    | Error e ->
        Assert.Contains("row 1 diverged", e)
        Assert.Contains("row-X", e)
    match cut [ "row-a" ] with
    | Ok() -> failwith "row-count divergence must refuse"
    | Error e -> Assert.Contains("row count diverged", e)

[<Fact>]
let ``THE LIGHT: one glance — LOCKED on a deterministic pass, FAILED on a cut, and AMBIENT OUTRANKS EVERYTHING`` () =
    let locked = TestLoop.run (TestLoop.make "locked" 4UL (fun _ -> 1) (fun w -> w + 1) (fun _ -> Ok()))
    Assert.StartsWith("[REC ●] LOCKED", TestLoop.light locked)
    let failed = TestLoop.run (TestLoop.make "failed" 4UL (fun _ -> 1) (fun w -> w) (fun _ -> Error "the cut says no"))
    Assert.StartsWith("[off ○] FAILED", TestLoop.light failed)
    let ambient =
        TestLoop.run (
            TestLoop.make "ambient" 4UL
                (fun _ -> ())
                (fun () -> System.Guid.NewGuid().ToString()) // SEAL-WAIVER: falsifier — the light must show AMBIENT
                (fun _ -> Ok()))
    Assert.StartsWith("[!! ●] AMBIENT", TestLoop.light ambient)

[<Fact>]
let ``THE CHIP9-BOARD HOST: the four-oracle treaty golden replays through the framework — rooms inherit the lock`` () =
    // The real treaty golden is preloaded as warm-cache data; the loop itself runs sealed.
    let lines = chip9TreatyGoldenLines
    let romHex = (List.item 0 lines).Split('\t').[1]
    let rom = [| for i in 0 .. romHex.Length / 2 - 1 -> System.Convert.ToByte(romHex.Substring(i * 2, 2), 16) |]
    let goldenGrid = List.item 1 lines :: (lines |> List.skip 2 |> List.truncate Chip8.DisplayH)
    // board render adds fault+pc lines after the grid; the treaty grid is the locked prefix
    let cut = TestLoop.cutGolden goldenGrid (fun (rows: string list) -> rows |> List.truncate (1 + Chip8.DisplayH))
    let verdict =
        TestLoop.run (Chip9Board.loop "chip9 treaty via the board host" 7UL rom [ for k in 0..7 -> 0x300 + k, 0xFFuy ] 30 cut)
    Assert.True(verdict.Passed, TestLoop.light verdict)
    Assert.True(verdict.Deterministic)
    Assert.StartsWith("[REC ●] LOCKED", TestLoop.light verdict)

[<Fact>]
let ``THE BOARD HOST CARRIES THE FAULT REGISTER: the overflow treaty vector replays as a sealed loop`` () =
    let overflowRom = [| for k in 0..16 do
                           let op = 0x2202 + 2 * k
                           yield byte (op >>> 8)
                           yield byte (op &&& 0xFF) |]
    let cut (rows: string list) =
        let has (s: string) = rows |> List.exists (fun r -> r = s)
        if has "fault\tstack overflow: CALL (2NNN) at depth 16 refused" && has "pc\t0222" then Ok()
        else Error(sprintf "fault/pc lines wrong: %A" (rows |> List.skip (1 + Chip8.DisplayH)))
    let verdict = TestLoop.run (Chip9Board.loop "overflow fault via the board host" 7UL overflowRom [] 17 cut)
    Assert.True(verdict.Passed, TestLoop.light verdict)
