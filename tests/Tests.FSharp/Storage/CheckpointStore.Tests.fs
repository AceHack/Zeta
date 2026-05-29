module Zeta.Tests.Storage.CheckpointStoreTests

open System
open System.IO
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Tests.Support


[<Fact>]
let ``InMemoryCheckpointStore roundtrips operator state`` () =
    let store = InMemoryCheckpointStore() :> ICheckpointStore

    let mutable savedValue = 42
    let checkpointable =
        { new ICheckpointable with
            member _.SaveState writer = writer.WriteInt32 savedValue
            member _.LoadState reader = savedValue <- reader.ReadInt32()
            member _.StateVersion = 1 }

    let states = [| (0, checkpointable) |]
    store.SaveCheckpointAsync("test-circuit", 1L, states, System.Threading.CancellationToken.None)
    |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    savedValue <- 0

    let loaded =
        store.LoadCheckpointAsync("test-circuit", System.Threading.CancellationToken.None)
        |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    loaded.IsSome |> should be True
    let struct (tick, readers) = loaded.Value
    tick |> should equal 1L
    readers.Length |> should equal 1

    let (opId, reader) = readers.[0]
    opId |> should equal 0
    checkpointable.LoadState reader
    savedValue |> should equal 42


[<Fact>]
let ``InMemoryCheckpointStore returns ValueNone when empty`` () =
    let store = InMemoryCheckpointStore() :> ICheckpointStore

    let loaded =
        store.LoadCheckpointAsync("nonexistent", System.Threading.CancellationToken.None)
        |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    loaded.IsNone |> should be True


[<Fact>]
let ``InMemoryCheckpointStore handles multiple operators`` () =
    let store = InMemoryCheckpointStore() :> ICheckpointStore

    let mutable val1 = 100L
    let mutable val2 = "hello"

    let op1 =
        { new ICheckpointable with
            member _.SaveState writer = writer.WriteInt64 val1
            member _.LoadState reader = val1 <- reader.ReadInt64()
            member _.StateVersion = 1 }

    let op2 =
        { new ICheckpointable with
            member _.SaveState writer = writer.WriteString val2
            member _.LoadState reader = val2 <- reader.ReadString()
            member _.StateVersion = 1 }

    let states = [| (0, op1); (1, op2) |]
    store.SaveCheckpointAsync("multi", 5L, states, System.Threading.CancellationToken.None)
    |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    val1 <- 0L
    val2 <- ""

    let loaded =
        store.LoadCheckpointAsync("multi", System.Threading.CancellationToken.None)
        |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    let struct (tick, readers) = loaded.Value
    tick |> should equal 5L
    readers.Length |> should equal 2

    let (_, r1) = readers.[0]
    let (_, r2) = readers.[1]
    op1.LoadState r1
    op2.LoadState r2

    val1 |> should equal 100L
    val2 |> should equal "hello"


[<Fact>]
let ``InMemoryCheckpointStore overwrites on second save`` () =
    let store = InMemoryCheckpointStore() :> ICheckpointStore

    let mutable v = 10
    let op =
        { new ICheckpointable with
            member _.SaveState writer = writer.WriteInt32 v
            member _.LoadState reader = v <- reader.ReadInt32()
            member _.StateVersion = 1 }

    store.SaveCheckpointAsync("c", 1L, [| (0, op) |], System.Threading.CancellationToken.None)
    |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    v <- 20
    store.SaveCheckpointAsync("c", 2L, [| (0, op) |], System.Threading.CancellationToken.None)
    |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    v <- 0

    let loaded =
        store.LoadCheckpointAsync("c", System.Threading.CancellationToken.None)
        |> fun vt -> vt.AsTask() |> Async.AwaitTask |> Async.RunSynchronously

    let struct (tick, readers) = loaded.Value
    tick |> should equal 2L
    let (_, r) = readers.[0]
    op.LoadState r
    v |> should equal 20


// ═══════════════════════════════════════════════════════════════════
// ═ FileCheckpointStore tests
// ═══════════════════════════════════════════════════════════════════

let private makeTempDir () =
    DeterministicTestPath.nextDir "zeta-checkpoint-test"

let private cleanupDir (dir: string) =
    if Directory.Exists dir then
        Directory.Delete(dir, true)


[<Fact>]
let ``FileCheckpointStore roundtrips operator state`` () =
    let dir = makeTempDir ()
    try
        let store = FileCheckpointStore(dir) :> ICheckpointStore

        let mutable savedValue = 42
        let checkpointable =
            { new ICheckpointable with
                member _.SaveState writer =
                    writer.WriteInt32 savedValue
                member _.LoadState reader =
                    savedValue <- reader.ReadInt32()
                member _.StateVersion = 1 }

        let states = [| (0, checkpointable) |]
        store.SaveCheckpointAsync(
            "test-circuit", 1L, states,
            Threading.CancellationToken.None)
        |> fun vt ->
            vt.AsTask()
            |> Async.AwaitTask
            |> Async.RunSynchronously

        savedValue <- 0

        let loaded =
            store.LoadCheckpointAsync(
                "test-circuit",
                Threading.CancellationToken.None)
            |> fun vt ->
                vt.AsTask()
                |> Async.AwaitTask
                |> Async.RunSynchronously

        loaded.IsSome |> should be True
        let struct (tick, readers) = loaded.Value
        tick |> should equal 1L
        readers.Length |> should equal 1

        let (opId, reader) = readers.[0]
        opId |> should equal 0
        checkpointable.LoadState reader
        savedValue |> should equal 42
    finally
        cleanupDir dir


[<Fact>]
let ``FileCheckpointStore returns ValueNone when empty`` () =
    let dir = makeTempDir ()
    try
        let store = FileCheckpointStore(dir) :> ICheckpointStore

        let loaded =
            store.LoadCheckpointAsync(
                "nonexistent",
                Threading.CancellationToken.None)
            |> fun vt ->
                vt.AsTask()
                |> Async.AwaitTask
                |> Async.RunSynchronously

        loaded.IsNone |> should be True
    finally
        cleanupDir dir


[<Fact>]
let ``FileCheckpointStore handles multiple operators`` () =
    let dir = makeTempDir ()
    try
        let store = FileCheckpointStore(dir) :> ICheckpointStore

        let mutable val1 = 100L
        let mutable val2 = "hello"

        let op1 =
            { new ICheckpointable with
                member _.SaveState writer =
                    writer.WriteInt64 val1
                member _.LoadState reader =
                    val1 <- reader.ReadInt64()
                member _.StateVersion = 1 }

        let op2 =
            { new ICheckpointable with
                member _.SaveState writer =
                    writer.WriteString val2
                member _.LoadState reader =
                    val2 <- reader.ReadString()
                member _.StateVersion = 1 }

        let states = [| (0, op1); (1, op2) |]
        store.SaveCheckpointAsync(
            "multi", 5L, states,
            Threading.CancellationToken.None)
        |> fun vt ->
            vt.AsTask()
            |> Async.AwaitTask
            |> Async.RunSynchronously

        val1 <- 0L
        val2 <- ""

        let loaded =
            store.LoadCheckpointAsync(
                "multi",
                Threading.CancellationToken.None)
            |> fun vt ->
                vt.AsTask()
                |> Async.AwaitTask
                |> Async.RunSynchronously

        let struct (tick, readers) = loaded.Value
        tick |> should equal 5L
        readers.Length |> should equal 2

        let (_, r1) = readers.[0]
        let (_, r2) = readers.[1]
        op1.LoadState r1
        op2.LoadState r2

        val1 |> should equal 100L
        val2 |> should equal "hello"
    finally
        cleanupDir dir


[<Fact>]
let ``FileCheckpointStore overwrites on second save`` () =
    let dir = makeTempDir ()
    try
        let store = FileCheckpointStore(dir) :> ICheckpointStore

        let mutable v = 10
        let op =
            { new ICheckpointable with
                member _.SaveState writer =
                    writer.WriteInt32 v
                member _.LoadState reader =
                    v <- reader.ReadInt32()
                member _.StateVersion = 1 }

        store.SaveCheckpointAsync(
            "c", 1L, [| (0, op) |],
            Threading.CancellationToken.None)
        |> fun vt ->
            vt.AsTask()
            |> Async.AwaitTask
            |> Async.RunSynchronously

        v <- 20
        store.SaveCheckpointAsync(
            "c", 2L, [| (0, op) |],
            Threading.CancellationToken.None)
        |> fun vt ->
            vt.AsTask()
            |> Async.AwaitTask
            |> Async.RunSynchronously

        v <- 0

        let loaded =
            store.LoadCheckpointAsync(
                "c",
                Threading.CancellationToken.None)
            |> fun vt ->
                vt.AsTask()
                |> Async.AwaitTask
                |> Async.RunSynchronously

        let struct (tick, readers) = loaded.Value
        tick |> should equal 2L
        let (_, r) = readers.[0]
        op.LoadState r
        v |> should equal 20
    finally
        cleanupDir dir


[<Fact>]
let ``FileCheckpointStore survives across instances`` () =
    let dir = makeTempDir ()
    try
        let mutable savedValue = 69420
        let checkpointable =
            { new ICheckpointable with
                member _.SaveState writer =
                    writer.WriteInt32 savedValue
                member _.LoadState reader =
                    savedValue <- reader.ReadInt32()
                member _.StateVersion = 1 }

        // Save with one instance.
        let store1 =
            FileCheckpointStore(dir) :> ICheckpointStore
        store1.SaveCheckpointAsync(
            "persist", 7L, [| (0, checkpointable) |],
            Threading.CancellationToken.None)
        |> fun vt ->
            vt.AsTask()
            |> Async.AwaitTask
            |> Async.RunSynchronously

        savedValue <- 0

        // Load with a completely new instance.
        let store2 =
            FileCheckpointStore(dir) :> ICheckpointStore
        let loaded =
            store2.LoadCheckpointAsync(
                "persist",
                Threading.CancellationToken.None)
            |> fun vt ->
                vt.AsTask()
                |> Async.AwaitTask
                |> Async.RunSynchronously

        loaded.IsSome |> should be True
        let struct (tick, readers) = loaded.Value
        tick |> should equal 7L
        readers.Length |> should equal 1

        let (opId, reader) = readers.[0]
        opId |> should equal 0
        checkpointable.LoadState reader
        savedValue |> should equal 69420
    finally
        cleanupDir dir
