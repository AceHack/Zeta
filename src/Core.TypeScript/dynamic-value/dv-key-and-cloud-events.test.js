import { describe, test, expect } from "bun:test";
import {} from "./types";
import { DvKey } from "./dv-key";
import * as CE from "./cloud-events";
describe("DvKey", () => {
    const row = (kvs) => {
        return DvKey.ofValue({ t: "obj", v: kvs });
    };
    test("equal Tagged rows give equal keys; distinct give distinct keys", () => {
        const a = row([["id", { t: "int", v: "1" }], ["name", { t: "str", v: "x" }]]);
        const a2 = row([["id", { t: "int", v: "1" }], ["name", { t: "str", v: "x" }]]);
        const b = row([["id", { t: "int", v: "2" }], ["name", { t: "str", v: "x" }]]);
        expect(a.equals(a2)).toBe(true);
        expect(a.getHashCode()).toBe(a2.getHashCode());
        expect(a.equals(b)).toBe(false);
    });
    test("DvKey lexicographical comparison compares canonical bytes", () => {
        const a = row([["id", { t: "int", v: "1" }]]);
        const b = row([["id", { t: "int", v: "2" }]]);
        expect(a.compareTo(b)).toBeLessThan(0);
        expect(b.compareTo(a)).toBeGreaterThan(0);
        expect(a.compareTo(a)).toBe(0);
    });
});
describe("CloudEvents", () => {
    test("create yields a valid v1.0 event; validate catches a missing required attribute", () => {
        const e = CE.create("id-1", "/zeta/source", "com.zeta.change", { t: "int", v: "7" });
        expect(e.specversion).toBe("1.0");
        expect(CE.validate(e).ok).toBe(true);
        const missingId = { ...e, id: "" };
        const validationResult = CE.validate(missingId);
        expect(validationResult.ok).toBe(false);
        if (!validationResult.ok) {
            expect(validationResult.error).toContain("id");
        }
    });
    test("toDynamic ∘ ofDynamic round-trips (required + optionals + extensions + data)", () => {
        const e = {
            ...CE.create("id-2", "/s", "t", { t: "str", v: "payload" }),
            time: "2026-06-07T00:00:00Z",
            dataschema: "schema://v2",
            extensions: [["iodebeziumop", "c"], ["traceparent", "abc"]],
        };
        const parsedResult = CE.ofDynamic(CE.toDynamic(e));
        expect(parsedResult.ok).toBe(true);
        if (parsedResult.ok) {
            expect(parsedResult.value).toEqual(e);
        }
    });
    test("ofDynamic rejects a non-object and an object missing required attributes", () => {
        const nonObj = CE.ofDynamic({ t: "int", v: "1" });
        expect(nonObj.ok).toBe(false);
        const missingAttrs = CE.ofDynamic({
            t: "obj",
            v: [["id", { t: "str", v: "x" }]],
        });
        expect(missingAttrs.ok).toBe(false);
    });
    test("unknown string keys become extension attributes, core keys do not", () => {
        const dv = {
            t: "obj",
            v: [
                ["specversion", { t: "str", v: "1.0" }],
                ["id", { t: "str", v: "i" }],
                ["source", { t: "str", v: "s" }],
                ["type", { t: "str", v: "t" }],
                ["myext", { t: "str", v: "v" }],
                ["data", { t: "int", v: "5" }],
            ],
        };
        const parsedResult = CE.ofDynamic(dv);
        expect(parsedResult.ok).toBe(true);
        if (parsedResult.ok) {
            expect(parsedResult.value.extensions).toEqual([["myext", "v"]]);
            expect(parsedResult.value.data).toEqual({ t: "int", v: "5" });
        }
    });
});
