import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { measureText, add, sum, Zero, ofBytes } from "./byte-cost";
const seed = seedJson;
test("seed identifies as byte-cost v1 in utf8-bytes", () => {
    expect(seed.primitive).toBe("byte-cost");
    expect(seed.version).toBe("v1");
    expect(seed.unit).toBe("utf8-bytes");
    expect(seed.vectors.length).toBeGreaterThan(0);
});
for (const v of seed.vectors) {
    test(`byte-lock measure: ${v.name}`, () => {
        expect(measureText(v.text).bytes).toBe(v.bytes);
    });
}
test("monoid: Zero is identity and empty text costs Zero", () => {
    expect(measureText("")).toEqual(Zero);
    const a = ofBytes(7);
    expect(add(a, Zero)).toEqual(a);
    expect(add(Zero, a)).toEqual(a);
});
test("sum is order-independent (sound DORA aggregate)", () => {
    const costs = seed.vectors.map((v) => measureText(v.text));
    expect(sum(costs)).toEqual(sum([...costs].reverse()));
});
