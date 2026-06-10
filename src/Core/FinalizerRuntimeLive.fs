namespace Zeta.Core

/// **FinalizerRuntimeLive — the LIVE `IRuntimeEffects` (real git merge + RNS), wired SAFE and Core-pure.**
///
/// Implements the `FinalizerRuntime.IRuntimeEffects` seam with the *real* substrates — but under three
/// disciplines so it cannot misfire:
///
/// 1. **Core stays pure (no I/O here).** The only side-effect channel is an **injected** `CommandRunner`
///    (`string -> string`). Core never calls `Process.Start`; the *host* (an edge CLI / Dejan's runner)
///    supplies the real runner. Default = `dryRun` (executes nothing).
/// 2. **Gate-respecting merge, never force.** `MergeToMain` uses **`gh pr merge <pr> --auto --squash`**
///    semantics — **auto-merge that respects branch protection + CI gates** (it merges only when the gates
///    pass). It is NEVER a `git push … :main` / force / direct write. And it is **dry-run by default**
///    (`live = false` ⇒ logs intent, returns `false` = no merge); `live = true` only does anything if the
///    host also injected a real runner.
/// 3. **No crypto, no daemon spin-up here.** The RNS daemon (rnsd) + the governed ZetaId identity for
///    Reticulum destinations are **routed to Dejan (devops) + Nazar (security)** — NOT minted/spun here.
///    This module covers the git effect + the *shape* of the RNS exchange; the live RNS transport + crypto
///    is the host's, behind the same injected runner (detect `rnstatus`; graceful fallback to the
///    in-process medium).
///
/// So: the wiring is real and present, but **safe-by-default** — running the pure default produces an inert
/// (immediately-Stop) runtime; going live is an explicit, gated, host-supplied step. (DST-friendly: inject a
/// deterministic runner and it replays.)
module FinalizerRuntimeLive =

    /// The single I/O seam the HOST injects. `dryRun` is the safe default (no execution).
    type CommandRunner = string -> string

    /// The dry-run runner: executes nothing, returns "" (⇒ ReadTick yields a cold Stop tick; MergeToMain
    /// returns false). Safe default so the live effects are inert until a host opts in.
    let dryRun: CommandRunner = fun _ -> ""

    /// The success token the host returns from a real merge command.
    [<Literal>]
    let MergeOk = "ok"

    let private inv = System.Globalization.CultureInfo.InvariantCulture // culture-invariant (ordinal discipline)

    let private parseFloat (s: string) (d: float) : float =
        match System.Double.TryParse(s, System.Globalization.NumberStyles.Float, inv) with
        | true, v -> v
        | _ -> d

    let private parseBool (s: string) : bool =
        match System.Boolean.TryParse s with
        | true, v -> v
        | _ -> false

    /// Parse a tick from a git/metrics state line: "deltaU temperature bounded merged" (the host produces
    /// this via the injected runner). Lenient: empty/garbage → a cold (Temperature 0) tick ⇒ the finalizer
    /// Stops — the safe default under dry-run.
    let parseTick (line: string) : TickResult =
        let parts = line.Split([| ' '; '\t' |], System.StringSplitOptions.RemoveEmptyEntries)
        if parts.Length = 0 then
            { DeltaU = 0.0; Temperature = 0.0; Bounded = true; Merged = false }
        else
            { DeltaU = parseFloat parts.[0] 0.0
              Temperature = (if parts.Length > 1 then parseFloat parts.[1] 0.0 else 0.0)
              Bounded = (if parts.Length > 2 then parseBool parts.[2] else true)
              Merged = (parts.Length > 3 && parseBool parts.[3]) }

    /// Build the live `IRuntimeEffects`.
    ///  • `live`   — gates merges (false ⇒ dry-run, never merges).
    ///  • `runCmd` — the injected I/O seam (default `dryRun`; the host supplies the real one).
    ///  • `prFor`  — maps a tick to the PR number whose auto-merge IS the wave's merge-to-main.
    /// ReadTick reads git/metrics state via the runner; MergeToMain arms `gh pr merge --auto --squash`
    /// (gate-respecting) for the wave's PR, only when `live` AND the host runner reports `MergeOk`.
    let create (live: bool) (runCmd: CommandRunner) (prFor: int -> int) : FinalizerRuntime.IRuntimeEffects =
        { new FinalizerRuntime.IRuntimeEffects with
            member _.ReadTick n = parseTick (runCmd (sprintf "tick-state %d" n))
            member _.MergeToMain n =
                if not live then false // SAFE default: dry-run never merges
                else runCmd (sprintf "gh pr merge %d --auto --squash" (prFor n)) = MergeOk }
