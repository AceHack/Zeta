module Zeta.Tests.DeterminismLintTests

// THE DETERMINISM LINT (Aaron 2026-06-12: "are we using `pure` in F# everywhere so the compiler
// checks deterministic simulation?"). The honest answer: F# has no `pure` — no effect system, no
// compiler enforcement; immutability is a default, not a guarantee. This test is the enforcement
// we CAN have at build time: every source of ambient nondeterminism in src/Core must be either
// ABSENT or on the allowlist below with a WHY (a named edge). A new unseeded Random / wall clock /
// NewGuid / Stopwatch in Core fails the build — the lint is the `pure` we get to write ourselves.
// (The behavioral half of enforcement stays where it always was: DST replay + golden vectors.)

open System.IO
open global.Xunit

let private repoRoot () =
    let mutable dir = DirectoryInfo(System.AppContext.BaseDirectory)
    while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent
    dir.FullName

/// The banned ambient-entropy patterns (substring match per line, comments included on purpose —
/// a commented-out wall clock is a wall clock waiting to return).
let private banned =
    [ "Guid.NewGuid"; "DateTime.Now"; "DateTime.UtcNow"; "DateTimeOffset.Now"; "DateTimeOffset.UtcNow"
      "Random.Shared"; "new Random()"; "System.Random()"; "Stopwatch.StartNew"; "Stopwatch.GetTimestamp"
      "Environment.TickCount" ]

/// The NAMED EDGES: (file, pattern) pairs allowed to exist, each with its why. Adding a new edge
/// means adding a row HERE, with a reason a reviewer can refuse.
let private allowlist =
    [ // the wall-clock door itself: the ONE place ambient time/entropy is abstracted behind IEnvironment
      "Environment.fs", "DateTime.UtcNow", 1, "the docstring NAMES the ambient sources this interface fences off"
      "Environment.fs", "Guid.NewGuid", 2, "the ambient implementation of IEnvironment.NewGuid — the fenced door"
      "Environment.fs", "Random.Shared", 3, "docstring reference to what is being fenced"
      "Environment.fs", "Environment.TickCount", 1, "the ambient implementation of IEnvironment.Ticks"
      // seeded by construction: System.Random(seed + i) — deterministic per seed, the LawRunner contract
      "LawRunner.fs", "System.Random(", 3, "every instance is seeded (seed + sampleIndex); reproducible by design"
      // IO-infrastructure edges: temp-file / instance names (affect disk layout, never logical state)
      "Checkpoint.fs", "Guid.NewGuid", 1, "tmp-file suffix for atomic rename — IO edge, not logical state"
      // interactive-edge convenience overload, documented as non-replayable; seeded overload exists
      "Crdt.fs", "Guid.NewGuid", 2, "OrSet.Add ambient overload — documented wall-clock edge; the seeded Add(elem, tag) is the DST path"
      // the ambient wall-clock EDGES of consensus (the DST paths are transitionAt/prToVoteAt)
      "Consensus.fs", "DateTimeOffset.UtcNow", 4, "two documented ambient wrappers (transition/prToVote) + their two doc-comment mentions; injected -At variants are the DST paths"
      "Environment.fs", "DateTimeOffset.UtcNow", 1, "the ambient implementation of IEnvironment.Now — the fenced door"
      "Injection.fs", "DateTimeOffset.UtcNow", 2, "wall-time instrumentation at the injection edge — observability only"
      // timing instrumentation at the injection boundary (observability, not logic)
      "Injection.fs", "Stopwatch.StartNew", 1, "wall-time instrumentation at the injection edge — observability only"
      // oracle wall-clock edges (added 2026-07-31, shadow): the pre-existing main-wide determinism-lint red.
      // DebouncedOracle's DST branch was FIXED (it read ambient UtcNow despite the docstring; now a pump-tick
      // counter) — this row is only its live-mode door. Transport/velocity uses are live-emit metadata +
      // latency instrumentation; verified none feed the rho/Condorcet math, none run on the DST/seed path.
      "DebouncedOracle.fs", "DateTime.UtcNow", 1, "live-mode debounce rate-control door (local timing, not shared-fold evidence); the SyncContext=Some DST path uses a deterministic pump-tick counter"
      "OracleTransport.fs", "DateTimeOffset.UtcNow", 7, "reading-timestamp display metadata (1) + emit-latency instrumentation in GitFileDropTransport/WebSocketTransport/SimulatedReticulumLatencyTransport (6); observability only, live-emit path never DST — the rho/Condorcet math uses none of it"
      "MoneyVelocityOracle.fs", "DateTimeOffset.UtcNow", 1, "reading-timestamp display field; rho/bonus/velocity are computed from UTXO age + M2, not the timestamp — observability only" ]

[<Fact>]
let ``THE DETERMINISM LINT: no ambient entropy in src/Core outside the named, justified edges`` () =
    let core = Path.Combine(repoRoot (), "src", "Core")
    let violations =
        [ for file in Directory.GetFiles(core, "*.fs") do
              let name = Path.GetFileName file
              let lines = File.ReadAllLines file
              for i in 0 .. lines.Length - 1 do
                  for pat in banned do
                      if lines.[i].Contains pat then
                          let allowed = allowlist |> List.exists (fun (f, p, _, _) -> f = name && p = pat) // exact rows only (the old contains-disjunct excused pattern Y on any line mentioning X)
                          if not allowed then
                              yield sprintf "%s:%d uses '%s' — ambient entropy in Core; seed it, fence it behind IEnvironment, or add a justified allowlist row" name (i + 1) pat ]
    Assert.True(List.isEmpty violations, String.concat "\n" violations)

[<Fact>]
let ``the allowlist pins EXACT occurrence counts — a third wall clock cannot slide in behind two justified ones`` () =
    let core = Path.Combine(repoRoot (), "src", "Core")
    for (file, pat, expected, _why) in allowlist do
        let path = Path.Combine(core, file)
        Assert.True(File.Exists path, file + " vanished — remove its allowlist rows")
        let actual =
            File.ReadAllLines path
            |> Array.sumBy (fun (l: string) ->
                let mutable c = 0
                let mutable i = l.IndexOf(pat)
                while i >= 0 do
                    c <- c + 1
                    i <- l.IndexOf(pat, i + 1)
                c)
        Assert.True((actual = expected), sprintf "%s: '%s' occurs %d times, allowlist pins %d — justify the new edge with a count bump and a WHY, or remove the stale row" file pat actual expected)
