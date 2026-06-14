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

        let rec deleteExisting attempts =
            if Directory.Exists dir then
                try
                    Directory.Delete(dir, true)
                with
                | :? DirectoryNotFoundException when attempts > 0 ->
                    Thread.Sleep 10
                    deleteExisting (attempts - 1)
                | :? IOException when attempts > 0 ->
                    Thread.Sleep 10
                    deleteExisting (attempts - 1)
                | :? UnauthorizedAccessException when attempts > 0 ->
                    Thread.Sleep 10
                    deleteExisting (attempts - 1)

        deleteExisting 5

        Directory.CreateDirectory dir |> ignore
        dir
