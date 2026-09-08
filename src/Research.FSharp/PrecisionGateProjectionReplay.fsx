#if INTERACTIVE
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll"
#else
namespace Zeta.Research
#endif

/// One independently identified subject per invocation. No reference outputs or
/// expected numerical outcomes are read. File witnesses are ordinary observations,
/// not proof of the complete loaded dependency closure or hostile namespace safety.
module PrecisionGateProjectionReplay =
    open System
    open System.Collections.Generic
    open System.Diagnostics
    open System.IO
    open System.Runtime.InteropServices
    open System.Security.Cryptography
    open System.Text
    open System.Text.Json
    open Microsoft.Win32.SafeHandles
    open Zeta.Bayesian
    module P = PrecisionGateProjection

    type CommandFailure = { Stage: string; Code: string; Message: string }
    type FileObservation = { Path: string; Bytes: int; Sha256: string }
    type RunResult =
        { Complete: bool; Receipt: P.NativeReceipt option
          Failure: CommandFailure option; ApiFailure: P.Failure option
          Cleanup: CommandFailure array; Inputs: FileObservation array
          Assemblies: FileObservation array; Output: FileObservation option }

    let private reason stage code (message: string) =
        { Stage = stage; Code = code
          Message = if message.Length <= 1024 then message else message.Substring(0, 1024) }
    let private observed path (raw: byte array) =
        { Path = path; Bytes = raw.Length; Sha256 = Convert.ToHexString(SHA256.HashData raw) }

    [<DllImport("libc", EntryPoint = "open", SetLastError = true)>]
    extern int private openUnix(string path, int flags)

    /// A nonblocking/no-follow Unix leaf open avoids waiting on a FIFO before
    /// rejecting nonseekable inputs. Windows uses its ordinary file handle API.
    let private inputHandle path =
        if OperatingSystem.IsMacOS() || OperatingSystem.IsLinux() then
            let flags = if OperatingSystem.IsMacOS() then 0x0004 ||| 0x0100 else 0x0800 ||| 0x20000
            let descriptor = openUnix(path, flags)
            if descriptor < 0 then
                raise (IOException("owned input open refused: " + string (Marshal.GetLastPInvokeError())))
            new SafeFileHandle(nativeint descriptor, true)
        elif OperatingSystem.IsWindows() then
            File.OpenHandle(path, FileMode.Open, FileAccess.Read, FileShare.Read)
        else raise (PlatformNotSupportedException("declared file-open platform required"))

    /// Exact initial-size bytes plus one; no read-until-EOF loop. The deadline is
    /// checked between reads, not a kernel-I/O cancellation or OS quota guarantee.
    let private readBounded (cleanup: ResizeArray<CommandFailure>) path cap : Result<byte array, CommandFailure> =
        let mutable primary = None
        let mutable value = None
        let mutable stream: FileStream option = None
        let mutable handle: SafeFileHandle option = None
        try
            let owned = inputHandle path
            handle <- Some owned
            let opened = new FileStream(owned, FileAccess.Read)
            stream <- Some opened
            if not opened.CanSeek then raise (IOException("seekable regular input required"))
            let size = opened.Length
            if size < 0L || size > int64 cap then raise (IOException("declared input byte limit exceeded"))
            let clock = Stopwatch.StartNew()
            let raw = Array.zeroCreate<byte> (int size)
            let mutable offset = 0
            while offset < raw.Length do
                if clock.Elapsed.TotalSeconds > 10.0 then raise (IOException("bounded input read deadline exceeded"))
                let count = opened.Read(raw, offset, raw.Length - offset)
                if count = 0 then raise (IOException("short input read"))
                offset <- offset + count
            if clock.Elapsed.TotalSeconds > 10.0 then raise (IOException("bounded input read deadline exceeded"))
            if opened.ReadByte() <> -1 || opened.Length <> size then raise (IOException("input size changed during read"))
            value <- Some raw
        with ex -> primary <- Some(reason "read" "FileRead" ex.Message)
        try
            match stream, handle with
            | Some owned, _ -> owned.Dispose()
            | None, Some owned -> owned.Dispose()
            | None, None -> ()
        with ex ->
            let error = reason "read-cleanup" "FileClose" ex.Message
            cleanup.Add error
            if primary.IsNone then primary <- Some error
        match primary, value with
        | Some error, _ -> Error error
        | None, Some raw -> Ok raw
        | None, None -> Error(reason "read" "MissingRead" "no admitted input bytes")

    /// The stream factory is an owned-file test seam. Production always uses
    /// FileMode.CreateNew. The returned in-memory receipt survives write/flush/close
    /// refusal; a complete publication requires every one of those steps.
    let runWith (createOutput: string -> Stream) (args: string array) : RunResult =
        let mutable stage = "arguments"
        let mutable primary = None
        let mutable apiFailure = None
        let mutable receipt = None
        let mutable output = None
        let mutable outputStream: Stream option = None
        let cleanup = ResizeArray<CommandFailure>()
        let inputs = ResizeArray<FileObservation>()
        let assemblies = ResizeArray<FileObservation>()
        let fail error = if primary.IsNone then primary <- Some error
        let take = function
            | Ok value -> Some value
            | Error error -> fail error; None
        try
            let validArgs =
                not (isNull args) && args.Length = 5
                && (args |> Array.forall (fun s -> not (String.IsNullOrEmpty s)))
                && (args |> Array.sumBy (fun s -> int64 (Encoding.UTF8.GetByteCount s))) <= 65536L
            if not validArgs then
                fail (reason stage "Arguments" "input path, expected SHA256, subject Id, bindings path and exclusive output path required; total argv <=64 KiB")
            else
                stage <- "output-create"
                outputStream <- Some(createOutput args.[4])
                stage <- "input-read"
                match readBounded cleanup args.[0] 65536 |> take with
                | None -> ()
                | Some raw ->
                    inputs.Add(observed args.[0] raw)
                    stage <- "bindings-read"
                    match readBounded cleanup args.[3] 65536 |> take with
                    | None -> ()
                    | Some bindingBytes ->
                        inputs.Add(observed args.[3] bindingBytes)
                        stage <- "bindings-admission"
                        match P.tryReadBindings bindingBytes with
                        | Error error -> apiFailure <- Some error; fail (reason stage "ApiRefusal" "caller binding admission refused")
                        | Ok bindings ->
                            stage <- "assembly-observation"
                            for assembly in [| typeof<P.NativeReceipt>.Assembly; typeof<Zeta.Core.ProbabilitySemiring.Rational>.Assembly |] do
                                if primary.IsNone then
                                    match readBounded cleanup assembly.Location (128 * 1024 * 1024) |> take with
                                    | None -> ()
                                    | Some bytes -> assemblies.Add(observed assembly.Location bytes)
                            if primary.IsNone then
                                stage <- "native-call"
                                match P.tryNativeCall raw args.[1] args.[2] bindings with
                                | Error error -> apiFailure <- Some error; fail (reason stage "ApiRefusal" "independent caller metadata refused")
                                | Ok actual ->
                                    receipt <- Some actual
                                    stage <- "receipt-encoding"
                                    match P.tryEncode actual with
                                    | Error error -> apiFailure <- Some error; fail (reason stage "EncodingRefusal" "actual receipt remains in memory")
                                    | Ok bytes ->
                                        stage <- "receipt-write"
                                        let owned = outputStream.Value
                                        owned.Write(bytes, 0, bytes.Length)
                                        stage <- "receipt-flush"
                                        match owned with
                                        | :? FileStream as file -> file.Flush(true)
                                        | _ -> owned.Flush()
                                        output <- Some(observed args.[4] bytes)
        with ex -> fail (reason stage "CommandException" ex.Message)
        match outputStream with
        | None -> ()
        | Some owned ->
            try owned.Dispose()
            with ex ->
                let error = reason "output-close" "FileClose" ex.Message
                cleanup.Add error
                fail error
        { Complete = primary.IsNone && output.IsSome && receipt.IsSome
          Receipt = receipt; Failure = primary; ApiFailure = apiFailure
          Cleanup = cleanup.ToArray(); Inputs = inputs.ToArray()
          Assemblies = assemblies.ToArray(); Output = output }

    let run args =
        runWith (fun path -> new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None) :> Stream) args

    let private objectOf (pairs: (string * obj) list) : obj =
        let fields = Dictionary<string, obj>(StringComparer.Ordinal)
        for key, value in pairs do fields.Add(key, value)
        box fields
    let private optional convert = function Some value -> convert value | None -> null
    let private apiObject (error: P.Failure) =
        objectOf ["Code", box error.Code; "Stage", box error.Stage; "Field", optional box error.Field
                  "Message", box error.Message
                  "OriginalKernelFailure", optional (fun (e: P.OriginalKernelFailure) ->
                      objectOf ["Kind", box e.Kind; "Field", box e.Field; "Detail", optional box e.Detail]) error.OriginalKernelFailure]

    /// Side-channel report is separate from the registered receipt. It reports
    /// availability/counters, never truncates that receipt into an apparent result.
    let encodeCommand (result: RunResult) =
        try
            let receiptKind = result.Receipt |> Option.map (fun r -> match r.Outcome with P.Candidate _ -> "candidate" | P.Refused _ -> "refused")
            let value =
                objectOf ["Schema", box "zeta.precision-projection.command.v1"
                          "Complete", box result.Complete; "Failure", optional box result.Failure
                          "ApiFailure", optional apiObject result.ApiFailure; "Cleanup", box result.Cleanup
                          "InputFiles", box result.Inputs; "AssemblyFiles", box result.Assemblies
                          "Output", optional box result.Output; "ReceiptAvailable", box result.Receipt.IsSome
                          "ReceiptKind", optional box receiptKind
                          "Counters", optional (fun (r: P.NativeReceipt) -> box r.Counters) result.Receipt
                          "TraceRows", optional (fun (r: P.NativeReceipt) -> box r.Trace.Length) result.Receipt
                          "Runtime", box Runtime.InteropServices.RuntimeInformation.FrameworkDescription]
            let bytes = JsonSerializer.SerializeToUtf8Bytes value
            if bytes.Length > 128 * 1024 - 1 then Error(reason "command-encoding" "OutputBound" "side report exceeds 128 KiB including newline")
            else Ok bytes
        with ex -> Error(reason "command-encoding" "EncodingException" ex.Message)

#if INTERACTIVE
let returned = PrecisionGateProjectionReplay.run (fsi.CommandLineArgs |> Array.skip 1)
let mutable exitCode = if returned.Complete then 0 else 2
try
    match PrecisionGateProjectionReplay.encodeCommand returned with
    | Ok bytes ->
        let stdout = System.Console.OpenStandardOutput()
        stdout.Write(bytes, 0, bytes.Length)
        stdout.WriteByte(10uy)
        stdout.Flush()
    | Error error ->
        exitCode <- 2
        eprintfn "Projection command report refused at %s: %s" error.Stage error.Code
with ex ->
    exitCode <- 2
    try eprintfn "Projection command publication failed: %s" (ex.GetType().Name) with _ -> ()
System.Environment.Exit exitCode
#endif
