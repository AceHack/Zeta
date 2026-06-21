/**
 * g-set-view.test.ts — the bus AS a first-class G-Set (B-0954 on the G-Set foundation).
 *
 * Proves the cross-machine read-model: folding a clone's envelopes into a G-Set of
 * ids, merging N clones by G-Set union (commutative + idempotent — the CRDT laws
 * that make it coordination-free), the unseen-since-merge difference, and the
 * re-hydration back to envelopes.
 */
import { describe, expect, it } from "bun:test";
import { ofArray, stringCompare, toArray } from "../g-set/g-set";
import { busIdSet, envelopesIn, mergeViews, unseen } from "./g-set-view";
/** A minimal valid envelope for a given id (the view only reads `.id`). */
const env = (id) => ({
    topic: "shadow-catch",
    payload: { content: `msg ${id}` },
    id,
    from: "otto-cli",
    to: "*",
    timestamp: "2026-06-01T00:00:00.000Z",
    expiresAt: "2026-06-01T01:00:00.000Z",
});
const A = "a".repeat(32);
const B = "b".repeat(32);
const C = "c".repeat(32);
const D = "d".repeat(32);
describe("busIdSet — the bus AS a grow-only set of ids", () => {
    it("folds envelopes to a sorted-unique id set", () => {
        expect(toArray(busIdSet([env(C), env(A), env(B)]))).toEqual([A, B, C]);
    });
    it("is idempotent: duplicate-id envelopes collapse to one", () => {
        expect(toArray(busIdSet([env(A), env(A), env(B)]))).toEqual([A, B]);
    });
    it("empty clone → empty set", () => {
        expect(toArray(busIdSet([]))).toEqual([]);
    });
});
describe("mergeViews — cross-machine union (the whole cross-machine story)", () => {
    const cli = busIdSet([env(A), env(B)]);
    const windows = busIdSet([env(B), env(C)]);
    it("unions two machines' clones", () => {
        expect(toArray(mergeViews([cli, windows]))).toEqual([A, B, C]);
    });
    it("is commutative — merge order does not matter", () => {
        expect(toArray(mergeViews([cli, windows]))).toEqual(toArray(mergeViews([windows, cli])));
    });
    it("is idempotent — re-merging an included view changes nothing", () => {
        const once = mergeViews([cli, windows]);
        expect(toArray(mergeViews([once, cli, windows]))).toEqual(toArray(once));
    });
    it("empty merge → empty set", () => {
        expect(toArray(mergeViews([]))).toEqual([]);
    });
});
describe("unseen — what a peer's clone has that mine lacks", () => {
    it("returns the set difference theirs − mine", () => {
        const mine = ofArray(stringCompare, [A, B]);
        const theirs = ofArray(stringCompare, [B, C, D]);
        expect(unseen(mine, theirs)).toEqual([C, D]);
    });
    it("nothing new when theirs ⊆ mine", () => {
        const mine = ofArray(stringCompare, [A, B, C]);
        const theirs = ofArray(stringCompare, [A, B]);
        expect(unseen(mine, theirs)).toEqual([]);
    });
});
describe("envelopesIn — re-hydrate a merged id-set back to envelopes", () => {
    it("maps ids to envelopes via the lookup, dropping unknown ids", () => {
        const byId = new Map([
            [A, env(A)],
            [C, env(C)],
        ]);
        const merged = ofArray(stringCompare, [A, B, C]); // B has no envelope in byId
        const got = envelopesIn(merged, byId).map((e) => e.id);
        expect(got).toEqual([A, C]);
    });
});
