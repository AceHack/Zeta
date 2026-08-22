namespace Zeta.Core

open System
open System.Text.Json
open System.Text.Json.Serialization

type QuantumObservableRowConverter() =
    inherit JsonConverter<QuantumObservableRow>()

    override _.Read(reader: byref<Utf8JsonReader>, typeToConvert: Type, options: JsonSerializerOptions) =
        let doc = JsonDocument.ParseValue(&reader)
        let root = doc.RootElement
        let typ = root.GetProperty("type").GetString()
        let valueVal = root.GetProperty("value")

        match typ with
        | "SingleQubit" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.SingleQubitMeasurement>(valueVal.GetRawText(), options)
            QuantumObservableRow.SingleQubit v
        | "CanonicalChsh" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.CanonicalChsh>(valueVal.GetRawText(), options)
            QuantumObservableRow.CanonicalChsh v
        | "SingletChsh" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.SingletChsh>(valueVal.GetRawText(), options)
            QuantumObservableRow.SingletChsh v
        | "BellCorner" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.BellCorner>(valueVal.GetRawText(), options)
            QuantumObservableRow.BellCorner v
        | "BellCoincidence" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.BellCoincidence>(valueVal.GetRawText(), options)
            QuantumObservableRow.BellCoincidence v
        | "InterferenceVisibility" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.InterferenceVisibility>(valueVal.GetRawText(), options)
            QuantumObservableRow.InterferenceVisibility v
        | "FlowBitDistinction" ->
            let v = JsonSerializer.Deserialize<QuantumObservableTreaty.FlowBitDistinction>(valueVal.GetRawText(), options)
            QuantumObservableRow.FlowBitDistinction v
        | _ -> failwithf "Unknown quantum observable row type: %s" typ

    override _.Write(writer: Utf8JsonWriter, value: QuantumObservableRow, options: JsonSerializerOptions) =
        writer.WriteStartObject()
        match value with
        | QuantumObservableRow.SingleQubit v ->
            writer.WriteString("type", "SingleQubit")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        | QuantumObservableRow.CanonicalChsh v ->
            writer.WriteString("type", "CanonicalChsh")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        | QuantumObservableRow.SingletChsh v ->
            writer.WriteString("type", "SingletChsh")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        | QuantumObservableRow.BellCorner v ->
            writer.WriteString("type", "BellCorner")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        | QuantumObservableRow.BellCoincidence v ->
            writer.WriteString("type", "BellCoincidence")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        | QuantumObservableRow.InterferenceVisibility v ->
            writer.WriteString("type", "InterferenceVisibility")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        | QuantumObservableRow.FlowBitDistinction v ->
            writer.WriteString("type", "FlowBitDistinction")
            writer.WritePropertyName("value")
            JsonSerializer.Serialize(writer, v, options)
        writer.WriteEndObject()

and [<JsonConverter(typeof<QuantumObservableRowConverter>)>] QuantumObservableRow =
    | SingleQubit of QuantumObservableTreaty.SingleQubitMeasurement
    | CanonicalChsh of QuantumObservableTreaty.CanonicalChsh
    | SingletChsh of QuantumObservableTreaty.SingletChsh
    | BellCorner of QuantumObservableTreaty.BellCorner
    | BellCoincidence of QuantumObservableTreaty.BellCoincidence
    | InterferenceVisibility of QuantumObservableTreaty.InterferenceVisibility
    | FlowBitDistinction of QuantumObservableTreaty.FlowBitDistinction

type QuantumObservableDelta =
    { [<JsonPropertyName("row")>] Row: QuantumObservableRow
      [<JsonPropertyName("weight")>] Weight: int64 }

type Batch =
    { [<JsonPropertyName("batchId")>] BatchId: int
      [<JsonPropertyName("deltas")>] Deltas: QuantumObservableDelta list }

type Transcript =
    { [<JsonPropertyName("schema")>] Schema: string
      [<JsonPropertyName("batches")>] Batches: Batch list }

[<RequireQualifiedAccess>]
module QuantumObservableDbsp =

    type Metered<'T> =
        { Value: 'T
          Heat: HeatSignature list }

    type MachZehnderFeedback =
        { CompletedRows: Metered<QuantumObservableRow> list
          Measurement: MachZehnderWSetHeat.Feedback }

    let private probabilityFor (key: int) (probabilities: (int * float) list) : float =
        probabilities
        |> List.filter (fun (candidate, _) -> candidate = key)
        |> List.sumBy snd

    let private probabilitiesFromWSet (probabilities: (int * float) list) : QuantumObservableTreaty.Probabilities =
        { Zero = probabilityFor 0 probabilities
          One = probabilityFor 1 probabilities }

    let interferenceVisibilityFromWSet
        (id: string)
        (operation: string)
        (phaseRadians: float option)
        (visibility: float option)
        (probabilities: (int * float) list)
        : QuantumObservableRow =
        QuantumObservableRow.InterferenceVisibility
            { Id = id
              Operation = operation
              PhaseRadians = phaseRadians
              Probabilities = probabilitiesFromWSet probabilities
              Visibility = visibility }

    /// Pure reference row. Runtime/DBSP generation uses `machZehnderOpenRow` with an injected sink.
    let machZehnderOpenReferenceRow () : QuantumObservableRow =
        MachZehnderWSet.openArm ()
        |> interferenceVisibilityFromWSet "mach-zehnder-open" "Zeta.ReferenceOracle.ApplyMachZehnderOpen" None None

    /// Pure reference row. Runtime/DBSP generation uses `machZehnderClosedRow` with an injected sink.
    let machZehnderClosedReferenceRow (id: string) (operation: string) (phaseRadians: float) : QuantumObservableRow =
        MachZehnderWSet.closed phaseRadians
        |> interferenceVisibilityFromWSet id operation (Some phaseRadians) (Some 1.0)

    let machZehnderReferenceRows () : QuantumObservableRow list =
        [ machZehnderOpenReferenceRow ()
          machZehnderClosedReferenceRow "mach-zehnder-closed-zero-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase" 0.0
          machZehnderClosedReferenceRow
              "mach-zehnder-closed-pi-over-3-phase"
              "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver3Phase"
              (Math.PI / 3.0)
          machZehnderClosedReferenceRow
              "mach-zehnder-closed-pi-over-2-phase"
              "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver2Phase"
              (Math.PI / 2.0)
          machZehnderClosedReferenceRow
              "mach-zehnder-closed-two-pi-over-3-phase"
              "Zeta.ReferenceOracle.ApplyMachZehnderClosedTwoPiOver3Phase"
              (2.0 * Math.PI / 3.0)
          machZehnderClosedReferenceRow "mach-zehnder-closed-pi-phase" "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase" Math.PI ]

    let machZehnderOpenRow
        (sink: IHeatSink)
        (source: string)
        : Result<Metered<QuantumObservableRow>, MachZehnderWSetHeat.Feedback> =
        MachZehnderWSetHeat.openArm sink (source + ".mach-zehnder-open")
        |> Result.map (fun measured ->
            { Value =
                measured.Probabilities
                |> interferenceVisibilityFromWSet
                    "mach-zehnder-open"
                    "Zeta.ReferenceOracle.ApplyMachZehnderOpen"
                    None
                    None
              Heat = measured.Heat })

    let machZehnderClosedRow
        (sink: IHeatSink)
        (source: string)
        (id: string)
        (operation: string)
        (phaseRadians: float)
        : Result<Metered<QuantumObservableRow>, MachZehnderWSetHeat.Feedback> =
        MachZehnderWSetHeat.closed sink (source + "." + id) phaseRadians
        |> Result.map (fun measured ->
            { Value =
                measured.Probabilities
                |> interferenceVisibilityFromWSet id operation (Some phaseRadians) (Some 1.0)
              Heat = measured.Heat })

    let machZehnderRows
        (sink: IHeatSink)
        (source: string)
        : Result<Metered<QuantumObservableRow list>, MachZehnderFeedback> =
        let runs =
            [ fun () -> machZehnderOpenRow sink source
              fun () ->
                  machZehnderClosedRow
                      sink
                      source
                      "mach-zehnder-closed-zero-phase"
                      "Zeta.ReferenceOracle.ApplyMachZehnderClosedZeroPhase"
                      0.0
              fun () ->
                  machZehnderClosedRow
                      sink
                      source
                      "mach-zehnder-closed-pi-over-3-phase"
                      "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver3Phase"
                      (Math.PI / 3.0)
              fun () ->
                  machZehnderClosedRow
                      sink
                      source
                      "mach-zehnder-closed-pi-over-2-phase"
                      "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver2Phase"
                      (Math.PI / 2.0)
              fun () ->
                  machZehnderClosedRow
                      sink
                      source
                      "mach-zehnder-closed-two-pi-over-3-phase"
                      "Zeta.ReferenceOracle.ApplyMachZehnderClosedTwoPiOver3Phase"
                      (2.0 * Math.PI / 3.0)
              fun () ->
                  machZehnderClosedRow
                      sink
                      source
                      "mach-zehnder-closed-pi-phase"
                      "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiPhase"
                      Math.PI ]

        let rec collect completed pending =
            match pending with
            | [] ->
                let rows = List.rev completed

                Ok
                    { Value = rows |> List.map _.Value
                      Heat = rows |> List.collect _.Heat }
            | run :: tail ->
                match run () with
                | Ok row -> collect (row :: completed) tail
                | Error feedback ->
                    Error
                        { CompletedRows = List.rev completed
                          Measurement = feedback }

        collect [] runs

    let delta (row: QuantumObservableRow) (weight: int64) : QuantumObservableDelta = { Row = row; Weight = weight }

    let zsetOfDeltas (deltas: QuantumObservableDelta seq) : ZSet<QuantumObservableRow> =
        deltas |> Seq.map (fun d -> d.Row, d.Weight) |> ZSet.ofSeq

    let machZehnderDeltas
        (sink: IHeatSink)
        (source: string)
        : Result<Metered<QuantumObservableDelta list>, MachZehnderFeedback> =
        machZehnderRows sink source
        |> Result.map (fun rows ->
            { Value = rows.Value |> List.map (fun row -> delta row 1L)
              Heat = rows.Heat })

    let machZehnderZSet
        (sink: IHeatSink)
        (source: string)
        : Result<Metered<ZSet<QuantumObservableRow>>, MachZehnderFeedback> =
        machZehnderDeltas sink source
        |> Result.map (fun deltas ->
            { Value = deltas.Value |> zsetOfDeltas
              Heat = deltas.Heat })

    let flowBitRows () : QuantumObservableRow list =
        QuantumObservableTreaty.flowBitDistinctions ()
        |> List.map QuantumObservableRow.FlowBitDistinction

    let flowBitRow (externalBit: bool) : QuantumObservableRow =
        flowBitRows ()
        |> List.find (fun row ->
            match row with
            | QuantumObservableRow.FlowBitDistinction value -> value.ExternalBit = externalBit
            | _ -> false)

    let flowBitDeltas () : QuantumObservableDelta list =
        flowBitRows () |> List.map (fun row -> delta row 1L)

    let flowBitZSet () : ZSet<QuantumObservableRow> =
        flowBitDeltas () |> zsetOfDeltas
