namespace Zeta.Benchmarks

open System
open BenchmarkDotNet.Attributes
open Zeta.Core
open Zeta.Core.CSharp.Bonsai

[<MemoryDiagnoser>]
type BonsaiBench() =

    let sampleExpr = 
        Expr.Binary(
            BinOp.Add,
            Expr.Constant(ConstValue.Number 123L),
            Expr.Binary(
                BinOp.Mul,
                Expr.Constant(ConstValue.Number 456L),
                Expr.Constant(ConstValue.Str "hello_world")
            )
        )

    let mutable serializedString = ""

    [<GlobalSetup>]
    member this.Setup() =
        serializedString <- 
            match BonsaiCodec.Serialize(sampleExpr) with
            | :? Result<string, BonsaiFeedback>.Ok as ok -> ok.Value
            | _ -> failwith "Failed to serialize"

    [<Benchmark>]
    member this.Serialize() =
        BonsaiCodec.Serialize(sampleExpr) |> ignore

    [<Benchmark>]
    member this.Parse() =
        BonsaiCodec.Parse(serializedString) |> ignore
