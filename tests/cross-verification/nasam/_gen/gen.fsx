// Independent F# hand-port oracle for Pelle Evensen's `nasam` mixer.
// Re-implements the public-domain reference FROM SCRATCH — a genuine N-way peer.
// uint64 arithmetic wraps mod 2^64 natively.
// Reference: https://mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
open System.IO

let ror (x: uint64) (r: int) : uint64 = (x >>> r) ||| (x <<< (64 - r))

let nasam (x0: uint64) : uint64 =
    let mutable x = x0
    x <- x ^^^ ror x 25 ^^^ ror x 47
    x <- x * 0x9E6C63D0676A9A99UL
    x <- x ^^^ (x >>> 23) ^^^ (x >>> 51)
    x <- x * 0x9E6D62D06F6A9A9BUL
    x <- x ^^^ (x >>> 23) ^^^ (x >>> 51)
    x

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
    sb.Append(sprintf "  \"%s\": \"%d\"%s\n" id (nasam x) comma) |> ignore)
sb.Append("}\n") |> ignore

let target = Path.Combine(__SOURCE_DIRECTORY__, "..", "fsharp-output.json")
File.WriteAllText(target, sb.ToString())
printfn "wrote fsharp-output.json (hand-port)"
