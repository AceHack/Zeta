namespace Zeta.Core

open System
open System.Buffers.Binary
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// Transactional `z^-1` — like the ordinary delay, but its state commit is
/// gated on an explicit `Commit` call rather than automatically per-tick.
/// Lets a batch of ticks either all-succeed-together or all-roll-back,
/// giving exactly-once semantics when paired with an external ack protocol.
///
/// **Semantics:**
///   - Default mode: `AutoCommit = true` — behaves exactly like `z^-1`.
///   - Transactional mode: set `AutoCommit = false` (via `BeginTransaction`);
///     AfterStep now only updates `pending`, not `state`. `Commit()` promotes
///     `pending -> state`; `Rollback()` restores `pending <- state`. At tick t
///     during an open tx, `Value = state` (the last committed value), not the
///     still-uncommitted pending frontier.
///
/// Usage:
/// ```fsharp
/// let tz = circuit.TransactionZ1 input
/// tz.BeginTransaction()
/// for d in deltas do input.Send d; do! circuit.StepAsync()
/// tz.Commit()   // or tz.Rollback()
/// ```
/// Immutable snapshot of the transaction state. Reference-typed so it
/// can be CAS'd via `Interlocked.CompareExchange`. Reads are fully
/// lock-free; writes are a tight CAS-retry loop.
///
/// Why this shape: the previous `lock stateLock` on every `StepAsync`
/// serialises every tick on a mutex, which (a) stalls reader threads
/// (`.State`/`.Pending` properties block), and (b) shows up as a
/// measurable hotspot when N operators each pull the transaction's
/// current value per tick. A `CompareExchange` is ~3 ns vs `lock`'s
/// ~20 ns; more importantly, readers never block.
[<Sealed; NoComparison; NoEquality>]
type TxStateSnapshot<'T>(state: 'T, pending: 'T, autoCommit: bool) =
    member _.State = state
    member _.Pending = pending
    member _.AutoCommit = autoCommit
    member _.WithPending(p: 'T) = TxStateSnapshot(state, p, autoCommit)
    member _.WithState(s: 'T) = TxStateSnapshot(s, pending, autoCommit)
    member _.Begin() = TxStateSnapshot(state, state, false)   // pending := state
    member _.Commit() = TxStateSnapshot(pending, pending, true)
    member _.Rollback() = TxStateSnapshot(state, state, true)
    member _.Tick(nextInput: 'T) =
        // AfterStep: pending <- input; if autoCommit then state <- pending.
        let newPending = nextInput
        let newState = if autoCommit then newPending else state
        TxStateSnapshot(newState, newPending, autoCommit)


[<Sealed>]
type TransactionZ1Op<'T>(input: Op<'T>, initial: 'T) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    // Reference-typed CAS cell holding the atomic `TxStateSnapshot`.
    // `[<VolatileField>]` forces a release-fence publication on every
    // `Interlocked.CompareExchange` and an acquire-fence read on every
    // plain `cell` access. Without it, the JIT is allowed to hoist the
    // `cell` read out of `StepAsync`'s loop, so a reader can observe a
    // torn snapshot reference that a writer replaced several CASes
    // ago. Same pattern as `Circuit.tick`.
    [<VolatileField>]
    let mutable cell = TxStateSnapshot(initial, initial, true)

    /// CAS-retry helper: `f` is applied to the current snapshot until
    /// the `Interlocked.CompareExchange` succeeds. Since every write
    /// contender is racing for the same cell, the loop is bounded in
    /// practice (~1.2 iterations average under light contention).
    let updateCas (f: TxStateSnapshot<'T> -> TxStateSnapshot<'T>) : TxStateSnapshot<'T> =
        let mutable attempts = 0
        let mutable success = false
        let mutable result = Unchecked.defaultof<TxStateSnapshot<'T>>
        while not success do
            let cur = cell
            let next = f cur
            if obj.ReferenceEquals(Interlocked.CompareExchange(&cell, next, cur), cur) then
                success <- true
                result <- next
            attempts <- attempts + 1
            if attempts > 1024 then
                invalidOp "TransactionZ1Op CAS loop exceeded 1024 retries — pathological contention"
        result

    override _.Name = "transactionZ1"
    override _.Inputs = inputs
    override _.IsStrict = true
    override this.StepAsync(_: CancellationToken) =
        // Single volatile load — no lock, no CAS retry.
        this.Value <- cell.State
        ValueTask.CompletedTask
    override _.AfterStepAsync(_: CancellationToken) =
        let nextInput = input.Value
        updateCas (fun s -> s.Tick nextInput) |> ignore
        ValueTask.CompletedTask

    /// Open a transaction. While open, `AfterStep` only writes `pending`;
    /// `state` is frozen until `Commit` or `Rollback`.
    member _.BeginTransaction() = updateCas (fun s -> s.Begin()) |> ignore

    /// Promote `pending` to `state` and resume auto-commit.
    member _.Commit() = updateCas (fun s -> s.Commit()) |> ignore

    /// Discard `pending`, restore to last-committed `state`, resume auto-commit.
    member _.Rollback() = updateCas (fun s -> s.Rollback()) |> ignore

    member _.IsInTransaction = not cell.AutoCommit
    member _.Pending = cell.Pending
    member _.State = cell.State


/// Simple binary serialisation for Z-set state. Uses `System.Text.Json`
/// with source-generator-friendly types — sufficient for checkpointing a
/// running circuit and restoring it in a new process. This is *not* the
/// performant path (rkyv-style zero-copy is better); it's the correct-and-
/// compact starting point so you can checkpoint today.
/// A Z-set entry wrapped in a plain record for JSON-serialiser-friendliness.
/// F# struct tuples don't round-trip through `System.Text.Json` by default;
/// this record does.
[<CLIMutable>]
type CheckpointEntry<'K> = {
    mutable Key: 'K
    mutable Weight: int64
}


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Checkpoint =

    open System.IO.Hashing
    open System.Text.Json

    // Wire format: 4-byte magic || 4-byte CRC32 of payload || JSON payload.
    // Keeping this explicit so a 1-byte corruption during disk spill or
    // network transfer is detected on `ofBytes` rather than silently
    // deserialising a garbage Z-set. This is an *integrity* check, not
    // authentication — a malicious producer can still forge a matching
    // CRC. Pair with HMAC externally when the source is untrusted.
    [<Literal>]
    let private Magic = 0xD85C01E1u   // "DBSP CkPt v1"

    /// Serialise a Z-set to a JSON byte array prefixed with a magic tag
    /// and CRC32. The key type must be serialisable by `System.Text.Json`
    /// (primitives, records, strings).
    let toBytes<'K when 'K : comparison> (z: ZSet<'K>) : byte array =
        let arr =
            z.AsSpan().ToArray()
            |> Array.map (fun e -> { Key = e.Key ; Weight = e.Weight })
        let payload = JsonSerializer.SerializeToUtf8Bytes arr
        let crc = Crc32.HashToUInt32(ReadOnlySpan<byte> payload)
        let buffer = Array.zeroCreate<byte> (8 + payload.Length)
        BinaryPrimitives.WriteUInt32LittleEndian(Span<byte>(buffer, 0, 4), Magic)
        BinaryPrimitives.WriteUInt32LittleEndian(Span<byte>(buffer, 4, 4), crc)
        Array.Copy(payload, 0, buffer, 8, payload.Length)
        buffer

    /// Deserialise a Z-set from bytes produced by `toBytes`. Throws if the
    /// magic tag or CRC doesn't match — prefer a visible failure to a
    /// silently-wrong state restore.
    let ofBytes<'K when 'K : comparison> (bytes: byte array) : ZSet<'K> =
        if bytes.Length < 8 then
            invalidOp "Checkpoint: blob too short to contain header"
        let magic = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan<byte>(bytes, 0, 4))
        if magic <> Magic then
            invalidOp $"Checkpoint: wrong magic 0x{magic:X8} (expected 0x{Magic:X8})"
        let expectedCrc = BinaryPrimitives.ReadUInt32LittleEndian(ReadOnlySpan<byte>(bytes, 4, 4))
        let payload = ReadOnlySpan<byte>(bytes, 8, bytes.Length - 8)
        let actualCrc = Crc32.HashToUInt32 payload
        if expectedCrc <> actualCrc then
            invalidOp $"Checkpoint: CRC mismatch (expected 0x{expectedCrc:X8}, got 0x{actualCrc:X8}) — blob corrupted"
        let arr = JsonSerializer.Deserialize<CheckpointEntry<'K> array> payload
        arr
        |> Array.map (fun e -> e.Key, e.Weight)
        |> ZSet.ofSeq


/// Handle to a transactional-z^-1 op, exposing the tx control surface
/// alongside the stream handle.
[<Sealed>]
type TransactionHandle<'T> internal (op: TransactionZ1Op<'T>) =
    member _.Stream = Stream op
    member _.BeginTransaction() = op.BeginTransaction()
    member _.Commit() = op.Commit()
    member _.Rollback() = op.Rollback()
    member _.IsInTransaction = op.IsInTransaction
    /// Currently-committed value (read-only snapshot).
    member _.State = op.State
    /// In-tx pending value (equal to State when not in a tx).
    member _.Pending = op.Pending


[<Extension>]
type TransactionExtensions =

    /// Transactional `z^-1` — delay operator gated by explicit commits.
    /// Returns both the stream and a control handle; call
    /// `handle.BeginTransaction()` / `.Commit()` / `.Rollback()` to
    /// drive exactly-once semantics.
    [<Extension>]
    static member TransactionZ1<'T>
        (this: Circuit, input: Stream<'T>) : TransactionHandle<'T> =
        let op = this.Register (TransactionZ1Op(input.Op, Unchecked.defaultof<'T>))
        TransactionHandle op

    /// Simpler variant that only returns the stream (for use when the
    /// txn control isn't needed — behaves as ordinary `z^-1` via auto-commit).
    [<Extension>]
    static member TransactionZ1Stream<'T>
        (this: Circuit, input: Stream<'T>) : Stream<'T> =
        this.RegisterStream (TransactionZ1Op(input.Op, Unchecked.defaultof<'T>))
