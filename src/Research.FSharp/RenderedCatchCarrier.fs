namespace Zeta.Research

open System
open System.Buffers.Binary
open System.Security.Cryptography
open Zeta.Core

/// Private source/execution side of the acting fixture. None of these values is a policy input.
[<RequireQualifiedAccess>]
module RenderedCatchCarrier =
    type Geometry = Dot | Bar
    type AdmittedRom = private { Bytes: byte[]; Geometry: Geometry }
    type Advanced = { State: Chip8Cow.Frame; Frame: GameEnvironment.Frame; Counters: RenderedCatchReceipt.Counters }
    let private fail code detail = Error(RenderedCatchReceipt.failure "carrier" code detail)
    let sha256 (bytes: byte[]) = SHA256.HashData bytes |> Convert.ToHexString
    let binaryString (values: int[]) = values |> Array.map (fun value -> if value = 0 then '0' else '1') |> String
    let romBytes admitted = Array.copy admitted.Bytes
    let geometry = function "dot" -> Ok Dot | "bar" -> Ok Bar | _ -> fail "geometry" "unknown catch geometry"
    let compile shape (symbols: int[]) =
        if isNull symbols || symbols.Length <> 66 || Array.exists (fun value -> value <> 0 && value <> 1) symbols then
            fail "symbols" "catch ROM requires exactly 66 binary source symbols"
        else
            let bytes = ResizeArray<byte>(2247)
            let emit opcode = bytes.Add(byte (opcode >>> 8)); bytes.Add(byte (opcode &&& 255))
            for opcode in [0x00E0;0x6118;0x6300 ||| (if shape = Bar then 20 else 8);0x6404;0x651A;0x6200 ||| (16 + 32 * symbols.[0]);0xAAC6;0xD231] do emit opcode
            for _ in 1 .. 9 do emit 0x6E00
            for index in 1 .. 65 do
                for opcode in [0xF00A;0x800E;0x800E;0x800E;0x800E;0x800E;0x7010;0x00E0;0xAAC6;0xD011;
                               0x6200 ||| (16 + 32 * symbols.[index]);0xD211;0x86F0;0xD211;0xD231;0xF629;0xD455] do emit opcode
            emit 0x1AC4
            bytes.Add(if shape = Bar then 0xE0uy else 0x80uy)
            Ok(bytes.ToArray())

    /// Reconstruct only the permitted X operands and compare every ROM byte against the template.
    let admit shape (bytes: byte[]) =
        if isNull bytes || bytes.Length <> 2247 then fail "rom-budget" "catch ROM must be exactly 2247 bytes"
        else
            let mutable valid = true
            let symbols = Array.init 66 (fun index ->
                let offset = if index = 0 then 11 else index * 34 + 21
                let x = int bytes.[offset]
                if x <> 16 && x <> 48 then valid <- false
                (x - 16) / 32)
            if not valid then fail "rom-coordinate" "noncanonical target X operand"
            else
                compile shape symbols |> Result.bind (fun expected ->
                    if bytes <> expected then fail "rom-opcode" "noncanonical catch opcode, operand, font bound, or sprite"
                    else Ok { Bytes = Array.copy bytes; Geometry = shape })

    let sample (stream: ResearchRandom.Stream) probability =
        if not (Double.IsFinite probability) || (probability <> 0.75 && probability <> 0.5) then fail "source-law" "unregistered source probability"
        else
            let row = Array.zeroCreate 66
            for index in 0 .. 65 do
                let draw = stream.Next()
                row.[index] <- if index < 2 then int (2.0 * draw) elif draw < probability then row.[index - 2] else 1 - row.[index - 2]
            Ok row

    let topBackground (frame: GameEnvironment.Frame) =
        if frame.W <> 64 || frame.H <> 32 || frame.Palette <> 2 || isNull frame.Cells || frame.Cells.Length <> 2048
           || Array.exists (fun value -> value > 1uy) frame.Cells then fail "frame" "requires a complete 64x32 binary frame"
        else
            // Structural noninterference boundary: this loop never reads indices 1536..2047.
            let mutable ones = 0
            for index in 0 .. 1535 do ones <- ones + int frame.Cells.[index]
            if ones = 768 then fail "background-tie" "top-band background has no unique majority"
            else Ok(if ones > 768 then 1uy else 0uy)

    let project frame =
        topBackground frame |> Result.map (fun background ->
            let cells = Array.create 2048 background
            Array.Copy(frame.Cells, cells, 1536)
            { frame with Cells = cells })

    let decodeProjection frame =
        topBackground frame |> Result.bind (fun background ->
            if frame.Cells.[1536..] |> Array.exists (fun cell -> cell <> background) then fail "projection-padding" "policy frame contains lower-band information"
            else RenderedSignalCarrier.decode frame |> Result.mapError (RenderedCatchReceipt.failure "policy-observation" "beacon"))

    let reward frame =
        topBackground frame |> Result.bind (fun background ->
            let matches digit =
                [0 .. 4] |> List.forall (fun y ->
                    [0 .. 3] |> List.forall (fun x ->
                        let expected = (Chip8.fontSet.[digit * 5 + y] >>> (7 - x)) &&& 1uy
                        (frame.Cells.[(26 + y) * 64 + 4 + x] ^^^ background) = expected))
            match matches 0, matches 1 with
            | true, false -> Ok 0
            | false, true -> Ok 1
            | _ -> fail "feedback" "rendered feedback is neither exact font glyph 0 nor 1")

    let create admitted =
        let environment = GameEnvironment.Chip8Adapter(admitted.Bytes, 1UL, 17) :> GameEnvironment.IEnvironment<Chip8Cow.Frame>
        environment.Reset() |> Result.mapError (sprintf "%A" >> RenderedCatchReceipt.failure "carrier" "reset")
        |> Result.map (fun state -> environment, state)

    /// Real adapter execution followed by a separately observed 17-transition shadow audit.
    /// The supplied trace callback consumes bytes immediately; its six-byte scratch array is reused.
    let advance admitted (environment: GameEnvironment.IEnvironment<Chip8Cow.Frame>) (before: Chip8Cow.Frame) observationIndex action invert (onTrace: byte[] -> unit) (onCounters: RenderedCatchReceipt.Counters -> unit) =
        let mutable counters = RenderedCatchReceipt.zeroCounters
        let account delta = counters <- RenderedCatchReceipt.addCounters counters delta; onCounters delta
        let key =
            match observationIndex, action with
            | 0, ControlScheme.Go "stay" -> Ok None
            | index, ControlScheme.Pad value when index > 0 && index < 66 && (value = 0 || value = 1) -> Ok(Some value)
            | _ -> fail "key" "only bootstrap stay then 65 Pad0/Pad1 actions are admitted"
        key |> Result.bind (fun key ->
            if observationIndex < 0 || observationIndex >= 66 || int before.PC <> 0x200 + observationIndex * 34
               || isNull before.V || before.V.Length <> 16 || isNull before.Keys || before.Keys.Length <> 16 || before.Fault.IsSome then
                fail "pre-state" "invalid catch episode index, boundary PC, register shape, or fault"
            else
                account { RenderedCatchReceipt.zeroCounters with EnvironmentCalls = 1; KeyActions = (if key.IsSome then 1 else 0); ScoredChoices = (if observationIndex >= 2 then 1 else 0) }
                environment.Step(before, action) |> Result.mapError (sprintf "%A" >> RenderedCatchReceipt.failure "carrier" "step")
                |> Result.bind (fun primary ->
                    account { RenderedCatchReceipt.zeroCounters with PrimaryInstructions = 17; TotalTransitions = 17; PrimaryTimerTicks = 1 }
                    let keys = Array.zeroCreate<bool> 16
                    key |> Option.iter (fun value -> keys.[value] <- true)
                    let mutable shadow = { before with Keys = keys }
                    let scratch = Array.zeroCreate<byte> 6
                    let mutable failure = None
                    for offset in 0 .. 16 do
                        if failure.IsNone then
                            let pc = 0x200 + observationIndex * 34 + offset * 2
                            let actualPc = int shadow.PC
                            let read address = Map.tryFind address shadow.Mem |> Option.defaultValue 0uy |> int
                            let opcode = (read actualPc <<< 8) ||| read (actualPc + 1)
                            let expectedOpcode = (int admitted.Bytes.[pc - 0x200] <<< 8) ||| int admitted.Bytes.[pc - 0x200 + 1]
                            if actualPc <> pc || opcode <> expectedOpcode then failure <- Some(RenderedCatchReceipt.failure "shadow" "pc-opcode" "observed pre-PC/opcode disagrees with admitted ROM")
                            else
                                shadow <- Chip8Cow.step shadow
                                account { RenderedCatchReceipt.zeroCounters with ShadowInstructions = 1; TotalTransitions = 1 }
                                if int shadow.PC <> pc + 2 || shadow.Fault.IsSome then failure <- Some(RenderedCatchReceipt.failure "shadow" "post-pc" "observed post-PC/fault violates advancing group")
                                else
                                    BinaryPrimitives.WriteUInt16LittleEndian(scratch.AsSpan(0,2), uint16 pc)
                                    BinaryPrimitives.WriteUInt16LittleEndian(scratch.AsSpan(2,2), uint16 opcode)
                                    BinaryPrimitives.WriteUInt16LittleEndian(scratch.AsSpan(4,2), shadow.PC)
                                    onTrace scratch
                    match failure with
                    | Some reason -> Error reason
                    | None ->
                        shadow <- Chip8Cow.tick shadow
                        account { RenderedCatchReceipt.zeroCounters with ShadowTimerTicks = 1 }
                        if shadow <> primary then fail "group-state" "shadow and adapter group-end states disagree"
                        else
                            account { RenderedCatchReceipt.zeroCounters with AdapterGroupsChecked = 1 }
                            environment.Frame primary |> Result.mapError (sprintf "%A" >> RenderedCatchReceipt.failure "carrier" "frame")
                            |> Result.map (fun raw ->
                                let frame = if invert then { raw with Cells = Array.map (fun cell -> 1uy - cell) raw.Cells } else raw
                                { State = primary; Frame = frame; Counters = counters })))
