// Independent F# hand-port oracle for the xoshiro256** OUTPUT SCRAMBLER.
// Re-implements result = rotl(x*5, 7) * 9 (width 64) FROM SCRATCH — a genuine
// N-way peer. uint64 arithmetic wraps mod 2^64 natively.
// Public-domain reference: https://prng.di.unimi.it/xoshiro256starstar.c
open System.IO

let rotl (x: uint64) (k: int) : uint64 = (x <<< k) ||| (x >>> (64 - k))
let scramble (x: uint64) : uint64 = (rotl (x * 5UL) 7) * 9UL

let inputs : (string * uint64) list =
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

let sb = System.Text.StringBuilder()
sb.Append("{\n") |> ignore
sb.Append("  \"_source\": \"hand-port-fsharp\",\n") |> ignore
inputs
|> List.iteri (fun i (id, x) ->
    let comma = if i = inputs.Length - 1 then "" else ","
    sb.Append(sprintf "  \"%s\": \"%d\"%s\n" id (scramble x) comma) |> ignore)
sb.Append("}\n") |> ignore

let dir = Path.GetDirectoryName(Path.GetDirectoryName(__SOURCE_DIRECTORY__ + "/x"))
let target = Path.Combine(__SOURCE_DIRECTORY__, "..", "fsharp-output.json")
File.WriteAllText(target, sb.ToString())
printfn "wrote fsharp-output.json (hand-port)"
