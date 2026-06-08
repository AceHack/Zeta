// Watch the soft emulator play — both modes (hard screen + ghost heatmap).
//
// Prereq:  dotnet build src/Core/Core.fsproj -c Release
// Usage (from the repo root):
//   dotnet fsi samples/watch-soft-emu.fsx <path-to-rom.ch8> [frames] [snapshotEvery]
//
// ROMs are reference-only (gitignored under references/prior-art/chip8-roms/) — pass your own path.

#r "../src/Core/bin/Release/net10.0/Zeta.Core.dll"
open Zeta.Core

let argv = System.Environment.GetCommandLineArgs()
let romPath =
    if argv.Length > 2 then argv.[2]
    else failwith "usage: dotnet fsi samples/watch-soft-emu.fsx <rom.ch8> [frames] [snapshotEvery]"
let frames = if argv.Length > 3 then int argv.[3] else 60
let every = if argv.Length > 4 then int argv.[4] else 15

let rom = System.IO.File.ReadAllBytes romPath
let cyc = 8
let value = SoftDashboard.empowerment 3

printfn "Playing %s for %d frames (snapshot every %d)\n" (System.IO.Path.GetFileName romPath) frames every

let mutable cur = Chip8Cow.create 42UL |> Chip8Cow.loadRom rom
for i in 1..frames do
    // calibrated soft controller: resolve the soft value to an action (holds when not confident)
    let keys = SoftActionController.resolve 0.30 0.5 value cyc 3 6 cur
    cur <- Chip8Cow.frameStep cyc { cur with Keys = keys }
    if i % every = 0 then
        let k = keys |> Array.tryFindIndex id |> Option.defaultValue -1
        // HARD MODE: the actual screen
        printfn "%s" (SoftScope.renderFrameCaptioned (sprintf "frame %d  PC=0x%03X  key=%d  [HARD screen]" i (int cur.PC) k) cur)
        // GHOST MODE: P(lit) over a short soft look-ahead from here
        let mutable ghost = SoftEmu.pure1 cur
        for _ in 1..4 do ghost <- SoftEmu.softFrame cyc ghost |> SoftEmu.prune 16
        printfn "[GHOST heatmap — %s]" (SoftScope.observables ghost)
        printfn "%s\n" (SoftScope.renderGhost ghost)
