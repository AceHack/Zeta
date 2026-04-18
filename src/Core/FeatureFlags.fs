namespace Zeta.Core

open System
open System.Collections.Concurrent


/// Lifecycle stage of a feature flag.
///
/// - **Experimental** — the implementation may change shape at any
///   time; consumers opting in knowingly accept churn.
/// - **ResearchPreview** — the API is stable enough that opt-in
///   callers can wire it in, but the semantics may still shift (e.g.
///   correctness proofs outstanding). Meta-flag `researchPreview`
///   composes all `ResearchPreview`-stage flags at once.
/// - **Stable** — the flag has graduated. At this point the flag is
///   usually retired (removed) after one release in which it is a
///   warning-only no-op.
[<RequireQualifiedAccess>]
type FlagStage =
    | Experimental
    | ResearchPreview
    | Stable


/// Every feature flag defined by `Zeta.Core`. Flags are named
/// deliberately narrowly — each corresponds to exactly one
/// feature gate. Umbrella toggles are discouraged; prefer one flag
/// per feature with the `researchPreview` meta-flag for composition.
///
/// Naming: camelCase identifiers, no dots, no scope prefix. Match
/// the DU variant / type name the flag gates when one exists.
[<RequireQualifiedAccess>]
type Flag =
    /// Gates `DurabilityMode.WitnessDurable`. The underlying
    /// backing store still throws on every `Save` until the WDC
    /// protocol is specified and proven; the flag is here so
    /// `DurabilityMode.createBackingStore` can surface the opt-in
    /// explicitly rather than via an ad-hoc boolean parameter.
    | WitnessDurable

    /// Gates `RecursiveCounting` / `CountingClosureTable`. The
    /// counting-algorithm LFP variant is shipped in Zeta.Core;
    /// the flag lets cautious callers continue to use `Recursive`
    /// / `ClosureTable` only.
    | CountingSemiNaive

    /// Reserved for the signed-delta ("gap-monotone") semi-naïve
    /// combinator (`RecursiveSignedSemiNaive`) — research plan in
    /// `docs/research/retraction-safe-semi-naive.md`. Not yet
    /// implemented; the flag exists so callers can see the gate
    /// name ahead of the landing.
    | SignedSemiNaive

    /// Reserved for the Counting Quotient Filter replacement of
    /// `CountingBloomFilter`. Not yet implemented; see
    /// `docs/research/bloom-filter-frontier.md`.
    | CqfCountingFilter


/// Feature-flag evaluation. Offline-safe by construction: never
/// reads the network, never fetches a config file the caller did
/// not hand us, no centralised server.
///
/// Resolution order (first match wins):
/// 1. **Programmatic override** via `FeatureFlags.set`.
/// 2. **Per-flag environment variable** — `DBSP_FLAG_<UPPER_SNAKE>`.
///    Accepts `1`, `true`, `on`, `yes` (case-insensitive); anything
///    else (including absent) is false.
/// 3. **Meta-flag** — `DBSP_FLAG_RESEARCHPREVIEW` enables every
///    flag whose stage is `ResearchPreview`. Does **not** enable
///    `Experimental`-stage flags (use the per-flag env var for
///    those).
/// 4. Default: off.
///
/// Contributors adding a new flag: add the case above, add the
/// stage mapping below, add the row in `docs/FEATURE-FLAGS.md`,
/// add a default-off test. The Spec Zealot will flag missing
/// documentation entries at review time.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module FeatureFlags =

    /// Stage classification for each flag. Update here when a flag
    /// graduates (`Experimental` → `ResearchPreview` → `Stable` →
    /// delete).
    let stage (flag: Flag) : FlagStage =
        match flag with
        | Flag.WitnessDurable -> FlagStage.ResearchPreview
        | Flag.SignedSemiNaive -> FlagStage.ResearchPreview
        | Flag.CountingSemiNaive -> FlagStage.Experimental
        | Flag.CqfCountingFilter -> FlagStage.Experimental

    /// Programmatic overrides (test harness / explicit opt-in in
    /// hosting code). Concurrent-safe; thread writes are visible to
    /// other threads' reads.
    let private overrides = ConcurrentDictionary<Flag, bool>()

    /// Canonical env-var name for a flag: `DBSP_FLAG_<UPPER_NAME>`.
    let private envName (flag: Flag) : string =
        let name =
            match flag with
            | Flag.WitnessDurable -> "WITNESSDURABLE"
            | Flag.CountingSemiNaive -> "COUNTINGSEMINAIVE"
            | Flag.SignedSemiNaive -> "SIGNEDSEMINAIVE"
            | Flag.CqfCountingFilter -> "CQFCOUNTINGFILTER"
        "DBSP_FLAG_" + name

    /// Interpret an env-var string as a boolean. `1`/`true`/`on`/`yes`
    /// are true; everything else (including absent) is false.
    let private envTrue (name: string) : bool =
        match Environment.GetEnvironmentVariable name with
        | null -> false
        | "" -> false
        | v ->
            match v.Trim().ToLowerInvariant() with
            | "1" | "true" | "on" | "yes" -> true
            | _ -> false

    /// Is the flag currently enabled? Follows the resolution order
    /// documented on the module.
    let isEnabled (flag: Flag) : bool =
        match overrides.TryGetValue flag with
        | true, v -> v
        | _ ->
            envTrue (envName flag)
            || (stage flag = FlagStage.ResearchPreview
                && envTrue "DBSP_FLAG_RESEARCHPREVIEW")

    /// Programmatically enable or disable a flag (typically from
    /// test code or hosting configuration). Overrides both env-var
    /// and meta-flag.
    let set (flag: Flag) (value: bool) : unit =
        overrides.[flag] <- value

    /// Remove a programmatic override, restoring env-var /
    /// meta-flag resolution for this flag.
    let reset (flag: Flag) : unit =
        overrides.TryRemove flag |> ignore

    /// Reset every programmatic override. Primarily for test
    /// harnesses that want a clean slate between cases.
    let resetAll () : unit =
        overrides.Clear()
