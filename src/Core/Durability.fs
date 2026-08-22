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
/// The `WitnessDurable` variant is a research
/// target — the protocol has not been specified yet and there is
/// no in-tree paper draft. It's defined here as a skeleton so
/// callers can type against it. The implementing
/// `WitnessDurableBackingStore` below throws on `Save` until the
/// paper's protocol is fully implemented and TLA+-verified.
[<RequireQualifiedAccess>]
type DurabilityMode =
    /// **Stable-storage durability — SHIPPED.** Every `Save` is `fsync`'d
    /// before returning, so on a host crash everything acknowledged is
    /// recoverable. Throughput is expected to be ≤ 1000 TPS on commodity
    /// NVMe with per-op fsync, ~50 kTPS with group commit. Correctness
    /// model: buffered durable linearizability (Izraelevitz DISC'16).
    ///
    /// The crash-consistent write protocol, per `Save`
    /// (`DiskSpine.writeAtomicFrame`, and the async twin in
    /// `DiskAsyncBackingStore`):
    ///
    ///   1. write the data frame, then `Flush(flushToDisk = true)`;
    ///   2. write the header frame, then `Flush(flushToDisk = true)`;
    ///   3. atomically `Move` the header onto the candidate path;
    ///   4. `FileSync.fsyncDir` the parent directory, so the *directory
    ///      entry* for a newly-created file is durable too — without this
    ///      a hard reset can lose a file whose contents were flushed.
    ///
    /// Data before header before rename is deliberate: a torn write can
    /// leave a data frame with no header (ignored on recovery), never a
    /// header pointing at absent data.
    ///
    /// **The one real gap: Windows.** `FileSync.fsyncDir` is a no-op on
    /// Windows (`FileSync.fs:41` — "documented gap, not an equivalence"),
    /// because there is no directory-fsync equivalent. Steps 1–3 still
    /// hold, so acknowledged *content* is durable; what is not guaranteed
    /// on Windows is the durability of the directory entry for a
    /// newly-created file across a hard reset. POSIX hosts get the full
    /// protocol.
    ///
    /// **Corrected 2026-08-10.** This doc comment previously carried an
    /// "honesty note" stating that `createBackingStore` mapped this
    /// variant to `OsBuffered` because the per-`Save` fsync path "hasn't
    /// shipped yet", that the factory flagged the mismatch, and that a P0
    /// tracked it. All three were stale: the factory passes
    /// `fsyncPerSave = true` (see `createBackingStore` below), the disk
    /// store honours it, no mismatch flagging exists in the factory, and
    /// no open P0 in `docs/BACKLOG.md` refers to it — the nearest item
    /// (081KR2E4K0008QG0R000ARCH0X) is closed. The note UNDER-claimed a
    /// guarantee that ships, which is its own hazard on a durability
    /// contract: an operator reading it would pick a weaker mode than
    /// they need, or rule the store out for a workload it can serve.
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

    /// **The declaration, beside the operations it classifies** (`ErasureClass`).
    ///
    /// The honest `Unmeasured` case. `Save` and `Load` raise `NotImplementedException`, so there
    /// is no representation to sweep: the operation has no fibres because it has no behaviour. It
    /// would be *easy* and wrong to record that as zero bits — an unimplemented durability mode
    /// would then show up in a ledger as the cheapest one available. `Unmeasured` is not a smaller
    /// number than `Reversible`; it is the absence of a number, and `ErasureClass.bitsErasedPpm`
    /// returns `None` here precisely so no fold can silently treat it as free.
    ///
    /// `Release` is a different matter: a no-op is the identity, which is genuinely measurable and
    /// genuinely reversible. Two operations on one type, two evidence kinds, no averaging.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "WitnessDurableBackingStore"
                Operation = "IBackingStore.Save"
                Observation = "the store's content function (Load over every live handle)"
                RecoveryChannel =
                    "undefined — the call raises before touching any state, so there is no \
                     post-state to compare a preimage against. The WDC protocol is unspecified; \
                     selecting this mode is an intent declaration, not a durability guarantee, and \
                     it is not a thermodynamic claim either"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "the operation raises NotImplementedException; an unimplemented operation has no fibres to sweep, and recording it as zero bits would make the least-finished durability mode look like the cheapest one" }

              { Representation = "WitnessDurableBackingStore"
                Operation = "IBackingStore.Load"
                Observation = "the store's content function (Load over every live handle)"
                RecoveryChannel = "undefined — the call raises; no witness recovery path is implemented"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "the operation raises NotImplementedException; there is nothing to sweep" }

              { Representation = "WitnessDurableBackingStore"
                Operation = "IBackingStore.Release"
                Observation = "the store's content function (Load over every live handle)"
                RecoveryChannel =
                    "everything, trivially — the call is a no-op over a store that can never hold \
                     anything. That is not a measurement, it is the absence of a domain to measure \
                     over, and the two must not be recorded the same way"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence = ErasureClass.Evidence.NoAdmissibleMeasurement "the store has exactly ONE reachable state, because Save raises before touching anything; a sweep of Release therefore has a one-point domain, and a one-point sweep cannot fail. Declaring it Reversible would be a vacuous pass wearing evidence's clothes, which is the defect this whole apparatus exists to refuse" } ]


/// Async sibling of `WitnessDurableBackingStore` — the WDC skeleton on the
/// `IAsyncBackingStore` surface. `SaveAsync`/`LoadAsync` throw until the WDC
/// protocol is specified + TLA+-proved; `ReleaseAsync` is a safe no-op.
[<Sealed>]
type WitnessDurableAsyncBackingStore<'K when 'K : comparison>
    (workDir: string, witnessDir: string, nvmeAtomicWriteSize: int) =
    do
        if nvmeAtomicWriteSize <= 0 then
            invalidArg (nameof nvmeAtomicWriteSize) "must be positive"
        if nvmeAtomicWriteSize &&& (nvmeAtomicWriteSize - 1) <> 0 then
            invalidArg (nameof nvmeAtomicWriteSize) "must be a power of 2"
    let rootWorkDir = System.IO.Path.GetFullPath workDir
    let rootWitnessDir = System.IO.Path.GetFullPath witnessDir
    do
        System.IO.Directory.CreateDirectory rootWorkDir |> ignore
        System.IO.Directory.CreateDirectory rootWitnessDir |> ignore

    member _.Mode : DurabilityMode = DurabilityMode.WitnessDurable
    member _.WorkDir : string = rootWorkDir
    member _.WitnessDir : string = rootWitnessDir
    member _.WitnessPageSize : int = nvmeAtomicWriteSize

    interface IAsyncBackingStore<'K> with
        member _.SaveAsync(_level, _batch, _ct) =
            raise (NotImplementedException(
                "WitnessDurableAsyncBackingStore.SaveAsync is not yet implemented. \
                 The WDC protocol is not specified; no TLA+ proof, no paper draft. \
                 Use DurabilityMode.StableStorage (async: fsync-per-save) or \
                 OsBuffered for now."))
        member _.LoadAsync(_handle, _ct) =
            raise (NotImplementedException(
                "WitnessDurableAsyncBackingStore.LoadAsync: skeleton throws; no \
                 witness recovery path implemented yet."))
        member _.ReleaseAsync(_handle, _ct) =
            // Release is idempotent on an empty store; safe to no-op.
            System.Threading.Tasks.ValueTask.CompletedTask

    /// **The declaration, beside the operations it classifies** (`ErasureClass`).
    /// Async twin of `WitnessDurableBackingStore`: the two throwing operations are `Unmeasured`,
    /// the no-op release is measurably `Reversible`.
    interface IErasureDeclaring with
        member _.ErasureProfiles =
            [ { Representation = "WitnessDurableAsyncBackingStore"
                Operation = "IAsyncBackingStore.SaveAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel = "undefined — the call raises before touching any state"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "the operation raises NotImplementedException; an unimplemented operation has no fibres to sweep, and zero would read as free" }

              { Representation = "WitnessDurableAsyncBackingStore"
                Operation = "IAsyncBackingStore.LoadAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel = "undefined — the call raises; no witness recovery path is implemented"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence =
                    ErasureClass.Evidence.NoAdmissibleMeasurement
                        "the operation raises NotImplementedException; there is nothing to sweep" }

              { Representation = "WitnessDurableAsyncBackingStore"
                Operation = "IAsyncBackingStore.ReleaseAsync"
                Observation = "the store's content function (LoadAsync over every live handle)"
                RecoveryChannel = "everything, trivially — a no-op over a store that can never hold anything"
                Classification = ErasureClass.ThermodynamicClass.Unmeasured
                Evidence = ErasureClass.Evidence.NoAdmissibleMeasurement "the store has exactly ONE reachable state, because Save raises before touching anything; a sweep of Release therefore has a one-point domain, and a one-point sweep cannot fail. Declaring it Reversible would be a vacuous pass wearing evidence's clothes, which is the defect this whole apparatus exists to refuse" } ]


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
    /// opt-in to a research-preview surface, not a claim that it works.
    let createBackingStore<'K when 'K : comparison>
        (mode: DurabilityMode)
        (workDir: string)
        (witnessDir: string)
        (inMemoryQuotaBytes: int64) : IBackingStore<'K> =
        match mode with
        | DurabilityMode.InMemoryOnly -> upcast InMemoryBackingStore<'K>()
        | DurabilityMode.OsBuffered ->
            upcast DiskBackingStore<'K>(workDir, inMemoryQuotaBytes, fsyncPerSave = false)
        | DurabilityMode.StableStorage ->
            upcast DiskBackingStore<'K>(workDir, inMemoryQuotaBytes, fsyncPerSave = true)
        | DurabilityMode.WitnessDurable ->
            if not (FeatureFlags.isEnabled Flag.WitnessDurable) then
                invalidOp
                    "WitnessDurable is gated: set DBSP_FLAG_WITNESSDURABLE=1 (docs/FEATURE-FLAGS.md), or use DurabilityMode.OsBuffered."
            // 512 B matches the default NVMe AWUPF on most consumer
            // drives; many enterprise SSDs support up to 4 KB. The
            // caller is responsible for measuring their device before
            // relying on this default once the protocol ships.
            upcast WitnessDurableBackingStore<'K>(workDir, witnessDir, 512)

    /// Async sibling of `createBackingStore` — picks an `IAsyncBackingStore`
    /// for the declared mode (genuine `File.*Async`, no `Task.Run` fakery).
    ///
    /// **`StableStorage` is honoured here**, by the same crash-consistent
    /// protocol as the sync path: data frame fsync → header frame fsync →
    /// atomic rename → parent-directory fsync
    /// (`DiskSpineAsync.fs:70-98`), with genuine `File.*Async` I/O.
    ///
    /// **Corrected 2026-08-10.** This comment previously said the sync
    /// `createBackingStore` maps `StableStorage` → OS-buffered, and that
    /// parent-dir fsync was "a documented follow-up" here. Both were stale:
    /// the sync path fsyncs per save (see `StableStorage` above) and BOTH
    /// stores fsync the parent directory. The only remaining gap is
    /// Windows, where `FileSync.fsyncDir` is a documented no-op.
    let createAsyncBackingStore<'K when 'K : comparison>
        (mode: DurabilityMode)
        (workDir: string)
        (witnessDir: string)
        (inMemoryQuotaBytes: int64) : IAsyncBackingStore<'K> =
        match mode with
        | DurabilityMode.InMemoryOnly -> upcast InMemoryAsyncBackingStore<'K>()
        | DurabilityMode.OsBuffered ->
            upcast DiskAsyncBackingStore<'K>(workDir, inMemoryQuotaBytes, fsyncPerSave = false)
        | DurabilityMode.StableStorage ->
            // The async path CAN fsync per save — so StableStorage is real here,
            // not aliased to OsBuffered. (See the factory doc comment for the
            // parent-dir-fsync follow-up caveat.)
            upcast DiskAsyncBackingStore<'K>(workDir, inMemoryQuotaBytes, fsyncPerSave = true)
        | DurabilityMode.WitnessDurable ->
            if not (FeatureFlags.isEnabled Flag.WitnessDurable) then
                invalidOp
                    "DurabilityMode.WitnessDurable is a research preview and \
                     throws on every Save. Enable the WitnessDurable feature \
                     flag (FeatureFlags.set, DBSP_FLAG_WITNESSDURABLE=1, or \
                     DBSP_FLAG_RESEARCHPREVIEW=1) to obtain a store anyway, or \
                     pick DurabilityMode.StableStorage for a usable fsync default."
            upcast WitnessDurableAsyncBackingStore<'K>(workDir, witnessDir, 512)

    /// Honest advertised properties for each mode — useful for auditing
    /// a deployment's durability story against `docs/security/THREAT-MODEL.md`.
    let recoveryProperty (mode: DurabilityMode) : string =
        match mode with
        | DurabilityMode.InMemoryOnly ->
            "no recovery — process-local only"
        | DurabilityMode.OsBuffered ->
            "survives process crash; last ~sec lost on host crash"
        | DurabilityMode.StableStorage ->
            "buffered-durable-linearizability (fsync-per-save frame-first protocol)"
        | DurabilityMode.WitnessDurable ->
            "research preview — no shipped durability guarantee; \
             Save throws until the WDC protocol is specified and \
             proved"
