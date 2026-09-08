#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll"

// Fixed pinned-input engineering replay, not an arbitrary-input service.
// Expected Outcome is never read by this producer.
open System
open System.Collections.Generic
open System.Globalization
open System.IO
open System.Security.Cryptography
open System.Text.Json
open Zeta.Bayesian
module K = PrecisionGateKernels

let objOf (pairs: (string * obj) list) : obj =
    let d = Dictionary<string, obj>(StringComparer.Ordinal)
    for key, value in pairs do d.Add(key, value)
    box d
let prop (key: string) (node: JsonElement) = node.GetProperty(key)
let text (node: JsonElement) = node.GetString()
let number (node: JsonElement) =
    if node.ValueKind = JsonValueKind.String then
        Double.Parse(node.GetString(), CultureInfo.InvariantCulture)
    else
        Double.Parse((prop "Num" node).GetString(), CultureInfo.InvariantCulture)
        / Double.Parse((prop "Den" node).GetString(), CultureInfo.InvariantCulture)
let scalar key node = prop key node |> number
let moments node : K.RealMoments = { Mean = scalar "Mean" node; Variance = scalar "Variance" node }
let gamma node : K.GammaKernel = { LogPower = scalar "LogPower" node; Rate = scalar "Rate" node }
let gaussian node : Gaussian = { PrecisionMean = scalar "PrecisionMean" node; Precision = scalar "Precision" node }
let outcome<'T> (value: Result<'T, K.KernelError>) =
    match value with
    | Ok success -> objOf [ "Kind", box "success"; "Value", box success ]
    | Error feedback ->
        let code, field, message =
            match feedback with
            | K.InvalidInput (field, requirement) -> "InvalidInput", field, requirement
            | K.NumericalFailure (operation, reason) -> "NumericalFailure", operation, reason
            | K.ImproperBelief family -> "ImproperBelief", family, "proper belief admission failed"
        objOf [ "Kind", box "refused"; "Failure", objOf [ "Code", box code; "Field", box field; "Message", box message ] ]
let invoke operation input =
    let n key = scalar key input
    let p key = prop key input
    match operation with
    | "soft_dot_vmp" -> K.trySoftDotVmp (moments (p "w")) (moments (p "x")) (moments (p "z")) (n "mean_tau") |> outcome
    | "normal_precision_vmp" -> K.tryNormalPrecisionVmp (moments (p "y")) (moments (p "mu")) (n "mean_gamma") |> outcome
    | "gamma_rate_vmp" -> K.tryGammaRateVmp (n "alpha") (n "mean_beta") (n "mean_gamma") |> outcome
    | "gamma_product" -> K.tryGammaProduct (gamma (p "left")) (gamma (p "right")) |> outcome
    | "gamma_quotient" -> K.tryGammaQuotient (gamma (p "left")) (gamma (p "right")) |> outcome
    | "gamma_proper_moments" -> K.tryGammaMoments (gamma (p "kernel")) |> outcome
    | "gaussian_product" -> K.tryGaussianProduct (gaussian (p "left")) (gaussian (p "right")) |> outcome
    | "gaussian_proper_moments" -> K.tryGaussianMoments (gaussian (p "kernel")) |> outcome
    | "gamma_from_shape" -> K.tryEncodeGamma (n "alpha") (n "rate") |> outcome
    | "reverse_log_kernel" ->
        match p "orientation" |> text with
        | "ExpConstraint" -> K.tryReverseLogKernel K.ExpConstraint (gamma (p "kernel")) (n "z") |> outcome
        | "LogConstraint" -> K.tryReverseLogKernel K.LogConstraint (gamma (p "kernel")) (n "z") |> outcome
        | _ -> Error(K.InvalidInput("Orientation", "declared orientation")) |> outcome<float>
    | "projection_objective" ->
        let target : K.ProjectionTarget = { Precision = n "t"; Location = n "u"; Linear = n "k"; ExponentialRate = n "c" }
        K.tryProjectionObjective target { Mean = n "m"; Variance = n "v" } |> outcome
    | _ -> Error(K.InvalidInput("Operation", "declared fixed operation")) |> outcome<float>
let assemblyWitness (assembly: Reflection.Assembly) =
    let bytes = File.ReadAllBytes assembly.Location
    objOf [ "Name", box (assembly.GetName().Name); "Path", box assembly.Location
            "Bytes", box bytes.Length; "Sha256", box (Convert.ToHexString(SHA256.HashData bytes).ToLowerInvariant()) ]
let run path =
    let bytes = File.ReadAllBytes path
    let expected = "ecab012f7084e17097594faabd2ee49ec7a76aa1da8a1fa4f2204ab8df841489"
    if bytes.Length <> 21985 || Convert.ToHexString(SHA256.HashData bytes).ToLowerInvariant() <> expected then
        Error "fixed reference input identity mismatch"
    else
        use doc = JsonDocument.Parse bytes
        let rows =
            (prop "Rows" doc.RootElement).EnumerateArray()
            |> Seq.map (fun row ->
                let id = prop "Id" row |> text
                let op = prop "Operation" row |> text
                objOf [ "Id", box id; "Operation", box op; "Outcome", invoke op (prop "Input" row) ])
            |> Seq.toArray
        Ok(objOf [ "Schema", box "zeta.precision-gate-kernels.native.v1"
                   "ReferenceSha256", box expected; "Rows", box rows
                   "Runtime", objOf [ "Framework", box Runtime.InteropServices.RuntimeInformation.FrameworkDescription;
                                       "Assemblies", box [| assemblyWitness typeof<K.GammaKernel>.Assembly; assemblyWitness typeof<Zeta.Core.ProbabilitySemiring.Rational>.Assembly |] ] ])
let args = fsi.CommandLineArgs |> Array.skip 1
let observed =
    if args.Length <> 1 then Error "one pinned reference path required"
    else
        try run args[0]
        with
        | :? IOException as ex -> Error ex.Message
        | :? JsonException as ex -> Error ex.Message
match observed with
| Ok value -> printfn "%s" (JsonSerializer.Serialize value)
| Error message ->
    eprintfn "%s" message
    Environment.Exit 2
