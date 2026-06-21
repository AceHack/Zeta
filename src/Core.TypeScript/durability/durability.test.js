import { test, expect } from "bun:test";
import { fromHex, toHex } from "../dynamic-value/cbor";
import { ofEntries, stringCompare } from "../z-set/z-set";
import { CborDeltaCodec } from "./delta-codec";
import { InMemoryDeltaLog } from "./delta-log";
import { InMemorySnapshotStore } from "./snapshot-store";
import { RecoverableSpine } from "./recoverable-spine";
const numCompare = (a, b) => a - b;
const keyEnc = (i) => ({ t: "int", v: i.toString() });
const keyDec = (t) => {
    if (t.t !== "int") {
        throw new Error(`Expected int, got ${t.t}`);
    }
    return parseInt(t.v, 10);
};
test("CborDeltaCodec round-trips losslessly", () => {
    const codec = new CborDeltaCodec(numCompare, keyEnc, keyDec);
    const sample = ofEntries(numCompare, [
        { e: 1, w: 1 },
        { e: 2, w: 3 },
        { e: 5, w: -2 },
        { e: 9, w: 1 },
    ]);
    const encoded = codec.encode(sample);
    const decoded = codec.decode(encoded);
    expect(decoded).toEqual(sample);
});
test("CBOR encoding is deterministic (same delta -> same bytes)", () => {
    const codec = new CborDeltaCodec(numCompare, keyEnc, keyDec);
    const sample = ofEntries(numCompare, [
        { e: 1, w: 1 },
        { e: 2, w: 3 },
    ]);
    expect(toHex(codec.encode(sample))).toBe(toHex(codec.encode(sample)));
});
test("empty delta round-trips through CBOR codec", () => {
    const codec = new CborDeltaCodec(numCompare, keyEnc, keyDec);
    const sample = ofEntries(numCompare, []);
    expect(codec.decode(codec.encode(sample))).toEqual(sample);
});
test("CBOR delta codec matches the byte-locked golden vectors (treaty)", () => {
    const codec = new CborDeltaCodec(numCompare, keyEnc, keyDec);
    const vectors = [
        ["empty", [], "80"],
        ["single", [[1, 1]], "81820101"],
        ["multi", [[1, 1], [2, 3]], "82820101820203"],
        ["retraction", [[5, -2], [7, 1]], "82820521820701"],
    ];
    for (const [, pairs, expected] of vectors) {
        const z = ofEntries(numCompare, pairs.map(([e, w]) => ({ e, w })));
        const encoded = codec.encode(z);
        expect(toHex(encoded)).toBe(expected);
        const decoded = codec.decode(fromHex(expected));
        expect(decoded).toEqual(z);
    }
});
test("RecoverableSpine recovery flow works", async () => {
    const log = new InMemoryDeltaLog();
    const snap = new InMemorySnapshotStore();
    const spine = new RecoverableSpine(stringCompare, log, snap, [], 0);
    spine.setAutoSnapshotEvery(2);
    // Commit 1
    const d1 = ofEntries(stringCompare, [{ e: "a", w: 1 }]);
    const s1 = await spine.commit(d1);
    expect(s1).toBe(1);
    expect(spine.consolidate()).toEqual(d1);
    // Commit 2 -> triggers auto-snapshot (every 2) + log truncate(2)
    const d2 = ofEntries(stringCompare, [{ e: "b", w: 2 }]);
    const s2 = await spine.commit(d2);
    expect(s2).toBe(2);
    expect(spine.consolidate()).toEqual(ofEntries(stringCompare, [{ e: "a", w: 1 }, { e: "b", w: 2 }]));
    // Log should now be truncated at 2, and highWater is 2.
    // Commit 3
    const d3 = ofEntries(stringCompare, [{ e: "a", w: -1 }, { e: "c", w: 3 }]);
    const s3 = await spine.commit(d3);
    expect(s3).toBe(3);
    // Consolidated state at 3: b:2, c:3 (a:1 + a:-1 nets to 0 and drops)
    const expectedState = ofEntries(stringCompare, [{ e: "b", w: 2 }, { e: "c", w: 3 }]);
    expect(spine.consolidate()).toEqual(expectedState);
    // Now simulate recovery from the snapshot store + log tail
    const recovered = await RecoverableSpine.recover(stringCompare, log, snap);
    expect(recovered.getAppliedSeq()).toBe(3);
    expect(recovered.consolidate()).toEqual(expectedState);
});
