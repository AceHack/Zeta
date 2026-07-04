namespace Zeta.Core

/// PersonaId - Closed, registry-backed enum of identities (the hubs).
type PersonaId =
    | Otto
    | Alexa
    | Riven
    | Vera
    | Lior
    | Soraya
    | Aaron
    | Addison

[<RequireQualifiedAccess>]
module PersonaId =
    let toString = function
        | Otto -> "otto"
        | Alexa -> "alexa"
        | Riven -> "riven"
        | Vera -> "vera"
        | Lior -> "lior"
        | Soraya -> "soraya"
        | Aaron -> "aaron"
        | Addison -> "addison"

    let parse = function
        | "otto" -> Some Otto
        | "alexa" -> Some Alexa
        | "riven" -> Some Riven
        | "vera" -> Some Vera
        | "lior" -> Some Lior
        | "soraya" -> Some Soraya
        | "aaron" -> Some Aaron
        | "addison" -> Some Addison
        | _ -> None

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

    /// Parse a string projection of an actor ref into its structured format.
    /// Supports legacy composites (e.g. "otto-cli") and new canonical grammar:
    /// `<persona>/<surface>[/<instance>][@<node>]`
    let parse (str: string) : ActorRef option =
        if System.String.IsNullOrEmpty str then
            None
        elif Map.containsKey str legacyMap then
            Some legacyMap.[str]
        else
            let mutable remaining = str
            let mutable node = None

            let atIdx = remaining.IndexOf('@')
            if atIdx <> -1 then
                node <- Some (remaining.Substring(atIdx + 1))
                remaining <- remaining.Substring(0, atIdx)

            let parts = remaining.Split('/')
            if parts.Length = 0 then
                None
            else
                match PersonaId.parse parts.[0] with
                | None -> None
                | Some persona ->
                    let surface = if parts.Length > 1 then Some parts.[1] else None
                    let instance = if parts.Length > 2 then Some parts.[2] else None
                    if parts.Length > 3 then
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
        if System.String.IsNullOrEmpty uri || not (uri.StartsWith(prefix)) then
            None
        else
            let mutable remaining = uri.Substring(prefix.Length)
            let mutable node = None

            let atIdx = remaining.IndexOf('@')
            if atIdx <> -1 then
                node <- Some (remaining.Substring(atIdx + 1))
                remaining <- remaining.Substring(0, atIdx)

            let parts = remaining.Split('/')
            if parts.Length = 0 then
                None
            else
                match PersonaId.parse parts.[0] with
                | None -> None
                | Some persona ->
                    if parts.Length > 1 then
                        if parts.[1] <> "cell" then
                            None
                        elif parts.Length < 3 then
                            None
                        else
                            let surface = Some parts.[2]
                            let instance = if parts.Length > 3 then Some parts.[3] else None
                            if parts.Length > 4 then
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
                    else
                        Some {
                            Persona = persona
                            Cell = {
                                Surface = None
                                Instance = None
                                Node = node
                            }
                        }
