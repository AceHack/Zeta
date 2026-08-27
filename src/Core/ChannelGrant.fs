namespace Zeta.Core

open System
open System.Globalization

/// Direction in which information crosses a TAS channel boundary.
[<RequireQualifiedAccess>]
type ChannelDirection =
    | Read
    | Write

/// One declared apparatus channel and the inclusive address range it admits.
[<Struct>]
type ChannelSpec =
    { Channel: string
      Direction: ChannelDirection
      StartAddress: int
      EndAddress: int }

/// Typed refusals from channel declaration, grant issuance, and metering.
type ChannelGrantFeedback =
    | EmptyChannelSet
    | InvalidChannelName of channel: string
    | InvalidChannelRange of channel: string * startAddress: int * endAddress: int
    | OverlappingChannelRanges of channel: string * direction: ChannelDirection
    | InvalidExperimenterId of issuedBy: string
    | InvalidDerivedChannelLabel of detail: string
    | RunKeyChannelMismatch of expected: string * actual: string
    | CrossingNotGranted of channel: string * direction: ChannelDirection * address: int
    | CrossingCountOverflow of channel: string * direction: ChannelDirection

[<Struct>]
type ExperimenterId = private ExperimenterId of string

[<RequireQualifiedAccess>]
module ExperimenterId =

    let tryCreate (issuedBy: string) : Result<ExperimenterId, ChannelGrantFeedback> =
        let valid =
            not (String.IsNullOrWhiteSpace issuedBy)
            && issuedBy
               |> Seq.forall (fun c ->
                   (c >= 'a' && c <= 'z')
                   || (c >= 'A' && c <= 'Z')
                   || (c >= '0' && c <= '9')
                   || c = '-'
                   || c = '_'
                   || c = '.')

        if valid then
            Ok(ExperimenterId issuedBy)
        else
            Error(InvalidExperimenterId issuedBy)

    let value (ExperimenterId issuedBy) = issuedBy


/// Validated, canonical channel configuration. Construction rejects ambiguous overlaps.
type ChannelSet = private ChannelSet of ChannelSpec list

[<RequireQualifiedAccess>]
module ChannelSet =

    [<Literal>]
    let private MaxAddress = 0xFFF

    let private directionText direction =
        match direction with
        | ChannelDirection.Read -> "read"
        | ChannelDirection.Write -> "write"

    let private isChannelName (channel: string) =
        not (String.IsNullOrEmpty channel)
        && channel[0] >= 'a'
        && channel[0] <= 'z'
        && channel
           |> Seq.forall (fun c ->
               (c >= 'a' && c <= 'z')
               || (c >= '0' && c <= '9')
               || c = '-')

    let private canonicalSpec (spec: ChannelSpec) =
        String.concat
            ""
            [ spec.Channel
              "-"
              directionText spec.Direction
              "@"
              spec.StartAddress.ToString("x4", CultureInfo.InvariantCulture)
              "-"
              spec.EndAddress.ToString("x4", CultureInfo.InvariantCulture) ]

    let private overlaps (left: ChannelSpec) (right: ChannelSpec) =
        String.Equals(left.Channel, right.Channel, StringComparison.Ordinal)
        && left.Direction = right.Direction
        && left.StartAddress <= right.EndAddress
        && right.StartAddress <= left.EndAddress

    let tryCreate (specs: ChannelSpec list) : Result<ChannelSet, ChannelGrantFeedback> =
        match specs with
        | [] -> Error EmptyChannelSet
        | _ ->
            match specs |> List.tryFind (fun spec -> not (isChannelName spec.Channel)) with
            | Some invalid -> Error(InvalidChannelName invalid.Channel)
            | None ->
                match
                    specs
                    |> List.tryFind (fun spec ->
                        spec.StartAddress < 0
                        || spec.EndAddress > MaxAddress
                        || spec.StartAddress > spec.EndAddress)
                with
                | Some invalid ->
                    Error(InvalidChannelRange(invalid.Channel, invalid.StartAddress, invalid.EndAddress))
                | None ->
                    let indexed = specs |> List.indexed

                    match
                        indexed
                        |> List.tryPick (fun (i, left) ->
                            indexed
                            |> List.tryPick (fun (j, right) ->
                                if i < j && overlaps left right then
                                    Some(left.Channel, left.Direction)
                                else
                                    None))
                    with
                    | Some(channel, direction) -> Error(OverlappingChannelRanges(channel, direction))
                    | None ->
                        specs
                        |> List.sortWith (fun left right ->
                            StringComparer.Ordinal.Compare(canonicalSpec left, canonicalSpec right))
                        |> ChannelSet
                        |> Ok

    let specs (ChannelSet channels) : ChannelSpec list = channels

    let detail (ChannelSet channels) : string =
        channels |> List.map canonicalSpec |> String.concat ","

    /// The channel label that must be carried by the bound run key.
    let runLabel (channels: ChannelSet) : Result<Chip8CrossRunStore.RunChannelLabel, ChannelGrantFeedback> =
        let value = detail channels

        match Chip8CrossRunStore.RunChannelLabel.assisted value with
        | Ok label -> Ok label
        | Error _ -> Error(InvalidDerivedChannelLabel value)


/// Opaque capability issued by the experiment harness and bound to one run key.
[<Sealed>]
type ChannelGrant
    internal
    (
        channels: ChannelSet,
        issuedBy: ExperimenterId,
        runKey: Chip8CrossRunStore.RunKey
    ) =

    member _.Channels = channels
    member _.IssuedBy = issuedBy
    member _.RunKey = runKey


[<RequireQualifiedAccess>]
module internal ChannelGrantHarness =

    /// Issue only when the run key already names this exact apparatus configuration.
    let issue
        (issuedBy: ExperimenterId)
        (runKey: Chip8CrossRunStore.RunKey)
        (channels: ChannelSet)
        : Result<ChannelGrant, ChannelGrantFeedback> =
        match ChannelSet.runLabel channels with
        | Error feedback -> Error feedback
        | Ok expected ->
            let expectedText = Chip8CrossRunStore.RunChannelLabel.value expected
            let actualText = Chip8CrossRunStore.RunChannelLabel.value runKey.ChannelLabel

            if String.Equals(expectedText, actualText, StringComparison.Ordinal) then
                Ok(ChannelGrant(channels, issuedBy, runKey))
            else
                Error(RunKeyChannelMismatch(expectedText, actualText))


type ChannelMeter = private ChannelMeter of Map<ChannelSpec, int64>

type ChannelMeterRow =
    { Channel: string
      Direction: ChannelDirection
      StartAddress: int
      EndAddress: int
      Crossings: int64 }

type ChannelMeterSnapshot =
    { ChannelLabel: string
      IssuedBy: string
      RunKey: string
      Rows: ChannelMeterRow list }

[<RequireQualifiedAccess>]
module ChannelMeter =

    let zero (grant: ChannelGrant) : ChannelMeter =
        grant.Channels
        |> ChannelSet.specs
        |> List.map (fun spec -> spec, 0L)
        |> Map.ofList
        |> ChannelMeter

    let private matchingSpec (grant: ChannelGrant) channel direction address =
        grant.Channels
        |> ChannelSet.specs
        |> List.tryFind (fun spec ->
            String.Equals(spec.Channel, channel, StringComparison.Ordinal)
            && spec.Direction = direction
            && address >= spec.StartAddress
            && address <= spec.EndAddress)

    let cross
        (grant: ChannelGrant)
        (channel: string)
        (direction: ChannelDirection)
        (address: int)
        (ChannelMeter counts)
        : Result<ChannelMeter, ChannelGrantFeedback> =
        match matchingSpec grant channel direction address with
        | None -> Error(CrossingNotGranted(channel, direction, address))
        | Some spec ->
            let current = Map.find spec counts

            if current = Int64.MaxValue then
                Error(CrossingCountOverflow(channel, direction))
            else
                counts |> Map.add spec (current + 1L) |> ChannelMeter |> Ok

    let crossRange
        (grant: ChannelGrant)
        (channel: string)
        (direction: ChannelDirection)
        (startAddress: int)
        (endAddress: int)
        (ChannelMeter initialCounts)
        : Result<ChannelMeter, ChannelGrantFeedback> =
        if startAddress > endAddress then
            Error(CrossingNotGranted(channel, direction, startAddress))
        else
            let rec loop address counts =
                if address > endAddress then
                    Ok(ChannelMeter counts)
                else
                    match matchingSpec grant channel direction address with
                    | None -> Error(CrossingNotGranted(channel, direction, address))
                    | Some spec ->
                        let coveredEnd = min spec.EndAddress endAddress
                        let increment = int64 (coveredEnd - address + 1)
                        let current = Map.find spec counts

                        if current > Int64.MaxValue - increment then
                            Error(CrossingCountOverflow(channel, direction))
                        else
                            loop (coveredEnd + 1) (Map.add spec (current + increment) counts)

            loop startAddress initialCounts

    let snapshot (grant: ChannelGrant) (ChannelMeter counts) : ChannelMeterSnapshot =
        let rows =
            grant.Channels
            |> ChannelSet.specs
            |> List.map (fun spec ->
                { Channel = spec.Channel
                  Direction = spec.Direction
                  StartAddress = spec.StartAddress
                  EndAddress = spec.EndAddress
                  Crossings = Map.find spec counts })

        { ChannelLabel =
            grant.RunKey.ChannelLabel
            |> Chip8CrossRunStore.RunChannelLabel.value
          IssuedBy = ExperimenterId.value grant.IssuedBy
          RunKey = Chip8CrossRunStore.keyText grant.RunKey
          Rows = rows }
