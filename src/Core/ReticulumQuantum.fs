namespace Zeta.Core

open System
open System.Globalization
open System.Text.Json
open System.Text.Json.Serialization

/// ReticulumQuantum is the first typed bridge between the salon/darkhall finite-room
/// observables and the deterministic Reticulum overlay.
///
/// Honest scope: this does not ship a qubit state vector or claim physical networking.
/// It ships measured observables from bounded rooms as deterministic payloads over
/// `ReticulumLink`, which is the right first distributed contract: compare what rooms
/// can measure, then hang richer codecs/content addresses under the same envelope.
[<RequireQualifiedAccess>]
module ReticulumQuantum =

    /// A finite-room observable ready to cross the Reticulum boundary.
    type Observable =
        { Room: string
          Source: string
          Name: string
          Value: float
          Norm: float
          Support: int
          Sequence: int64 }

    /// A DBSP quantum-observable delta ready to cross Reticulum. This keeps
    /// Q#/TS as an oracle while the source-owned `ZSet<QuantumObservableRow>`
    /// remains the runtime shape on the F# side.
    [<CLIMutable>]
    type ObservableDelta =
        { [<JsonPropertyName("source")>]
          Source: string
          [<JsonPropertyName("sequence")>]
          Sequence: int64
          [<JsonPropertyName("row")>]
          Row: QuantumObservableRow
          [<JsonPropertyName("weight")>]
          Weight: int64 }

    [<RequireQualifiedAccess>]
    type PacketError =
        | Malformed of string

    let private inv = CultureInfo.InvariantCulture
    let private schema = "zeta-reticulum-observable/v1"
    let private deltaSchema = "zeta-reticulum-quantum-observable-delta/v1"

    let private json =
        let options = JsonSerializerOptions()
        options.PropertyNamingPolicy <- JsonNamingPolicy.CamelCase
        options.Converters.Add(QuantumObservableRowConverter())
        options

    let private enc (s: string) = Uri.EscapeDataString s
    let private dec (s: string) = Uri.UnescapeDataString s

    let private f (x: float) = x.ToString("R", inv)
    let private i (x: int64) = x.ToString(inv)

    /// Capture the observable side of a two-stream qubit/join state.
    let ofQubit (source: string) (sequence: int64) (q: QubitIso.JoinState) : Observable =
        { Room = Salon.name
          Source = source
          Name = "born:P(|1>)"
          Value = QubitIso.measureOne q
          Norm = QubitIso.normSq q
          Support = 2
          Sequence = sequence }

    /// Capture the observable side of an amplitude CHIP-8 ensemble after interference
    /// merge. `Value` is the largest Born-frame probability; `Support` is the merged
    /// state-space width that still fits in memory.
    let ofAmplitudeEmu (source: string) (sequence: int64) (amp: AmplitudeEmu.Amp) : Observable =
        let merged = AmplitudeEmu.merge amp
        let maxBorn =
            match AmplitudeEmu.bornProb merged with
            | [] -> 0.0
            | ps -> ps |> List.maxBy snd |> snd
        { Room = Arcade.name
          Source = source
          Name = "born:max-frame"
          Value = maxBorn
          Norm = AmplitudeEmu.intensity merged
          Support = List.length merged
          Sequence = sequence }

    /// Deterministic culture-invariant payload encoding for the string-only
    /// `ReticulumLink.Packet` substrate.
    let encode (o: Observable) : string =
        String.concat
            "|"
            [ schema
              "room=" + enc o.Room
              "source=" + enc o.Source
              "name=" + enc o.Name
              "value=" + f o.Value
              "norm=" + f o.Norm
              "support=" + i (int64 o.Support)
              "sequence=" + i o.Sequence ]

    let private field (name: string) (fields: Map<string, string>) =
        match fields |> Map.tryFind name with
        | Some value -> Ok value
        | None -> Error(PacketError.Malformed(sprintf "missing %s" name))

    let private parseFloat name (value: string) =
        match Double.TryParse(value, NumberStyles.Float, inv) with
        | true, value -> Ok value
        | false, _ -> Error(PacketError.Malformed name)

    let private parseInt name (value: string) =
        match Int32.TryParse(value, NumberStyles.Integer, inv) with
        | true, value -> Ok value
        | false, _ -> Error(PacketError.Malformed name)

    let private parseInt64 name (value: string) =
        match Int64.TryParse(value, NumberStyles.Integer, inv) with
        | true, value -> Ok value
        | false, _ -> Error(PacketError.Malformed name)

    let private malformedFromException (context: string) (ex: exn) =
        PacketError.Malformed(sprintf "%s: %s" context ex.Message)

    let private tryProperty (name: string) (element: JsonElement) =
        let mutable value = Unchecked.defaultof<JsonElement>
        if element.TryGetProperty(name, &value) then Some value else None

    let private tryPropertyEither (lowerName: string) (upperName: string) (element: JsonElement) =
        match tryProperty lowerName element with
        | Some value -> Some value
        | None -> tryProperty upperName element

    /// Decode an observable payload without surfacing exceptions to callers.
    let decode (payload: string) : Result<Observable, PacketError> =
        let parts = payload.Split('|', StringSplitOptions.None)
        if parts.Length <> 8 || parts.[0] <> schema then
            Error(PacketError.Malformed "schema")
        else
            let fields =
                parts
                |> Seq.skip 1
                |> Seq.choose (fun p ->
                    match p.IndexOf('=') with
                    | n when n > 0 -> Some(p.Substring(0, n), p.Substring(n + 1))
                    | _ -> None)
                |> Map.ofSeq

            result {
                let! room = field "room" fields
                let! source = field "source" fields
                let! name = field "name" fields
                let! valueRaw = field "value" fields
                let! value = parseFloat "value" valueRaw
                let! normRaw = field "norm" fields
                let! norm = parseFloat "norm" normRaw
                let! supportRaw = field "support" fields
                let! support = parseInt "support" supportRaw
                let! sequenceRaw = field "sequence" fields
                let! sequence = parseInt64 "sequence" sequenceRaw

                return
                    { Room = dec room
                      Source = dec source
                      Name = dec name
                      Value = value
                      Norm = norm
                      Support = support
                      Sequence = sequence }
            }

    /// Lift one source-owned quantum DBSP delta into the Reticulum payload
    /// shape. Weight remains signed so ordinary DBSP retractions cross the
    /// same link as insertions.
    let ofQuantumObservableDelta
        (source: string)
        (sequence: int64)
        (delta: QuantumObservableDelta)
        : ObservableDelta =
        { Source = source
          Sequence = sequence
          Row = delta.Row
          Weight = delta.Weight }

    /// Lift a whole `ZSet<QuantumObservableRow>` as a deterministic sequence of
    /// per-row deltas. Z-set enumeration is canonical, so the sequence is
    /// replayable in deterministic Reticulum simulations.
    let ofQuantumObservableZSet
        (source: string)
        (firstSequence: int64)
        (rows: ZSet<QuantumObservableRow>)
        : ObservableDelta list =
        rows
        |> Seq.mapi (fun i entry ->
            { Source = source
              Sequence = firstSequence + int64 i
              Row = entry.Key
              Weight = entry.Weight })
        |> Seq.toList

    /// Deterministic JSON payload encoding for source-owned quantum observable
    /// deltas. This is a separate schema from the compact scalar observable
    /// packet above because it must preserve the full row identity.
    let encodeDelta (delta: ObservableDelta) : string =
        let schemaJson = JsonSerializer.Serialize(deltaSchema, json)
        let deltaJson = JsonSerializer.Serialize(delta, json)
        "{\"schema\":" + schemaJson + ",\"delta\":" + deltaJson + "}"

    /// Decode a quantum observable delta payload without surfacing JSON or
    /// converter exceptions to callers.
    let decodeDelta (payload: string) : Result<ObservableDelta, PacketError> =
        try
            use doc = JsonDocument.Parse(payload)
            let root = doc.RootElement
            let schemaValue = root |> tryPropertyEither "schema" "Schema" |> Option.map (fun value -> value.GetString())
            if schemaValue <> Some deltaSchema then
                Error(PacketError.Malformed "schema")
            else
                match root |> tryPropertyEither "delta" "Delta" with
                | None -> Error(PacketError.Malformed "delta")
                | Some deltaElement ->
                    let delta = JsonSerializer.Deserialize<ObservableDelta>(deltaElement.GetRawText(), json)
                    if isNull (box delta) then
                        Error(PacketError.Malformed "delta")
                    else
                        Ok delta
        with ex ->
            Error(malformedFromException "json" ex)

    /// Send one observable over an established deterministic link.
    let send
        (link: ReticulumLink.Link)
        (observable: Observable)
        (s: Scheduler)
        (m: ReticulumLink.Medium)
        : ReticulumLink.Medium * Scheduler =
        ReticulumLink.send link.A link.B (encode observable) s m

    /// Send one source-owned quantum observable delta over an established
    /// deterministic link.
    let sendDelta
        (link: ReticulumLink.Link)
        (delta: ObservableDelta)
        (s: Scheduler)
        (m: ReticulumLink.Medium)
        : ReticulumLink.Medium * Scheduler =
        ReticulumLink.send link.A link.B (encodeDelta delta) s m

    /// Send a batch of quantum observable deltas in input order. The scheduler
    /// advances once per packet, making replay count visible to DST tests.
    let sendDeltas
        (link: ReticulumLink.Link)
        (deltas: ObservableDelta seq)
        (s: Scheduler)
        (m: ReticulumLink.Medium)
        : ReticulumLink.Medium * Scheduler =
        deltas |> Seq.fold (fun (medium, scheduler) delta -> sendDelta link delta scheduler medium) (m, s)

    /// Send a whole `ZSet<QuantumObservableRow>` over Reticulum as signed DBSP
    /// deltas. This is the small finite WSet/DBSP/Q# isomorphism probe: the
    /// row contract crosses the edge, while Q# remains a reference oracle.
    let sendQuantumObservableZSet
        (link: ReticulumLink.Link)
        (source: string)
        (firstSequence: int64)
        (rows: ZSet<QuantumObservableRow>)
        (s: Scheduler)
        (m: ReticulumLink.Medium)
        : ReticulumLink.Medium * Scheduler =
        sendDeltas link (ofQuantumObservableZSet source firstSequence rows) s m

    /// Drain and decode observable payloads addressed to `destination`.
    let receive (destination: ReticulumLink.Destination) (m: ReticulumLink.Medium)
        : Result<Observable list, PacketError> * ReticulumLink.Medium =
        let packets, rest = ReticulumLink.deliver destination m
        let rec loop (xs: ReticulumLink.Packet list) acc =
            match xs with
            | [] -> Ok(List.rev acc), rest
            | p :: tail ->
                match decode p.Payload with
                | Ok o -> loop tail (o :: acc)
                | Error e -> Error e, rest
        loop packets []

    /// Drain and decode quantum observable delta payloads addressed to
    /// `destination`.
    let receiveDeltas (destination: ReticulumLink.Destination) (m: ReticulumLink.Medium)
        : Result<ObservableDelta list, PacketError> * ReticulumLink.Medium =
        let packets, rest = ReticulumLink.deliver destination m
        let rec loop (xs: ReticulumLink.Packet list) acc =
            match xs with
            | [] -> Ok(List.rev acc), rest
            | p :: tail ->
                match decodeDelta p.Payload with
                | Ok delta -> loop tail (delta :: acc)
                | Error e -> Error e, rest
        loop packets []

    /// Drain quantum observable deltas and consolidate them into the ordinary
    /// source-owned DBSP Z-set shape.
    let receiveQuantumObservableZSet (destination: ReticulumLink.Destination) (m: ReticulumLink.Medium)
        : Result<ZSet<QuantumObservableRow>, PacketError> * ReticulumLink.Medium =
        let deltas, rest = receiveDeltas destination m
        deltas |> Result.map (Seq.map (fun delta -> delta.Row, delta.Weight) >> ZSet.ofSeq), rest
