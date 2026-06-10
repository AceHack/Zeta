namespace Zeta.Core

open System

/// CLI verb resolution — diskpart-style minimum-unique-prefix abbreviation (Aaron 2026-06-10:
/// "does mea and measure both work ... the 3 letter thing i got from diskpart").
///
/// The verb family is sim · mea · cut · ben · cla · res. The full word AND any UNAMBIGUOUS prefix
/// resolve to the same verb (measure ≡ measu ≡ meas ≡ mea; cut ≡ cu; classify ≡ cla ≡ cl);
/// ambiguous prefixes (e.g. "c" → cut|classify) are REJECTED, not guessed. The 3-letter stems are
/// just the guaranteed-unique shortest form. Pure + module/curried, no classes. Culture-invariant
/// (ToLowerInvariant + Ordinal — never platform-default comparison). See clis/ and the sim·mea·cut docs.
[<RequireQualifiedAccess>]
module CliVerb =

    /// The verb family.
    type Verb =
        | Simulate
        | Measure
        | Cut
        | Benchmark
        | Classify
        | Resolve

    /// Canonical word per verb (the stems sim/mea/cut/ben/cla/res are prefixes of these).
    let word (v: Verb) : string =
        match v with
        | Simulate -> "simulate"
        | Measure -> "measure"
        | Cut -> "cut"
        | Benchmark -> "benchmark"
        | Classify -> "classify"
        | Resolve -> "resolve"

    /// All verbs, in canonical order.
    let all: Verb list = [ Simulate; Measure; Cut; Benchmark; Classify; Resolve ]

    /// Does this verb commit a residue to main? `sim` is ephemeral (no); the rest do — they commit to
    /// a branch at end of run and the TEST-FRAMEWORK FINALIZER merges it to main (FinalizerRuntime
    /// ReKick=merge-to-main). So `cut`/`mea`/`ben`/`cla`/`res` all run through the finalizer; `sim`
    /// leaves nothing.
    let commits (v: Verb) : bool =
        match v with
        | Simulate -> false
        | _ -> true

    /// Why a token failed to resolve.
    [<RequireQualifiedAccess>]
    type ResolveError =
        | Unknown of token: string
        | Ambiguous of token: string * candidates: Verb list

    /// Resolve a token by minimum-unique prefix (diskpart-style, culture-invariant): the full word
    /// AND any unambiguous prefix resolve; ambiguous prefixes are rejected, not guessed.
    let resolve (token: string) : Result<Verb, ResolveError> =
        let t = token.Trim().ToLowerInvariant()
        if t = "" then
            Error(ResolveError.Unknown token)
        else
            match all |> List.filter (fun v -> (word v).StartsWith(t, StringComparison.Ordinal)) with
            | [ v ] -> Ok v
            | [] -> Error(ResolveError.Unknown token)
            | many -> Error(ResolveError.Ambiguous(token, many))
