namespace Zeta.Tests.Support

open System
open System.Globalization
open System.Text.Json

/// Emit one machine-readable observation per perf assertion, on EVERY run — pass or fail.
///
/// WHY THE PASSES MATTER, and why this is not a failure logger. `perf-regression-ledger.ts` splits
/// a **flake** (an isolated miss among passes — the machine) from a **regression** (a sustained
/// miss — the code), and neither number means anything without a denominator. Emitting only on
/// failure would hand the ledger a numerator over an unknown total, which is the same defect as
/// counting failures on a `main` where most runs never finished. So every observation is emitted,
/// and a `clean` verdict is then a measured statement rather than an absence of complaints.
///
/// WHAT IS DELIBERATELY *NOT* ENROLLED. Only wall-clock ratio assertions belong here. Measured
/// 2026-08-27, the repository contains exactly **two**:
///
///     Storage/ColumnLinearOps.Tests.fs:618   speedup >= gate   (1.15 Debug / 1.5 Release)
///     Storage/ColumnZSet.Tests.fs:302        speedup >= 1.5
///
/// A wider grep suggested six files, and the other four were prose or deterministic assertions:
/// `Differentiate` asserts numerical CONVERGENCE ("faster than naive"), `ReceiptScheduler` asserts
/// a computed profit multiplier, and two were comments. Enrolling those would be actively harmful,
/// not merely noisy: a deterministic assertion cannot flake, so every row it contributed would be a
/// guaranteed pass inflating the denominator — **understating the flake rate of the assertions that
/// genuinely are timing-sensitive.** The ledger's denominator must be timing-sensitive
/// observations only.
///
/// `pass` is a PARAMETER, never re-derived from `measured` vs `gate`. The direction of the
/// comparison lives in the assertion — this repository holds lower-bound gates (speedup >= x) and
/// upper-bound ones (allocations <= n) — and re-deriving it here would invent misses in every
/// upper-bound test. The caller passes the same boolean it asserts on.
[<RequireQualifiedAccess>]
module PerfObservation =

    /// The sentinel `parsePerfObservations` scans for. Must match `PERF_OBS_PREFIX` in
    /// `src/Core.TypeScript/ci/perf-regression-ledger.ts`; `PerfObservation.Tests.fs` pins that.
    [<Literal>]
    let Prefix = "##perf-obs "

    /// An environment value, or a stated fallback. Never an empty string — the ledger's boundary
    /// check refuses those, and a row silently dropped there is a denominator quietly shrinking.
    let private envOr (name: string) (fallback: string) =
        match Environment.GetEnvironmentVariable name with
        | null -> fallback
        | "" -> fallback
        | v -> v

    /// Build the line. Separated from `emit` so a test can assert the bytes without capturing
    /// stdout — a helper whose only observable effect is a `printfn` is a helper nothing can check.
    let line (test: string) (metric: string) (measured: float) (gate: float) (pass: bool) =
        // Release and Debug carry DIFFERENT thresholds for the same assertion (the JIT optimises
        // both paths in Release and neither in Debug, which compresses the ratio), so the config is
        // part of the ledger's key. Folding them together would average two different questions.
#if DEBUG
        let config = "Debug"
#else
        let config = "Release"
#endif
        // `runner` because a wall-clock ratio is a claim about HARDWARE. A miss confined to one
        // runner label is a hardware clue; without it the ledger cannot tell that from a code
        // regression.
        let runner = envOr "RUNNER_OS" (envOr "RUNNER_NAME" "local")
        let sha = envOr "GITHUB_SHA" "local"
        let payload =
            dict [
                "test", box test
                "metric", box metric
                "measured", box measured
                "gate", box gate
                "pass", box pass
                "config", box config
                "runner", box runner
                // The observation's own instant. Round-trip ("O") so `Date.parse` on the reading
                // side never has to guess a format, and UTC so two runners are comparable.
                "at", box (DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture))
                "sha", box sha
            ]
        // Serialised rather than string-concatenated: test names in this repository contain spaces,
        // commas, quotes and backticks, and a hand-built line would emit unparseable JSON for the
        // very assertions most worth recording.
        Prefix + JsonSerializer.Serialize(payload)

    /// Print the observation. Call from the assertion site, with the same `pass` it asserts on.
    /// Where the sink file goes, when one is asked for. Set by CI; unset locally, and unset means
    /// stdout only -- a developer running `dotnet test` should not have files appear.
    [<Literal>]
    let SinkEnvVar = "ZETA_PERF_OBS_FILE"

    /// Emit one observation: always to stdout, and additionally to `ZETA_PERF_OBS_FILE` when set.
    ///
    /// WHY A FILE AND NOT A PIPE. The first attempt at collecting these captured the test step's
    /// stdout with `tee`, which required `shell: bash` + `set -o pipefail` on every matrix leg.
    /// That BROKE BOTH WINDOWS LEGS on main (2026-08-27): Windows runners resolve `shell: bash` to
    /// Git Bash, and forcing it changed how the command line was interpreted on legs that had been
    /// using the default shell. Build passed, Test died in ~2 minutes -- a broken invocation, not
    /// broken tests.
    ///
    /// Writing the file HERE removes the shell from the problem entirely. The emitter already
    /// knows it is emitting; `File.AppendAllText` is platform-agnostic through .NET, and the
    /// workflow needs no `shell:`, no pipe, and no exit-status surgery on a step whose outcome is
    /// read downstream.
    ///
    /// APPEND, not write: every assertion across every test class emits into one file, and the
    /// collector folds the whole set. A failure to write is SWALLOWED -- a telemetry sink that can
    /// fail a test run would be worse than no telemetry, and stdout still carries the line, so the
    /// observation is not lost even when the file is.
    let emit (test: string) (metric: string) (measured: float) (gate: float) (pass: bool) =
        let rendered = line test metric measured gate pass
        Console.Out.WriteLine(rendered)
        match Environment.GetEnvironmentVariable SinkEnvVar with
        | null | "" -> ()
        | path ->
            try
                IO.File.AppendAllText(path, rendered + Environment.NewLine)
            with _ ->
                // Deliberately silent. See above: this must never be why a test run fails.
                ()
