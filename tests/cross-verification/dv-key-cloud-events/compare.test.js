import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {} from "../../../src/Core.TypeScript/dynamic-value/types";
import { DvKey } from "../../../src/Core.TypeScript/dynamic-value/dv-key";
import { canonicalCbor } from "../../../src/Core.TypeScript/dynamic-value/cbor";
import { canonicalJson } from "../../../src/Core.TypeScript/dynamic-value/json";
import * as CE from "../../../src/Core.TypeScript/dynamic-value/cloud-events";
const vectorsJsonPath = join(import.meta.dir, "vectors.json");
function toHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
describe("Cross-Language Golden Vectors Parity", () => {
    const content = readFileSync(vectorsJsonPath, "utf8");
    const data = JSON.parse(content);
    test("DvKey vectors match expected canonical CBOR and FNV-1a hash", () => {
        for (const vec of data.dv_key_vectors) {
            const key = DvKey.ofValue(vec.value);
            const actualCborHex = toHex(key.canonical);
            const actualHash = key.getHashCode().toString();
            expect(actualCborHex).toBe(vec.expected_cbor_hex);
            expect(actualHash).toBe(vec.expected_hash);
        }
    });
    test("CloudEvent vectors match expected canonical JSON and CBOR serialization", () => {
        for (const vec of data.cloud_event_vectors) {
            const ce = CE.create(vec.event.id, vec.event.source, vec.event.type, vec.event.data);
            ce.time = vec.event.time;
            ce.subject = vec.event.subject;
            ce.datacontenttype = vec.event.datacontenttype;
            ce.dataschema = vec.event.dataschema;
            ce.extensions = vec.event.extensions;
            const dynamicVal = CE.toDynamic(ce);
            const jsonRes = canonicalJson(dynamicVal);
            expect(jsonRes.ok).toBe(true);
            if (jsonRes.ok) {
                expect(jsonRes.value).toBe(vec.expected_json);
            }
            const cborRes = canonicalCbor(dynamicVal);
            expect(cborRes.ok).toBe(true);
            if (cborRes.ok) {
                expect(toHex(new Uint8Array(cborRes.value))).toBe(vec.expected_cbor_hex);
            }
        }
    });
});
