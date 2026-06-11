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
      "Environment.fs", "DateTime.UtcNow", "the docstring NAMES the ambient sources this interface fences off"
      "Environment.fs", "Guid.NewGuid", "the ambient implementation of IEnvironment.NewGuid — the fenced door"
      "Environment.fs", "Random.Shared", "docstring reference to what is being fenced"
      "Environment.fs", "Environment.TickCount", "the ambient implementation of IEnvironment.Ticks"
      // seeded by construction: System.Random(seed + i) — deterministic per seed, the LawRunner contract
      "LawRunner.fs", "System.Random(", "every instance is seeded (seed + sampleIndex); reproducible by design"
      // IO-infrastructure edges: temp-file / instance names (affect disk layout, never logical state)
      "Checkpoint.fs", "Guid.NewGuid", "tmp-file suffix for atomic rename — IO edge, not logical state"
      "DiskSpine.fs", "Guid.NewGuid", "per-instance disk prefix — IO edge, not logical state"
      "DiskSpineAsync.fs", "Guid.NewGuid", "per-instance disk prefix — IO edge, not logical state"
      // interactive-edge convenience overload, documented as non-replayable; seeded overload exists
      "Crdt.fs", "Guid.NewGuid", "OrSet.Add ambient overload — documented wall-clock edge; the seeded Add(elem, tag) is the DST path"
      // the ambient wall-clock EDGES of consensus (the DST paths are transitionAt/prToVoteAt)
      "Consensus.fs", "DateTimeOffset.UtcNow", "two documented ambient wrappers (transition/prToVote); injected -At variants are the DST paths"
      "Environment.fs", "DateTimeOffset.UtcNow", "the ambient implementation of IEnvironment.Now — the fenced door"
      "Injection.fs", "DateTimeOffset.UtcNow", "wall-time instrumentation at the injection edge — observability only"
      // timing instrumentation at the injection boundary (observability, not logic)
      "Injection.fs", "Stopwatch.StartNew", "wall-time instrumentation at the injection edge — observability only" ]

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
                          let allowed = allowlist |> List.exists (fun (f, p, _) -> f = name && pat.StartsWith p || (f = name && lines.[i].Contains p))
                          if not allowed then
                              yield sprintf "%s:%d uses '%s' — ambient entropy in Core; seed it, fence it behind IEnvironment, or add a justified allowlist row" name (i + 1) pat ]
    Assert.True(List.isEmpty violations, String.concat "\n" violations)

[<Fact>]
let ``the allowlist rows all still exist — a stale exemption is a hole waiting for a new occupant`` () =
    let core = Path.Combine(repoRoot (), "src", "Core")
    for (file, pat, _why) in allowlist do
        let path = Path.Combine(core, file)
        Assert.True(File.Exists path, file + " vanished — remove its allowlist rows")
        let contains = (File.ReadAllText path).Contains pat
        Assert.True(contains, sprintf "%s no longer contains '%s' — remove the stale allowlist row" file pat)
