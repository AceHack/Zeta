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
        writer.WriteEndObject()

and [<JsonConverter(typeof<QuantumObservableRowConverter>)>] QuantumObservableRow =
    | SingleQubit of QuantumObservableTreaty.SingleQubitMeasurement
    | CanonicalChsh of QuantumObservableTreaty.CanonicalChsh
    | SingletChsh of QuantumObservableTreaty.SingletChsh
    | BellCorner of QuantumObservableTreaty.BellCorner
    | BellCoincidence of QuantumObservableTreaty.BellCoincidence
    | InterferenceVisibility of QuantumObservableTreaty.InterferenceVisibility

type QuantumObservableDelta =
    { [<JsonPropertyName("row")>] Row: QuantumObservableRow
      [<JsonPropertyName("weight")>] Weight: int64 }

type Batch =
    { [<JsonPropertyName("batchId")>] BatchId: int
      [<JsonPropertyName("deltas")>] Deltas: QuantumObservableDelta list }

type Transcript =
    { [<JsonPropertyName("schema")>] Schema: string
      [<JsonPropertyName("batches")>] Batches: Batch list }
