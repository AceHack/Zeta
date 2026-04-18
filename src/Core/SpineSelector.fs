namespace Zeta.Core


/// Auto-select the right spine implementation given a workload size and
/// memory budget. Spares users from benchmarking themselves; the picks
/// below are driven by the head-to-head numbers in `docs/BENCHMARKS.md`.
///
/// Summary of our own benchmarks on Apple M2 Ultra:
///   - Sync is 3.7× faster than async at small batches (1024 × 16).
///   - Sync is 3% slower at medium-large batches (16 384 × 256).
///   - Async never strictly dominates in-memory; it wins ONLY when merge
///     work includes disk I/O (DiskBackingStore).
///
/// Decision matrix:
///   - estimatedEntries × entrySize ≤ memoryBudgetBytes / 4 → sync, in-memory
///   - estimatedEntries × entrySize ≤ memoryBudgetBytes     → async, in-memory (headroom)
///   - estimatedEntries × entrySize  > memoryBudgetBytes    → async, disk-backed
[<RequireQualifiedAccess>]
type SpineMode =
    | Sync
    | Async
    | AsyncOnDisk of workDir: string


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module SpineSelector =

    /// Default estimate: 24 bytes per `ZEntry` (16 for struct + overhead).
    [<Literal>]
    let DefaultEntrySizeBytes = 24L

    /// Pick a `SpineMode` given an estimated entry count, bytes per entry,
    /// and memory budget. Pass `None` for `workDir` to force an in-memory
    /// choice even when the size exceeds budget (caller accepts OOM risk).
    let pick
        (estimatedEntries: int64)
        (entrySizeBytes: int64)
        (memoryBudgetBytes: int64)
        (workDir: string option)
        : SpineMode =
        let workingSet = estimatedEntries * entrySizeBytes
        if workingSet * 4L <= memoryBudgetBytes then
            SpineMode.Sync
        elif workingSet <= memoryBudgetBytes then
            SpineMode.Async
        else
            match workDir with
            | Some dir -> SpineMode.AsyncOnDisk dir
            | None -> SpineMode.Async   // degraded but still in-memory

    /// Convenience: pick with default entry size + current process working
    /// set as budget. Callers who just want "do the right thing" call this.
    let auto (estimatedEntries: int64) (workDir: string option) : SpineMode =
        let proc = System.Diagnostics.Process.GetCurrentProcess()
        let available = max (proc.WorkingSet64 * 2L) (1L <<< 30)   // ≥ 1 GB floor
        pick estimatedEntries DefaultEntrySizeBytes available workDir
