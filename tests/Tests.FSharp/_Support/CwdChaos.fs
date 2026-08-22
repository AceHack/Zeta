namespace Zeta.Tests.Support

open System
open System.Diagnostics
open System.IO
open System.Threading


// ═══════════════════════════════════════════════════════════════════
// CWD chaos — a DECLARED, SEEDED fault-injection channel.
//
// ┌────────────────────────────────────────────────────────────────┐
// │ BLAST RADIUS: `Environment.CurrentDirectory` is PROCESS-GLOBAL │
// │ (a `chdir(2)`). While a session runs, EVERY thread in the test │
// │ process sees the churned directory, and every child process    │
// │ spawned WITHOUT an explicit `WorkingDirectory` INHERITS it —   │
// │ including one spawned by an unrelated test. When the session's │
// │ directories are then deleted, that child's cwd becomes an      │
// │ unlinked inode and `getcwd(2)` fails.                          │
// └────────────────────────────────────────────────────────────────┘
//
// WHY THIS EXISTS AS A CHANNEL RATHER THAN A LOOSE THREAD.
// The churn itself is legitimate and valuable: it is fault injection
// (DST / chaos testing), and it is what proves
// `WitnessDurableBackingStore` canonicalises a relative path exactly
// once. What was NOT legitimate was the shape it used to have — a raw
// background `Thread` flipping at whatever rate the OS scheduler gave
// it, `with _ -> ()` swallowing every failure, and nothing anywhere
// declaring that the mutation was process-global. On 2026-08-14 that
// hidden channel surfaced as a JVM crash in
// `Zeta.Tests.Formal.AlloyRunnerTests` on an unrelated PR (#10757):
//
//     java.lang.Error: Properties init: Could not determine current
//     working directory.
//         at jdk.internal.util.SystemProps$Raw.platformProperties
//
// So the channel is kept and made legible instead of removed:
//   * SEEDED   — the flip SEQUENCE is a pure function of the seed
//                (`schedule`), so a run is replayable on demand.
//   * METERED  — a session reports flips applied and failures caught;
//                nothing is swallowed silently.
//   * DECLARED — the blast radius is named here, and membership of it
//                is opt-in via the `cwd-chaos` xunit collection rather
//                than by parallel-scheduling luck.
//
// HONEST LIMIT — read this before trusting the word "deterministic".
// The seed fixes WHICH directories are visited and IN WHAT ORDER. It
// does NOT fix the interleaving between the churner thread and the
// system under test; that is still the OS scheduler's to decide, and
// no seed reproduces it. `schedule` is replayable; the race is not.
// Claiming otherwise would be the vacuity failure this repo names
// elsewhere — a check that cannot fail is not a check.
//
// Anchors (Beacon): FoundationDB deterministic simulation / BUGGIFY
// (Zhou et al., SIGMOD 2021; Will Wilson, Strange Loop 2014) — the
// house implementation is `src/Core/ChaosEnv.fs`, whose SplitMix64
// generator this module reuses so the two chaos surfaces draw from
// the same arithmetic. Goguen–Meseguer (1982) noninterference — the
// discipline this module restores: influence crosses through a
// declared, metered channel, never ambiently.
// ═══════════════════════════════════════════════════════════════════


/// What a churn session did. Returned by `CwdChaos.run`, so a test can
/// assert the chaos ACTUALLY RAN rather than assume it did.
type CwdChurnReport =
    { /// The seed the flip sequence was drawn from — quote this to replay.
      Seed: int64
      /// How many `Environment.CurrentDirectory` assignments were applied.
      Flips: int
      /// How many assignments threw. Previously swallowed by `with _ -> ()`.
      Failures: int
      /// The first failure's message, kept so a churner that silently
      /// stopped working is visible instead of reading as a clean run.
      FirstFailure: string option }


[<RequireQualifiedAccess>]
module CwdChaos =

    /// xunit collection name for every test that either DRIVES CWD chaos
    /// or deliberately runs INSIDE its blast radius.
    ///
    /// `DisableParallelization = true` on the collection is not here to
    /// dodge a flake — it is the scheduling half of the declaration.
    /// Process-global mutation has no scope smaller than the process, so
    /// the only way a test can be outside the blast radius is for nothing
    /// else to be running. Tests that WANT to be inside it join this
    /// collection on purpose.
    [<Literal>]
    let CollectionName = "cwd-chaos"

    /// SplitMix64 — the same generator and constants as
    /// `Zeta.Core.Buggify` / `ChaosEnvironment` in `src/Core/ChaosEnv.fs`.
    let private splitMix (state: byref<int64>) : int64 =
        state <- state + 0x9E3779B97F4A7C15L
        let mutable z = state
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
        z ^^^ (z >>> 31)

    /// The replayable half of the chaos: the sequence of target indices
    /// this seed churns through, as a PURE function of `(seed, steps,
    /// targetCount)`. Same seed ⇒ same list, on every machine and every
    /// run. That is what "seeded" buys here — not a reproducible race, a
    /// reproducible schedule.
    ///
    /// Consecutive entries always DIFFER. A uniform draw would repeat a
    /// target roughly `1/targetCount` of the time, and a repeat is a
    /// no-op `chdir` — that would have quietly halved the churn rate
    /// against the hand-rolled A/B alternation this replaced, i.e. less
    /// fault injection wearing a better-engineered coat. The draw
    /// therefore selects an OFFSET into the other targets.
    let schedule (seed: int64) (steps: int) (targetCount: int) : int list =
        if targetCount <= 0 then
            invalidArg "targetCount" "need at least one churn target"
        if steps < 0 then invalidArg "steps" "steps must be non-negative"
        let mutable state = seed
        let mutable prev = 0
        let acc = ResizeArray<int>(max steps 0)
        for _ in 1 .. steps do
            let draw = splitMix &state
            let next =
                if targetCount = 1 then 0
                else
                    let offset = int ((draw &&& 0x7FFF_FFFFL) % int64 (targetCount - 1))
                    (prev + 1 + offset) % targetCount
            prev <- next
            acc.Add next
        List.ofSeq acc

    /// How many schedule steps a session draws before cycling.
    [<Literal>]
    let ScheduleSteps = 256

    /// A running churn session: a background thread assigning
    /// process-global CWD along the seeded schedule until `Stop`.
    type private Session(seed: int64, targets: string[], plan: int list) =

        let stop = ref 0
        let gate = obj ()
        let mutable flips = 0
        let mutable failures = 0
        let mutable firstFailure : string option = None
        let mutable stopped = false
        let mutable final = Unchecked.defaultof<CwdChurnReport>

        let thread =
            Thread(fun () ->
                // Cycle the seeded schedule until asked to stop, so the
                // session's LENGTH is wall-clock-bound (the system under
                // test decides that) while its CONTENT is seed-bound.
                let mutable rest = plan
                while Volatile.Read(&stop.contents) = 0 do
                    match rest with
                    | [] -> rest <- plan
                    | idx :: tail ->
                        rest <- tail
                        try
                            Environment.CurrentDirectory <- targets.[idx]
                            lock gate (fun () -> flips <- flips + 1)
                        with ex ->
                            // METERED, not swallowed: the old code's
                            // `with _ -> ()` made a churner that had
                            // stopped churning indistinguishable from
                            // one that was working.
                            lock gate (fun () ->
                                failures <- failures + 1
                                if firstFailure.IsNone then
                                    firstFailure <- Some ex.Message))

        do
            thread.IsBackground <- true
            thread.Start()

        /// Idempotent (discipline #6): calling `Stop` twice returns the
        /// same report and joins the thread once.
        member _.Stop() : CwdChurnReport =
            if not stopped then
                stopped <- true
                Volatile.Write(&stop.contents, 1)
                thread.Join()
                final <-
                    lock gate (fun () ->
                        { Seed = seed
                          Flips = flips
                          Failures = failures
                          FirstFailure = firstFailure })
            final

    /// Run `body` while process-global CWD churns across `targets` on the
    /// schedule drawn from `seed`. Restores the caller's CWD before
    /// returning, whether `body` threw or not.
    ///
    /// CALLER OBLIGATION: every entry of `targets` must exist for the
    /// whole call and must NOT be deleted until after this function
    /// returns — a subprocess `body` spawned without an explicit
    /// `WorkingDirectory` will have inherited one of them.
    let run (seed: int64) (targets: string[]) (body: unit -> 'a) : 'a * CwdChurnReport =
        if Array.isEmpty targets then
            invalidArg "targets" "need at least one churn target"
        for t in targets do
            if not (Directory.Exists t) then
                invalidArg "targets" (sprintf "churn target does not exist: %s" t)
        let originalCwd = Environment.CurrentDirectory
        let session = Session(seed, targets, schedule seed ScheduleSteps targets.Length)
        try
            try
                let result = body ()
                result, session.Stop()
            finally
                // Idempotent — a no-op when the success path already stopped.
                session.Stop() |> ignore
        finally
            // Restore BEFORE the caller's cleanup deletes any target.
            Environment.CurrentDirectory <- originalCwd


/// Subprocess spawning with a DECLARED working directory.
///
/// A `ProcessStartInfo` whose `WorkingDirectory` is left empty makes the
/// child inherit the parent's process-global CWD *at fork time* — an
/// ambient channel, in the sense of discipline #7 (noninterference). A
/// test elsewhere in the process can move that directory out from under
/// the child, and a child that resolves its own cwd during startup (any
/// JVM does, in `SystemProps$Raw.platformProperties`) then dies before
/// `main`.
///
/// Making `workingDirectory` a required parameter turns that ambient
/// input into a declared one. Verified: with the assignment below the
/// `subprocess spawned under seeded CWD churn survives …` test passes;
/// remove it and that test fails, which is what makes it a falsifier
/// rather than a passing assertion.
[<RequireQualifiedAccess>]
module Subprocess =

    /// Build a redirected, non-shell `ProcessStartInfo` that names where
    /// the child will run. Prefer this over a bare `ProcessStartInfo()`
    /// anywhere a test spawns a process.
    let startInfo (fileName: string) (workingDirectory: string) : ProcessStartInfo =
        if String.IsNullOrWhiteSpace workingDirectory then
            invalidArg "workingDirectory"
                "a subprocess must declare its working directory — inheriting \
                 the ambient process CWD is the hazard this helper exists to close"
        let psi = ProcessStartInfo()
        psi.FileName <- fileName
        psi.WorkingDirectory <- workingDirectory
        psi.RedirectStandardOutput <- true
        psi.RedirectStandardError <- true
        psi.UseShellExecute <- false
        psi


/// xunit collection binding for `CwdChaos.CollectionName`. Serialised
/// against every other collection because the mutation it drives is
/// process-global and therefore has no smaller scope.
[<Xunit.CollectionDefinition(CwdChaos.CollectionName, DisableParallelization = true)>]
type CwdChaosCollection() =
    class end
