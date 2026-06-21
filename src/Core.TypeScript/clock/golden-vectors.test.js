import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { run, tick, delay, compare, ofInt, fromSeed, step } from "./clock";
const seed = seedJson;
test("seed identifies as clock v1", () => {
    expect(seed.primitive).toBe("clock");
    expect(seed.version).toBe("v1");
    expect(seed.vectors.length).toBeGreaterThan(0);
});
for (const v of seed.vectors) {
    test(`clock DST replay: ${v.name}`, () => {
        const got = run(BigInt(v.seed), v.steps).map((x) => Number(x.version));
        expect(got).toEqual(v.stamps);
    });
}
test("tick is the monotone unit step; delay undoes it", () => {
    const a = ofInt(41n);
    expect(tick(a).version).toBe(42n);
    expect(delay(tick(a))).toEqual(a);
});
test("compare is a total order; run is strictly increasing", () => {
    expect(compare(ofInt(1n), ofInt(2n))).toBe(-1);
    expect(compare(ofInt(2n), ofInt(2n))).toBe(0);
    expect(compare(ofInt(2n), ofInt(1n))).toBe(1);
    const stamps = run(5n, 8);
    for (let i = 0; i < stamps.length - 1; i++) {
        expect(stamps[i].version < stamps[i + 1].version).toBe(true);
    }
});
test("step advances by exactly one tick (= one versionstamp increment)", () => {
    const s = fromSeed(100n);
    expect(step(s).now.version).toBe(101n);
});
