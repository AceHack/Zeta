// Independent F# oracle: compute MurmurHash3 fmix32 over the canonical inputs and
// emit fsharp-output.json. Recomputes the finaliser from scratch with unchecked
// wrapping uint32 arithmetic (does not reference any Core assembly) so it is a
// genuine independent oracle.
open System.IO
open System.Text

let fmix32 (x: uint32) : uint32 =
    let mutable h = x
    h <- h ^^^ (h >>> 16)
    h <- h * 0x85ebca6bu
    h <- h ^^^ (h >>> 13)
    h <- h * 0xc2b2ae35u
    h ^^^ (h >>> 16)

let inputs =
    [ "x-0", 0u
      "x-1", 1u
      "x-2", 2u
      "x-10", 10u
      "x-255", 255u
      "x-u32max", 4294967295u
      "x-0x9e3779b9", 2654435769u
      "x-2pow31", 2147483648u
      "x-3735928559", 3735928559u
      "x-1e9", 1000000000u ]

let sb = StringBuilder()
sb.AppendLine("{") |> ignore
inputs
|> List.iteri (fun i (id, x) ->
    let comma = if i < inputs.Length - 1 then "," else ""
    sb.AppendLine(sprintf "  \"%s\": \"%d\"%s" id (fmix32 x) comma) |> ignore)
sb.AppendLine("}") |> ignore
let here = __SOURCE_DIRECTORY__
let target = Path.Combine(Path.GetDirectoryName(here), "fsharp-output.json")
File.WriteAllText(target, sb.ToString())
printfn "wrote fsharp-output.json"
