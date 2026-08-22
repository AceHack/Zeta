module Zeta.Tests.ActorRefTests

open System.IO
open System.Text.Json
open Xunit
open Zeta.Core

let private repoRoot () =
    let mutable dir = DirectoryInfo(Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location))
    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    if isNull dir then failwith "Could not locate repo root (Zeta.sln)." else dir.FullName

let private sharedInvalid (door: string) : string list =
    let path = Path.Join(repoRoot (), "tests", "cross-verification", "actor-ref", "vectors.json")
    Assert.True(File.Exists path, sprintf "shared actor-ref vectors missing: %s" path)
    use doc = JsonDocument.Parse(File.ReadAllText path)
    [ for v in doc.RootElement.GetProperty("invalid").EnumerateArray() do
          if v.GetProperty("door").GetString() = door then
              yield v.GetProperty("input").GetString() ]

type GoldenVector =
    { StringProj: string
      SpiffeUri: string
      ExpectedActor: ActorRef }

let goldenVectors =
    [
        { StringProj = "otto"
          SpiffeUri = "spiffe://zeta/persona/otto"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = None; Instance = None; Node = None } } }
        { StringProj = "alexa"
          SpiffeUri = "spiffe://zeta/persona/alexa"
          ExpectedActor = { Persona = PersonaId.Alexa; Cell = { Surface = None; Instance = None; Node = None } } }
        { StringProj = "otto-cli"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/cli"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "cli"; Instance = None; Node = None } } }
        { StringProj = "otto-desktop"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/desktop"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "desktop"; Instance = None; Node = None } } }
        { StringProj = "otto-vscode"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/vscode"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "vscode"; Instance = None; Node = None } } }
        { StringProj = "otto-windows"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/windows"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "windows"; Instance = None; Node = None } } }
        { StringProj = "alexa-kiro"
          SpiffeUri = "spiffe://zeta/persona/alexa/cell/kiro"
          ExpectedActor = { Persona = PersonaId.Alexa; Cell = { Surface = Some "kiro"; Instance = None; Node = None } } }
        { StringProj = "riven-cursor"
          SpiffeUri = "spiffe://zeta/persona/riven/cell/cursor"
          ExpectedActor = { Persona = PersonaId.Riven; Cell = { Surface = Some "cursor"; Instance = None; Node = None } } }
        { StringProj = "lior-antigravity"
          SpiffeUri = "spiffe://zeta/persona/lior/cell/antigravity"
          ExpectedActor = { Persona = PersonaId.Lior; Cell = { Surface = Some "antigravity"; Instance = None; Node = None } } }
        { StringProj = "vera-codex"
          SpiffeUri = "spiffe://zeta/persona/vera/cell/codex"
          ExpectedActor = { Persona = PersonaId.Vera; Cell = { Surface = Some "codex"; Instance = None; Node = None } } }
        { StringProj = "otto/cli"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/cli"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "cli"; Instance = None; Node = None } } }
        { StringProj = "otto/cli/fg"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/cli/fg"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "cli"; Instance = Some "fg"; Node = None } } }
        { StringProj = "otto/cli/fg@node-a"
          SpiffeUri = "spiffe://zeta/persona/otto/cell/cli/fg@node-a"
          ExpectedActor = { Persona = PersonaId.Otto; Cell = { Surface = Some "cli"; Instance = Some "fg"; Node = Some "node-a" } } }
        { StringProj = "aaron/desktop@machine-b"
          SpiffeUri = "spiffe://zeta/persona/aaron/cell/desktop@machine-b"
          ExpectedActor = { Persona = PersonaId.Aaron; Cell = { Surface = Some "desktop"; Instance = None; Node = Some "machine-b" } } }
        // verifier-node is a SURFACE (registry/cell-surfaces.yaml), not a node —
        // vector corrected to match the TS oracle (phase 4, 2026-07-04);
        // node-without-surface moved to the invalid class below.
        { StringProj = "soraya/verifier-node"
          SpiffeUri = "spiffe://zeta/persona/soraya/cell/verifier-node"
          ExpectedActor = { Persona = PersonaId.Soraya; Cell = { Surface = Some "verifier-node"; Instance = None; Node = None } } }
    ]

[<Fact>]
let ``Golden Vectors: parse and project roundtrip`` () =
    for vector in goldenVectors do
        // 1. Parsing the string projection
        match ActorRef.parse vector.StringProj with
        | None -> failwithf "Failed to parse golden vector: %s" vector.StringProj
        | Some actor ->
            Assert.Equal(vector.ExpectedActor, actor)

            // 2. Projecting back should match canonical form
            let projected = ActorRef.project actor
            
            // Legacy composites project to canonical form (hyphen -> slash)
            let expectedProj =
                match vector.StringProj with
                | "otto-cli" -> "otto/cli"
                | "otto-desktop" -> "otto/desktop"
                | "otto-vscode" -> "otto/vscode"
                | "otto-windows" -> "otto/windows"
                | "alexa-kiro" -> "alexa/kiro"
                | "riven-cursor" -> "riven/cursor"
                | "lior-antigravity" -> "lior/antigravity"
                | "vera-codex" -> "vera/codex"
                | other -> other
                
            Assert.Equal(expectedProj, projected)

[<Fact>]
let ``Golden Vectors: SPIFFE parse and project roundtrip`` () =
    for vector in goldenVectors do
        // 1. Parsing the SPIFFE URI
        match ActorRef.parseSpiffe vector.SpiffeUri with
        | None -> failwithf "Failed to parse SPIFFE URI: %s" vector.SpiffeUri
        | Some actor ->
            Assert.Equal(vector.ExpectedActor, actor)

            // 2. Formatting back to SPIFFE URI
            let formatted = ActorRef.toSpiffe actor
            Assert.Equal(vector.SpiffeUri, formatted)

[<Fact>]
let ``Invalid actor ref string formats return None`` () =
    Assert.True(ActorRef.parse "invalidagent/cli" = None)
    Assert.True(ActorRef.parse "otto/cli/instance/extra" = None)
    Assert.True(ActorRef.parse "" = None)

[<Fact>]
let ``Invalid SPIFFE URI formats return None`` () =
    Assert.True(ActorRef.parseSpiffe "http://zeta/persona/otto" = None)
    Assert.True(ActorRef.parseSpiffe "spiffe://zeta/persona/invalidagent/cell/cli" = None)
    Assert.True(ActorRef.parseSpiffe "spiffe://zeta/persona/otto/invalid/cli" = None)
    Assert.True(ActorRef.parseSpiffe "spiffe://zeta/persona/otto/cell" = None)
    Assert.True(ActorRef.parseSpiffe "spiffe://zeta/persona/otto/cell/cli/fg/extra" = None)

[<Fact>]
let ``Invalid vectors — byte-lock floor rejection class (shared file)`` () =
    // 081M00J1EWW: one file, every oracle. Adding a parse-door row with no
    // parser change must turn this red.
    let invalidVectors = sharedInvalid "parse"
    Assert.True(List.isEmpty invalidVectors |> not, "shared file has no parse-door rows")
    for bad in invalidVectors do
        Assert.True(ActorRef.parse bad = None, sprintf "expected parse to reject %s" bad)

[<Fact>]
let ``Invalid SPIFFE vectors — same rejection class through the URI port`` () =
    let invalid = sharedInvalid "parseSpiffe"
    Assert.True(List.isEmpty invalid |> not, "shared file has no parseSpiffe-door rows")
    for bad in invalid do
        Assert.True(ActorRef.parseSpiffe bad = None, sprintf "expected parseSpiffe to reject %s" bad)
