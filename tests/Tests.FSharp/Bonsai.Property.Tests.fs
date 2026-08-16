module Zeta.Tests.BonsaiPropertyTests

open Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.Bonsai

// ── FsCheck generators for arbitrary Bonsai.Expr tree (bounded depth to prevent stack overflow) ──

let private genChar = Gen.elements [ 'a'; 'Z'; '0'; ' '; '_' ]
let private genStr =
    gen { let! n = Gen.choose (0, 6)
          let! cs = Gen.listOfLength n genChar
          return System.String(List.toArray cs) }

let private genInt64 =
    Gen.oneof [
        Gen.choose (-100000, 100000) |> Gen.map int64
        Gen.elements [ 0L; 1L; -1L; 9007199254740991L; -9007199254740991L ]
    ]

let private genConst =
    Gen.oneof [
        genInt64 |> Gen.map CInt
        genStr |> Gen.map CStr
        Gen.elements [ true; false ] |> Gen.map CBool
        Gen.constant CNull
    ]

let private genBinOp =
    Gen.elements [ Add; Sub; Mul; Eq; Lt; And; Or ]

let private genExpr =
    let rec aux (size: int) : Gen<Expr> =
        if size <= 0 then
            Gen.oneof [
                genConst |> Gen.map Const
                genStr |> Gen.map Param
            ]
        else
            Gen.oneof [
                genConst |> Gen.map Const
                genStr |> Gen.map Param
                gen {
                    // Arity is generated (0..3), not fixed: a fixed-arity generator cannot
                    // distinguish an implementation that only handles the one arity it emits.
                    let! n = Gen.choose (0, 3)
                    let! ps = Gen.listOfLength n genStr
                    let! body = aux (size / 2)
                    return Lambda (ps, body)
                }
                gen {
                    let! op = genBinOp
                    let! l = aux (size / 2)
                    let! r = aux (size / 2)
                    return Binary (op, l, r)
                }
                gen {
                    let! fn = genStr
                    let! n = Gen.choose (0, 3)
                    let! args = Gen.listOfLength n (aux (size / 2))
                    return Call (fn, args)
                }
                gen {
                    let! t = aux (size / 3)
                    let! th = aux (size / 3)
                    let! el = aux (size / 3)
                    return Cond (t, th, el)
                }
            ]
    Gen.sized aux

type BonsaiExprArb() =
    static member Expr() = Arb.fromGen genExpr

[<Property(Arbitrary = [| typeof<BonsaiExprArb> |])>]
let ``Bonsai.Expr round-trips through reify and apply for all generated expressions`` (e: Expr) =
    apply (reify e) = Ok e
