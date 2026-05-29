namespace Zeta.Tests.Support

open System
open System.IO
open System.Threading

[<RequireQualifiedAccess>]
module DeterministicTestPath =
    let mutable private counter = 0

    let private sanitize (prefix: string) =
        let chars =
            prefix
            |> Seq.map (fun c ->
                if Char.IsLetterOrDigit c || c = '-' || c = '_' || c = '.' then c
                else '-')
            |> Seq.toArray

        let cleaned = String(chars).Trim('-')
        if String.IsNullOrWhiteSpace cleaned then "path" else cleaned

    /// Returns a process-local deterministic temp directory for filesystem tests.
    let nextDir (prefix: string) =
        let id = Interlocked.Increment(&counter)
        let root = Path.Combine(Path.GetTempPath(), "zeta-test-paths")
        let dir = Path.Combine(root, sprintf "%s-%04d" (sanitize prefix) id)

        if Directory.Exists dir then
            Directory.Delete(dir, true)

        Directory.CreateDirectory dir |> ignore
        dir
