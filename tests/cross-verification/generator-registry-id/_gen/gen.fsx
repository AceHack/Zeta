// F# oracle for GeneratorRegistry content-addresses — emits fsharp-output.json.
//
// Unlike the other cross-verification F# oracles (which recompute from scratch to
// stay independent), this one references the REAL shipping `GeneratorRegistry`
// from the compiled Core assembly. That is deliberate and stronger here: the
// whole point of this primitive is to prove the in-tree registry's content-address
// agrees, cross-language, with an independent re-derivation (the TS oracle, which
// DOES recompute hash128/idOf from scratch). So:
//   * For a REGISTERED generator (`rng.splitmix64`) we resolve via `byName` and
//     read `.ZetaId` — proving it is an actual registry ROW, not just a hash of
//     an arbitrary string.
//   * For the remaining vectors we call `idOf name version` directly (the pure
//     content-address), covering version-bump distinctness etc.
// The TS oracle's independent recompute byte-locking against THIS real-registry
// output is the evidence that the id is reproducible everywhere ("treaty over
// generators").
#r "../../../../src/Core/bin/Release/net10.0/Zeta.Core.dll"
open System.IO
open System.Text
open Zeta.Core

// Resolve a registered generator by name (registry ROW), else fall back to the
// pure content-address. Both must equal the canonical vector.
let resolve (name: string) (version: int) : string =
    match GeneratorRegistry.byName name with
    | Some e when e.Version = version -> e.ZetaId
    | _ -> GeneratorRegistry.idOf name version

let inputs =
    [ "rng.splitmix64@1", "rng.splitmix64", 1
      "boundary.glow@1", "boundary.glow", 1
      "boundary.glow@2", "boundary.glow", 2
      "kernel.rbf@1", "kernel.rbf", 1
      "zetaid.glyph@1", "zetaid.glyph", 1
      "zetaid.glyph@2", "zetaid.glyph", 2 ]

let sb = StringBuilder()
sb.AppendLine("{") |> ignore
sb.AppendLine("  \"_source\": \"generated-from-ir\",") |> ignore
inputs
|> List.iteri (fun i (id, name, version) ->
    let comma = if i < inputs.Length - 1 then "," else ""
    sb.AppendLine(sprintf "  \"%s\": \"%s\"%s" id (resolve name version) comma) |> ignore)
sb.AppendLine("}") |> ignore

let here = __SOURCE_DIRECTORY__
let target = Path.Combine(Path.GetDirectoryName(here), "fsharp-output.json")
File.WriteAllText(target, sb.ToString())
printfn "wrote fsharp-output.json"
