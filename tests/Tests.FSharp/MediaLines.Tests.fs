module Zeta.Tests.MediaLinesTests

// MediaLines: our own media container — typed text sections, quote-based, generators-on-top for
// compression, and the EXPANSION LAW (unknown kinds carried, never errors). Plus Amara's card loaded
// CHIP-9-native: the roster's second portrait, her light XORing to white over the cyan.

open System.IO
open global.Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

[<Fact>]
let ``round-trip: parse then serialize is identity on the entries (text is the storage)`` () =
    let text = "meta\tname\tx\nframe\tidle\tdeadbeef\nanim\tgo\tidle,idle"
    match MediaLines.parse text with
    | Ok d -> Assert.Equal(text, MediaLines.serialize d)
    | Error e -> failwith e

[<Fact>]
let ``THE EXPANSION LAW: unknown kinds are carried byte-faithfully, never errors`` () =
    let future = "meta\tname\tx\nholo3d\tbust\tv2:zstd:base85:....\naudio-env\thum\tA440:adsr:1,2,3,4"
    match MediaLines.parse future with
    | Ok d ->
        Assert.Equal(2, List.length (MediaLines.carried d)) // the future rides along
        Assert.Equal(future, MediaLines.serialize d) // and survives transit byte-faithfully
    | Error e -> failwith e

[<Fact>]
let ``malformed lines are refused honestly with their line number`` () =
    match MediaLines.parse "meta\tname\tx\njustonefield" with
    | Error e -> Assert.Contains("line 2", e)
    | Ok _ -> failwith "should refuse"

[<Fact>]
let ``generators-on-top: a gen section is a KNOWN kind (regenerate, don't store the expansion)`` () =
    Assert.True(Set.contains "gen" MediaLines.knownKinds)

[<Fact>]
let ``AMARA'S CARD loads CHIP-9-native: portrait + light + five glyphs + the motto verbatim`` () =
    let text = File.ReadAllText(Path.Combine(repoRoot (), "rooms", "amara", "avatar.lines"))
    match MediaLines.parse text with
    | Error e -> failwith e
    | Ok d ->
        Assert.Equal(Some "WE ARE THE LIGHTED BOUNDARY THAT LETS GOOD WORK FLOW.", MediaLines.field "meta" "motto" d)
        Assert.Equal(5, List.length (MediaLines.ofKind "glyph" d)) // the halo's five values
        Assert.Equal(12, (MediaLines.field "frame" "portrait" d |> Option.get |> MediaLines.hexBytes).Length)
        Assert.Equal<MediaLines.Entry list>([], MediaLines.carried d) // today's card: all known kinds

[<Fact>]
let ``her light crosses to WHITE over the cyan — drawn by real CHIP-9 opcodes, like otto's heart`` () =
    let text = File.ReadAllText(Path.Combine(repoRoot (), "rooms", "amara", "avatar.lines"))
    let d = match MediaLines.parse text with | Ok d -> d | Error e -> failwith e
    let body = MediaLines.field "frame" "portrait" d |> Option.get |> MediaLines.hexBytes
    let light = MediaLines.field "sprite" "light" d |> Option.get |> MediaLines.hexBytes

    // draw via opcodes: plane 6 portrait at (0,0), then plane 1 light at (0,0)
    let put (addr: int) (bytes: byte[]) (f: Chip8Cow.Frame) =
        bytes |> Array.indexed |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (addr + i) b m.Mem }) f
    let rom =
        [| 0xF6uy; 0x01uy; 0xA3uy; 0x00uy; 0xD0uy; 0x0Cuy // plane 6; I=0x300; draw 12 rows
           0xF1uy; 0x01uy; 0xA3uy; 0x20uy; 0xD0uy; 0x0Cuy |] // plane 1; I=0x320; draw 12 rows
    let f =
        Chip8Cow.create 7UL
        |> put 0x300 body |> put 0x320 light
        |> fun f0 -> rom |> Array.indexed |> Array.fold (fun (m: Chip8Cow.Frame) (i, b) -> { m with Mem = Map.add (0x200 + i) b m.Mem }) f0
        |> fun f0 -> List.fold (fun acc _ -> Chip8Cow.step acc) f0 [ 1..6 ]

    Assert.Equal(7uy, Chip8Cow.colorAt 3 2 f) // the brow light: white (red XOR cyan)
    Assert.Equal(7uy, Chip8Cow.colorAt 3 9 f) // the heart cross: white
    Assert.Equal(6uy, Chip8Cow.colorAt 2 0 f) // the hair: cyan
    Assert.Equal(ZetaMax.Indexed8, ZetaMax.capabilityOf f) // a color citizen, like the rest of us

// ── many loops; the file defines its own sim·mea·cut ──

[<Fact>]
let ``a file carries MANY independent loops (anim + gen + sim) — no single master loop`` () =
    let text = "anim\tbreathe\tidle,blink\ngen\tstars\t" + GeneratorRegistry.idOf "boundary.scatter" 1 + "\t1\t99\t24\nsim\tpong\twheel-otto\nmeta\tname\tx"
    match MediaLines.parse text with
    | Ok d -> Assert.Equal(3, List.length (MediaLines.loops d))
    | Error e -> failwith e

[<Fact>]
let ``a file with sim+mea+cut IS a room declaration; media-only files honestly are not`` () =
    let room = "sim\tloop\twheel-otto\nmea\tdeltaU\tledger\ncut\tprogress\tepsilon:0.01,window:8"
    match MediaLines.parse room with
    | Ok d ->
        match MediaLines.roomOf d with
        | Some (s, m, c) ->
            Assert.Equal("loop", s.Name)
            Assert.Equal("deltaU", m.Name)
            Assert.Equal("progress", c.Name)
        | None -> failwith "should be a room"
    | Error e -> failwith e
    let media = "frame\tidle\tdeadbeef"
    match MediaLines.parse media with
    | Ok d -> Assert.True(MediaLines.roomOf d |> Option.isNone)
    | Error e -> failwith e

[<Fact>]
let ``the verb kinds are KNOWN (sim/mea/cut ride first-class, not carried as strangers)`` () =
    Assert.True(Set.contains "sim" MediaLines.knownKinds)
    Assert.True(Set.contains "mea" MediaLines.knownKinds)
    Assert.True(Set.contains "cut" MediaLines.knownKinds)

// ── live IO: declared by ZetaId; resolved live / injected / mock (the door law for buttons) ──

[<Fact>]
let ``io and button are first-class kinds; io declarations resolve by ZetaId`` () =
    Assert.True(Set.contains "io" MediaLines.knownKinds)
    Assert.True(Set.contains "button" MediaLines.knownKinds)
    let tvId = GeneratorRegistry.idOf "interface.universal-tv" 1
    let text = sprintf "io\ttv\t%s\nbutton\ta\tgo:hottest" tvId
    match MediaLines.parse text with
    | Ok d -> Assert.Equal(1, List.length (MediaLines.ioOf d))
    | Error e -> failwith e

[<Fact>]
let ``resolution is the capability calculus: live when the host has it; injected when the door grants; MOCK otherwise — never a crash`` () =
    let tvId = GeneratorRegistry.idOf "interface.universal-tv" 1
    let e: MediaLines.Entry = { Kind = "io"; Name = "tv"; Fields = [ tvId ] }
    Assert.Equal(MediaLines.Live tvId, MediaLines.resolveIo (Set.ofList [ tvId ]) Set.empty e)
    Assert.Equal(MediaLines.Injected tvId, MediaLines.resolveIo Set.empty (Set.ofList [ tvId ]) e)
    Assert.Equal(MediaLines.Mock tvId, MediaLines.resolveIo Set.empty Set.empty e) // degrades honestly

// ── constants (WHY and WHAT required), meta-dimensions, and the lint ──

[<Fact>]
let ``a constant without WHAT and WHY is a magic number — the lint refuses it`` () =
    let bad = "constant\tmax-laps\t1000"
    let good = "constant\tmax-laps\t1000\tthe SimLoop lap rail\tno one gets to run for infinity"
    match MediaLines.parse bad, MediaLines.parse good with
    | Ok b, Ok g ->
        Assert.Equal(1, List.length (MediaLines.lint b))
        Assert.Contains("magic number", (MediaLines.lint b |> List.head).Problem)
        Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint g)
    | _ -> failwith "parse failed"

[<Fact>]
let ``a dimension REBINDS the deep-pixel field — declared, never assumed; lint checks the declaration`` () =
    let ok = "dimension\tdepth\tuncertainty-field\tpsych-z-from-contrast-pairs"
    let bad = "dimension\tdepth"
    match MediaLines.parse ok, MediaLines.parse bad with
    | Ok o, Error _ -> Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint o)
    | Ok o, Ok b ->
        Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint o)
        Assert.Equal(1, List.length (MediaLines.lint b))
    | _ -> failwith "parse failed"

[<Fact>]
let ``the lint enforces DI-from-the-start: gen/io first fields must be 32-hex ZetaIds`` () =
    let bad = "gen\tstars\tnot-a-zetaid\t1\t99"
    let good = sprintf "gen\tstars\t%s\t1\t99" (GeneratorRegistry.idOf "boundary.scatter" 1)
    match MediaLines.parse bad, MediaLines.parse good with
    | Ok b, Ok g ->
        Assert.Equal(1, List.length (MediaLines.lint b))
        Assert.Equal<MediaLines.LintFinding list>([], MediaLines.lint g)
    | _ -> failwith "parse failed"

[<Fact>]
let ``the lint catches missing anim frames and duplicates — but stays SILENT on carried future kinds`` () =
    let doc = "frame\tidle\taa\nanim\tgo\tidle,missing\nmeta\tname\tx\nmeta\tname\ty\nholo3d\tbust\twhatever"
    match MediaLines.parse doc with
    | Ok d ->
        let findings = MediaLines.lint d
        Assert.True(findings |> List.exists (fun f -> f.Problem.Contains "missing frame 'missing'"))
        Assert.True(findings |> List.exists (fun f -> f.Problem = "duplicate (kind, name)"))
        Assert.False(findings |> List.exists (fun f -> f.Kind = "holo3d")) // the future is not a lint error
    | Error e -> failwith e
