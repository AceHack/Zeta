module Zeta.Tests.Git.GitDeltaLogErasureLawsTests

open System
open System.Globalization
open System.IO
open System.Threading
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open LibGit2Sharp
open Zeta.Core
open Zeta.Core.FSharp.Git

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// THE PRESERVING TRUNCATION, MEASURED
//
// `Zeta.Tests.Formal.ErasureRepresentationLawsTests` measures every representation that lives in
// `Zeta.Core`. `GitDeltaLog` lives in `Zeta.Core.FSharp.Git`, so its rows are measured here — same
// machinery, same domain, same two-direction check, because a classification that only holds in
// the assembly where it is convenient to test is not a classification.
//
// This is the half of the pair that makes the point. `InMemoryDeltaLog.TruncateAsync` and
// `GitDeltaLog.TruncateAsync` are the SAME interface method reached from the SAME call site
// (`RecoverableSpine.CommitAsync`). One destroys the preimage. The other commits the truncated
// tree with the old commit as its PARENT, so every removed delta stays reachable by walking one
// edge of the DAG. The class is decided by the injected backend, which is why it cannot live on
// the interface — and why the list this replaces, keyed by operation name, could never have been
// completed.
//
// Note what the two rows say together: through the log's own READ SURFACE the two backends are
// indistinguishable — Git's `ReplayAsync` reads the tip tree only, so the truncated deltas are as
// absent there as anywhere. They differ in what OTHER channel survives. Stating both keeps the
// comparison honest instead of flattering.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private fixedClock () = DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)

let private codec () =
    CborEntryCodec<int>(
        (fun (i: int) -> DynamicValue.Int(int64 i)),
        (function
        | DynamicValue.Int v -> int v
        | o -> failwithf "key not Int: %A" o)
    )
    :> IEntryCodec<int>

let mutable private counter = 0

let private freshRepoDir () =
    let id = Threading.Interlocked.Increment(&counter)

    let dir =
        Path.Combine(Path.GetTempPath(), "zeta-git-erasure", sprintf "%04d-%s" id (Guid.NewGuid().ToString("N")))

    Directory.CreateDirectory dir |> ignore
    Repository.Init(dir, isBare = true) |> ignore
    dir

// ── the same swept universe as the core pack ──────────────────────────────────────────────────

let private deltaUniverse: ZSet<int> list =
    [ ZSet<int>.Empty; ZSet.ofSeq [ (1, 1L) ]; ZSet.ofSeq [ (1, -1L) ] ]

let private deltaSequences: ZSet<int> list list =
    [ yield ([]: ZSet<int> list)
      for a in deltaUniverse -> [ a ]
      for a in deltaUniverse do
          for b in deltaUniverse -> [ a; b ] ]

/// Truncate through 2 — everything the log holds. The point is pinned for the same reason it is
/// pinned in the core pack: an operation that does not record its own argument erases it, that
/// term is shared by every backend, and letting it dominate would hide the question that
/// discriminates them.
let private pinnedTruncationPoint = 2L

let private measureLargestFibre (inputs: 'a list) (probe: 'a -> string) : int =
    inputs |> List.map probe |> List.groupBy id |> List.map (snd >> List.length) |> List.max

/// Build a repo, append, truncate, then observe with `observe`.
let private probeWith (observe: string -> IDeltaLog<int> -> string) (deltas: ZSet<int> list) : string =
    let dir = freshRepoDir ()
    use repo = new Repository(dir)
    let log = GitDeltaLog<int>(repo, codec (), now = fixedClock) :> IDeltaLog<int>

    for d in deltas do
        log.AppendAsync(d, Map.empty, ct).AsTask().GetAwaiter().GetResult() |> ignore

    log.TruncateAsync(pinnedTruncationPoint, ct).AsTask().GetAwaiter().GetResult()
    observe dir log

/// Observation 1 — the log's own read surface. Identical in shape to the core pack's.
let private readSurface (_dir: string) (log: IDeltaLog<int>) : string =
    let entries = log.ReplayAsync(0L, ct).AsTask().GetAwaiter().GetResult()

    let rendered =
        entries
        |> Array.map (fun e -> String.Format(CultureInfo.InvariantCulture, "{0}={1}", e.Seq, e.Delta.ToString()))
        |> String.concat ","

    String.Format(CultureInfo.InvariantCulture, "hw={0}|{1}", log.HighWater, rendered)

/// Observation 2 — the object DAG reachable from the live ref, walking commit parents. Every blob
/// under every commit's tree, in sorted order. THIS is the channel that survives a Git truncation,
/// and walking it is what turns "git never rewrites history" from a slogan into a measurement.
let private reachableThroughDag (dir: string) (_log: IDeltaLog<int>) : string =
    use repo = new Repository(dir)

    let refName =
        repo.Refs
        |> Seq.map (fun r -> r.CanonicalName)
        |> Seq.sortWith (fun a b -> String.CompareOrdinal(a, b))
        |> Seq.tryHead

    match refName with
    | None -> "no-ref"
    | Some name ->
        let tip = repo.Refs.[name].ResolveToDirectReference()

        let rec walk (commit: Commit) (acc: string list) =
            let blobs =
                commit.Tree
                |> Seq.collect (fun entry ->
                    match entry.TargetType with
                    | TreeEntryTargetType.Tree ->
                        (entry.Target :?> Tree)
                        |> Seq.map (fun sub -> entry.Name + "/" + sub.Name + "@" + sub.Target.Sha)
                    | _ -> Seq.singleton (entry.Name + "@" + entry.Target.Sha))
                |> List.ofSeq

            let acc = acc @ [ commit.Message.Trim() ] @ blobs

            match commit.Parents |> Seq.tryHead with
            | Some parent -> walk parent acc
            | None -> acc

        let commit = repo.Lookup<Commit>(tip.TargetIdentifier)

        if isNull (box commit) then
            "no-commit"
        else
            walk commit [] |> List.sortWith (fun a b -> String.CompareOrdinal(a, b)) |> String.concat ","

// ── the declared rows this pack is responsible for ────────────────────────────────────────────

let private gitProfiles () =
    let dir = freshRepoDir ()
    let repo = new Repository(dir)
    (GitDeltaLog<int>(repo, codec (), now = fixedClock) :> IErasureDeclaring).ErasureProfiles

let private profileFor (observation: string) =
    gitProfiles ()
    |> List.filter (fun p ->
        p.Operation = "IDeltaLog.TruncateAsync"
        && p.Observation.Contains(observation, StringComparison.Ordinal))
    |> List.exactlyOne

// ═══ 1. The DAG observation: fibre 1, zero bits — Bennett-free, and MEASURED ═══

[<Fact>]
let ``truncation is reversible through the commit DAG - the parent edge is the recovery channel`` () =
    let fibre = measureLargestFibre deltaSequences (probeWith reachableThroughDag)
    let declared = profileFor "the object DAG"

    ErasureClass.ofLargestFibre fibre |> should equal declared.Classification
    ErasureClass.ofLargestFibre fibre |> should equal ErasureClass.ThermodynamicClass.Reversible
    ErasureClass.largestFibre declared |> should equal (Some fibre)
    ErasureClass.bitsErasedPpm declared |> should equal (Some(ErasureClass.bitsPpmOfLargestFibre fibre))
    fibre |> should equal 1

// ═══ 2. The read surface: the SAME backend is erasing through the SAME channel as the others ═══

[<Fact>]
let ``truncation is erasing through the log's own read surface, exactly as every other backend`` () =
    let fibre = measureLargestFibre deltaSequences (probeWith readSurface)
    let declared = profileFor "at a pinned truncation point"

    ErasureClass.ofLargestFibre fibre |> should equal declared.Classification
    ErasureClass.ofLargestFibre fibre |> should equal ErasureClass.ThermodynamicClass.Erasing
    ErasureClass.largestFibre declared |> should equal (Some fibre)
    ErasureClass.bitsErasedPpm declared |> should equal (Some(ErasureClass.bitsPpmOfLargestFibre fibre))

// ═══ 3. The witness: the truncated delta is STILL THERE, one parent edge away ═══
// The fibre measurement above is the general statement. This is the particular one, in the form a
// reader can check by hand: append, truncate, and then find the blob you were told was gone.

[<Fact>]
let ``a truncated delta remains reachable by walking one parent edge from the live ref`` () =
    let dir = freshRepoDir ()
    let before =
        use repo = new Repository(dir)
        let log = GitDeltaLog<int>(repo, codec (), now = fixedClock) :> IDeltaLog<int>
        log.AppendAsync(ZSet.ofSeq [ (7, 1L) ], Map.empty, ct).AsTask().GetAwaiter().GetResult() |> ignore
        reachableThroughDag dir log

    let after =
        use repo = new Repository(dir)
        let log = GitDeltaLog<int>(repo, codec (), now = fixedClock) :> IDeltaLog<int>
        log.TruncateAsync(1L, ct).AsTask().GetAwaiter().GetResult()
        // Gone from the read surface …
        let entries = log.ReplayAsync(0L, ct).AsTask().GetAwaiter().GetResult()
        entries |> Array.isEmpty |> should equal true
        reachableThroughDag dir log

    // … and every blob that was reachable before is still reachable after. Set inclusion, not
    // equality: the truncation adds its own commit, which is exactly the parent edge doing the work.
    let beforeItems = before.Split(',') |> Set.ofArray
    let afterItems = after.Split(',') |> Set.ofArray

    Set.difference beforeItems afterItems |> Set.toList |> should be Empty

// ═══ 4. Drift guard — a new representation in THIS assembly cannot stay silent either ═══

[<Fact>]
let ``every concrete delta log in the git assembly declares its erasure class`` () =
    let asm = typeof<GitDeltaLog<int>>.Assembly

    let candidates =
        asm.GetTypes()
        |> Array.filter (fun t -> t.IsClass && not t.IsAbstract && t.IsPublic)
        |> Array.filter (fun t ->
            t.GetInterfaces()
            |> Array.exists (fun i ->
                i.IsGenericType
                && i.GetGenericTypeDefinition() = typedefof<IDeltaLog<int, ZSet<int>>>))

    candidates |> Array.isEmpty |> should equal false

    candidates
    |> Array.filter (fun t -> not (typeof<IErasureDeclaring>.IsAssignableFrom t))
    |> Array.map (fun t -> t.Name)
    |> List.ofArray
    |> should be Empty

// ═══ 5. Every declaration in this assembly is internally consistent ═══

[<Fact>]
let ``git declarations are internally consistent with their own evidence`` () =
    let violations = gitProfiles () |> List.collect ErasureClass.inconsistencies

    if not (List.isEmpty violations) then
        failwith (String.Join(Environment.NewLine, violations))
