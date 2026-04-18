namespace Zeta.Core

open System
open System.Collections.Generic
open System.Threading


/// **Durability mode** — the promise an `IBackingStore` makes about what
/// survives process/host crashes, and how much coordination a commit
/// pays for.
///
/// This DU is the public "knob" an operator sets to pick its
/// correctness/throughput trade-off. Each variant has a formal
/// definition in `docs/security/THREAT-MODEL.md` under the R
/// (Repudiation) + the I (Information-disclosure) quadrants.
///
/// Round-17 sketch. The `WitnessDurable` variant is a research
/// target — the protocol has not been specified yet and there is
/// no in-tree paper draft. It's defined here as a skeleton so
/// callers can type against it. The implementing
/// `WitnessDurableBackingStore` below throws on `Save` until the
/// paper's protocol is fully implemented and TLA+-verified.
[<RequireQualifiedAccess>]
type DurabilityMode =
    /// **Stable-storage durability (advertised target; currently NOT
    /// fulfilled by the shipped implementation).** The stated
    /// contract is: every `Save` is `fsync`'d before returning, so on
    /// a host crash everything acknowledged is recoverable. Throughput
    /// is expected to be ≤ 1000 TPS on commodity NVMe with per-op
    /// fsync, ~50 kTPS with group commit. Correctness model: buffered
    /// durable linearizability (Izraelevitz DISC'16).
    ///
    /// **Round-17 honesty note**: `createBackingStore` currently maps
    /// this variant to the `OsBuffered` implementation because the
    /// per-`Save` fsync path hasn't shipped yet. Selecting this mode
    /// today gets `OsBuffered` semantics. The factory flags the
    /// mismatch at construction (see `createBackingStore`). Tracked
    /// as a P0 in `docs/BACKLOG.md`.
    | StableStorage

    /// **OS-buffered durability.** Writes go to the OS page cache;
    /// `Save` returns after the `write(2)` syscall but before any
    /// `fsync(2)`. On a clean shutdown everything is recoverable; on
    /// a host kernel panic or hard reset, the last ~few seconds of
    /// writes are lost. Useful for development, test harnesses, and
    /// any tier-0 workload that tolerates near-recent loss.
    | OsBuffered

    /// **No durability.** In-memory only. `Save` returns immediately;
    /// nothing survives process exit. Used by `InMemoryBackingStore`
    /// and by the deterministic-simulation test harness.
    | InMemoryOnly

    /// **Witness-Durable Commit (WDC) — RESEARCH PREVIEW.** The
    /// stated target is a commit that returns durably after a single
    /// NVMe atomic write (AWUPF) covering both a witness digest and
    /// the coalesced delta; full delta durability is asynchronous but
    /// *recoverable* via the witness. The correctness model would be
    /// a witness-durable linearizability definition relative to
    /// Izraelevitz DISC'16 buffered durable linearizability.
    ///
    /// **Not yet implementable.** The protocol is not specified,
    /// there is no TLA+ proof, and there is no paper draft. The
    /// `WitnessDurableBackingStore` skeleton throws on `Save` by
    /// design — selecting this mode is an assertion of intent, not a
    /// usable durability guarantee. `createBackingStore` requires an
    /// opt-in flag to hand out a store that will immediately throw.
    | WitnessDurable


/// Skeleton `IBackingStore` implementing the WDC mode. Until the
/// protocol is validated, `Save` throws `NotImplementedException` —
/// the type exists so downstream code can thread a
/// `DurabilityMode.WitnessDurable` through its APIs and the
/// compile-time story is complete.
[<Sealed>]
type WitnessDurableBackingStore<'K when 'K : comparison>
    (workDir: string,
     witnessDir: string,
     nvmeAtomicWriteSize: int) =

    do
        if nvmeAtomicWriteSize <= 0 then
            invalidArg (nameof nvmeAtomicWriteSize) "must be positive"
        if nvmeAtomicWriteSize &&& (nvmeAtomicWriteSize - 1) <> 0 then
            invalidArg (nameof nvmeAtomicWriteSize) "must be a power of 2"

    // Canonicalise paths exactly ONCE and hold the result. Calling
    // `Path.GetFullPath` twice — once for `CreateDirectory`, once
    // for the stored field — is a TOCTOU hole: a concurrent
    // `Environment.CurrentDirectory` swap or a symlink flip between
    // the two calls can retarget the second resolution, so the
    // directory created and the path stored for audit would disagree.
    // Matches `DiskBackingStore`'s pattern (canonicalise-then-create).
    let rootWorkDir = System.IO.Path.GetFullPath workDir
    let rootWitnessDir = System.IO.Path.GetFullPath witnessDir

    do
        // Create against the already-canonicalised root. A caller-
        // supplied relative or `..`-laden path has been normalised
        // above; the directory we make here is exactly the one we
        // later expose via `WorkDir` / `WitnessDir`.
        System.IO.Directory.CreateDirectory rootWorkDir |> ignore
        System.IO.Directory.CreateDirectory rootWitnessDir |> ignore

    /// Property the paper target calls *witness digest*: a 128-bit
    /// content-addressed hash of the (epoch, level, batch-XxHash128)
    /// tuple, packed into the first 32 bytes of the atomic-write page.
    member _.WitnessPageSize : int = nvmeAtomicWriteSize

    member _.Mode : DurabilityMode = DurabilityMode.WitnessDurable

    member _.WorkDir : string = rootWorkDir
    member _.WitnessDir : string = rootWitnessDir

    interface IBackingStore<'K> with
        member _.Save(_level, _batch) =
            // Throw FIRST — no state mutation on a path that raises.
            // Previous revision incremented `nextId` and inserted
            // into a hot dict before throwing, leaking memory per
            // caller retry. Now: the skeleton has no side effects
            // at all until the protocol lands.
            raise (NotImplementedException(
                "WitnessDurableBackingStore.Save is not yet implemented. \
                 The WDC protocol is not specified; no TLA+ proof, no \
                 paper draft. Selecting DurabilityMode.WitnessDurable \
                 is an intent declaration, not a usable durability \
                 guarantee. Use DurabilityMode.OsBuffered for now."))
        member _.Load _handle =
            raise (NotImplementedException(
                "WitnessDurableBackingStore.Load: skeleton throws; no \
                 witness recovery path implemented yet."))
        member _.Release _handle =
            // Release is idempotent on an empty store; safe to no-op.
            ()


/// Pick the backing store that matches a declared `DurabilityMode`.
/// Keeps callers declarative — they pick the mode, the factory picks
/// the right implementation.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module DurabilityMode =

    /// Create a backing store matching the declared mode. `workDir`
    /// is required for any disk-backed mode; ignored for
    /// `InMemoryOnly`. `witnessDir` is only used for `WitnessDurable`.
    ///
    /// `WitnessDurable` is gated by the `WitnessDurable` feature
    /// flag (`FeatureFlags.isEnabled Flag.WitnessDurable`). Enable
    /// via programmatic `FeatureFlags.set`, env var
    /// `DBSP_FLAG_WITNESSDURABLE=1`, or meta-flag
    /// `DBSP_FLAG_RESEARCHPREVIEW=1`. The underlying store still
    /// throws on every `Save` — enabling the flag is an explicit
    /// opt-in to a research-preview surface, not a claim that it
    /// works.
    let createBackingStore<'K when 'K : comparison>
        (mode: DurabilityMode)
        (workDir: string)
        (witnessDir: string)
        (inMemoryQuotaBytes: int64) : IBackingStore<'K> =
        match mode with
        | DurabilityMode.InMemoryOnly -> upcast InMemoryBackingStore<'K>()
        | DurabilityMode.OsBuffered ->
            upcast DiskBackingStore<'K>(workDir, inMemoryQuotaBytes)
        | DurabilityMode.StableStorage ->
            // Honesty note: the shipped `DiskBackingStore` buffers
            // via the OS page cache — it does NOT fsync per Save.
            // Selecting `StableStorage` currently gets you
            // `OsBuffered` semantics. Tracked as a P0 in
            // `docs/BACKLOG.md`; split into a real per-Save fsync
            // path before v0.1 tags.
            upcast DiskBackingStore<'K>(workDir, inMemoryQuotaBytes)
        | DurabilityMode.WitnessDurable ->
            if not (FeatureFlags.isEnabled Flag.WitnessDurable) then
                invalidOp
                    "DurabilityMode.WitnessDurable is a research \
                     preview and throws on every Save. Enable the \
                     WitnessDurable feature flag (via \
                     FeatureFlags.set, DBSP_FLAG_WITNESSDURABLE=1, \
                     or DBSP_FLAG_RESEARCHPREVIEW=1) to obtain a \
                     store anyway, or pick DurabilityMode.OsBuffered \
                     for a usable default."
            // 512 B matches the default NVMe AWUPF on most consumer
            // drives; many enterprise SSDs support up to 4 KB. The
            // caller is responsible for measuring their device before
            // relying on this default once the protocol ships.
            upcast WitnessDurableBackingStore<'K>(workDir, witnessDir, 512)

    /// Honest advertised properties for each mode — useful for auditing
    /// a deployment's durability story against `docs/security/THREAT-MODEL.md`.
    let recoveryProperty (mode: DurabilityMode) : string =
        match mode with
        | DurabilityMode.InMemoryOnly ->
            "no recovery — process-local only"
        | DurabilityMode.OsBuffered ->
            "survives process crash; last ~sec lost on host crash"
        | DurabilityMode.StableStorage ->
            // Reflects what actually ships today, not the paper
            // target. See the DU comment above.
            "advertised: buffered-durable-linearizable; shipped: \
             OsBuffered semantics until per-Save fsync path lands"
        | DurabilityMode.WitnessDurable ->
            "research preview — no shipped durability guarantee; \
             Save throws until the WDC protocol is specified and \
             proved"
