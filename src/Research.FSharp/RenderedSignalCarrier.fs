namespace Zeta.Research

open System
open System.Diagnostics
open System.Security.Cryptography
open Zeta.Core

/// A source-owned animation carrier. Only decoded rendered observations enter learners.
[<RequireQualifiedAccess>]
module RenderedSignalCarrier =
    type Renderer = TrainDot | HeldoutBar | Nuisance
    type Diagnostics = { Comparisons: int; StructureChanges: int; PaletteChanges: int; PlacementChanges: int }
    type Fingerprints = { RomSha256: string; FrameSha256: string; TokenSha256: string; Sequences: int; Frames: int }
    type Resource = { ElapsedMilliseconds: float; CpuMilliseconds: float; AllocatedBytes: int64 }
    type Corpus = { Tokens: int[][]; Fingerprints: Fingerprints; Diagnostics: Diagnostics; Generation: Resource; Extraction: Resource }

    let name = function TrainDot -> "train-dot" | HeldoutBar -> "heldout-bar" | Nuisance -> "nuisance"
    let renderer = function "train-dot" -> Ok TrainDot | "heldout-bar" -> Ok HeldoutBar | "nuisance" -> Ok Nuisance | _ -> Error "unknown rendered carrier"
    let sha256 (bytes: byte[]) = SHA256.HashData bytes |> Convert.ToHexString
    let zeroDiagnostics = { Comparisons = 0; StructureChanges = 0; PaletteChanges = 0; PlacementChanges = 0 }
    let addDiagnostics a b =
        { Comparisons = a.Comparisons + b.Comparisons; StructureChanges = a.StructureChanges + b.StructureChanges
          PaletteChanges = a.PaletteChanges + b.PaletteChanges; PlacementChanges = a.PlacementChanges + b.PlacementChanges }
    let measure action =
        use proc = Process.GetCurrentProcess()
        let cpu = proc.TotalProcessorTime
        let allocated = GC.GetAllocatedBytesForCurrentThread()
        let timer = Stopwatch.StartNew()
        let value = action ()
        timer.Stop()
        value, { ElapsedMilliseconds = timer.Elapsed.TotalMilliseconds; CpuMilliseconds = (proc.TotalProcessorTime - cpu).TotalMilliseconds
                 AllocatedBytes = GC.GetAllocatedBytesForCurrentThread() - allocated }

    let sample (stream: ResearchRandom.Stream) length probability start duration =
        if length < 2 || length > 256 || not (Double.IsFinite probability) || probability < 0.0 || probability > 1.0
           || start < 2 || duration < 0 || (duration > 0 && (start >= length || duration > length - start)) then
            Error "source requires 2..256 symbols and a bounded change interval"
        else
            let tokens = Array.zeroCreate length
            for t in 0 .. length - 1 do
                let draw = stream.Next()
                if t < 2 then tokens.[t] <- int (2.0 * draw)
                else
                    let p = if t >= start && t < start + duration then probability else 0.75
                    tokens.[t] <- if draw < p then tokens.[t - 2] else 1 - tokens.[t - 2]
            Ok tokens

    let private layout renderer count =
        let groupBytes = if renderer = Nuisance then 12 else 8
        groupBytes, 0x204 + groupBytes * count

    let compile renderer (tokens: int[]) =
        if isNull tokens || tokens.Length < 1 || tokens.Length > 256 || Array.exists (fun t -> t <> 0 && t <> 1) tokens then
            Error "carrier requires 1..256 binary symbols"
        else
            let groupBytes, sprite = layout renderer tokens.Length
            let size = sprite - 0x200 + (if renderer = Nuisance then 2 else 1)
            if size > Chip8.MemSize - Chip8.ProgramStart then Error "ROM exceeds classic CHIP-8 program memory"
            else
                let bytes = ResizeArray<byte>()
                let emit opcode = bytes.Add(byte (opcode >>> 8)); bytes.Add(byte (opcode &&& 255))
                emit (0x6100 ||| (if renderer = HeldoutBar then 20 else 8))
                emit (0xA000 ||| sprite)
                for t in 0 .. tokens.Length - 1 do
                    let bar = renderer = HeldoutBar || (renderer = Nuisance && t % 2 = 1)
                    if renderer = Nuisance then
                        emit (0x6100 ||| (if bar then 20 else 8))
                        emit (0xA000 ||| (sprite + (if bar then 1 else 0)))
                    emit 0x00E0
                    emit (0x6000 ||| ((if bar then 14 else 16) + 32 * tokens.[t]))
                    emit 0xD011
                    let next = 0x204 + groupBytes * (t + 1)
                    emit (0x1000 ||| (if t = tokens.Length - 1 then next - 2 else next))
                bytes.Add(if renderer = HeldoutBar then 0xE0uy else 0x80uy)
                if renderer = Nuisance then bytes.Add 0xE0uy
                Ok(bytes.ToArray())

    /// Validate the complete tiny carrier before an opcode reaches the mutable emulator.
    let validateRom renderer count (rom: byte[]) =
        if count < 1 || count > 256 || isNull rom then Error "invalid ROM or frame count"
        else
            let groupBytes, sprite = layout renderer count
            let size = sprite - 0x200 + (if renderer = Nuisance then 2 else 1)
            if rom.Length <> size || rom.Length > Chip8.MemSize - Chip8.ProgramStart then Error "ROM shape or budget mismatch"
            else
                let mutable valid = true
                let tokens = Array.init count (fun t ->
                    let bar = renderer = HeldoutBar || (renderer = Nuisance && t % 2 = 1)
                    let index = 4 + t * groupBytes + (if renderer = Nuisance then 4 else 0) + 3
                    let coordinate = int rom.[index] - (if bar then 14 else 16)
                    if coordinate <> 0 && coordinate <> 32 then valid <- false
                    coordinate / 32)
                if not valid then Error "noncanonical beacon coordinate"
                else
                    compile renderer tokens |> Result.bind (fun expected ->
                        if rom.AsSpan().SequenceEqual(expected.AsSpan()) then Ok() else Error "noncanonical carrier opcode or sprite")

    let decode (frame: GameEnvironment.Frame) =
        if frame.W <> 64 || frame.H <> 32 || frame.Palette <> 2 then Error "beacon requires a 64x32 binary-palette frame"
        else
            FrameSignals.observe frame |> Result.mapError (sprintf "%A") |> Result.bind (fun signals ->
                match signals.Components with
                | [ region ] when region.Origin.X / 32 = (region.Origin.X + region.Shape.Width - 1) / 32 ->
                    FrameMotion.observe FrameMotion.empty frame |> Result.mapError (sprintf "%A") |> Result.bind (fun motion ->
                        match motion.Current with Some point -> Ok(point.X / 32) | None -> Error "missing beacon centroid")
                | _ -> Error "beacon must be one component entirely within one horizontal half")

    /// The callback sees copied rendered cells only. Every opcode and resulting PC are checked.
    let renderRom renderer count (rom: byte[]) (onFrame: GameEnvironment.Frame -> unit) =
        validateRom renderer count rom |> Result.bind (fun () ->
            let machine = Chip8.create 1UL
            Chip8.loadRom rom machine
            let groupBytes, _ = layout renderer count
            let tokens = Array.zeroCreate count
            let mutable failure = None
            let mutable previous = None
            let mutable diagnostics = zeroDiagnostics
            let step () =
                if failure.IsNone then
                    let pc = int machine.PC
                    if pc < 0x200 || pc + 1 >= 0x200 + rom.Length then failure <- Some "program counter outside admitted ROM"
                    else
                        let opcode = (int machine.Mem.[pc] <<< 8) ||| int machine.Mem.[pc + 1]
                        let expected = if opcode &&& 0xF000 = 0x1000 then opcode &&& 0xFFF else pc + 2
                        Chip8.step machine
                        if int machine.PC <> expected then failure <- Some "emulator program counter disagrees with admitted opcode"
            step (); step ()
            for t in 0 .. count - 1 do
                for _ in 1 .. groupBytes / 2 do step ()
                if failure.IsNone then
                    let invert = renderer = Nuisance && t % 2 = 1
                    let cells = machine.Display |> Array.map (fun lit -> if lit <> invert then 1uy else 0uy)
                    let frame: GameEnvironment.Frame = { W = 64; H = 32; Palette = 2; Cells = cells }
                    match decode frame with
                    | Error reason -> failure <- Some reason
                    | Ok token ->
                        tokens.[t] <- token
                        match previous with
                        | None -> ()
                        | Some prior ->
                            match FrameSignals.compare prior frame with
                            | Error reason -> failure <- Some(sprintf "%A" reason)
                            | Ok delta -> diagnostics <- addDiagnostics diagnostics
                                                            { Comparisons = 1; StructureChanges = if delta.StructureChanged then 1 else 0
                                                              PaletteChanges = if delta.PaletteChanged then 1 else 0
                                                              PlacementChanges = if delta.PlacementChanged then 1 else 0 }
                        previous <- Some frame
                        onFrame frame
            match failure with Some reason -> Error reason | None -> Ok(tokens, diagnostics))

    /// Corpus truth is used only for extraction conformance, never as fallback input.
    let corpus renderer count length seed domain probability start duration =
        if count < 1 || count > 65536 then Error "corpus count must be in 1..65536"
        else
            let stream = ResearchRandom.Stream(ResearchRandom.domain seed domain)
            let (generated, generation) = measure (fun () ->
                let rows = ResizeArray<int[] * byte[]>()
                let mutable failure = None
                for _ in 1 .. count do
                    if failure.IsNone then
                        match sample stream length probability start duration |> Result.bind (fun tokens -> compile renderer tokens |> Result.map (fun rom -> tokens, rom)) with
                        | Ok row -> rows.Add row
                        | Error reason -> failure <- Some reason
                match failure with Some reason -> Error reason | None -> Ok(rows.ToArray()))
            generated |> Result.bind (fun generatedRows ->
                use romHash = IncrementalHash.CreateHash HashAlgorithmName.SHA256
                use frameHash = IncrementalHash.CreateHash HashAlgorithmName.SHA256
                use tokenHash = IncrementalHash.CreateHash HashAlgorithmName.SHA256
                let (extracted, extraction) = measure (fun () ->
                    let rows = ResizeArray<int[]>()
                    let mutable failure = None
                    let mutable diagnostics = zeroDiagnostics
                    for truth, rom in generatedRows do
                        if failure.IsNone then
                            romHash.AppendData rom
                            match renderRom renderer length rom (fun frame -> frameHash.AppendData frame.Cells) with
                            | Error reason -> failure <- Some reason
                            | Ok(tokens, delta) ->
                                if tokens <> truth then failure <- Some "rendered extraction disagrees with source truth"
                                else
                                    tokenHash.AppendData(Array.map byte tokens)
                                    rows.Add tokens
                                    diagnostics <- addDiagnostics diagnostics delta
                    match failure with Some reason -> Error reason | None -> Ok(rows.ToArray(), diagnostics))
                extracted |> Result.map (fun (rows, diagnostics) ->
                    { Tokens = rows; Diagnostics = diagnostics; Generation = generation; Extraction = extraction
                      Fingerprints = { RomSha256 = romHash.GetHashAndReset() |> Convert.ToHexString; FrameSha256 = frameHash.GetHashAndReset() |> Convert.ToHexString
                                       TokenSha256 = tokenHash.GetHashAndReset() |> Convert.ToHexString; Sequences = count; Frames = count * length } }))
