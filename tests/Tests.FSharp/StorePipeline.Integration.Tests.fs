module Zeta.Tests.StorePipelineIntegrationTests

open global.Xunit
open Zeta.Core

module CDC = Zeta.Core.DebeziumCdc
module CS = Zeta.Core.ContentStore
module FS = Zeta.Core.DagFs
module CE = Zeta.Core.CloudEvents

// END-TO-END: a Debezium CDC change over a DynamicValue row flows through the whole session substrate —
// DvKey (comparable row) → DebeziumCdc (→ Z-set delta) → ZSetMerkle (content address) → ContentStore
// (single-instance COW) → DagFs (path link) → CloudEvents (bus envelope carrying the address). Proves the
// pieces compose, not just pass in isolation.

let private row kvs = DvKey.ofValue (DynamicValue.Object kvs)
let private addr = ZSetMerkle.root DvKey.canonical // ZSet<DvKey> -> MerkleHash (rows keyed by canonical CBOR)

[<Fact>]
let ``Debezium change → Z-set delta → content-addressed store node → DagFs path → CloudEvents envelope`` () =
    // 1. a Debezium "create" of a DynamicValue row
    let r = row [ "id", DynamicValue.Int 1L; "name", DynamicValue.String "Ada" ]
    let delta = CDC.toZSetDelta (CDC.create r) // ZSet<DvKey> = +1·row

    // 2. content-address + store it (single-instance COW), and link it in the file tree
    let store = CS.create addr
    let h, store1 = CS.put delta store
    let fs = FS.create addr |> FS.link "/changes/1" delta

    // 3. wrap the change as a CloudEvent carrying the content address (as the data)
    let ce = CE.create "evt-1" "/zeta/cdc" "com.zeta.cdc.create" (Some(DynamicValue.String(h.ToHex())))

    // --- the pipeline composes + each hop round-trips ---
    Assert.Equal<ZSet<DvKey> option>(Some delta, CS.get h store1) // store round-trips by content address
    Assert.Equal<ZSet<DvKey> option>(Some delta, FS.resolve "/changes/1" fs) // fs resolves the same node
    Assert.Equal(h, (FS.addressAt "/changes/1" fs).Value) // store + fs agree on the content address
    Assert.Equal<Result<unit, string>>(Ok(), CE.validate ce)
    Assert.Equal<Result<CE.CloudEvent, string>>(Ok ce, CE.ofDynamic (CE.toDynamic ce)) // envelope round-trips
    Assert.Equal<DynamicValue option>(Some(DynamicValue.String(h.ToHex())), ce.Data) // carries the address

[<Fact>]
let ``an update's delta (retract+insert) stores as one node; identical content dedups across the pipeline`` () =
    let before = row [ "id", DynamicValue.Int 1L; "v", DynamicValue.String "old" ]
    let after = row [ "id", DynamicValue.Int 1L; "v", DynamicValue.String "new" ]
    let updateDelta = CDC.toZSetDelta (CDC.update before after) // -before +after

    let store = CS.create addr
    let h1, s1 = CS.put updateDelta store
    // re-deriving the same update produces the same delta → same address → dedup (single node)
    let h2, s2 = CS.put (CDC.toZSetDelta (CDC.update before after)) s1
    Assert.Equal(h1, h2)
    Assert.Equal(1, CS.count s2)
