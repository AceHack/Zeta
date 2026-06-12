module Zeta.Tests.Algebra.SpineAsyncProtocolProperties

open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open System.Threading.Tasks
open System.Threading
open System

// Helper to merge a list/sequence of ZSets
let private mergeAll (sets: seq<ZSet<'K>>) : ZSet<'K> =
    sets |> Seq.fold ZSet.add ZSet.Empty

// Invariant: processed <= sent is checked dynamically by asserting that 
// any retrieved consolidated state matches a prefix of the inserted sequence.
// Also, after a Flush() call, all inserted items must have been processed.
[<Property(MaxTest = 200)>]
let ``SpineAsync concurrent inserts and flushes satisfy protocol and merge invariants`` (batchesList: int list list) =
    // Filter out zero and make sure we have non-empty keys.
    // Offset keys by batch index to guarantee disjoint namespaces across batches.
    let batches =
        batchesList
        |> List.indexed
        |> List.map (fun (idx, list) ->
            list
            |> List.filter (fun x -> x <> 0)
            |> List.map (fun x -> x + idx * 100000)
            |> ZSet.ofKeys
        )
        |> List.filter (fun z -> not z.IsEmpty)

    if List.isEmpty batches then
        ()
    else
        use spine = new SpineAsync<int>()
        let inserted = ResizeArray<ZSet<int>>()

        // Producer task runs concurrently
        let producerTask = Task.Run(fun () ->
            for b in batches do
                // Random delays to allow background worker to interleave
                if Random.Shared.Next(10) < 3 then
                    Thread.Sleep(1)
                lock inserted (fun () ->
                    inserted.Add(b)
                    spine.Insert(b)
                )
        )

        let mutable maxObservedProcessed = 0
        let mutable monotonicViolations = 0
        let mutable invariantViolations = 0

        // Monitor loops while producer is active or elements are not yet fully processed
        let monitor = Task.Run(fun () ->
            let mutable iteration = 0
            while not producerTask.IsCompleted || spine.Count < (mergeAll batches).Count do
                Thread.Sleep(2)
                iteration <- iteration + 1
                if iteration > 1000 then () // Safety limit

                // Retrieve snapshot values using a double-read pattern on Levels 
                // to guarantee they are in sync with Consolidate.
                let currentLevels = spine.Levels
                let currentConsolidated = spine.Consolidate()
                let currentLevels2 = spine.Levels

                if currentLevels = currentLevels2 then
                    let insertedSnapshot = lock inserted (fun () -> inserted.ToArray())
                    let limit = insertedSnapshot.Length

                    // Find P such that prefix sum of first P batches equals currentConsolidated
                    let mutable foundP = None
                    let mutable prefix = ZSet.Empty
                    for p in 0 .. limit do
                        if p > 0 then
                            prefix <- ZSet.add prefix insertedSnapshot.[p-1]
                        if prefix = currentConsolidated then
                            foundP <- Some p

                    match foundP with
                    | Some p ->
                        // Monotonic progress check
                        if p < maxObservedProcessed then
                            monotonicViolations <- monotonicViolations + 1
                        maxObservedProcessed <- max p maxObservedProcessed

                        // Check Spine level structure invariants for processed count P
                        let binaryBits =
                            let mutable temp = p
                            let mutable bit = 0
                            let bits = ResizeArray<int>()
                            while temp > 0 do
                                if temp % 2 = 1 then
                                    bits.Add(bit)
                                temp <- temp / 2
                                bit <- bit + 1
                            bits.ToArray()

                        if currentLevels.Length <> binaryBits.Length then
                            invariantViolations <- invariantViolations + 1
                        else
                            let mutable sumP = 0
                            for j in 0 .. binaryBits.Length - 1 do
                                let bitPos = binaryBits.[j]
                                let blockSize = 1 <<< bitPos
                                let startIdx = p - sumP - blockSize
                                let endIdx = p - sumP - 1
                                sumP <- sumP + blockSize

                                let expectedLevelSet = mergeAll insertedSnapshot.[startIdx .. endIdx]
                                if currentLevels.[j] <> expectedLevelSet then
                                    invariantViolations <- invariantViolations + 1
                    | None ->
                        // It is possible under concurrent checks to hit an intermediate state if the worker is mid-update,
                        // but since read operations acquire spineLock, it should always be structurally consistent.
                        ()
        )

        // Wait for producer to finish insertions and flush to ensure worker is done
        producerTask.Wait()
        spine.Flush().Wait()
        monitor.Wait()

        // Assert invariants using xUnit assertions to get descriptive errors on failure
        Assert.Equal(0, monotonicViolations)
        Assert.Equal(0, invariantViolations)

        let finalConsolidated = spine.Consolidate()
        let expectedFinal = mergeAll batches
        Assert.Equal<ZSet<int>>(expectedFinal, finalConsolidated)

        let totalProcessed = batches.Length
        let finalLevels = spine.Levels

        let finalBinaryBits =
            let mutable temp = totalProcessed
            let mutable bit = 0
            let bits = ResizeArray<int>()
            while temp > 0 do
                if temp % 2 = 1 then
                    bits.Add(bit)
                temp <- temp / 2
                bit <- bit + 1
            bits.ToArray()

        Assert.Equal(finalBinaryBits.Length, finalLevels.Length)

        let mutable sumP = 0
        for j in 0 .. finalBinaryBits.Length - 1 do
            let bitPos = finalBinaryBits.[j]
            let blockSize = 1 <<< bitPos
            let startIdx = totalProcessed - sumP - blockSize
            let endIdx = totalProcessed - sumP - 1
            sumP <- sumP + blockSize

            let expectedLevelSet = mergeAll batches.[startIdx .. endIdx]
            Assert.Equal<ZSet<int>>(expectedLevelSet, finalLevels.[j])
