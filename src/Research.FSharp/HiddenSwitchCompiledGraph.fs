namespace Zeta.Research

open System
open System.Diagnostics
open System.Globalization
open System.IO
open System.Reflection
open System.Runtime.CompilerServices
open System.Runtime.InteropServices
open System.Runtime.Loader
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Zeta.Core

/// Separate graph-hand feasibility collector. This does not admit a runtime or
/// execute registered streams. It never reads arbitrary native method memory;
/// the independently decoded callable/stub/body evidence belongs to LLDB.
[<RequireQualifiedAccess>]
module HiddenSwitchCompiledGraph =
    [<Struct; StructLayout(LayoutKind.Sequential)>]
    type private FpEnvironment =
        val mutable Fpsr: uint64
        val mutable Fpcr: uint64

    [<DllImport("/usr/lib/libSystem.B.dylib", EntryPoint = "fegetenv", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern int private getEnvironment(FpEnvironment& environment)
    [<DllImport("/usr/lib/libSystem.B.dylib", EntryPoint = "fegetround", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern int private getRounding()
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_image_count", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern uint32 private imageCount()
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_get_image_name", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern nativeint private imageName(uint32 index)
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_get_image_header", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern nativeint private imageHeader(uint32 index)
    [<DllImport("/usr/lib/system/libdyld.dylib", EntryPoint = "_dyld_get_image_vmaddr_slide", ExactSpelling = true, CallingConvention = CallingConvention.Cdecl)>]
    extern nativeint private imageSlide(uint32 index)

    type FileIdentity = { File: string; Available: bool; Bytes: int64; Sha256: string }
    type FpSnapshot = { ThreadId: int; EnvironmentReturn: int; RoundingReturn: int; Fpsr: string; Fpcr: string; StructBytes: int }
    type ManagedImage = { Name: string; Dynamic: bool; Context: string; Mvid: string; Identity: FileIdentity }
    type NativeImage = { Index: uint32; Name: string; Header: string; Slide: int64; Identity: FileIdentity }
    type NativeSnapshot = { CountBefore: uint32; CountAfter: uint32; Images: NativeImage[]; Atomic: bool; Limit: string }
    type MethodEntry =
        { Type: string; Name: string; Signature: string; Token: int; Mvid: string; Generic: bool
          Prepared: bool; Refusal: string; Callable: string; IlHex: string }
    type Report =
        { Kind: string; Complete: bool; RuntimeAdmitted: bool; Failure: HiddenSwitchCompiledReceipt.Failure
          ProcessId: int; ThreadId: int; StartedAtUtc: string; FinishedAtUtc: string
          Runtime: string; Framework: string; Architecture: string; OS: string
          Environment: Map<string, string>; BeforeFp: FpSnapshot; AfterFp: FpSnapshot
          ManagedImages: ManagedImage[]; NativeImages: NativeSnapshot; Methods: MethodEntry[]
          NativePreparationCalls: int; SourceDraws: int; Scope: string }

    let private address (value: nativeint) = (uint64 (value.ToInt64())).ToString("X16", CultureInfo.InvariantCulture)
    let private identity path =
        if String.IsNullOrEmpty path || not (File.Exists path) then
            { File = path; Available = false; Bytes = 0L; Sha256 = null }
        else
            use stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read)
            { File = path; Available = true; Bytes = stream.Length; Sha256 = SHA256.HashData stream |> Convert.ToHexString }

    let private fp () =
        let mutable state = Unchecked.defaultof<FpEnvironment>
        let result = getEnvironment &state
        { ThreadId = Environment.CurrentManagedThreadId; EnvironmentReturn = result; RoundingReturn = getRounding()
          Fpsr = state.Fpsr.ToString("X16", CultureInfo.InvariantCulture); Fpcr = state.Fpcr.ToString("X16", CultureInfo.InvariantCulture)
          StructBytes = Marshal.SizeOf<FpEnvironment>() }

    let private managed () =
        AppDomain.CurrentDomain.GetAssemblies()
        |> Array.sortBy (fun a -> a.FullName)
        |> Array.map (fun assembly ->
            let context = AssemblyLoadContext.GetLoadContext assembly
            { Name = assembly.FullName; Dynamic = assembly.IsDynamic
              Context = if isNull context || isNull context.Name then "<unnamed>" else context.Name
              Mvid = assembly.ManifestModule.ModuleVersionId.ToString("D", CultureInfo.InvariantCulture)
              Identity = identity (if assembly.IsDynamic then null else assembly.Location) })

    // dyld returns borrowed NUL-terminated names. The loader/OS are trusted;
    // this bounds copying, not arbitrary-invalid-pointer isolation.
    let private name pointer =
        if pointer = nativeint 0 then Error(HiddenSwitchCompiledReceipt.failure "native-images" "null-name" "dyld returned no image name")
        else
            let bytes = ResizeArray<byte>()
            let mutable ended = false
            while not ended && bytes.Count < 8192 do
                let value = Marshal.ReadByte(pointer, bytes.Count)
                if value = 0uy then ended <- true else bytes.Add value
            if not ended then Error(HiddenSwitchCompiledReceipt.failure "native-images" "name-bound" "dyld name exceeds 8191 bytes")
            else Ok(UTF8Encoding(false, true).GetString(bytes.ToArray()))

    let private iterate operation values =
        values |> Seq.fold (fun state value -> state |> Result.bind (fun () -> operation value)) (Ok())

    let private nativeImages () =
        result {
            let before = imageCount()
            if before = 0u || before > 1024u then
                return! Error(HiddenSwitchCompiledReceipt.failure "native-images" "count-bound" "requires 1..1024 loaded images")
            let rows = ResizeArray<NativeImage>()
            do! [0u .. before - 1u] |> iterate (fun index -> result {
                let! path = name (imageName index)
                let header = imageHeader index
                if header = nativeint 0 then
                    return! Error(HiddenSwitchCompiledReceipt.failure "native-images" "null-header" "dyld returned no header")
                rows.Add { Index = index; Name = path; Header = address header; Slide = (imageSlide index).ToInt64(); Identity = identity path }
            })
            let after = imageCount()
            if before <> after then
                return! Error(HiddenSwitchCompiledReceipt.failure "native-images" "changed-count" "detected load/unload during non-atomic collection")
            return { CountBefore = before; CountAfter = after; Images = rows.ToArray(); Atomic = false
                     Limit = "equal counts do not exclude load/unload; OS/loader and borrowed pointers trusted; unavailable shared-cache files have no invented hash" }
        }

    let private methods () =
        let assembly = typeof<HiddenSwitchCompiledReceipt.ChoiceWork>.Assembly
        let prefixes = [|"Zeta.Research.HiddenSwitchPolicy"; "Zeta.Research.HiddenSwitchCompiledPolicy";
                         "Zeta.Research.HiddenSwitchObservation"; "Zeta.Research.HiddenSwitchCompiledReceipt"|]
        let flags = BindingFlags.Public ||| BindingFlags.NonPublic ||| BindingFlags.Static ||| BindingFlags.Instance ||| BindingFlags.DeclaredOnly
        assembly.GetTypes()
        |> Array.filter (fun t -> prefixes |> Array.exists (fun p -> t.FullName.StartsWith(p, StringComparison.Ordinal)))
        |> Array.collect (fun t ->
            let moduleType = Array.contains t.FullName prefixes
            t.GetMethods flags
            |> Array.filter (fun m -> moduleType || m.Name = "Invoke")
            |> Array.map (fun method ->
                let body = method.GetMethodBody()
                let generic = method.ContainsGenericParameters
                let prepared = not generic && not method.IsAbstract && not (isNull body)
                if prepared then RuntimeHelpers.PrepareMethod method.MethodHandle
                { Type = t.FullName; Name = method.Name; Signature = method.ToString(); Token = method.MetadataToken
                  Mvid = method.Module.ModuleVersionId.ToString("D", CultureInfo.InvariantCulture); Generic = generic
                  Prepared = prepared; Refusal = if prepared then null else "open generic, abstract or absent IL: unresolved in this feasibility roster"
                  Callable = if prepared then address (method.MethodHandle.GetFunctionPointer()) else null
                  IlHex = if isNull body then null else body.GetILAsByteArray() |> Convert.ToHexString }))
        |> Array.sortBy (fun item -> item.Type, item.Token)

    let private protect stage operation =
        try operation()
        with error -> Error(HiddenSwitchCompiledReceipt.failure stage "collector-exception" (error.GetType().FullName + ": " + error.Message))

    let private prepare () =
        result {
            let mutable calls = 0
            let scalarInputs = [for effect in [false; true] do
                                    for depth in 1 .. 3 do
                                        for belief in [0.0; 0.25; 0.5; 1.0] do yield effect, depth, belief]
            do! scalarInputs |> iterate (fun (effect, depth, belief) -> result {
                let! choice = HiddenSwitchCompiledPolicy.native effect belief depth
                calls <- calls + 1
                let bytes = Array.zeroCreate<byte> 28
                do! HiddenSwitchCompiledReceipt.writeChoice bytes 0 choice
            })
            let adapterInputs = [for effect in [false; true] do for cue in [0; 1] do yield effect, cue]
            do! adapterInputs |> iterate (fun (effect, cue) -> result {
                let cells = Array.zeroCreate<byte> 2048
                cells.[8 * 64 + (if cue = 0 then 16 else 48)] <- 1uy
                let frame: GameEnvironment.Frame = { W = 64; H = 32; Palette = 2; Cells = cells }
                let! projection = HiddenSwitchObservation.project frame |> Result.mapError HiddenSwitchCompiledReceipt.fromPrevious
                let! initial = HiddenSwitchCompiledPolicy.create effect "dot"
                let! _, observed = HiddenSwitchCompiledPolicy.observe projection initial
                let! _, committed = HiddenSwitchCompiledPolicy.chooseNative observed
                calls <- calls + 1
                let! _ = HiddenSwitchCompiledPolicy.observe projection committed
                return ()
            })
            return calls
        }

    /// Explicit feasibility-only command. The exclusive JSONL stream retains
    /// the start stage before hand work. It waits for the owning debugger's
    /// newline; the external launcher owns the bounded process lifetime.
    let run path =
        let started = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        try
            use stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use writer = new StreamWriter(stream, UTF8Encoding(false))
            let emit (value: obj) = writer.WriteLine(JsonSerializer.Serialize value); writer.Flush(); stream.Flush(true)
            emit {| Kind = "graph-hand-start"; ProcessId = Environment.ProcessId; StartedAtUtc = started; SourceDraws = 0 |}
            let work = protect "graph-hand-collection" (fun () -> result {
                if not (OperatingSystem.IsMacOS()) || RuntimeInformation.ProcessArchitecture <> Architecture.Arm64 then
                    return! Error(HiddenSwitchCompiledReceipt.failure "runtime" "platform" "this feasibility collector requires macOS ARM64")
                do! ["DOTNET_TieredCompilation"; "DOTNET_TieredPGO"; "DOTNET_ReadyToRun"] |> iterate (fun key ->
                    if Environment.GetEnvironmentVariable key <> "0" then
                        Error(HiddenSwitchCompiledReceipt.failure "runtime" "startup-flags" (key + " must be 0"))
                    else Ok())
                let before = fp()
                let! calls = prepare()
                let entries = methods()
                let! images = nativeImages()
                let loaded = managed()
                let after = fp()
                let environment =
                    ["DOTNET_TieredCompilation"; "DOTNET_TieredPGO"; "DOTNET_ReadyToRun"; "DOTNET_JitDisasm"; "DOTNET_JitDisasmSummary"; "DOTNET_JitDisasmWithCodeBytes"; "DOTNET_JitStdOutFile"]
                    |> List.map (fun key -> key, Environment.GetEnvironmentVariable key) |> Map.ofList
                return { Kind = "graph-hand-ready"; Complete = true; RuntimeAdmitted = false; Failure = null
                         ProcessId = Environment.ProcessId; ThreadId = Environment.CurrentManagedThreadId
                         StartedAtUtc = started; FinishedAtUtc = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                         Runtime = Environment.Version.ToString(); Framework = RuntimeInformation.FrameworkDescription
                         Architecture = RuntimeInformation.ProcessArchitecture.ToString(); OS = RuntimeInformation.OSDescription
                         Environment = environment; BeforeFp = before; AfterFp = after; ManagedImages = loaded
                         NativeImages = images; Methods = entries; NativePreparationCalls = calls; SourceDraws = 0
                         Scope = "initial pure/native graph feasibility only; callable pointers are not body spans; no compiled guard, final caller closure, runtime admission or registered source execution" }
            })
            match work with
            | Error failure -> emit {| Kind = "graph-hand-failed"; Complete = false; Failure = failure |}; Error failure
            | Ok report ->
                emit report
                let command = Console.ReadLine()
                if command <> "graph-capture-complete" then
                    let failure = HiddenSwitchCompiledReceipt.failure "debugger" "handshake" "requires explicit owning debugger completion"
                    emit {| Kind = "graph-hand-failed"; Complete = false; Failure = failure |}
                    Error failure
                else
                    emit {| Kind = "graph-hand-finished"; Complete = true; ProcessId = Environment.ProcessId |}
                    Ok()
        with error -> Error(HiddenSwitchCompiledReceipt.failure "graph-hand" "collector-exception" (error.GetType().FullName + ": " + error.Message))
