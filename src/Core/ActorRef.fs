namespace Zeta.Core

open System.Text.RegularExpressions

/// CellRef - Open-ended execution coordinate hanging off the hub (the satellite).
type CellRef =
    { Surface: string option
      Instance: string option
      Node: string option }

/// ActorRef - Combined identity + address composition.
type ActorRef =
    { Persona: PersonaId
      Cell: CellRef }

module ActorRef =

    /// Segment charset law (INVALID_VECTORS parity with the TS oracle,
    /// src/Core.TypeScript/identity/actor-ref.ts SEGMENT_RE): lowercase
    /// alnum start, then alnum/dot/underscore/dash. Culture-invariant,
    /// byte-stable; excludes "/" and "@" (grammar chars) and uppercase.
    /// The invalid-vector class of the treaty byte-lock floor.
    let private segmentRe =
        Regex("^[a-z0-9][a-z0-9._-]*$", RegexOptions.Compiled ||| RegexOptions.CultureInvariant)

    let private isValidSegment (value: string) = segmentRe.IsMatch value

    /// Map of legacy SENDER_IDS composites and bare personas to their structured ActorRef representation.
    let private legacyMap =
        Map.ofList [
            "otto", { Persona = PersonaId.Otto; Cell = { Surface = None; Instance = None; Node = None } }
            "alexa", { Persona = PersonaId.Alexa; Cell = { Surface = None; Instance = None; Node = None } }
            "riven", { Persona = PersonaId.Riven; Cell = { Surface = None; Instance = None; Node = None } }
            "vera", { Persona = PersonaId.Vera; Cell = { Surface = None; Instance = None; Node = None } }
            "lior", { Persona = PersonaId.Lior; Cell = { Surface = None; Instance = None; Node = None } }
            "soraya", { Persona = PersonaId.Soraya; Cell = { Surface = None; Instance = None; Node = None } }
            "aaron", { Persona = PersonaId.Aaron; Cell = { Surface = None; Instance = None; Node = None } }
            "addison", { Persona = PersonaId.Addison; Cell = { Surface = None; Instance = None; Node = None } }
            "otto-cli", { Persona = PersonaId.Otto; Cell = { Surface = Some "cli"; Instance = None; Node = None } }
            "otto-desktop", { Persona = PersonaId.Otto; Cell = { Surface = Some "desktop"; Instance = None; Node = None } }
            "otto-vscode", { Persona = PersonaId.Otto; Cell = { Surface = Some "vscode"; Instance = None; Node = None } }
            "otto-windows", { Persona = PersonaId.Otto; Cell = { Surface = Some "windows"; Instance = None; Node = None } }
            "alexa-cli", { Persona = PersonaId.Alexa; Cell = { Surface = Some "cli"; Instance = None; Node = None } }
            "alexa-kiro", { Persona = PersonaId.Alexa; Cell = { Surface = Some "kiro"; Instance = None; Node = None } }
            "riven-cli", { Persona = PersonaId.Riven; Cell = { Surface = Some "cli"; Instance = None; Node = None } }
            "riven-cursor", { Persona = PersonaId.Riven; Cell = { Surface = Some "cursor"; Instance = None; Node = None } }
            "lior-antigravity", { Persona = PersonaId.Lior; Cell = { Surface = Some "antigravity"; Instance = None; Node = None } }
            "lior-gemini", { Persona = PersonaId.Lior; Cell = { Surface = Some "gemini"; Instance = None; Node = None } }
            "vera-codex", { Persona = PersonaId.Vera; Cell = { Surface = Some "codex"; Instance = None; Node = None } }
        ]

    /// Split off an optional `@node` suffix. Returns None for the whole
    /// parse when the input has multiple "@" or an invalid node segment
    /// (INVALID_VECTORS: "otto/cli@a@b").
    let private splitNode (input: string) : (string * string option) option =
        let atIdx = input.IndexOf '@'
        if atIdx = -1 then
            Some(input, None)
        elif input.IndexOf('@', atIdx + 1) <> -1 then
            None
        else
            let node = input.Substring(atIdx + 1)
            if isValidSegment node then
                Some(input.Substring(0, atIdx), Some node)
            else
                None

    /// Assemble a validated ActorRef from grammar pieces. Enforces:
    /// segment charset on surface/instance, no node-without-surface
    /// (INVALID_VECTORS: "otto@machine-a"), no empty segments
    /// (INVALID_VECTORS: "otto//fg").
    let private assemble
        (persona: PersonaId)
        (surface: string option)
        (instance: string option)
        (node: string option)
        : ActorRef option =
        let segmentOk =
            function
            | None -> true
            | Some (s: string) -> isValidSegment s

        if not (segmentOk surface) || not (segmentOk instance) then
            None
        elif surface.IsNone && (instance.IsSome || node.IsSome) then
            None
        else
            Some {
                Persona = persona
                Cell = {
                    Surface = surface
                    Instance = instance
                    Node = node
                }
            }

    /// Parse a string projection of an actor ref into its structured format.
    /// Supports legacy composites (e.g. "otto-cli") and new canonical grammar:
    /// `<persona>/<surface>[/<instance>][@<node>]`
    let parse (str: string) : ActorRef option =
        if System.String.IsNullOrEmpty str then
            None
        elif Map.containsKey str legacyMap then
            Some legacyMap.[str]
        else
            match splitNode str with
            | None -> None
            | Some(remaining, node) ->
                let parts = remaining.Split '/'
                if parts.Length = 0 || parts.Length > 3 then
                    None
                else
                    match PersonaId.parse parts.[0] with
                    | None -> None
                    | Some persona ->
                        let surface = if parts.Length > 1 then Some parts.[1] else None
                        let instance = if parts.Length > 2 then Some parts.[2] else None
                        assemble persona surface instance node

    /// Project a structured ActorRef into its canonical string projection format:
    /// `<persona>/<surface>[/<instance>][@<node>]`
    /// If cell is empty, projects to just `<persona>`.
    let project (actor: ActorRef) : string =
        let mutable str = PersonaId.toString actor.Persona
        match actor.Cell.Surface with
        | Some s ->
            str <- str + "/" + s
            match actor.Cell.Instance with
            | Some inst -> str <- str + "/" + inst
            | None -> ()
        | None -> ()

        match actor.Cell.Node with
        | Some n -> str <- str + "@" + n
        | None -> ()

        str

    /// Convert a structured ActorRef to its canonical SPIFFE ID URI format:
    /// `spiffe://zeta/persona/<persona>[/cell/<surface>[/<instance>][@<node>]]`
    let toSpiffe (actor: ActorRef) : string =
        let mutable uri = "spiffe://zeta/persona/" + PersonaId.toString actor.Persona
        match actor.Cell.Surface with
        | Some s ->
            uri <- uri + "/cell/" + s
            match actor.Cell.Instance with
            | Some inst -> uri <- uri + "/" + inst
            | None -> ()
        | None -> ()

        match actor.Cell.Node with
        | Some n -> uri <- uri + "@" + n
        | None -> ()

        uri

    /// Parse a canonical SPIFFE ID URI format back into a structured ActorRef.
    let parseSpiffe (uri: string) : ActorRef option =
        let prefix = "spiffe://zeta/persona/"
        if System.String.IsNullOrEmpty uri || not (uri.StartsWith prefix) then
            None
        else
            match splitNode (uri.Substring prefix.Length) with
            | None -> None
            | Some(remaining, node) ->
                let parts = remaining.Split '/'
                if parts.Length = 0 then
                    None
                else
                    match PersonaId.parse parts.[0] with
                    | None -> None
                    | Some persona ->
                        if parts.Length > 1 then
                            if parts.[1] <> "cell" then
                                None
                            elif parts.Length < 3 || parts.Length > 4 then
                                None
                            else
                                let surface = Some parts.[2]
                                let instance = if parts.Length > 3 then Some parts.[3] else None
                                assemble persona surface instance node
                        else
                            assemble persona None None node
