// Independent F# oracle: compute SplitMix64 over the canonical inputs and emit
// fsharp-output.json. Recomputes the mixer from scratch with unchecked wrapping
// uint64 arithmetic (does not reference the Core port assembly) so it is a
// genuine independent oracle.
open System.IO
open System.Text

let mix (x: uint64) : uint64 =
    let mutable z = x * 0x9E3779B97F4A7C15UL
    z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
    z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
    z ^^^ (z >>> 31)

let inputs =
    [ "x-0", 0UL
      "x-1", 1UL
      "x-2", 2UL
      "x-10", 10UL
      "x-255", 255UL
      "x-u64max", 18446744073709551615UL
      "x-golden", 11400714819323198485UL
      "x-2pow63", 9223372036854775808UL
      "x-12345678901234567890", 12345678901234567890UL
      "x-1e18", 1000000000000000000UL ]

// Emit a stable, indent-2 JSON object preserving input order.
let sb = StringBuilder()
sb.AppendLine("{") |> ignore
inputs
|> List.iteri (fun i (id, x) ->
    let comma = if i < inputs.Length - 1 then "," else ""
    sb.AppendLine(sprintf "  \"%s\": \"%d\"%s" id (mix x) comma) |> ignore)
sb.AppendLine("}") |> ignore

let here = __SOURCE_DIRECTORY__
let target = Path.Combine(Path.GetDirectoryName(here), "fsharp-output.json")
File.WriteAllText(target, sb.ToString())
printfn "wrote fsharp-output.json"
