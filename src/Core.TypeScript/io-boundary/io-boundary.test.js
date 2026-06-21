import { describe, expect, it } from "bun:test";
import { stringCompare } from "../z-set/z-set";
import * as ZSet from "../z-set/z-set";
import * as GSet from "../g-set/g-set";
import { emit, retract, compose, composeAll, fuse, input, genesis, output, toList, count, isEmpty, } from "./io-boundary";
const cmp = stringCompare;
describe("I/O Boundary — Laws & Transition Properties", () => {
    it("I/O boundary fuses composed signed interior into exterior G-set", () => {
        const interior = composeAll(cmp, [
            emit("life"),
            emit("life"),
            emit("identity"),
            retract("identity"),
            retract("void"),
        ]);
        const exterior = fuse(interior);
        expect(toList(exterior)).toEqual(["life"]);
        expect(count(exterior)).toBe(1);
    });
    it("I/O boundary composes before output so internal ledgers do not leak", () => {
        const insert = emit("boundary");
        const ret = retract("boundary");
        const composedOutput = fuse(compose(cmp, insert, ret));
        const leakedIfObservedTooEarly = GSet.union(cmp, output(fuse(insert)), output(fuse(ret)));
        expect(isEmpty(composedOutput)).toBe(true);
        expect(GSet.toArray(leakedIfObservedTooEarly)).toEqual(["boundary"]);
    });
    it("input and output name the I/O passage without exposing signed history", () => {
        const exterior = output(fuse(input(ZSet.ofEntries(cmp, [
            { e: "inside", w: 3 },
            { e: "outside", w: 1 },
            { e: "inside", w: -3 },
        ]))));
        expect(GSet.toArray(exterior)).toEqual(["outside"]);
    });
    it("genesis enters as add-only facts and exits sorted unique", () => {
        const exterior = fuse(genesis(cmp, ["zeta", "genesis", "zeta", "boundary"]));
        expect(toList(exterior)).toEqual(["boundary", "genesis", "zeta"]);
    });
    it("outside stays monotone after the boundary", () => {
        const first = output(fuse(emit("mark")));
        const absent = output(fuse(retract("mark")));
        const combined = GSet.union(cmp, first, absent);
        expect(GSet.toArray(combined)).toEqual(["mark"]);
    });
});
