import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
const source = readFileSync(join(import.meta.dir, "ZetaReferenceOracle.qs"), "utf-8");
const flowBitApplyOperations = [
    "ApplyExternalBitDifferentiator",
    "ApplyExternalBitDistinguishZero",
    "ApplyExternalBitDistinguishOne",
];
function operationBody(name) {
    const declarationStart = source.indexOf(`operation ${name}(`);
    expect(declarationStart).toBeGreaterThanOrEqual(0);
    if (declarationStart < 0) {
        return "";
    }
    const bodyStart = source.indexOf("{", declarationStart);
    expect(bodyStart).toBeGreaterThanOrEqual(0);
    if (bodyStart < 0) {
        return "";
    }
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        const character = source[index];
        if (character === "{") {
            depth += 1;
        }
        else if (character === "}") {
            depth -= 1;
            if (depth === 0) {
                return source.slice(bodyStart + 1, index);
            }
        }
    }
    expect(depth).toBe(0);
    return "";
}
function expectNoTerminalReadout(name) {
    const body = operationBody(name);
    expect(body).not.toMatch(/\bM\s*\(/);
    expect(body).not.toMatch(/\bMeasure\b/);
    expect(body).not.toMatch(/\bReset(?:All)?\s*\(/);
}
describe("Q# flow-bit source treaty", () => {
    test("keeps external entropy differentiation as H, optional Z, H", () => {
        const differentiator = operationBody("ApplyExternalBitDifferentiator");
        expect(differentiator).toContain("H(qs[0]);");
        expect(differentiator).toContain("if externalBit");
        expect(differentiator).toContain("Z(qs[0]);");
        expect(differentiator.match(/H\(qs\[0\]\);/g)).toHaveLength(2);
    });
    test("names the two measured identity branches without changing the live circuit", () => {
        expect(operationBody("ApplyExternalBitDistinguishZero")).toContain("ApplyExternalBitDifferentiator(false, qs);");
        expect(operationBody("ApplyExternalBitDistinguishOne")).toContain("ApplyExternalBitDifferentiator(true, qs);");
        for (const name of flowBitApplyOperations) {
            expectNoTerminalReadout(name);
        }
    });
    test("confines collapse to the terminal self-contained Q# readout operation", () => {
        const measurement = operationBody("MeasureExternalBitDifferentiator");
        expect(measurement).toContain("ApplyExternalBitDifferentiator(externalBit, [q]);");
        expect(measurement).toContain("let measured = M(q);");
        expect(measurement).toContain("Reset(q);");
        expect(measurement).toContain("return measured;");
    });
});
