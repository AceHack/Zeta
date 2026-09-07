namespace Zeta.Research

open System
open System.Buffers.Binary
open System.Globalization

/// Pure wire records for the registered action-only service. Runtime/archive
/// capabilities and private evaluator state are not choice-service inputs.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledReceipt =
    [<AllowNullLiteral; Sealed>]
    type Failure(stage: string, code: string, detail: string, panel: string, mode: string, strategy: string,
                 replicate: Nullable<int>, episode: Nullable<int>, call: Nullable<int64>) =
        member _.Stage = stage
        member _.Code = code
        member _.Detail = detail
        member _.Panel = panel
        member _.Mode = mode
        member _.Strategy = strategy
        member _.Replicate = replicate
        member _.Episode = episode
        member _.Call = call

    let failure stage code detail = Failure(stage, code, detail, null, null, null, Nullable(), Nullable(), Nullable())
    let fromPrevious (reason: HiddenSwitchReceipt.Failure) =
        Failure(reason.Stage, reason.Code, reason.Detail, reason.Panel, null, reason.Arm,
                Nullable(), reason.Episode, Nullable())

    /// Path: 0 native, 1 certified-switch, 2 certified-harvest,
    /// 3 certified-trivial-harvest, 4 fallback. The six counts are executed work.
    [<Struct>]
    type ChoiceWork =
        { Action: byte; Path: byte; GuardComparisons: uint32; RecursiveCalls: uint32
          Nodes: uint32; ActionValues: uint32; Predictions: uint32; Updates: uint32 }

    type Episode =
        { Index: int; Complete: bool; Failure: Failure; Cues: string; Actions: string; States: string
          Reward4: int[]; BeliefBits: string[]; ChoiceWork: ChoiceWork[]
          FilterCounters: HiddenSwitchReceipt.FilterCounters; FrameSha256: string[]
          ProjectionSha256: string[]; TotalReward4: int }

    type ScalarInput = { Index: int; BeliefBits: string; Effect: bool; Depth: int }
    /// Q bits belong only to an untimed scalar audit, never the action-only output.
    type ScalarAudit =
        { Input: ScalarInput; QBits: string[]; Native: ChoiceWork; Compiled: ChoiceWork }

    let recordBytes = 28
    let bits (value: float) = BitConverter.DoubleToUInt64Bits(value).ToString("X16", CultureInfo.InvariantCulture)

    let parseFiniteBits (value: string) =
        if isNull value || value.Length <> 16
           || (value |> Seq.exists (fun c -> not ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))) then
            Error(failure "input" "binary64-bits" "requires exactly sixteen uppercase hexadecimal digits")
        else
            match UInt64.TryParse(value, NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture) with
            | true, raw ->
                let decoded = BitConverter.UInt64BitsToDouble raw
                if Double.IsFinite decoded then Ok decoded
                else Error(failure "input" "nonfinite" "binary64 value must be finite")
            | false, _ -> Error(failure "input" "binary64-bits" "invalid binary64 encoding")

    /// Both strategies use this exact owned-buffer writer inside choice timing.
    /// It allocates no output buffer itself and explicitly writes reserved zeros.
    let writeChoice (buffer: byte[]) offset (value: ChoiceWork) =
        if isNull buffer || offset < 0 || offset > buffer.Length - recordBytes then
            Error(failure "output" "choice-buffer" "requires an owned writable span of twenty-eight bytes")
        elif value.Action > 1uy || value.Path > 4uy then
            Error(failure "output" "choice-enum" "requires a binary action and registered path 0..4")
        else
            buffer.[offset] <- value.Action
            buffer.[offset + 1] <- value.Path
            buffer.[offset + 2] <- 0uy
            buffer.[offset + 3] <- 0uy
            BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset + 4, 4), value.GuardComparisons)
            BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset + 8, 4), value.RecursiveCalls)
            BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset + 12, 4), value.Nodes)
            BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset + 16, 4), value.ActionValues)
            BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset + 20, 4), value.Predictions)
            BinaryPrimitives.WriteUInt32LittleEndian(buffer.AsSpan(offset + 24, 4), value.Updates)
            Ok()
