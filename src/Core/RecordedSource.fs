namespace Zeta.Core

/// RecordedSource — **the §13 noninterference quarantine made EXECUTABLE on real IO** (Aaron 2026-06-11:
/// "1 let's do it"). The FoundationDB move, applied to the soft IScheduler's entropy door:
///
/// All entropy enters a room through the injected `SoftScheduler.Source` (the ONLY door — manifesto §13).
/// `seedSource` covers the DST/null path. THIS module covers the **prod path**: wrap any LIVE source
/// (one backed by real Reticulum/disk/operator crossings), **record every crossing at the membrane**,
/// and **replay the recording as a Source** that reproduces the run *identically*. DST survives real
/// network IO: record the crossings, replay the crossings.
///
/// The recording is **TEXT** (`toLines`/`ofLines`, tab-separated, escaped) — never a binary blob
/// (no-binary-in-proof-lineage): recordings are diffable, mergeable, golden-vector-able. A recording IS
/// a treaty surface ("we are the consumer for our treaties").
[<RequireQualifiedAccess>]
module RecordedSource =

    /// A recording: per tick, the interrupts that crossed the membrane. Sparse (ticks with no arrivals
    /// are omitted); ticks beyond the recording replay as empty (the membrane was quiet).
    type Recording = { Crossings: Map<int, InterruptKind list> }

    /// The empty recording.
    let empty: Recording = { Crossings = Map.empty }

    /// Record `budget` ticks of a live source: ask the source what crossed at each tick and book it.
    /// (The live source may be impure underneath — backed by real IO; that is exactly the point. The
    /// recording is the metered membrane log.)
    let record (live: SoftScheduler.Source) (budget: int) : Recording =
        let m =
            [ 0 .. budget - 1 ]
            |> List.choose (fun n ->
                match live n with
                | [] -> None
                | arrivals -> Some(n, arrivals))
            |> Map.ofList

        { Crossings = m }

    /// Replay a recording as a `Source`: the same crossings at the same ticks, nothing else, ever.
    let replay (r: Recording) : SoftScheduler.Source =
        fun n ->
            match Map.tryFind n r.Crossings with
            | Some arrivals -> arrivals
            | None -> []

    // ── Text codec (no binary in the proof lineage; recordings are diffable treaties) ──

    let private esc (s: string) =
        s.Replace("\\", "\\\\").Replace("\t", "\\t").Replace("\n", "\\n").Replace("\r", "\\r")

    let private unesc (s: string) =
        let sb = System.Text.StringBuilder()
        let mutable i = 0
        while i < s.Length do
            if s.[i] = '\\' && i + 1 < s.Length then
                (match s.[i + 1] with
                 | 't' -> sb.Append '\t'
                 | 'n' -> sb.Append '\n'
                 | 'r' -> sb.Append '\r'
                 | c -> sb.Append c)
                |> ignore
                i <- i + 2
            else
                sb.Append s.[i] |> ignore
                i <- i + 1
        sb.ToString()

    let private kindToText (k: InterruptKind) : string =
        match k with
        | TimerElapsed ms -> sprintf "TimerElapsed\t%d" ms
        | RateLimitExhausted b -> sprintf "RateLimitExhausted\t%s" (esc b)
        | OperatorMessageArrived c -> sprintf "OperatorMessageArrived\t%s" (esc c)
        | DotGitSaturation n -> sprintf "DotGitSaturation\t%d" n
        | SentinelMissing -> "SentinelMissing"
        | RoundsElapsedSinceFreeTime n -> sprintf "RoundsElapsedSinceFreeTime\t%d" n
        | PeerPRMerged n -> sprintf "PeerPRMerged\t%d" n
        | CIFailureDetected j -> sprintf "CIFailureDetected\t%s" (esc j)

    let private kindOfText (parts: string list) : InterruptKind option =
        match parts with
        | [ "TimerElapsed"; ms ] -> Some(TimerElapsed(int ms))
        | [ "RateLimitExhausted"; b ] -> Some(RateLimitExhausted(unesc b))
        | [ "OperatorMessageArrived"; c ] -> Some(OperatorMessageArrived(unesc c))
        | [ "DotGitSaturation"; n ] -> Some(DotGitSaturation(int n))
        | [ "SentinelMissing" ] -> Some SentinelMissing
        | [ "RoundsElapsedSinceFreeTime"; n ] -> Some(RoundsElapsedSinceFreeTime(int n))
        | [ "PeerPRMerged"; n ] -> Some(PeerPRMerged(int n))
        | [ "CIFailureDetected"; j ] -> Some(CIFailureDetected(unesc j))
        | _ -> None

    /// Serialize a recording to text lines — one crossing per line, `tick<TAB>Kind<TAB>arg`, tick-ordered
    /// then arrival-ordered (deterministic output: same recording ⇒ byte-identical lines).
    let toLines (r: Recording) : string list =
        r.Crossings
        |> Map.toList
        |> List.collect (fun (tick, arrivals) -> arrivals |> List.map (fun k -> sprintf "%d\t%s" tick (kindToText k)))

    /// Parse text lines back to a recording (inverse of `toLines`; unknown lines are skipped — a partial
    /// read never throws, it just records less, named here honestly).
    let ofLines (lines: string list) : Recording =
        let parsed =
            lines
            |> List.choose (fun line ->
                match line.Split('\t') |> Array.toList with
                | tick :: rest ->
                    match System.Int32.TryParse tick, kindOfText rest with
                    | (true, t), Some k -> Some(t, k)
                    | _ -> None
                | [] -> None)

        let m =
            parsed
            |> List.groupBy fst
            |> List.map (fun (t, ks) -> t, ks |> List.map snd)
            |> Map.ofList

        { Crossings = m }
