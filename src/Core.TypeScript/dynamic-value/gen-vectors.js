import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {} from "./types";
import { DvKey } from "./dv-key";
import { canonicalCbor } from "./cbor";
import { canonicalJson } from "./json";
import * as CE from "./cloud-events";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vectorsJsonPath = join(__dirname, "../../../tests/cross-verification/dv-key-cloud-events/vectors.json");
function toHex(bytes) {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
function run() {
    const content = readFileSync(vectorsJsonPath, "utf8");
    const data = JSON.parse(content);
    // Process DvKey vectors
    for (const vec of data.dv_key_vectors) {
        const key = DvKey.ofValue(vec.value);
        vec.expected_cbor_hex = toHex(key.canonical);
        vec.expected_hash = key.getHashCode().toString();
    }
    // Process CloudEvent vectors
    for (const vec of data.cloud_event_vectors) {
        const ce = CE.create(vec.event.id, vec.event.source, vec.event.type, vec.event.data);
        ce.time = vec.event.time;
        ce.subject = vec.event.subject;
        ce.datacontenttype = vec.event.datacontenttype;
        ce.dataschema = vec.event.dataschema;
        ce.extensions = vec.event.extensions;
        const dynamicVal = CE.toDynamic(ce);
        const jsonRes = canonicalJson(dynamicVal);
        if (!jsonRes.ok)
            throw new Error(`JSON encode failed: ${jsonRes.error}`);
        vec.expected_json = jsonRes.value;
        const cborRes = canonicalCbor(dynamicVal);
        if (!cborRes.ok)
            throw new Error(`CBOR encode failed: ${cborRes.error}`);
        vec.expected_cbor_hex = toHex(new Uint8Array(cborRes.value));
    }
    writeFileSync(vectorsJsonPath, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`Successfully generated golden vectors in ${vectorsJsonPath}`);
}
run();
