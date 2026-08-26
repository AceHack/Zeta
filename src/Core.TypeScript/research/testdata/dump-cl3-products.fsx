#r "../../../Core/bin/Release/net10.0/Zeta.Core.dll"
open Zeta.Core

// Deterministic LCG — no ambient entropy, so the TS side can reproduce the same inputs.
let mutable seed = 4u
let next () =
    seed <- seed * 1103515245u + 12345u
    (float seed / 4294967296.0) * 10.0 - 5.0

let sb = System.Text.StringBuilder()
// Mv field order is MASK order: [S; E1; E2; E12; E3; E13; E23; E123]
for _ in 1 .. 200 do
    let a = [| next(); next(); next(); next(); next(); next(); next(); next() |]
    let b = [| next(); next(); next(); next(); next(); next(); next(); next() |]
    let mk (v: float[]) = { Cl3.S = v.[0]; Cl3.E1 = v.[1]; Cl3.E2 = v.[2]; Cl3.E12 = v.[3]
                            Cl3.E3 = v.[4]; Cl3.E13 = v.[5]; Cl3.E23 = v.[6]; Cl3.E123 = v.[7] }
    let p = Cl3.gp (mk a) (mk b)
    let fmt (v: float[]) =
        v |> Array.map (fun x -> x.ToString("R", System.Globalization.CultureInfo.InvariantCulture))
          |> String.concat ","
    let pa = [| p.S; p.E1; p.E2; p.E12; p.E3; p.E13; p.E23; p.E123 |]
    sb.AppendLine(fmt a + "|" + fmt b + "|" + fmt pa) |> ignore

System.IO.File.WriteAllText(
    "cl3-geometric-products.raw.txt",
    sb.ToString())
printfn "wrote %d products" 200
