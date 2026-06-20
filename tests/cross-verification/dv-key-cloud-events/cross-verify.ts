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

const vectors = JSON.parse(readFileSync(join(import.meta.dir, "vectors.json"), "utf8")) as VectorsFile;
let mismatches = 0;

function fail(message: string): void {
  mismatches++;
  console.error(`  ${message}`);
}

console.log("dv-key-cloud-events cross-verification:");
console.log(`  DvKey vectors: ${vectors.dv_key_vectors.length}`);
console.log(`  CloudEvent vectors: ${vectors.cloud_event_vectors.length}`);

if (vectors.dv_key_vectors.length === 0) {
  fail("DvKey vector set is empty");
}

if (vectors.cloud_event_vectors.length === 0) {
  fail("CloudEvent vector set is empty");
}

for (const vector of vectors.dv_key_vectors) {
  const key = DvKey.ofValue(vector.value);
  const actualCborHex = toHex(key.canonical);
  const actualHash = key.getHashCode().toString();

  if (actualCborHex !== vector.expected_cbor_hex) {
    fail(`DvKey ${vector.id}: cbor mismatch got=${actualCborHex} expected=${vector.expected_cbor_hex}`);
  }

  if (actualHash !== vector.expected_hash) {
    fail(`DvKey ${vector.id}: hash mismatch got=${actualHash} expected=${vector.expected_hash}`);
  }
}

for (const vector of vectors.cloud_event_vectors) {
  const event = CE.create(vector.event.id, vector.event.source, vector.event.type, vector.event.data);
  event.time = vector.event.time;
  event.subject = vector.event.subject;
  event.datacontenttype = vector.event.datacontenttype;
  event.dataschema = vector.event.dataschema;
  event.extensions = vector.event.extensions;

  const dynamicValue = CE.toDynamic(event);
  const json = canonicalJson(dynamicValue);
  const cbor = canonicalCbor(dynamicValue);

  if (!json.ok) {
    fail(`CloudEvent ${vector.id}: canonical JSON rejected`);
  } else if (json.value !== vector.expected_json) {
    fail(`CloudEvent ${vector.id}: json mismatch got=${json.value} expected=${vector.expected_json}`);
  }

  if (!cbor.ok) {
    fail(`CloudEvent ${vector.id}: canonical CBOR rejected`);
  } else {
    const actualCborHex = toHex(new Uint8Array(cbor.value));

    if (actualCborHex !== vector.expected_cbor_hex) {
      fail(`CloudEvent ${vector.id}: cbor mismatch got=${actualCborHex} expected=${vector.expected_cbor_hex}`);
    }
  }
}

if (mismatches === 0) {
  console.log("  TS oracle agrees with every committed vector.");
  process.exit(0);
}

console.log(`  ${mismatches} mismatch(es).`);
process.exit(1);
