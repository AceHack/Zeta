namespace Zeta.Research.MetadataProbe

open System
open System.Collections.Immutable
open System.Diagnostics
open System.Globalization
open System.IO
open System.Reflection
open System.Reflection.Metadata
open System.Reflection.PortableExecutable
open System.Runtime.InteropServices
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Microsoft.Diagnostics.Runtime
open Zeta.Core
open Admission

/// Isolated offline metadata helper. This does not link the study assembly.
module Program =
    let private sha (raw: byte[]) = Convert.ToHexString(SHA256.HashData raw)
    let private iterate operation values =
        values |> Seq.fold (fun state value -> Result.bind (fun () -> operation value) state) (Ok())

    let private readBounded path limit =
        use stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read)
        let count = stream.Length
        if count < 0L || count > limit then error "local-file" "size" path
        else
            let bytes = Array.zeroCreate<byte> (int count)
            stream.ReadExactly bytes
            if stream.ReadByte() <> -1 || stream.Length <> count then error "local-file" "changed-size" path
            else Ok bytes

    let private checkFile (pin: FilePin) =
        try result {
            let info = FileInfo pin.File
            if not info.Exists || info.Length <> pin.Bytes || pin.Bytes > 64L * 1024L * 1024L
               || (info.Attributes &&& (FileAttributes.Directory ||| FileAttributes.ReparsePoint)) <> enum 0 then
                return! error "local-file" "shape" pin.File
            let! raw = readBounded pin.File (64L * 1024L * 1024L)
            if int64 raw.Length <> pin.Bytes || sha raw <> pin.Sha256 then return! error "local-file" "hash" pin.File
        }
        with exceptionValue -> Error(exceptionFailure "local-file" exceptionValue)

    let private checkDump (stream: FileStream) (pin: FilePin) =
        try
            if stream.Length <> pin.Bytes then error "dump" "size" "held dump descriptor length differs"
            else
                let clock = Stopwatch.StartNew()
                use digest = IncrementalHash.CreateHash HashAlgorithmName.SHA256
                let buffer = Array.zeroCreate<byte> (1024 * 1024)
                let mutable remaining = pin.Bytes
                let mutable failure = None
                while remaining > 0L && failure.IsNone do
                    if clock.Elapsed > TimeSpan.FromSeconds 120.0 then
                        failure <- Some(Admission.failure "dump" "hash-deadline" "120-second checked hashing deadline exceeded")
                    else
                        let count = stream.Read(buffer, 0, int (min remaining (int64 buffer.Length)))
                        if count = 0 then failure <- Some(Admission.failure "dump" "short-read" "dump descriptor ended before captured size")
                        else digest.AppendData(buffer, 0, count); remaining <- remaining - int64 count
                match failure with
                | Some reason -> Error reason
                | None when stream.ReadByte() <> -1 || stream.Length <> pin.Bytes -> error "dump" "changed-size" "dump grew during hashing"
                | None when Convert.ToHexString(digest.GetHashAndReset()) <> pin.Sha256 -> error "dump" "hash" "dump bytes differ from captured identity"
                | None -> stream.Position <- 0L; Ok()
        with exceptionValue -> Error(exceptionFailure "dump" exceptionValue)

    type private DenyLocator(record: obj -> unit) =
        let mutable requests = 0
        let refuse kind (file: string) =
            requests <- requests + 1
            if requests <= 64 then record (box {| Kind = "locator-refusal"; Request = requests; Format = kind
                                                  Name = Path.GetFileName file; PathSha256 = sha(Encoding.UTF8.GetBytes file) |})
            // No credential, symbol path, cache, network or file lookup occurs.
            null
        member _.Requests = requests
        interface IFileLocator with
            member _.FindPEImage(file: string, _: int, _: int, _: bool) = refuse "pe-index" file
            member _.FindPEImage(file: string, _: SymbolProperties, _: ImmutableArray<byte>, _: OSPlatform, _: bool) = refuse "pe-build-id" file
            member _.FindElfImage(file: string, _: SymbolProperties, _: ImmutableArray<byte>, _: bool) = refuse "elf" file
            member _.FindMachOImage(file: string, _: SymbolProperties, _: ImmutableArray<byte>, _: bool) = refuse "macho" file

    let private dependencies record =
        try
            let admitted = result {
                let! raw = readBounded (Path.Combine(AppContext.BaseDirectory, "dependencies.json")) 65536L
                do! Admission.dependencyManifest raw
                record (box {| Kind = "dependency-manifest"; Bytes = raw.Length; Sha256 = sha raw |})
                return raw
            }
            match admitted with
            | Error reason -> Error reason
            | Ok raw ->
                use document = JsonDocument.Parse raw
                let rows = document.RootElement.GetProperty("Records").EnumerateArray() |> Seq.toArray
                if rows.Length <> 13 then error "dependencies" "roster" "requires the thirteen pinned installed managed assets"
                else
                    rows |> iterate (fun row -> result {
                        let pin = { File = Path.Combine(AppContext.BaseDirectory, row.GetProperty("File").GetString())
                                    Bytes = row.GetProperty("Bytes").GetInt64()
                                    Sha256 = row.GetProperty("Sha256").GetString().ToUpperInvariant() }
                        do! checkFile pin
                        record (box {| Kind = "copied-dependency"; Identity = pin |})
                    })
        with exceptionValue -> Error(exceptionFailure "dependencies" exceptionValue)

    let private localModuleMvid (pin: ModulePin) =
        let read () =
            try
                use stream = File.OpenRead pin.Copy.File
                use image = new PEReader(stream)
                let metadata = image.GetMetadataReader()
                let actual = metadata.GetGuid(metadata.GetModuleDefinition().Mvid).ToString("D")
                if actual <> pin.Mvid then error "module-file" "mvid" "captured file MVID differs from native reflection; this is not a dump-derived MVID"
                else Ok()
            with exceptionValue -> Error(exceptionFailure "module-file" exceptionValue)
        result {
            do! checkFile pin.Original
            do! checkFile pin.Copy
            return! read()
        }

    /// This is copied-file metadata/IL corroboration, not a dump-derived MVID or instantiation proof.
    let private localMappedDefinitions (pin: ModulePin) (methods: MappedMethod[]) emit =
        try
            use stream = File.OpenRead pin.Copy.File
            use image = new PEReader(stream)
            let metadata = image.GetMetadataReader()
            let rec typeName handle =
                let definition = metadata.GetTypeDefinition handle
                let name = metadata.GetString definition.Name
                let parent = definition.GetDeclaringType()
                if parent.IsNil then
                    let space = metadata.GetString definition.Namespace
                    if space.Length = 0 then name else space + "." + name
                else typeName parent + "+" + name
            methods |> iterate (fun expected -> result {
                let handle = Ecma335.MetadataTokens.MethodDefinitionHandle(expected.Token &&& 0x00FFFFFF)
                let definition = metadata.GetMethodDefinition handle
                let name = metadata.GetString definition.Name
                let declaringType = typeName(definition.GetDeclaringType())
                if definition.RelativeVirtualAddress = 0 then return! error "module-file" "absent-il" expected.Role
                let il = image.GetMethodBody(definition.RelativeVirtualAddress).GetILBytes()
                let ilHex = Convert.ToHexString il
                emit (box {| Kind = "copied-method-definition"; Role = expected.Role; Token = expected.Token
                             DeclaringType = declaringType; Name = name; IlHex = ilHex; ReflectionSignature = expected.ReflectionSignature |})
                if name <> expected.Name || declaringType <> expected.DeclaringType || ilHex <> expected.IlHex then
                    return! error "module-file" "definition" "copied MethodDef token/type/name/IL differs from captured reflection"
            })
        with exceptionValue -> Error(exceptionFailure "module-file" exceptionValue)

    let private managedLoads emit = result {
        let assemblies = AppDomain.CurrentDomain.GetAssemblies()
        let selected =
            assemblies |> Array.filter (fun assembly ->
                not assembly.IsDynamic && (assembly.Location.StartsWith(AppContext.BaseDirectory, StringComparison.Ordinal)
                                           || assembly = typeof<obj>.Assembly))
        if selected.Length > 64 then return! error "managed-loads" "roster-bound" "more than 64 selected helper-local/corelib images"
        do! selected |> iterate (fun assembly -> result {
            let! bytes = readBounded assembly.Location (64L * 1024L * 1024L)
            emit (box {| Kind = "observed-managed-load"; Name = assembly.FullName; File = assembly.Location
                         Mvid = assembly.ManifestModule.ModuleVersionId.ToString("D"); Bytes = bytes.Length; Sha256 = sha bytes |})
        })
        emit (box {| Kind = "managed-load-snapshot"; ObservedAssemblyCount = assemblies.Length
                     SelectedFileRows = selected.Length; CountAfter = AppDomain.CurrentDomain.GetAssemblies().Length
                     Scope = "one collection of helper-local assemblies plus corelib; not atomic or a complete framework closure" |})
    }

    let private run mappedMode inputPath outputPath =
        let mutable primary: Failure option = None
        try
            use output = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            use journal = new FileStream(outputPath + ".jsonl", FileMode.CreateNew, FileAccess.Write, FileShare.Read)
            let rows = ResizeArray<obj>()
            let cleanup = ResizeArray<Failure>()
            let mutable stage = "start"
            let mutable emitted = 0
            let emit value =
                let raw = JsonSerializer.SerializeToUtf8Bytes value
                let next =
                    match Admission.journalSize emitted raw.Length with
                    | Ok value -> value
                    | Error reason -> raise (IOException reason.Detail)
                journal.Write raw; journal.WriteByte 10uy; journal.Flush(true)
                emitted <- next
            let mutable target: DataTarget option = None
            let mutable custom: CustomDataTarget option = None
            let mutable reader: IDataReader option = None
            let mutable readerOwner: IDisposable option = None
            let mutable runtime: ClrRuntime option = None
            let mutable dump: FileStream option = None
            let mutable locator: DenyLocator option = None
            let keep value = match value with Error reason -> primary <- Some reason; value | Ok _ -> value
            let execution =
                try result {
                    emit (box {| Kind = "metadata-start"; Pid = Environment.ProcessId; Runtime = Environment.Version.ToString()
                                 InputFile = inputPath; RuntimeAdmitted = false; BodyResolved = false; ClosureAdmitted = false |})
                    stage <- "input"
                    let! raw = readBounded inputPath (if mappedMode then 256L * 1024L else 65536L) |> keep
                    emit (box {| Kind = "input-identity"; Bytes = raw.Length; Sha256 = sha raw |})
                    let! input, mapped =
                        (if mappedMode then Admission.parseMapped raw |> Result.map (fun value -> Admission.mappedBase value, Some value)
                         else Admission.parse raw |> Result.map (fun value -> value, None)) |> keep
                    match mapped with
                    | Some mapping ->
                        emit (box {| Kind = "mapping-file"; Identity = mapping.Mapping; MethodCount = mapping.Methods.Length |})
                        let! mappingRaw = readBounded mapping.Mapping.File Admission.mappingBytes |> keep
                        do! Admission.bindMapped mappingRaw mapping |> keep
                    | None -> ()
                    do! dependencies emit |> keep
                    let languageRuntime = typeof<unit>.Assembly
                    let languagePin = { File = languageRuntime.Location; Bytes = 2405712L
                                        Sha256 = "454275E6F64F26C19F989CC0E0C43A2EAF41705FC0F456097FAA1DA445139394" }
                    do! checkFile languagePin |> keep
                    emit (box {| Kind = "executable-language-dependency"; Package = "FSharp.Core/10.1.400"
                                 Assembly = languageRuntime.FullName; Identity = languagePin
                                 Scope = "F# executable runtime dependency, separate from the thirteen ClrMD transitive assets" |})
                    do! managedLoads emit |> keep
                    do! checkFile input.Dac |> keep
                    do! checkFile input.Runtime.Image |> keep
                    do! localModuleMvid input.Module |> keep
                    match mapped with
                    | Some mapping -> do! localMappedDefinitions input.Module mapping.Methods emit |> keep
                    | None -> ()
                    emit (box {| Kind = "local-file-association"; Module = input.Module; Dac = input.Dac; TargetRuntime = input.Runtime
                                 Scope = "captured file/native reflection association; not a dump-derived managed MVID" |})
                    stage <- "dump"
                    let owned = new FileStream(input.Dump.File, FileMode.Open, FileAccess.Read, FileShare.Read)
                    dump <- Some owned
                    do! checkDump owned input.Dump |> keep
                    emit (box {| Kind = "held-dump-identity"; Identity = input.Dump; PhysicalCodeVerifiedByHelper = false |})
                    stage <- "reader-factory"
                    let assembly = typeof<DataTarget>.Assembly
                    do! checkFile { File = assembly.Location; Bytes = 685640L; Sha256 = "45FE59B0E9D206B37616F0177279189B53A4EEC50717DD6CD60C9D7C38A2A59E" } |> keep
                    let kind = assembly.GetType("Microsoft.Diagnostics.Runtime.MacOS.MachOCoreReader", false)
                    if isNull kind then return! error stage "type" "exact version-bound internal reader type is unavailable" |> keep
                    let constructor = kind.GetConstructor(BindingFlags.Instance ||| BindingFlags.Public, null, [|typeof<string>; typeof<Stream>; typeof<bool>|], null)
                    if isNull constructor then return! error stage "constructor" "exact public string/Stream/bool constructor is unavailable" |> keep
                    let actual = constructor.Invoke([|box input.Dump.File; box owned; box true|])
                    match actual with
                    | :? IDisposable as value -> readerOwner <- Some value
                    | _ -> return! error stage "reader-disposal" "version-bound reader must implement IDisposable" |> keep
                    match actual with
                    | :? IDataReader as value -> reader <- Some value
                    | _ -> return! error stage "reader-interface" "factory did not return IDataReader" |> keep
                    let dataReader = reader.Value
                    if dataReader.Architecture <> Architecture.Arm64 || dataReader.TargetPlatform <> OSPlatform.OSX then
                        return! error stage "platform" "requires recorded macOS ARM64 dump" |> keep
                    let wrapper = new CustomDataTarget(dataReader)
                    custom <- Some wrapper
                    let denied = DenyLocator(emit)
                    locator <- Some denied
                    wrapper.FileLocator <- denied :> IFileLocator
                    wrapper.ForceCompleteRuntimeEnumeration <- true
                    emit (box {| Kind = "target-settings"; ForceCompleteRuntimeEnumeration = wrapper.ForceCompleteRuntimeEnumeration
                                 FileLocator = "non-null deny-all assigned before DataTarget construction" |})
                    // This assignment precedes DataTarget and bypasses its default symbol locator.
                    let dataTarget = new DataTarget(wrapper)
                    target <- Some dataTarget
                    stage <- "runtime-identity"
                    let candidates = dataTarget.ClrVersions |> Seq.toArray
                    if candidates.Length <> 1 then return! error stage "roster" "requires exactly one recorded runtime" |> keep
                    let candidate = candidates.[0]
                    let actualRuntime = {| File = candidate.ModuleInfo.FileName; Base = candidate.ModuleInfo.ImageBase
                                           Version = candidate.Version.ToString(); BuildId = Convert.ToHexString(candidate.BuildId.AsSpan())
                                           ModuleVersion = candidate.ModuleInfo.Version.ToString() |}
                    emit (box {| Kind = "dump-runtime"; Observed = actualRuntime |})
                    if actualRuntime.File <> input.Runtime.Image.File || actualRuntime.Base <> input.Runtime.ImageBase
                       || actualRuntime.Version <> input.Runtime.Version || actualRuntime.BuildId <> input.Runtime.BuildId.ToUpperInvariant() then
                        return! error stage "mismatch" "dump runtime path/base/actual version/build identity differ" |> keep
                    stage <- "dac-create"
                    emit (box {| Kind = "dac-request"; File = input.Dac.File; IgnoreMismatch = false; VerifyPublisherSignature = false |})
                    let selected = candidate.CreateRuntime(input.Dac.File, false, false)
                    runtime <- Some selected
                    if denied.Requests > 64 then return! error stage "locator-bound" "more than 64 denied requests; remaining paths are not emitted" |> keep
                    let! images = NativeImages.snapshot emit |> keep
                    let loaded = images |> Array.filter (fun row -> row.Name = input.Dac.File)
                    if loaded.Length <> 1 then return! error stage "loaded-dac" "exact local DAC module must be observed once in helper process" |> keep
                    do! checkFile input.Dac |> keep
                    emit (box {| Kind = "loaded-dac-path-file"; Identity = input.Dac; Header = loaded.[0].Header; Slide = loaded.[0].Slide
                                 CountAfterFileIdentity = NativeImages.countAfterIdentity()
                                 Scope = "helper module path and file identity, not loaded memory byte equivalence" |})
                    stage <- "method-query"
                    do! input.Methods |> iterate (fun expected -> result {
                        let method = selected.GetMethodByInstructionPointer expected.Address
                        if isNull method then return! error stage "missing-method" expected.Role |> keep
                        let regions = method.HotColdInfo
                        let first = {| Role = expected.Role; Query = expected.Address; Token = method.MetadataToken
                                       NativeCode = method.NativeCode
                                       HotStart = regions.HotStart; HotSize = regions.HotSize; ColdStart = regions.ColdStart; ColdSize = regions.ColdSize |}
                        rows.Add(box first)
                        emit (box {| Kind = "method-extent-prefix"; Data = first |})
                        let declaring = method.Type.Module
                        let observed = {| Role = expected.Role; Query = expected.Address; Token = method.MetadataToken
                                          Signature = method.Signature; DeclaringType = method.Type.Name; Name = method.Name; NativeCode = method.NativeCode
                                          HotStart = regions.HotStart; HotSize = regions.HotSize; ColdStart = regions.ColdStart; ColdSize = regions.ColdSize
                                          ModuleName = declaring.Name; ModuleAddress = declaring.Address; AssemblyAddress = declaring.AssemblyAddress
                                          ImageBase = declaring.ImageBase; MetadataAddress = declaring.MetadataAddress; MetadataLength = declaring.MetadataLength |}
                        rows.[rows.Count - 1] <- box observed
                        emit (box {| Kind = "method-metadata"; Data = observed |})
                        match mapped with
                        | Some mapping ->
                            let expectedDefinition = mapping.Methods |> Array.find (fun row -> row.Role = expected.Role)
                            do! Admission.mappedIdentity expectedDefinition observed.Token observed.DeclaringType observed.Name observed.ModuleName input.Module.Original.File |> keep
                        | None ->
                            if observed.Token <> expected.Token || observed.Signature <> expected.Signature || observed.ModuleName <> input.Module.Original.File then
                                return! error stage "method-identity" "method token/signature/module path differs from declared executing method" |> keep
                        if denied.Requests > 64 then return! error stage "locator-bound" "more than 64 denied requests; remaining paths are not emitted" |> keep
                        do! Admission.extents expected observed.NativeCode observed.HotStart observed.HotSize observed.ColdStart observed.ColdSize |> keep
                    })
                    do! checkFile input.Module.Original |> keep
                    do! checkFile input.Module.Copy |> keep
                    do! managedLoads emit |> keep
                    emit (box {| Kind = "declared-extents-complete"; Methods = rows.Count; PhysicalCodeVerifiedByHelper = false |})
                }
                with exceptionValue -> match primary with Some reason -> Error reason | None -> Error(exceptionFailure stage exceptionValue)
            match execution with Error reason -> primary <- Some reason | Ok () -> ()
            let dispose name (resource: IDisposable) =
                try resource.Dispose()
                with exceptionValue -> cleanup.Add(exceptionFailure name exceptionValue)
            runtime |> Option.iter (fun value -> dispose "runtime-dispose" value)
            match target, custom, readerOwner with
            | Some value, _, _ -> dispose "target-dispose" value
            | _, Some value, _ -> dispose "custom-dispose" value
            | _, _, Some value -> dispose "reader-dispose" value
            | _ -> ()
            dump |> Option.iter (fun value -> dispose "dump-dispose" value)
            if primary.IsNone && cleanup.Count > 0 then primary <- Some cleanup.[0]
            let report = {| Complete = primary.IsNone; Failure = primary; Cleanup = cleanup.ToArray(); Methods = rows.ToArray()
                            LocatorRequests = locator |> Option.map (fun value -> value.Requests)
                            RuntimeAdmitted = false; BodyResolved = false; ClosureAdmitted = false; PhysicalCodeVerifiedByHelper = false
                            Scope = (if mappedMode then "exact mapped-130 current DAC extents only; full closure remains separate"
                                     else "three current DAC extents only; independent physical-file comparison and complete closure remain separate")
                            RequestedMethods = (if mappedMode then 130 else 3); AvailableMethods = rows.Count
                            CleanupScope = "attempted disposal of runtime, one ownership-chain head and held dump; internal disposal after an exception is not guaranteed" |}
            try emit (box {| Kind = "metadata-finished"; Data = report |})
            with exceptionValue -> if primary.IsNone then primary <- Some(exceptionFailure "journal-finish" exceptionValue)
            let finalReport = {| report with Complete = primary.IsNone; Failure = primary |}
            try
                let bytes, first = Admission.finalOutput (JsonSerializer.SerializeToUtf8Bytes finalReport) primary rows.Count
                primary <- first
                output.Write bytes; output.WriteByte 10uy; output.Flush(true)
            with exceptionValue -> if primary.IsNone then primary <- Some(exceptionFailure "output-finish" exceptionValue)
            match primary with Some reason -> Error reason | None -> Ok()
        with exceptionValue -> match primary with Some reason -> Error reason | None -> Error(exceptionFailure "output" exceptionValue)

    [<EntryPoint>]
    let main arguments =
        match arguments with
        | [|input; output|] ->
            match run false input output with
            | Ok () -> 0
            | Error reason -> Console.Error.WriteLine(JsonSerializer.Serialize reason); 2
        | [|"--mapped-130"; input; output|] ->
            match run true input output with
            | Ok () -> 0
            | Error reason -> Console.Error.WriteLine(JsonSerializer.Serialize reason); 2
        | _ -> Console.Error.WriteLine("requires input-manifest and exclusive output path; no study execution"); 2
