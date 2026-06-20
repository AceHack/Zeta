// dv-key-cloud-events cross-verification oracle (harness-recognized standalone form).
//
// The port (#56f330395 — DvKey + CloudEvents to C#/Rust/TS) shipped its
// cross-verification as `compare.test.ts` (a bun:test) + a Rust
// `cross_verify_dv_key_cloud_events.rs`, but `cross-verify-all.ts` runs the
// harness oracle as a STANDALONE script (`bun <dir>/compare.ts|cross-verify.ts`,
// exit code = pass/fail) — so the dir read as "no oracle (assert-don't-skip)".
// This is the same logic as `compare.test.ts`, runnable: the TS impl must
// reproduce `vectors.json`'s canonical CBOR/JSON/hash for every vector. The
// vectors.json IS the cross-language byte-lock anchor; Rust checks the same file
// independently in its own test, so agreement-with-canonical here = byte-lock.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Tagged } from "../../../src/Core.TypeScript/dynamic-value/types";
import { DvKey } from "../../../src/Core.TypeScript/dynamic-value/dv-key";
import { canonicalCbor } from "../../../src/Core.TypeScript/dynamic-value/cbor";
import { canonicalJson } from "../../../src/Core.TypeScript/dynamic-value/json";
import * as CE from "../../../src/Core.TypeScript/dynamic-value/cloud-events";

interface DvKeyVector {
  id: string;
  value: Tagged;
  expected_cbor_hex: string;
  expected_hash: string;
}

interface CloudEventVector {
  id: string;
  event: {
    id: string;
    source: string;
    specversion: string;
    type: string;
    time?: string;
    subject?: string;
    datacontenttype?: string;
    dataschema?: string;
    extensions: [string, string][];
    data?: Tagged;
  };
  expected_json: string;
  expected_cbor_hex: string;
}

interface VectorsFile {
  dv_key_vectors: DvKeyVector[];
  cloud_event_vectors: CloudEventVector[];
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const data = JSON.parse(readFileSync(join(import.meta.dir, "vectors.json"), "utf8")) as VectorsFile;

let mismatches = 0;

for (const vec of data.dv_key_vectors) {
  const key = DvKey.ofValue(vec.value);
  if (toHex(key.canonical) !== vec.expected_cbor_hex) {
    console.error(`  DvKey ${vec.id}: canonical CBOR mismatch`);
    mismatches++;
  }
  if (key.getHashCode().toString() !== vec.expected_hash) {
    console.error(`  DvKey ${vec.id}: hash mismatch`);
    mismatches++;
  }
}

for (const vec of data.cloud_event_vectors) {
  const ce = CE.create(vec.event.id, vec.event.source, vec.event.type, vec.event.data);
  ce.time = vec.event.time;
  ce.subject = vec.event.subject;
  ce.datacontenttype = vec.event.datacontenttype;
  ce.dataschema = vec.event.dataschema;
  ce.extensions = vec.event.extensions;

  const dynamicVal = CE.toDynamic(ce);

  const jsonRes = canonicalJson(dynamicVal);
  if (!jsonRes.ok || jsonRes.value !== vec.expected_json) {
    console.error(`  CloudEvent ${vec.id}: canonical JSON mismatch`);
    mismatches++;
  }

  const cborRes = canonicalCbor(dynamicVal);
  if (!cborRes.ok || toHex(new Uint8Array(cborRes.value)) !== vec.expected_cbor_hex) {
    console.error(`  CloudEvent ${vec.id}: canonical CBOR mismatch`);
    mismatches++;
  }
}

console.log(
  `dv-key-cloud-events cross-verify: ${data.dv_key_vectors.length} dv-key + ${data.cloud_event_vectors.length} cloud-event vectors, ${mismatches} mismatch(es).`,
);

if (mismatches > 0) process.exit(1);
console.log("  TS oracle agrees with canonical on all dv-key + cloud-event vectors.");
