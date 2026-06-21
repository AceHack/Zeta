namespace Zeta.Core

/// **Per-row compare-and-swap over the content-addressed store — the lock-free runtime coordination
/// primitive (Aaron 2026-06-07; "maybe we don't need Orleans").** Each row (`'K`) holds the **content
/// address** (`MerkleHash`) of its current value; `trySwap` commits a new value **iff the row's current
/// address still equals the caller's `expected`** — otherwise it fails *without committing* and returns the
/// *actual* current address so the caller can re-read and retry. So a writer that fails mid-turn simply
/// never commits (the new store version is never adopted); no single-activation, no lock — **manifesto §2
/// lock/wait-free**. This is the runtime under the actor / SerializedSaga lane for single-row state (the
/// multi-row-atomic case escalates to the serialized bus / saga). DST-simulatable.
///
/// Composes `ContentStore` (values are content-addressed + dedup'd). Ties: 081KT07NV0008QG0R002KWQS05 (optimistic-CAS
/// claim-locks, deadlock-free by construction), SlateDB (CAS-manifest + writer-epoch fencing).
[<RequireQualifiedAccess>]
module CasStore =

    [<NoEquality; NoComparison>]
    type Store<'K, 'V when 'K: comparison> =
        private
            { Rows: Map<'K, MerkleHash> // row key -> current content address
              Content: ContentStore.Store<'V> }

    /// A store keyed by `hashOf` for value content-addressing (e.g. `ZSetMerkle.root enc`).
    let create (hashOf: 'V -> MerkleHash) : Store<'K, 'V> =
        { Rows = Map.empty; Content = ContentStore.create hashOf }

    /// The current content address at `key` (None if the row is absent).
    let currentHash (key: 'K) (s: Store<'K, 'V>) : MerkleHash option = Map.tryFind key s.Rows

    /// Read the current `(address, value)` at `key`, or None.
    let read (key: 'K) (s: Store<'K, 'V>) : (MerkleHash * 'V) option =
        match Map.tryFind key s.Rows with
        | Some h -> ContentStore.get h s.Content |> Option.map (fun v -> h, v)
        | None -> None

    /// **Compare-and-swap one row.** `expected` is the address the caller last observed (`None` = expect the
    /// row absent, i.e. CAS-create). Commits `next` and returns the new store **iff** the row's current
    /// address equals `expected`; otherwise returns `Error currentAddress` (the value at `key` is unchanged)
    /// so the caller can re-read and retry. Lock-free; a non-committing call mutates nothing.
    let trySwap (key: 'K) (expected: MerkleHash option) (next: 'V) (s: Store<'K, 'V>) : Result<Store<'K, 'V>, MerkleHash option> =
        let current = Map.tryFind key s.Rows
        if current = expected then
            let h, content' = ContentStore.put next s.Content
            Ok { Rows = Map.add key h s.Rows; Content = content' }
        else
            Error current

    /// `trySwap` retried internally against the current value: `update key f` reads the row and applies `f`
    /// to its current value (or None for absent), CAS-swapping the result. Since this store is immutable
    /// (single logical timeline), one attempt always succeeds; the `Result` shape stays for the concurrent
    /// caller who holds a *stale* version (their `expected` won't match → they retry).
    let update (key: 'K) (f: 'V option -> 'V) (s: Store<'K, 'V>) : Store<'K, 'V> =
        let cur = Map.tryFind key s.Rows
        let curVal = cur |> Option.bind (fun h -> ContentStore.get h s.Content)
        match trySwap key cur (f curVal) s with
        | Ok s' -> s'
        | Error _ -> s // unreachable on a single timeline; defensive

    /// Number of live rows.
    let rowCount (s: Store<'K, 'V>) : int = s.Rows.Count
