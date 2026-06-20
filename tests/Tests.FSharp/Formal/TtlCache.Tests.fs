module Zeta.Tests.Formal.TtlCacheTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module C = Zeta.Core.TtlCache

// ═══════════════════════════════════════════════════════════════════
// TtlCache — injected-clock, immutable TTL cache (the "respect the
// sites / don't re-source" mechanism). Deterministic: now is passed in.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``a value is live before expiry and gone after (now < ExpiresAt)`` () =
    let cache = C.empty |> C.put 100L 10L "k" "v" // expires at 110
    C.tryGet 105L "k" cache |> should equal (Some "v") // live
    C.tryGet 109L "k" cache |> should equal (Some "v") // still live
    C.tryGet 110L "k" cache |> should equal (None: string option) // expired (exclusive)
    C.tryGet 200L "k" cache |> should equal (None: string option)

[<Fact>]
let ``getOrSource hits the source only on miss/expiry (rate-respect)`` () =
    let mutable calls = 0
    let source () = calls <- calls + 1; "graph"
    let c0 = C.empty
    // first call: miss → sources once
    let v1, c1 = C.getOrSource 0L 50L "imdb" source c0
    v1 |> should equal "graph"
    calls |> should equal 1
    // second call within TTL: hit → does NOT re-source
    let v2, c2 = C.getOrSource 40L 50L "imdb" source c1
    v2 |> should equal "graph"
    calls |> should equal 1
    // after expiry: miss → sources again
    let v3, _ = C.getOrSource 60L 50L "imdb" source c2
    v3 |> should equal "graph"
    calls |> should equal 2

[<Fact>]
let ``put is idempotent — re-putting a key upserts (one entry, refreshed expiry)`` () =
    let cache = C.empty |> C.put 0L 10L "k" "a" |> C.put 5L 10L "k" "b" // refresh at 5, expires 15
    C.liveCount 6L cache |> should equal 1
    C.tryGet 14L "k" cache |> should equal (Some "b") // refreshed value + window
    C.tryGet 16L "k" cache |> should equal (None: string option)

[<Fact>]
let ``evictExpired drops only expired entries`` () =
    let cache =
        C.empty
        |> C.put 0L 10L "old" "x" // expires 10
        |> C.put 0L 100L "new" "y" // expires 100
    let pruned = C.evictExpired 50L cache
    C.tryGet 50L "old" pruned |> should equal (None: string option)
    C.tryGet 50L "new" pruned |> should equal (Some "y")
    C.liveCount 50L pruned |> should equal 1

[<Fact>]
let ``DST: same now/ttl/ops produce identical caches`` () =
    let build () = C.empty |> C.put 10L 20L "a" 1 |> C.put 12L 20L "b" 2
    (build ()) |> should equal (build ())
