// TS reference generator for the MessagePack cross-verification byte-lock.
// Reads tests/cross-verification/messagepack/vectors.json (run with cwd = that dir),
// computes canonical MessagePack bytes, and writes a flat ts-output.json keyed "id" -> msgpack hex.

import { type Tagged, toCanonicalMsgpack } from "../dynamic-value/msgpack";

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

interface MsgpackVec {
  id: string;
  value: Tagged;
  expected_msgpack: string;
}

const vec = JSON.parse(await Bun.file("vectors.json").text()) as {
  vectors: MsgpackVec[];
};

const out: Record<string, string> = {};
let mismatches = 0;

for (const v of vec.vectors) {
  const got = toHex(toCanonicalMsgpack(v.value));
  out[v.id] = got;
  if (got !== v.expected_msgpack) {
    mismatches++;
    console.error(`${v.id} MISMATCH\n  got=${got}\n  exp=${v.expected_msgpack}`);
  }
}

await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`MessagePack TS oracle: vectors=${vec.vectors.length}, ${mismatches} mismatches.`);
if (mismatches > 0) process.exit(1);
