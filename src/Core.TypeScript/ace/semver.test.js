import { describe, expect, test } from "bun:test";
import { parseVersion, compareVersions, parseRange, satisfies } from "./semver.js";
describe("parseVersion + compareVersions", () => {
    test("parses x.y.z", () => { expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 }); });
    test("rejects junk", () => { expect(parseVersion("1.2")).toBeNull(); expect(parseVersion("v1.2.3")).toBeNull(); expect(parseVersion("1.2.x")).toBeNull(); });
    test("orders numerically (not lexically)", () => {
        expect(compareVersions("1.2.3", "1.2.10")).toBe(-1);
        expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
        expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    });
});
describe("satisfies — exact / comparator / wildcard", () => {
    test("exact", () => { expect(satisfies("1.2.3", "1.2.3")).toBe(true); expect(satisfies("1.2.4", "1.2.3")).toBe(false); expect(satisfies("1.2.3", "=1.2.3")).toBe(true); });
    test("comparators", () => {
        expect(satisfies("1.5.0", ">=1.2.0")).toBe(true);
        expect(satisfies("1.1.0", ">=1.2.0")).toBe(false);
        expect(satisfies("1.2.0", "<2.0.0")).toBe(true);
        expect(satisfies("2.0.0", "<2.0.0")).toBe(false);
        expect(satisfies("1.2.0", ">1.2.0")).toBe(false);
        expect(satisfies("1.2.0", "<=1.2.0")).toBe(true);
    });
    test("wildcard * and x match any valid version", () => { expect(satisfies("9.9.9", "*")).toBe(true); expect(satisfies("0.0.1", "x")).toBe(true); });
    test("malformed range surfaces via parseRange error", () => { expect("error" in parseRange("@@@")).toBe(true); });
});
import { maxSatisfying } from "./semver.js";
import semverLib from "semver";
describe("caret / tilde desugaring", () => {
    test("^1.2.3 => >=1.2.3 <2.0.0", () => { expect(satisfies("1.9.0", "^1.2.3")).toBe(true); expect(satisfies("2.0.0", "^1.2.3")).toBe(false); expect(satisfies("1.2.2", "^1.2.3")).toBe(false); });
    test("^0.2.3 => >=0.2.3 <0.3.0", () => { expect(satisfies("0.2.9", "^0.2.3")).toBe(true); expect(satisfies("0.3.0", "^0.2.3")).toBe(false); });
    test("^0.0.3 => >=0.0.3 <0.0.4", () => { expect(satisfies("0.0.3", "^0.0.3")).toBe(true); expect(satisfies("0.0.4", "^0.0.3")).toBe(false); });
    test("~1.2.3 => >=1.2.3 <1.3.0", () => { expect(satisfies("1.2.9", "~1.2.3")).toBe(true); expect(satisfies("1.3.0", "~1.2.3")).toBe(false); });
});
describe("AND ranges + maxSatisfying", () => {
    test("space-AND", () => { expect(satisfies("1.5.0", ">=1.2.0 <2.0.0")).toBe(true); expect(satisfies("2.1.0", ">=1.2.0 <2.0.0")).toBe(false); });
    test("maxSatisfying picks newest in range", () => {
        expect(maxSatisfying(["1.0.0", "1.2.0", "1.9.0", "2.0.0"], "^1.0.0")).toBe("1.9.0");
        expect(maxSatisfying(["1.0.0", "2.0.0"], "^3.0.0")).toBeNull();
    });
});
describe("node-semver differential (oracle)", () => {
    const versions = ["0.0.1", "0.2.3", "0.2.9", "1.0.0", "1.2.3", "1.2.10", "1.9.0", "2.0.0", "2.3.4"];
    const ranges = ["1.2.3", "=1.2.3", ">=1.2.0", "<2.0.0", ">1.0.0 <2.0.0", "^1.2.3", "~1.2.3", "^0.2.3", "*"];
    test("our satisfies matches semver.satisfies for the corpus", () => {
        for (const v of versions)
            for (const r of ranges)
                expect(satisfies(v, r)).toBe(semverLib.satisfies(v, r));
    });
    test("our maxSatisfying matches semver.maxSatisfying for the corpus", () => {
        for (const r of ranges)
            expect(maxSatisfying(versions, r)).toBe(semverLib.maxSatisfying(versions, r));
    });
});
