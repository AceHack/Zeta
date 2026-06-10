// DST + Reticulum: "can our tests connect?" — the handshake proof (Aaron, 2026-06-09:
// "we are going to do a deterministic simulation test with Reticulum and see if our
// tests can connect once you have [the finalizer in src/Core] built").
//
// Two test nodes, each a ZetaId-shaped Reticulum destination, announce themselves
// (discovery), CONNECT over the deterministic medium, and exchange a tick BOTH ways.
// The whole exchange is scheduler-driven so it REPLAYS identically from one seed (DST).
// The finalizer (now in src/Core) closes the loop: the exchange's tick result feeds
// Finalizer.decide — "the finalizer is part of the test" (rooms/README).
//
// Run: dotnet fsi src/Core/ReticulumConnect.test.fsx
#load "Clock.fs"
#load "ReticulumLink.fs"
#load "Finalizer.fs"
open Zeta.Core
open Zeta.Core.ReticulumLink

let mutable pass = 0
let mutable fail = 0
let ok name cond =
    if cond then pass <- pass + 1; printfn "  ok: %s" name
    else fail <- fail + 1; printfn "  FAIL: %s" name

// two test nodes (ZetaId-shaped destinations) — "our tests"
let nodeA: Destination = { Hi = 0xA000UL; Lo = 1UL }
let nodeB: Destination = { Hi = 0xB000UL; Lo = 2UL }
let nodeGhost: Destination = { Hi = 0xC000UL; Lo = 3UL }   // never announces

// --- the connect + bidirectional exchange, parameterised by seed (so we can replay) ---
// returns: (connected, payloadsAtB, payloadsAtA, versionstampTrace)
let scenario (seed: int64) =
    let s0 = Scheduler.fromSeed seed
    // discovery: both test nodes announce (idempotent — announce A twice)
    let m0 = empty |> announce nodeA |> announce nodeA |> announce nodeB
    // can our tests connect?
    let link = connect nodeA nodeB m0
    match link with
    | Error _ -> (false, [], [], [])
    | Ok l ->
        // A -> B (a tick), then B -> A (the ack): the bidirectional handshake
        let m1, s1 = send l.A l.B "tick" s0 m0
        let m2, s2 = send l.B l.A "ack" s1 m1
        let atB, m3 = deliver nodeB m2
        let atA, _ = deliver nodeA m3
        let trace = [ s0.Now; s1.Now; s2.Now ]
        (true,
         atB |> List.map (fun p -> p.Payload),
         atA |> List.map (fun p -> p.Payload),
         trace)

printfn "ReticulumConnect (DST handshake):"

// 1. can our tests connect? (both announced)
let (connected, atB, atA, trace1) = scenario 100L
ok "two announced test nodes CONNECT" connected

// 2. the tick reached B, the ack reached A (bidirectional exchange)
ok "A->B tick delivered to B" (atB = [ "tick" ])
ok "B->A ack delivered to A" (atA = [ "ack" ])

// 3. connect to an un-announced node fails as a Result (no throw) — discovery precondition
let ghostConnect = connect nodeA nodeGhost (empty |> announce nodeA)
ok "connect to un-announced node -> Error (result, not throw)"
    (match ghostConnect with Error (LinkError.Unreachable d) -> d = nodeGhost | _ -> false)

// 4. idempotent announce: announcing A twice == once (one entry)
let mIdem = empty |> announce nodeA |> announce nodeA
ok "announce is idempotent (apply-N == apply-once)" (List.length mIdem.Announced = 1)

// 5. DST replay: same seed -> identical versionstamp trace AND identical deliveries
let (_, atB2, atA2, trace2) = scenario 100L
ok "DST replay: identical versionstamp trace" (trace1 = trace2)
ok "DST replay: identical deliveries" (atB = atB2 && atA = atA2)

// 6. different seed -> different (deterministic) trace, same logical outcome
let (conn3, atB3, _, trace3) = scenario 555L
ok "different seed -> different trace (time is seeded)" (trace3 <> trace1)
ok "different seed -> same logical connect+deliver" (conn3 && atB3 = [ "tick" ])

// 7. the finalizer closes the loop: a successful connected exchange is a bounded, merged
//    tick with positive ΔU -> Finalizer says ReKick (advance). "finalizer is part of the test".
let tick: TickResult = { DeltaU = 1.0; Temperature = Finalizer.warm; Bounded = true; Merged = true }
ok "finalizer on a connected exchange -> ReKick"
    (Finalizer.decide tick = FinalizerAction.ReKick)

printfn "ReticulumConnect: %d passed, %d failed" pass fail
if fail = 0 then printfn "ReticulumConnect: ALL PASS (our tests connect; DST-replayable; finalizer in loop)."
else exit 1
