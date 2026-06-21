import { test, expect } from "bun:test";
import seedJson from "./golden-vectors.json";
import { differentiate, integrate, curvature } from "./curve";
const seed = seedJson;
test("TS Curve agrees with the shared golden seed", () => {
    expect(seed.vectors.length).toBeGreaterThan(0);
    for (const v of seed.vectors) {
        expect(differentiate(v.input)).toEqual(v.rate);
        expect(integrate(v.input)).toEqual(v.integrate);
        expect(curvature(v.input)).toEqual(v.curvature);
    }
});
