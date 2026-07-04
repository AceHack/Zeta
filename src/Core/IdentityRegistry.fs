// IdentityRegistry.fs — GENERATED FILE — DO NOT EDIT DIRECTLY
namespace Zeta.Core

/// PersonaId - Closed, registry-backed enum of identities (the hubs).
type PersonaId =
    | Aaron
    | Otto
    | Alexa
    | Riven
    | Vera
    | Lior
    | Soraya
    | Addison

[<RequireQualifiedAccess>]
module PersonaId =
    let toString = function
        | Aaron -> "aaron"
        | Otto -> "otto"
        | Alexa -> "alexa"
        | Riven -> "riven"
        | Vera -> "vera"
        | Lior -> "lior"
        | Soraya -> "soraya"
        | Addison -> "addison"

    let parse = function
        | "aaron" -> Some Aaron
        | "otto" -> Some Otto
        | "alexa" -> Some Alexa
        | "riven" -> Some Riven
        | "vera" -> Some Vera
        | "lior" -> Some Lior
        | "soraya" -> Some Soraya
        | "addison" -> Some Addison
        | _ -> None

module IdentityRegistry =
    let validPersonas =
        [
            "aaron";
            "otto";
            "alexa";
            "riven";
            "vera";
            "lior";
            "soraya";
            "addison"
        ]
        |> Set.ofList

    let validSurfaces =
        [
            "antigravity";
            "cli";
            "codex";
            "cursor";
            "desktop";
            "gemini";
            "kiro";
            "verifier-node";
            "vscode";
            "windows"
        ]
        |> Set.ofList
