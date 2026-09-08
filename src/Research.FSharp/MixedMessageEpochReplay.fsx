#if INTERACTIVE
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll"
#else
namespace Zeta.Research
#endif

/// One finite, sequential peer. The standard streams are borrowed: an outstanding
/// timed-out read/write retains its buffer and is never raced by stream disposal.
/// The owning coordinator observes and closes the direct process separately.
module MixedMessageEpochReplay =
    open System
    open System.Collections.Generic
    open System.Diagnostics
    open System.IO
    open System.Runtime.InteropServices
    open System.Security.Cryptography
    open System.Text
    open System.Text.Json
    open System.Threading.Tasks
    open Microsoft.Win32.SafeHandles
    module E = Zeta.Bayesian.MixedMessageEpoch

    [<Literal>]
    let Schema = "zeta.mixed-epoch.peer.v1"
    [<Literal>]
    let StartCap = 1024 * 1024
    [<Literal>]
    let SmallCap = 64 * 1024
    [<Literal>]
    let RequestCap = 256 * 1024
    [<Literal>]
    let ResponseCap = 12 * 1024 * 1024
    [<Literal>]
    let ResultCap = 16 * 1024 * 1024
    [<Literal>]
    let TerminalCap = 1024 * 1024
    [<Literal>]
    let TranscriptCap = 64 * 1024 * 1024
    [<Literal>]
    let FrameCap = 16384

    type PeerFailure = { Stage: string; Code: string; Message: string }
    type ByteIdentity = { Bytes: int; Sha256: string }

    /// Raw records are available local observations, not successful publication.
    /// For a failed write Raw is the attempted frame; the sent byte count is unknown.
    type FrameObservation =
        { Direction: string
          Raw: byte array
          Identity: ByteIdentity
          Complete: bool
          Failure: PeerFailure option }

    /// Mutable state is confined to one sequential peer invocation. It preserves
    /// actual prefixes before fallible parsing, encoding or callback judgment.
    type Transport =
        private
            { Input: Stream
              Output: Stream
              Clock: Stopwatch
              mutable DeadlineSeconds: float
              Frames: ResizeArray<FrameObservation>
              mutable ChargedBytes: int
              mutable ReadBytes: int
              mutable ReadFrames: int
              mutable ReservedWriteBytes: int
              mutable ReservedWriteFrames: int
              mutable CompletedWriteBytes: int
              mutable CompletedWriteFrames: int
              mutable ChargedFrames: int
              mutable GlobalChargedBytes: int
              mutable GlobalChargedFrames: int
              mutable BudgetIndex: int option
              mutable BudgetCarrier: int
              mutable NextSequence: int
              mutable Failure: PeerFailure option
              mutable OutputFailed: bool
              mutable PendingRead: (Task<int> * byte array) option
              mutable PendingWrite: Task option }

    type TransportSnapshot =
        { ChargedBytes: int
          ReadBytes: int
          ReadFrames: int
          ReservedWriteBytes: int
          ReservedWriteFrames: int
          CompletedWriteBytes: int
          CompletedWriteFrames: int
          ChargedFrames: int
          GlobalChargedBytes: int
          GlobalChargedFrames: int
          BudgetIndex: int option
          NextSequence: int
          Failure: PeerFailure option
          OutputFailed: bool
          PendingRead: bool
          LateReadBytes: byte array option
          PendingWrite: bool
          Frames: FrameObservation array }

    let private utf8 = UTF8Encoding(false, true)

    let private failure stage code (message: string) =
        let text = if isNull message then "" else message
        let bounded = StringBuilder(1024)
        let mutable enumerator = text.EnumerateRunes()
        let mutable bytes = 0
        let mutable full = false
        while not full && enumerator.MoveNext() do
            let rune = enumerator.Current
            if rune.Utf8SequenceLength > 1024 - bytes then full <- true
            else
                bounded.Append(rune.ToString()) |> ignore
                bytes <- bytes + rune.Utf8SequenceLength
        { Stage = stage; Code = code
          Message = bounded.ToString() }

    let private identity (raw: byte array) =
        { Bytes = raw.Length; Sha256 = Convert.ToHexString(SHA256.HashData raw) }

    let private rememberFailure (state: Transport) error =
        if state.Failure.IsNone then state.Failure <- Some error
        error

    /// Streams are borrowed. A small timeout is an explicit development seam;
    /// production supplies the source-fixed 300 second cooperative allowance.
    let createTransport (input: Stream) (output: Stream) deadlineSeconds : Result<Transport, PeerFailure> =
        if isNull input || isNull output || not (Double.IsFinite deadlineSeconds)
           || deadlineSeconds <= 0.0 || deadlineSeconds > 300.0 then
            Error(failure "admit" "TransportArguments" "streams and deadline in (0,300] required")
        else
            Ok { Input = input; Output = output; Clock = Stopwatch.StartNew()
                 DeadlineSeconds = deadlineSeconds; Frames = ResizeArray()
                 ChargedBytes = 0; ReadBytes = 0; ReadFrames = 0
                 ReservedWriteBytes = 0; ReservedWriteFrames = 0
                 CompletedWriteBytes = 0; CompletedWriteFrames = 0
                 GlobalChargedBytes = 0; GlobalChargedFrames = 0
                 BudgetIndex = None; BudgetCarrier = -1
                 ChargedFrames = 0; NextSequence = 1; Failure = None; OutputFailed = false
                 PendingRead = None; PendingWrite = None }

    let snapshot (state: Transport) : TransportSnapshot =
        { ChargedBytes = state.ChargedBytes; ReadBytes = state.ReadBytes
          ReadFrames = state.ReadFrames; ReservedWriteBytes = state.ReservedWriteBytes
          ReservedWriteFrames = state.ReservedWriteFrames
          CompletedWriteBytes = state.CompletedWriteBytes
          CompletedWriteFrames = state.CompletedWriteFrames
          ChargedFrames = state.ChargedFrames; NextSequence = state.NextSequence
          GlobalChargedBytes = state.GlobalChargedBytes; GlobalChargedFrames = state.GlobalChargedFrames
          BudgetIndex = state.BudgetIndex
          Failure = state.Failure; OutputFailed = state.OutputFailed
          PendingRead = state.PendingRead |> Option.exists (fun (t, _) -> not t.IsCompleted)
          // A timed-out operation may later return bytes. They are retained as
          // unadmitted late input, separate from the completed-before-refusal
          // counters; this peer never resumes or parses that operation.
          LateReadBytes = state.PendingRead |> Option.bind (fun (t, buffer) ->
              if t.IsCompletedSuccessfully then Some(buffer.AsSpan(0, t.Result).ToArray()) else None)
          PendingWrite = state.PendingWrite |> Option.exists (fun t -> not t.IsCompleted)
          Frames = state.Frames.ToArray() }

    let private remainingTime (state: Transport) stage =
        let seconds = state.DeadlineSeconds - state.Clock.Elapsed.TotalSeconds
        if seconds <= 0.0 then
            Error(rememberFailure state (failure stage "Deadline" "cooperative peer deadline reached"))
        else Ok(TimeSpan.FromSeconds seconds)

    let private ordinaryRoom (state: Transport) = TranscriptCap - TerminalCap - state.GlobalChargedBytes

    /// Core admits the full exact snapshot DTO. This additional transport check
    /// binds its prefix to this peer's immediately preceding complete input.
    /// A newer global snapshot replaces the prefix; it is never summed once per
    /// session or added to positions that it already includes.
    let observeBudgetPrefix (state: Transport) index chargedBytes chargedFrames remainingMilliseconds =
        let current = state.Frames.Count - 1
        if state.Failure.IsSome then Error state.Failure.Value
        elif index < 0 || chargedBytes < 0 || chargedBytes > TranscriptCap
             || chargedFrames < 0 || chargedFrames > FrameCap
             || remainingMilliseconds < 0 || remainingMilliseconds > 300000
             || current < 0 || current <= state.BudgetCarrier
             || (state.BudgetIndex |> Option.exists (fun previous -> index <= previous)) then
            Error(rememberFailure state (failure "admit" "BudgetSnapshot" "bounded increasing snapshot and new carrier required"))
        else
            let carrier = state.Frames.[current]
            if carrier.Direction <> "in" || not carrier.Complete
               || carrier.Raw.Length > TranscriptCap - chargedBytes
               || chargedFrames >= FrameCap
               || chargedBytes + carrier.Raw.Length < state.GlobalChargedBytes
               || chargedFrames + 1 < state.GlobalChargedFrames then
                Error(rememberFailure state (failure "admit" "BudgetSnapshot" "snapshot must include all prior known positions, excluding only its carrier"))
            else
                state.GlobalChargedBytes <- chargedBytes + carrier.Raw.Length
                state.GlobalChargedFrames <- chargedFrames + 1
                state.BudgetIndex <- Some index
                state.BudgetCarrier <- current
                // The separate coordinator owns the actual outer deadline. This
                // only narrows the local cooperative allowance; it never extends it.
                state.DeadlineSeconds <- min state.DeadlineSeconds (state.Clock.Elapsed.TotalSeconds + float remainingMilliseconds / 1000.0)
                Ok()

    let private record (state: Transport) direction raw complete error =
        state.Frames.Add
            { Direction = direction; Raw = raw; Identity = identity raw
              Complete = complete; Failure = error }

    /// Reads one LF-terminated frame in bounded chunks. A conforming counterpart
    /// cannot have a second response ready before this peer's next request.
    /// Extra bytes after LF in the same read are retained and refused.
    let readFrame (state: Transport) stage maximum : Task<Result<byte array, PeerFailure>> =
        task {
            match state.Failure with
            | Some error -> return Error error
            | None ->
                let limit = min maximum (ordinaryRoom state)
                if maximum <= 0 || maximum > ResultCap || limit <= 0
                   || state.GlobalChargedFrames >= FrameCap - 1 then
                    return Error(rememberFailure state (failure stage "FrameBudget" "no bounded input-frame allowance"))
                else
                    use accumulated = new MemoryStream(min limit 4096)
                    let mutable complete = false
                    let mutable problem = None
                    while not complete && problem.IsNone do
                        match remainingTime state stage with
                        | Error error -> problem <- Some error
                        | Ok duration ->
                            // At most one extra byte establishes a size refusal.
                            let count = min 4096 (limit - int accumulated.Length + 1)
                            let buffer = Array.zeroCreate<byte> count
                            try
                                let pending = state.Input.ReadAsync(buffer.AsMemory()).AsTask()
                                state.PendingRead <- Some(pending, buffer)
                                let! received = pending.WaitAsync(duration).ConfigureAwait(false)
                                state.PendingRead <- None
                                if received = 0 then
                                    problem <- Some(failure stage "UnexpectedEof" "complete LF-terminated input required")
                                else
                                    if accumulated.Length = 0L then
                                        state.ReadFrames <- state.ReadFrames + 1
                                        state.ChargedFrames <- state.ChargedFrames + 1
                                        state.GlobalChargedFrames <- state.GlobalChargedFrames + 1
                                    state.ReadBytes <- state.ReadBytes + received
                                    state.ChargedBytes <- state.ChargedBytes + received
                                    state.GlobalChargedBytes <- state.GlobalChargedBytes + received
                                    accumulated.Write(buffer, 0, received)
                                    if accumulated.Length > int64 limit then
                                        problem <- Some(failure stage "FrameBound" "input exceeded its admitted frame/transcript allowance")
                                    else
                                        let lf = Array.IndexOf(buffer, 10uy, 0, received)
                                        if lf >= 0 then
                                            if lf <> received - 1 then
                                                problem <- Some(failure stage "UnexpectedTrailingBytes" "bytes followed the single outstanding input frame")
                                            else complete <- true
                            with error ->
                                // A pending operation retains buffer ownership. Do not close
                                // the borrowed stream or start another read after this failure.
                                problem <- Some(failure stage "ReadFailure" (error.GetType().FullName + ": " + error.Message))
                    let raw = accumulated.ToArray()
                    record state "in" raw complete problem
                    match problem with
                    | Some error -> return Error(rememberFailure state error)
                    | None -> return Ok raw
        }

    /// Reserves the whole original frame before I/O and never refunds failure.
    /// CompletedWriteBytes counts only completed writes and flushes; it does not
    /// guess how much a failing Stream.WriteAsync transmitted.
    let writeFrame (state: Transport) stage maximum terminal (raw: byte array) : Task<Result<unit, PeerFailure>> =
        task {
            let room = if terminal then TranscriptCap - state.GlobalChargedBytes else ordinaryRoom state
            let allowedFrames = if terminal then FrameCap else FrameCap - 1
            if state.OutputFailed then
                return Error(rememberFailure state (failure stage "OutputClosed" "a previous failed write forbids any later frame"))
            elif state.Failure.IsSome && not terminal then
                return Error state.Failure.Value
            elif isNull raw || raw.Length = 0 || raw.[raw.Length - 1] <> 10uy
               || maximum <= 0 || maximum > ResultCap || raw.Length > maximum
               || raw.Length > room || state.GlobalChargedFrames >= allowedFrames then
                return Error(rememberFailure state (failure stage "FrameBudget" "complete original output exceeds its frame/transcript allowance"))
            elif state.PendingWrite |> Option.exists (fun t -> not t.IsCompleted) then
                return Error(rememberFailure state (failure stage "PendingWrite" "cannot race an outstanding output write"))
            else
                match remainingTime state stage with
                | Error error -> return Error error
                | Ok duration ->
                    state.ChargedBytes <- state.ChargedBytes + raw.Length
                    state.ChargedFrames <- state.ChargedFrames + 1
                    state.ReservedWriteBytes <- state.ReservedWriteBytes + raw.Length
                    state.ReservedWriteFrames <- state.ReservedWriteFrames + 1
                    state.GlobalChargedBytes <- state.GlobalChargedBytes + raw.Length
                    state.GlobalChargedFrames <- state.GlobalChargedFrames + 1
                    let mutable problem = None
                    try
                        let pending = state.Output.WriteAsync(raw.AsMemory()).AsTask()
                        state.PendingWrite <- Some pending
                        do! pending.WaitAsync(duration).ConfigureAwait(false)
                        match remainingTime state stage with
                        | Error error -> problem <- Some error
                        | Ok flushDuration ->
                            let flushing = state.Output.FlushAsync()
                            state.PendingWrite <- Some flushing
                            do! flushing.WaitAsync(flushDuration).ConfigureAwait(false)
                            state.CompletedWriteBytes <- state.CompletedWriteBytes + raw.Length
                            state.CompletedWriteFrames <- state.CompletedWriteFrames + 1
                            state.PendingWrite <- None
                    with error ->
                        problem <- Some(failure stage "WriteFailure" (error.GetType().FullName + ": " + error.Message))
                    record state "out" raw problem.IsNone problem
                    match problem with
                    | Some error ->
                        state.OutputFailed <- true
                        return Error(rememberFailure state error)
                    | None -> return Ok()
        }

    /// Prewalk bounds metadata and rejects duplicate/deferred-invalid strings
    /// before cloning a passive JSON tree. The tree cannot instantiate a type.
    let strictJson stage maximum (raw: byte array) : Result<JsonElement, PeerFailure> =
        try
            if isNull raw || raw.Length = 0 || raw.Length > maximum then
                Error(failure stage "JsonBound" "bounded UTF8 JSON bytes required")
            else
                let options = JsonReaderOptions(MaxDepth = 128, CommentHandling = JsonCommentHandling.Disallow)
                let mutable reader = Utf8JsonReader(ReadOnlySpan<byte>(raw), options)
                let objects = Stack<HashSet<string>>()
                let mutable tokens = 0
                let mutable invalid = None
                while invalid.IsNone && reader.Read() do
                    tokens <- tokens + 1
                    if tokens > 100000 then invalid <- Some "JSON token bound exceeded"
                    else
                        match reader.TokenType with
                        | JsonTokenType.StartObject -> objects.Push(HashSet(StringComparer.Ordinal))
                        | JsonTokenType.EndObject -> objects.Pop() |> ignore
                        | JsonTokenType.PropertyName ->
                            let key = reader.GetString()
                            if isNull key || not (objects.Peek().Add key) then invalid <- Some "duplicate JSON key"
                        | JsonTokenType.String -> reader.GetString() |> ignore
                        | JsonTokenType.Number ->
                            // Integral encoded values may exceed binary64 but are
                            // bounded here and admitted by their owning codec.
                            // Decimal/exponent tokens must not encode infinity.
                            let token = reader.ValueSpan
                            let mutable fractional = false
                            for i in 0 .. token.Length - 1 do
                                if token.[i] = 46uy || token.[i] = 69uy || token.[i] = 101uy then fractional <- true
                            if token.Length > 4096 then invalid <- Some "JSON number token bound exceeded"
                            elif fractional then
                                match reader.TryGetDouble() with
                                | true, value when Double.IsFinite value -> ()
                                | _ -> invalid <- Some "nonfinite JSON numeric value"
                        | _ -> ()
                match invalid with
                | Some message -> Error(failure stage "JsonShape" message)
                | None ->
                    // Explicit strict UTF8 validation covers malformed byte sequences
                    // even in otherwise passive string values.
                    utf8.GetString raw |> ignore
                    use document = JsonDocument.Parse(ReadOnlyMemory<byte>(raw), JsonDocumentOptions(MaxDepth = 128))
                    if document.RootElement.ValueKind <> JsonValueKind.Object then
                        Error(failure stage "JsonShape" "object frame required")
                    else Ok(document.RootElement.Clone())
        with error -> Error(failure stage "JsonShape" (error.GetType().FullName + ": " + error.Message))

    let exactKeys stage (names: string array) (root: JsonElement) =
        if isNull names || root.ValueKind <> JsonValueKind.Object then
            Error(failure stage "FrameKeys" "object and exact frame member roster required")
        else
            let actual = root.EnumerateObject() |> Seq.map (fun p -> p.Name) |> Set.ofSeq
            if actual = Set.ofArray names then Ok()
            else Error(failure stage "FrameKeys" "exact frame member roster required")

    let stringField stage (key: string) (root: JsonElement) =
        match if root.ValueKind = JsonValueKind.Object && not (isNull key) then root.TryGetProperty key else false, Unchecked.defaultof<JsonElement> with
        | true, value when value.ValueKind = JsonValueKind.String ->
            try Ok(value.GetString())
            with error -> Error(failure stage "FrameString" error.Message)
        | _ -> Error(failure stage "FrameString" ("string member required: " + key))

    let integerField stage (key: string) (root: JsonElement) =
        match if root.ValueKind = JsonValueKind.Object && not (isNull key) then root.TryGetProperty key else false, Unchecked.defaultof<JsonElement> with
        | true, value when value.ValueKind = JsonValueKind.Number ->
            match value.TryGetInt32() with
            | true, number -> Ok number
            | _ -> Error(failure stage "FrameInteger" ("exact int32 required: " + key))
        | _ -> Error(failure stage "FrameInteger" ("exact integer member required: " + key))

    type FileObservation =
        { Path: string
          Bytes: int64 option
          ReadBytes: int
          Sha256: string option
          ExtraRead: int option
          Complete: bool
          Failure: PeerFailure option
          Cleanup: PeerFailure list }

    [<DllImport("libc", EntryPoint = "open", SetLastError = true)>]
    extern int private openUnix(string path, int flags)

    [<DllImport("libc", EntryPoint = "fstat", SetLastError = true)>]
    extern int private fileStat(int descriptor, nativeint buffer)

    /// The declared analysis host is macOS. Its installed sys/stat.h defines
    /// the inode64 struct with mode at 4, inode at 8, mtime at 48, ctime at 64,
    /// and size at 96. Other platforms refuse instead of guessing an ABI.
    let private descriptorStat descriptor =
        let buffer = Marshal.AllocHGlobal 256
        try
            if fileStat(descriptor, buffer) <> 0 then
                Error(failure "admit" "FileStat" ("fstat refused: " + string (Marshal.GetLastPInvokeError())))
            elif (int (Marshal.ReadInt16(buffer, 4)) &&& 0xF000) <> 0x8000 then
                Error(failure "admit" "FileKind" "same-descriptor regular source file required")
            else
                Ok (Marshal.ReadInt32(buffer, 0), Marshal.ReadInt64(buffer, 8),
                    Marshal.ReadInt64(buffer, 48), Marshal.ReadInt64(buffer, 56),
                    Marshal.ReadInt64(buffer, 64), Marshal.ReadInt64(buffer, 72),
                    Marshal.ReadInt64(buffer, 96))
        finally Marshal.FreeHGlobal buffer

    /// Finite source-file observation, under the stable writer-tree premise.
    /// Read from one nonblocking/no-follow regular descriptor, exactly its
    /// initial size plus at most one byte. Hash/read outcomes survive cleanup.
    /// This is not hostile parent-directory isolation or loaded-code closure.
    let observeFile (path: string) maximum : FileObservation =
        let mutable primary = None
        let cleanup = ResizeArray<PeerFailure>()
        let mutable size = None
        let mutable read = 0
        let mutable hash = None
        let mutable extraRead = None
        let mutable handle: SafeFileHandle option = None
        let mutable stream: FileStream option = None
        let fail error = if primary.IsNone then primary <- Some error
        try
            if not (OperatingSystem.IsMacOS()) then
                fail (failure "admit" "FilePlatform" "the reviewed macOS descriptor ABI is required")
            elif isNull path || path.Length = 0 || maximum <= 0 || maximum > 32 * 1024 * 1024 then
                fail (failure "admit" "FileArguments" "source path and byte cap in (0,32 MiB] required")
            else
                // Darwin O_NONBLOCK | O_NOFOLLOW; no create or write flag.
                let descriptor = openUnix(path, 0x0004 ||| 0x0100)
                if descriptor < 0 then fail (failure "admit" "FileOpen" ("open refused: " + string (Marshal.GetLastPInvokeError())))
                else
                    let owned = new SafeFileHandle(nativeint descriptor, true)
                    handle <- Some owned
                    match descriptorStat descriptor with
                    | Error error -> fail error
                    | Ok before ->
                        let (_, _, _, _, _, _, length) = before
                        size <- Some length
                        if length < 0L || length > int64 maximum then
                            fail (failure "admit" "FileBound" "source file exceeded its initial-size allowance")
                        else
                            let opened = new FileStream(owned, FileAccess.Read)
                            stream <- Some opened
                            let raw = Array.zeroCreate<byte> (int length)
                            let clock = Stopwatch.StartNew()
                            while primary.IsNone && read < raw.Length do
                                if clock.Elapsed.TotalSeconds >= 10.0 then
                                    fail (failure "admit" "FileDeadline" "cooperative source hash deadline reached")
                                else
                                    let received = opened.Read(raw, read, min (1024 * 1024) (raw.Length - read))
                                    if received = 0 then fail (failure "admit" "FileShortRead" "source file ended before its initial size")
                                    else read <- read + received
                            if primary.IsNone then
                                // Retain complete returned bytes' identity before later
                                // stability checks or disposal can refuse admission.
                                hash <- Some(Convert.ToHexString(SHA256.HashData raw))
                                if clock.Elapsed.TotalSeconds >= 10.0 then
                                    fail (failure "admit" "FileDeadline" "cooperative source hash deadline reached")
                                else
                                    let extra = opened.ReadByte()
                                    extraRead <- Some extra
                                    if extra <> -1 then
                                        read <- read + 1
                                        fail (failure "admit" "FileGrowth" "source file grew beyond its initial size")
                                    else
                                        match descriptorStat descriptor with
                                        | Error error -> fail error
                                        | Ok after when after <> before -> fail (failure "admit" "FileChanged" "descriptor identity changed during source read")
                                        | Ok _ -> ()
        with error -> fail (failure "admit" "FileObservation" (error.GetType().FullName + ": " + error.Message))
        try
            match stream, handle with
            | Some owned, _ -> owned.Dispose()
            | None, Some owned -> owned.Dispose()
            | None, None -> ()
        with error ->
            let problem = failure "admit" "FileClose" (error.GetType().FullName + ": " + error.Message)
            cleanup.Add problem
            fail problem
        { Path = path; Bytes = size; ReadBytes = read; Sha256 = hash; ExtraRead = extraRead
          Complete = primary.IsNone && hash.IsSome; Failure = primary
          Cleanup = List.ofSeq cleanup }

    [<Literal>]
    let PeerRepositoryPath = "src/Research.FSharp/MixedMessageEpochReplay.fsx"

    /// A load-path observation is separate from a byte observation. These are
    /// the three explicit #r dependencies only, not a transitive closure proof.
    type DirectSourceObservation =
        { RepositoryPath: string
          ExpectedSha256: string option
          ActualPath: string option
          AssemblyName: string option
          File: FileObservation option
          Failure: PeerFailure option }

    type SourceAdmission =
        { Complete: bool
          Observations: DirectSourceObservation list
          Failure: PeerFailure option }

    let private isHash (value: string) =
        not (isNull value) && value.Length = 64
        && (value |> Seq.forall (fun c -> (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F')))

    let private bindingsFailure (expected: Map<string, string>) =
        if isNull (box expected) || expected.IsEmpty || expected.Count > 132
           || (expected |> Map.exists (fun key value ->
               isNull key || key.Length = 0 || key.Length > 256
               || key = "@python" || key = "@host"
               || (key |> Seq.exists (fun c -> c < ' ' || c > '~'))
               || not (isHash value))) then
            Some(failure "admit" "SourceBindings" "bounded independently admitted ASCII path/hash map required")
        else
            // Exact canonical length of this ASCII string-to-hash object,
            // before file reads or expanded encoding. Quote/backslash are
            // the only escaped allowed key characters.
            let size =
                1 + (expected |> Seq.sumBy (fun (KeyValue(key, _)) ->
                    70 + (key |> Seq.sumBy (fun c -> if c = '"' || c = '\\' then 2 else 1))))
            if size > SmallCap then Some(failure "admit" "SourceBindingsBound" "canonical source binding map exceeds 64 KiB")
            else None

    /// Parsed transport data only. The core still admits the complete plan and
    /// budget snapshot and checks the canonical plan/binding correspondence.
    type StartEnvelope =
        { SessionId: string
          PlanSha256: string
          ServiceSha256: string
          ExpectedBindings: Map<string, string>
          Plan: JsonElement
          BudgetSnapshot: JsonElement }

    let private isId (value: string) =
        let alphanumeric c = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
        not (isNull value) && value.Length > 0 && value.Length <= 64
        && alphanumeric value.[0]
        && (value |> Seq.forall (fun c -> alphanumeric c || c = '.' || c = '_' || c = '/' || c = '-'))

    /// Only the one source-fixed Start envelope is recognized. Its nested
    /// plan/snapshot remain passive until their owning compiled codecs admit
    /// them. This function performs no source reads, Ready write or core entry.
    let tryReadStart (raw: byte array) : Result<StartEnvelope, PeerFailure> =
        try
            match strictJson "admit" StartCap raw with
            | Error error -> Error error
            | Ok root ->
                match exactKeys "admit" [| "Kind"; "Schema"; "SessionId"; "Plan"; "PlanSha256"; "ServiceSha256"; "ExpectedBindings"; "BudgetSnapshot" |] root with
                | Error error -> Error error
                | Ok () ->
                    let strings = [ "Kind"; "Schema"; "SessionId"; "PlanSha256"; "ServiceSha256" ]
                    let mutable fields = Map.empty
                    let mutable problem = None
                    for key in strings do
                        if problem.IsNone then
                            match stringField "admit" key root with
                            | Error error -> problem <- Some error
                            | Ok value -> fields <- Map.add key value fields
                    let plan = root.GetProperty "Plan"
                    let budget = root.GetProperty "BudgetSnapshot"
                    let supplied = root.GetProperty "ExpectedBindings"
                    let mutable expected = Map.empty
                    if problem.IsNone then
                        if fields["Kind"] <> "Start" || fields["Schema"] <> Schema || not (isId fields["SessionId"])
                           || not (isHash fields["PlanSha256"] && isHash fields["ServiceSha256"])
                           || plan.ValueKind <> JsonValueKind.Object || budget.ValueKind <> JsonValueKind.Object
                           || supplied.ValueKind <> JsonValueKind.Object then
                            problem <- Some(failure "admit" "StartIdentity" "fixed Start schema, bounded identities and object payloads required")
                        else
                            use entries = (supplied.EnumerateObject() :> IEnumerator<JsonProperty>)
                            let mutable count = 0
                            while problem.IsNone && entries.MoveNext() do
                                count <- count + 1
                                let entry = entries.Current
                                if count > 132 || entry.Name.Length > 256 || entry.Value.ValueKind <> JsonValueKind.String then
                                    problem <- Some(failure "admit" "SourceBindings" "bounded string/hash bindings required before map expansion")
                                else expected <- Map.add entry.Name (entry.Value.GetString()) expected
                            if problem.IsNone then problem <- bindingsFailure expected
                    match problem with
                    | Some error -> Error error
                    | None ->
                        Ok { SessionId = fields["SessionId"]; PlanSha256 = fields["PlanSha256"]
                             ServiceSha256 = fields["ServiceSha256"]; ExpectedBindings = expected
                             Plan = plan; BudgetSnapshot = budget }
        with error -> Error(failure "admit" "StartDecode" (error.GetType().FullName + ": " + error.Message))

    /// The caller supplies the separately admitted full binding map. This
    /// routine observes the executing script and the actual three direct
    /// assemblies before Ready. No supplied path chooses a file to load/read.
    /// The runtime path itself comes from the source-fixed Type/FSI locations.
    let observeDirectSources (expected: Map<string, string>) : SourceAdmission =
        let observations = ResizeArray<DirectSourceObservation>()
        let mutable primary = None
        let fail error = if primary.IsNone then primary <- Some error
        try
            // The manifest has up to 128 SourceFiles (including both scripts),
            // then three direct DLL binding paths and ProtocolSha256. The two
            // local @ executable roles are not members of this flat map.
            match bindingsFailure expected with
            | Some error -> fail error
            | None ->
                let sourcePath = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, __SOURCE_FILE__))
                let repository = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "..", ".."))
                // Functions defer actual assembly metadata access until each
                // preceding observation is retained; one failing lookup cannot
                // discard identities already read for an earlier direct file.
                let selected =
                    [ PeerRepositoryPath, 1024 * 1024, (fun () -> sourcePath, None)
                      "src/Core/bin/Release/net10.0/Zeta.Core.dll", 32 * 1024 * 1024,
                          (fun () -> let a = typeof<Zeta.Core.IntrCtx>.Assembly in a.Location, Some a.FullName)
                      "src/Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll", 32 * 1024 * 1024,
                          (fun () -> let a = typeof<Zeta.Core.IPort<int>>.Assembly in a.Location, Some a.FullName)
                      "src/Bayesian/bin/Release/net10.0/Zeta.Bayesian.dll", 32 * 1024 * 1024,
                          (fun () -> let a = typeof<Zeta.Bayesian.Gaussian>.Assembly in a.Location, Some a.FullName) ]
                for relative, maximum, actual in selected do
                    if primary.IsNone then
                        let expectedHash = Map.tryFind relative expected
                        let mutable row =
                            { RepositoryPath = relative; ExpectedSha256 = expectedHash
                              ActualPath = None; AssemblyName = None; File = None; Failure = None }
                        let index = observations.Count
                        observations.Add row
                        let update () = observations.[index] <- row
                        let refuse error =
                            row <- { row with Failure = Some error }
                            update ()
                            fail error
                        try
                            let path, name = actual ()
                            row <- { row with ActualPath = Some path; AssemblyName = name }
                            update ()
                            let declared = Path.GetFullPath(Path.Combine(repository, relative))
                            if expectedHash.IsNone then
                                refuse (failure "admit" "SourceBindingMissing" ("missing direct source binding: " + relative))
                            elif isNull path || path.Length = 0 || not (String.Equals(path, declared, StringComparison.Ordinal)) then
                                refuse (failure "admit" "SourceLocation" ("actual direct file is outside its declared source path: " + relative))
                            else
                                let file = observeFile path maximum
                                row <- { row with File = Some file }
                                update ()
                                match file.Failure with
                                | Some error -> refuse error
                                | None when not file.Complete || file.Sha256 <> expectedHash ->
                                    refuse (failure "admit" "SourceHash" ("actual direct file hash differs: " + relative))
                                | None -> ()
                        with error ->
                            refuse (failure "admit" "SourceObservation" (error.GetType().FullName + ": " + error.Message))
        with error -> fail (failure "admit" "SourceAdmission" (error.GetType().FullName + ": " + error.Message))
        { Complete = primary.IsNone && observations.Count = 4
          Observations = List.ofSeq observations; Failure = primary }

    /// Complete actual local codec/admission returns. These values remain in
    /// memory if later identity checks or publication fail; no serialized type
    /// label selects an operation. No scheduler or learner is called here.
    type CoreAdmissionCall =
        | BudgetDecoded of byte array * Result<E.BudgetSnapshot, E.Failure>
        | PlanDecoded of byte array * Result<E.EpochPlan, E.Failure>
        | PlanEncoded of Result<byte array, E.Failure>
        | ForecastsAdmitted of Result<E.AdmittedForecast list, E.Failure>
        | PlanAdmitted of Result<E.AdmittedPlan, E.Failure>
        | AdmissionRaised of phase: string * exceptionType: string * message: string

    type CoreStartAttempt =
        { Envelope: StartEnvelope
          Sources: SourceAdmission option
          Calls: CoreAdmissionCall list
          Admitted: E.AdmittedPlan option
          Failure: PeerFailure option }

    let private nestedBytes field maximum (value: JsonElement) =
        try
            let text = value.GetRawText()
            if utf8.GetByteCount text > maximum then
                Error(failure "admit" "PayloadBound" (field + " exceeds its bounded raw payload allowance"))
            else Ok(utf8.GetBytes text)
        with error -> Error(failure "admit" "PayloadEncoding" (field + ": " + error.Message))

    /// The incoming Start channel and full source manifest are independently
    /// admitted coordinator premises. Compact forecast construction below
    /// trusts that selected coordinator's completed bundle/closure admission;
    /// matching hashes alone cannot establish prior remote execution.
    let admitStart (envelope: StartEnvelope) : CoreStartAttempt =
        let calls = ResizeArray<CoreAdmissionCall>()
        let mutable sources = None
        let mutable budget = None
        let mutable plan = None
        let mutable forecasts = None
        let mutable admitted = None
        let mutable primary = None
        let mutable phase = "source"
        let fail error = if primary.IsNone then primary <- Some error
        let coreFailure name (problem: E.Failure) =
            fail (failure "admit" "CoreRefusal" (name + ": " + problem.Code + ": " + problem.Message))
        try
            if isNull (box envelope) then
                fail (failure "admit" "StartArguments" "parsed fixed Start envelope required")
            else
                // Before calling any codec in the selected core assembly,
                // retain the actual script/direct-file source observations.
                let actual = observeDirectSources envelope.ExpectedBindings
                sources <- Some actual
                match actual.Failure with
                | Some error -> fail error
                | None when not actual.Complete -> fail (failure "admit" "SourceIncomplete" "complete direct-source observations required")
                | None -> ()
            if primary.IsNone then
                phase <- "budget-decode"
                match nestedBytes "BudgetSnapshot" SmallCap envelope.BudgetSnapshot with
                | Error error -> fail error
                | Ok raw ->
                    let actual = E.tryDecodeBudgetSnapshot raw
                    calls.Add(BudgetDecoded(raw, actual))
                    match actual with Ok value -> budget <- Some value | Error error -> coreFailure phase error
            if primary.IsNone then
                phase <- "plan-decode"
                match nestedBytes "Plan" StartCap envelope.Plan with
                | Error error -> fail error
                | Ok raw ->
                    let actual = E.tryReadPlan raw
                    calls.Add(PlanDecoded(raw, actual))
                    match actual with Ok value -> plan <- Some value | Error error -> coreFailure phase error
            if primary.IsNone then
                phase <- "plan-bindings"
                let value = Option.get plan
                if value.SourceBindings <> envelope.ExpectedBindings then
                    fail (failure "admit" "PlanBindings" "plan source map differs from the independently admitted Start map")
            if primary.IsNone then
                phase <- "plan-canonical-identity"
                let actual = E.tryEncodePlan (Option.get plan)
                calls.Add(PlanEncoded actual)
                match actual with
                | Error error -> coreFailure phase error
                | Ok raw when (identity raw).Sha256 <> envelope.PlanSha256 ->
                    fail (failure "admit" "PlanHash" "actual canonical plan identity differs from Start")
                | Ok _ -> ()
            if primary.IsNone then
                phase <- "forecast-admission"
                let value = Option.get plan
                let compact = value.Training |> Option.map (fun training -> training.ChildForecasts) |> Option.defaultValue []
                let actual = E.tryAdmitCoordinatorForecasts compact
                calls.Add(ForecastsAdmitted actual)
                match actual with Ok value -> forecasts <- Some value | Error error -> coreFailure phase error
            if primary.IsNone then
                phase <- "plan-admission"
                let context: E.AdmissionContext =
                    { Identity = { SessionId = envelope.SessionId; ServiceSha256 = envelope.ServiceSha256 }
                      InitialBudgetSnapshot = Option.get budget; Forecasts = Option.get forecasts }
                let actual = E.tryAdmit (Option.get plan, context)
                calls.Add(PlanAdmitted actual)
                match actual with Ok value -> admitted <- Some value | Error error -> coreFailure phase error
        with error ->
            // Preserve the observed exception separately from the bounded
            // transport failure; never manufacture a missing core return.
            calls.Add(AdmissionRaised(phase, error.GetType().FullName, error.Message))
            fail (failure "admit" "CoreRaised" (phase + ": " + error.GetType().FullName + ": " + error.Message))
        { Envelope = envelope; Sources = sources; Calls = List.ofSeq calls
          Admitted = admitted; Failure = primary }

    /// Closed peer output kinds; no supplied string selects a protocol variant.
    type OutputKind =
        | ReadyFrame
        | CheckpointFrame of projectionBearing: bool
        | ProjectionRequestFrame
        | CommitFrame
        | EpochReturnFrame
        | TerminalFrame

    type FrameBuild =
        { Kind: OutputKind
          Payload: byte array
          CanonicalReturn: Result<byte array, E.Failure> option
          Raw: byte array option
          Failure: PeerFailure option }

    let private outputShape = function
        | ReadyFrame -> "Ready", SmallCap, [| "PlanSha256"; "ServiceSha256" |]
        | CheckpointFrame projection ->
            "Checkpoint", (if projection then ResultCap else SmallCap),
            [| "Sequence"; "Observation"; "LastRevision"; "StateSha256" |]
        | ProjectionRequestFrame ->
            "ProjectionRequest", RequestCap,
            [| "Sequence"; "RequestId"; "InputRevision"; "Base"; "TargetBits"; "RawInputHex"
               "InputSha256"; "CaseId"; "BindingsSha256"; "Remaining" |]
        | CommitFrame ->
            "Commit", SmallCap, [| "Sequence"; "CheckpointSha256"; "AppliedRevision"; "LastCommitted"; "Counters" |]
        | EpochReturnFrame -> "EpochReturn", ResultCap, [| "Sequence"; "Result"; "ResultSha256" |]
        | TerminalFrame ->
            "Terminal", TerminalCap,
            [| "Outcome"; "Termination"; "Failure"; "Counters"; "LastCommitted"; "LedgerCount"
               "LedgerSha256"; "PendingRequest"; "Publication" |]

    /// The remaining allowance already includes the LF. The payload is the
    /// actual returned core encoding, retained by the caller before framing.
    /// Only the three fixed envelope fields are added; numeric/source result
    /// trees are never reconstructed by the peer.
    let framePayload kind sessionId remainingBytes (payload: byte array) : FrameBuild =
        let mutable canonical = None
        let mutable raw = None
        let mutable primary = None
        let fail error = if primary.IsNone then primary <- Some error
        try
            let name, cap, keys = outputShape kind
            let maximum = min cap remainingBytes
            if maximum <= 0 || not (isId sessionId) || isNull payload then
                fail (failure "publish" "FrameArguments" "positive allowance, admitted session and actual payload required")
            else
                // ID/schema/kind alphabets are source-fixed ASCII without any
                // escaping characters. Count this small envelope before the
                // payload prewalk or any complete envelope allocation.
                let header = "{\"Kind\":\"" + name + "\",\"Schema\":\"" + Schema + "\",\"SessionId\":\"" + sessionId + "\","
                let headerBytes = utf8.GetBytes header
                // header + payload without its initial '{' + one LF. Require
                // braces in exact core encodings; arbitrary whitespace layouts
                // are not accepted as a returned core payload.
                if payload.Length < 2 || payload.[0] <> 123uy || payload.[payload.Length - 1] <> 125uy
                   || payload.Length > maximum || headerBytes.Length > maximum - payload.Length then
                    fail (failure "publish" "FrameBound" "complete envelope and LF exceed their finite allowance or payload braces are absent")
                else
                    match strictJson "publish" (maximum - headerBytes.Length) payload with
                    | Error error -> fail error
                    | Ok tree ->
                        match exactKeys "publish" keys tree with
                        | Error error -> fail error
                        | Ok () ->
                            let assembled = Array.zeroCreate<byte> (headerBytes.Length + payload.Length - 1)
                            headerBytes.CopyTo(assembled, 0)
                            Array.Copy(payload, 1, assembled, headerBytes.Length, payload.Length - 1)
                            let actual = E.tryCanonicalPayload assembled (maximum - 1)
                            canonical <- Some actual
                            match actual with
                            | Error error -> fail (failure "publish" "FrameEncoding" (error.Code + ": " + error.Message))
                            | Ok encoded ->
                                // Retain the actual codec return above before
                                // the final allocation/copy can fail.
                                let framed = Array.zeroCreate<byte> (encoded.Length + 1)
                                encoded.CopyTo(framed, 0)
                                framed.[encoded.Length] <- 10uy
                                raw <- Some framed
        with error -> fail (failure "publish" "FrameRaised" (error.GetType().FullName + ": " + error.Message))
        { Kind = kind; Payload = payload; CanonicalReturn = canonical; Raw = raw; Failure = primary }

    let private flow = Zeta.Core.ResultComputation.ResultBuilder()

    /// Copies a fixed subset of an already bounded passive object. The caller
    /// first checks exact outer keys; names here are source constants. Each raw
    /// value and the complete object are bounded before aggregate expansion.
    let private selectPayload maximum (fields: (string * JsonElement) list) =
        try
            if maximum <= 0 || maximum > ResultCap then
                Error(failure "admit" "PayloadBound" "positive fixed payload allowance required")
            else
                let parts = ResizeArray<string>()
                let mutable size = 2
                let mutable primary = None
                for name, value in fields do
                    if primary.IsNone then
                        let text = value.GetRawText()
                        let count = utf8.GetByteCount text
                        let extra = name.Length + 3 + (if parts.Count = 0 then 0 else 1)
                        if extra > maximum - size || count > maximum - size - extra then
                            primary <- Some(failure "admit" "PayloadBound" "fixed selected payload exceeds allowance")
                        else
                            size <- size + extra + count
                            parts.Add("\"" + name + "\":" + text)
                match primary with
                | Some error -> Error error
                | None -> Ok(utf8.GetBytes("{" + String.Join(",", parts) + "}"))
        with error -> Error(failure "admit" "PayloadSelection" (error.GetType().FullName + ": " + error.Message))

    let private headerMatches kind session (tree: JsonElement) =
        flow {
            let! actualKind = stringField "admit" "Kind" tree
            let! schema = stringField "admit" "Schema" tree
            let! actualSession = stringField "admit" "SessionId" tree
            if actualKind = kind && schema = Schema && actualSession = session && isId session then return ()
            else return! Error(failure "admit" "ResponseIdentity" "kind/schema/session differs from the outstanding exchange")
        }

    let private readFailure (tree: JsonElement) : Result<E.Failure, PeerFailure> =
        flow {
            do! exactKeys "admit" [| "Code"; "Stage"; "Field"; "Message" |] tree
            let! code = stringField "admit" "Code" tree
            let! stage = stringField "admit" "Stage" tree
            let! message = stringField "admit" "Message" tree
            let field = tree.GetProperty "Field"
            let! actualField =
                if field.ValueKind = JsonValueKind.Null then Ok None
                elif field.ValueKind = JsonValueKind.String then
                    let value = field.GetString()
                    if not (isNull value) && value.Length <= 256 && (value |> Seq.forall Char.IsAscii) then Ok(Some value)
                    else Error(failure "admit" "FailureShape" "bounded optional ASCII failure field required")
                else Error(failure "admit" "FailureShape" "string or null failure field required")
            if not (List.contains code ["Admission";"Conflict";"Stale";"Family";"Improper";"Arithmetic";"Service";"Uncertified";"Budget";"Storage";"Transport";"Unexpected"])
               || not (List.contains stage ["admit";"learn";"forward";"gamma";"gaussian";"project";"apply";"publish";"retract";"scheduler"])
               || utf8.GetByteCount message > 1024 then
                return! Error(failure "admit" "FailureShape" "registered failure code/stage and bounded UTF8 message required")
            return { Code = code; Stage = stage; Field = actualField; Message = message }
        }

    type AcknowledgmentAttempt =
        { Raw: byte array
          Parsed: Result<JsonElement, PeerFailure>
          StoredReturn: Result<E.StoredCheckpoint, E.Failure> option
          BudgetReturn: Result<E.BudgetSnapshot, E.Failure> option
          Refused: E.Failure option
          Stored: E.StoredCheckpoint option
          Failure: PeerFailure option }

    /// Retains raw/parsed/decoded ACK evidence before checking correspondence.
    /// This does not read the descriptor's named file or prove remote storage:
    /// the selected coordinator's actual Store/ACK route is the trust premise.
    let admitAcknowledgment session sequence (sent: byte array) (received: byte array) : AcknowledgmentAttempt =
        let parsed = strictJson "admit" SmallCap received
        let mutable storedReturn = None
        let mutable budgetReturn = None
        let mutable refused = None
        let mutable stored = None
        let outcome =
            try
                flow {
                    if not (isId session) || sequence < 1 || isNull sent || sent.Length = 0 || sent.Length > ResultCap then
                        return! Error(failure "admit" "AckArguments" "bounded original sent frame and admitted exchange required")
                    let! tree = parsed
                    do! exactKeys "admit" [| "Kind"; "Schema"; "SessionId"; "Sequence"; "CheckpointSha256"; "Outcome"; "BudgetSnapshot" |] tree
                    let ackOutcome = tree.GetProperty "Outcome"
                    let! outcomeKind = stringField "admit" "Kind" ackOutcome
                    if outcomeKind = "stored" then
                        do! exactKeys "admit" [| "Kind"; "Artifact" |] ackOutcome
                        let! payload = selectPayload SmallCap
                                           ["Sequence",tree.GetProperty "Sequence"; "CheckpointSha256",tree.GetProperty "CheckpointSha256"
                                            "Artifact",ackOutcome.GetProperty "Artifact"; "BudgetSnapshot",tree.GetProperty "BudgetSnapshot"]
                        let actual = E.tryDecodeStoredCheckpoint payload
                        storedReturn <- Some actual
                        let! value = actual |> Result.mapError (fun e -> failure "admit" "AckDecode" (e.Code + ": " + e.Message))
                        // Keep the complete actual decoded return above even
                        // if its session, descriptor or hash is inconsistent.
                        do! headerMatches "CheckpointAck" session tree
                        let sentIdentity = identity sent
                        let a = value.Artifact
                        if value.Sequence <> sequence || value.CheckpointSha256 <> sentIdentity.Sha256
                           || a.Bytes <> int64 sentIdentity.Bytes || a.Sha256 <> sentIdentity.Sha256
                           || a.Encoding <> "identity" || a.StoredBytes <> a.Bytes || a.StoredSha256 <> a.Sha256
                           || isNull a.File || a.File.Length = 0 || a.File.Length > 512
                           || not (a.File |> Seq.forall (fun c -> c >= ' ' && c <= '~')) then
                            return! Error(failure "admit" "AckCorrespondence" "ACK sequence/hash/complete original descriptor differs from the sent frame")
                        stored <- Some value
                    elif outcomeKind = "refused" then
                        do! exactKeys "admit" [| "Kind"; "Failure" |] ackOutcome
                        let! actualFailure = readFailure (ackOutcome.GetProperty "Failure")
                        refused <- Some actualFailure
                        let! payload = nestedBytes "BudgetSnapshot" SmallCap (tree.GetProperty "BudgetSnapshot")
                        let actual = E.tryDecodeBudgetSnapshot payload
                        budgetReturn <- Some actual
                        let! _ = actual |> Result.mapError (fun e -> failure "admit" "AckDecode" (e.Code + ": " + e.Message))
                        do! headerMatches "CheckpointAck" session tree
                        let! actualSequence = integerField "admit" "Sequence" tree
                        let! actualHash = stringField "admit" "CheckpointSha256" tree
                        if actualSequence <> sequence || actualHash <> (identity sent).Sha256 then
                            return! Error(failure "admit" "AckCorrespondence" "refused ACK differs from the outstanding sent frame")
                    else
                        return! Error(failure "admit" "AckOutcome" "stored or refused ACK outcome required")
                    return ()
                }
            with error -> Error(failure "admit" "AckRaised" (error.GetType().FullName + ": " + error.Message))
        { Raw = received; Parsed = parsed; StoredReturn = storedReturn; BudgetReturn = budgetReturn
          Refused = refused; Stored = stored; Failure = match outcome with Error e -> Some e | Ok () -> None }

    type ProjectionResponseAttempt =
        { Raw: byte array
          Parsed: Result<JsonElement, PeerFailure>
          DecodedReturn: Result<E.ProjectionResponse, E.Failure> option
          Response: E.ProjectionResponse option
          Failure: PeerFailure option }

    /// Fixed transport/identity correspondence only. The source-owned core
    /// separately admits the complete actual Native/Certificate result and its
    /// numerical proposal before any application. Passive decoding is not a
    /// certificate verdict or proof that a service/process ran.
    let admitProjectionResponse (peer: E.PeerIdentity) (request: E.ProjectionRequest) received : ProjectionResponseAttempt =
        let parsed = strictJson "admit" ResponseCap received
        let mutable decoded = None
        let mutable response = None
        let outcome =
            try
                flow {
                    if isNull (box peer) || isNull (box request) || not (isId peer.SessionId)
                       || not (isHash peer.ServiceSha256) || request.Sequence < 1 then
                        return! Error(failure "admit" "ResponseArguments" "admitted peer and actual outstanding request required")
                    let! tree = parsed
                    let names = [| "Sequence"; "RequestId"; "InputSha256"; "BindingsSha256"; "ServiceSha256"
                                   "Native"; "Certificate"; "Failure"; "BudgetSnapshot" |]
                    do! exactKeys "admit" (Array.append [| "Kind"; "Schema"; "SessionId" |] names) tree
                    let! payload = selectPayload ResponseCap (names |> Array.map (fun key -> key, tree.GetProperty key) |> Array.toList)
                    let actual = E.tryDecodeProjectionResponse payload
                    decoded <- Some actual
                    let! value = actual |> Result.mapError (fun e -> failure "admit" "ResponseDecode" (e.Code + ": " + e.Message))
                    do! headerMatches "ProjectionResponse" peer.SessionId tree
                    if value.Sequence <> request.Sequence || value.RequestId <> request.RequestId
                       || value.InputSha256 <> request.InputSha256 || value.BindingsSha256 <> request.BindingsSha256
                       || value.ServiceSha256 <> peer.ServiceSha256 then
                        return! Error(failure "admit" "ProjectionCorrespondence" "response differs from the outstanding request/source/binding identities")
                    // Use the same fixed four-field failure grammar for both
                    // coordinator response variants. The complete decoded
                    // value remains retained if this later check refuses.
                    match value.Failure with
                    | Some _ ->
                        let! _ = readFailure (tree.GetProperty "Failure")
                        ()
                    | None -> ()
                    response <- Some value
                    return ()
                }
            with error -> Error(failure "admit" "ResponseRaised" (error.GetType().FullName + ": " + error.Message))
        { Raw = received; Parsed = parsed; DecodedReturn = decoded; Response = response
          Failure = match outcome with Error e -> Some e | Ok () -> None }
