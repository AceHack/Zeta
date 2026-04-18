module Zeta.Tests.Storage.CheckpointTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Checkpoint serialization (moved from InfrastructureTests /
// ═ CoverageTests2 / SpineAndSafetyTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``Checkpoint roundtrips a Z-set`` () =
    let original = ZSet.ofSeq [ 1, 3L ; 2, 1L ; 3, -1L ; 4, 7L ]
    let bytes = Checkpoint.toBytes original
    let restored : ZSet<int> = Checkpoint.ofBytes bytes
    restored |> should equal original


// ─── Checkpoint for various key types (moved from CoverageTests2) ──

[<Fact>]
let ``Checkpoint roundtrips string keys`` () =
    let original = ZSet.ofSeq [ "alice", 1L ; "bob", 2L ; "carol", -1L ]
    let bytes = Checkpoint.toBytes original
    let restored : ZSet<string> = Checkpoint.ofBytes bytes
    restored |> should equal original


[<Fact>]
let ``Checkpoint empty Z-set roundtrips`` () =
    let empty = ZSet<int>.Empty
    let bytes = Checkpoint.toBytes empty
    let restored : ZSet<int> = Checkpoint.ofBytes bytes
    restored.IsEmpty |> should be True


// ─── Checkpoint CRC integrity (moved from SpineAndSafetyTests) ─────

[<Fact>]
let ``Checkpoint round-trips correctly`` () =
    let z = ZSet.ofKeys [ "a"; "b"; "c" ]
    let bytes = Checkpoint.toBytes z
    let restored = Checkpoint.ofBytes<string> bytes
    restored.Count |> should equal 3


[<Fact>]
let ``Checkpoint rejects truncated blob`` () =
    let z = ZSet.ofKeys [ 1; 2 ]
    let bytes = Checkpoint.toBytes z
    let truncated = Array.sub bytes 0 4   // only the magic, no CRC, no payload
    (fun () -> Checkpoint.ofBytes<int> truncated |> ignore)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``Checkpoint rejects corrupted payload via CRC mismatch`` () =
    let z = ZSet.ofKeys [ 10; 20; 30 ]
    let bytes = Checkpoint.toBytes z
    // Flip a bit deep in the payload (past the 8-byte header).
    bytes.[bytes.Length - 3] <- bytes.[bytes.Length - 3] ^^^ 0x20uy
    (fun () -> Checkpoint.ofBytes<int> bytes |> ignore)
    |> should throw typeof<InvalidOperationException>


[<Fact>]
let ``Checkpoint rejects wrong magic`` () =
    let z = ZSet.ofKeys [ 1 ]
    let bytes = Checkpoint.toBytes z
    // Zero the magic.
    bytes.[0] <- 0uy
    bytes.[1] <- 0uy
    bytes.[2] <- 0uy
    bytes.[3] <- 0uy
    (fun () -> Checkpoint.ofBytes<int> bytes |> ignore)
    |> should throw typeof<InvalidOperationException>
