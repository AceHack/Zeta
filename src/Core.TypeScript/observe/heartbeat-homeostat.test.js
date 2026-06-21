import { test, expect } from "bun:test";
import { empty, heartbeat, merge, converge, alive } from "./heartbeat-homeostat";
// 081KT7YW00008QG0R002T1XNWT "hello world" homeostasis — actors heartbeat, the CRDT-map merge converges
// to one fleet-liveness view regardless of order/duplicates. Homeostasis = the
// fixpoint of per-actor-max merge over the heartbeat stream.
// Simulate four Otto actors + a peer, each heartbeating at increasing versionstamps.
const A = "otto⊕cli-bg⊕inst1⊕node1";
const B = "otto⊕cli-fg⊕inst1⊕node1";
const C = "otto⊕desktop⊕inst1⊕node2";
const P = "lior⊕loop⊕inst1⊕node1";
test("heartbeat keeps per-actor MAX (monotone liveness; older is a no-op)", () => {
    let v = empty;
    v = heartbeat(v, A, 5n);
    v = heartbeat(v, A, 9n);
    v = heartbeat(v, A, 7n); // older — ignored
    expect(v.get(A)).toBe(9n);
});
test("merge converges to the SAME fleet view regardless of order — homeostasis", () => {
    // three partial views as if gossiped from different actors
    const v1 = heartbeat(heartbeat(empty, A, 9n), B, 3n);
    const v2 = heartbeat(heartbeat(empty, B, 8n), C, 4n);
    const v3 = heartbeat(heartbeat(empty, C, 2n), P, 6n);
    const order1 = converge([v1, v2, v3]);
    const order2 = converge([v3, v1, v2]);
    const order3 = converge([v2, v3, v1]);
    // per-actor max across all three, order-independent (the LUB / fixpoint)
    const expected = new Map([[A, 9n], [B, 8n], [C, 4n], [P, 6n]]);
    for (const view of [order1, order2, order3]) {
        expect(new Map(view)).toEqual(expected);
    }
});
test("merge is idempotent — re-delivering a view changes nothing (stable fixpoint)", () => {
    const v = converge([
        heartbeat(empty, A, 9n),
        heartbeat(empty, B, 8n),
    ]);
    expect(new Map(merge(v, v))).toEqual(new Map(v));
    // and re-merging an already-seen partial is a no-op
    expect(new Map(merge(v, heartbeat(empty, A, 5n)))).toEqual(new Map(v));
});
test("liveness readout: alive-since threshold over the converged view", () => {
    const v = converge([
        heartbeat(empty, A, 9n),
        heartbeat(empty, B, 8n),
        heartbeat(empty, C, 4n),
        heartbeat(empty, P, 6n),
    ]);
    expect(alive(v, 6n)).toEqual([A, B, P].sort()); // C at 4 is below threshold
});
