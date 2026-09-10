module RenderedSignalRuntime

open System
open System.IO
open System.Security.Cryptography

type LoadedAssembly = { Name: string; Mvid: string; Sha256: string }

// These are the binaries FSI actually loaded, separate from source fingerprints.
let loadedAssemblies () =
    let names = [| "Zeta.Core"; "Zeta.Core.Abstractions" |]
    let assemblies =
        [| typeof<Zeta.Core.GameEnvironment.Frame>.Assembly
           typeof<Zeta.Core.IBilinearMarker>.Assembly |]
        |> Array.map (fun assembly ->
            { Name = assembly.GetName().Name
              Mvid = assembly.ManifestModule.ModuleVersionId.ToString("D")
              Sha256 = File.ReadAllBytes assembly.Location |> SHA256.HashData |> Convert.ToHexString })
        |> Array.sortBy _.Name
    if Array.map _.Name assemblies <> Array.sort names then
        Error "expected loaded Core and Core.Abstractions assemblies"
    else Ok assemblies
