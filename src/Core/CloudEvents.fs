namespace Zeta.Core

/// **CloudEvents (CNCF v1.0) envelope over DynamicValue — the bus-envelope standard (081KTH0WQ3C).**
///
/// Aaron 2026-06-07: use the standard **CloudEvents** envelope over Zeta's busses instead of a bespoke
/// header. Required attributes `id`/`source`/`specversion`/`type`; optional `time`/`subject`/
/// `datacontenttype`/`dataschema`; plus **extension attributes** and the `data` payload. The envelope
/// rides our canonical codecs by mapping to/from `DynamicValue` (`toDynamic`/`ofDynamic` round-trip), so a
/// CloudEvent is just another self-describing value — JSON/CBOR/XML for free, byte-lockable.
///
/// Typical Zeta mapping: `ZetaId` → `id`/`source`; change kind → `type`; a Debezium-shaped Z-set delta
/// (`DebeziumCdc`) → `data`; schema version → `dataschema`; our extra fields → extension attributes
/// (exactly how Debezium's CloudEventsConverter maps its source fields).
[<RequireQualifiedAccess>]
module CloudEvents =

    /// A CloudEvents v1.0 event. `Extensions` are string-valued attributes outside the core set
    /// (CloudEvents extension attributes are simple-typed; we carry strings, in order).
    type CloudEvent =
        { Id: string
          Source: string
          SpecVersion: string
          Type: string
          Time: string option
          Subject: string option
          DataContentType: string option
          DataSchema: string option
          Extensions: (string * string) list
          Data: DynamicValue option }

    /// The reserved core attribute names (everything else in an envelope object is an extension).
    let private coreKeys =
        set [ "specversion"; "id"; "source"; "type"; "time"; "subject"; "datacontenttype"; "dataschema"; "data" ]

    /// A minimal valid event (specversion defaults to "1.0").
    let create (id: string) (source: string) (typ: string) (data: DynamicValue option) : CloudEvent =
        { Id = id
          Source = source
          SpecVersion = "1.0"
          Type = typ
          Time = None
          Subject = None
          DataContentType = None
          DataSchema = None
          Extensions = []
          Data = data }

    /// Validate the REQUIRED attributes are present + non-empty (CloudEvents v1.0 constraint).
    let validate (e: CloudEvent) : Result<unit, string> =
        let missing =
            [ "id", e.Id; "source", e.Source; "specversion", e.SpecVersion; "type", e.Type ]
            |> List.filter (fun (_, v) -> System.String.IsNullOrEmpty v)
            |> List.map fst
        if List.isEmpty missing then Ok()
        else Error(sprintf "CloudEvent missing required attribute(s): %s" (String.concat ", " missing))

    /// Serialize to `DynamicValue.Object` (rides the canonical codecs). Attribute order is stable:
    /// specversion, id, source, type, then present optionals, then extensions, then data.
    let toDynamic (e: CloudEvent) : DynamicValue =
        let opt k = function Some v -> [ k, DynamicValue.String v ] | None -> []
        DynamicValue.Object(
            [ "specversion", DynamicValue.String e.SpecVersion
              "id", DynamicValue.String e.Id
              "source", DynamicValue.String e.Source
              "type", DynamicValue.String e.Type ]
            @ opt "time" e.Time
            @ opt "subject" e.Subject
            @ opt "datacontenttype" e.DataContentType
            @ opt "dataschema" e.DataSchema
            @ (e.Extensions |> List.map (fun (k, v) -> k, DynamicValue.String v))
            @ (match e.Data with Some d -> [ "data", d ] | None -> [])
        )

    /// Parse from a `DynamicValue.Object`. Unknown string-valued keys (outside the core set) become
    /// extension attributes, in order. Errors if not an object or a required attribute is missing.
    let ofDynamic (dv: DynamicValue) : Result<CloudEvent, string> =
        match dv with
        | DynamicValue.Object kvs ->
            let str k =
                kvs |> List.tryPick (fun (kk, v) -> match v with DynamicValue.String s when kk = k -> Some s | _ -> None)
            match str "id", str "source", str "type" with
            | Some id, Some source, Some typ ->
                let extensions =
                    kvs
                    |> List.choose (fun (k, v) ->
                        match v with
                        | DynamicValue.String s when not (coreKeys.Contains k) -> Some(k, s)
                        | _ -> None)
                Ok
                    { Id = id
                      Source = source
                      SpecVersion = defaultArg (str "specversion") "1.0"
                      Type = typ
                      Time = str "time"
                      Subject = str "subject"
                      DataContentType = str "datacontenttype"
                      DataSchema = str "dataschema"
                      Extensions = extensions
                      Data = kvs |> List.tryPick (fun (k, v) -> if k = "data" then Some v else None) }
            | _ -> Error "CloudEvent object missing required attribute(s): id / source / type"
        | _ -> Error "CloudEvent must be a DynamicValue.Object"
