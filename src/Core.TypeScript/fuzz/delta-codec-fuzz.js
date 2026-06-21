#!/usr/bin/env bun
// delta-codec-fuzz.ts — cross-oracle differential fuzzer loop.
// Generates random ZSets and validates that the TS and Rust CBOR delta codecs
// produce identical encodings and decode correctly.
/* eslint-disable sonarjs/pseudo-random */
import { join } from "node:path";
import { existsSync } from "node:fs";
import { CborDeltaCodec } from "../durability/delta-codec";
import { fromHex, toHex } from "../dynamic-value/cbor";
import { ofEntries } from "../z-set/z-set";
const numCompare = (a, b) => a - b;
const keyEnc = (i) => ({ t: "int", v: i.toString() });
const keyDec = (t) => {
    if (t.t !== "int")
        throw new Error(`Expected int key`);
    return parseInt(t.v, 10);
};
const codec = new CborDeltaCodec(numCompare, keyEnc, keyDec);
// 1. Locate the compiled Rust durability_fuzz binary
const repoRoot = join(import.meta.dirname, "../..");
const rustBin = join(repoRoot, "src/Core.Rust.Durability/target/debug/durability_fuzz");
if (!existsSync(rustBin)) {
    console.error(`Error: Rust fuzzer binary not found at ${rustBin}`);
    console.error("Please run: cargo build --bin durability_fuzz --manifest-path src/Core.Rust.Durability/Cargo.toml");
    process.exit(1);
}
// 2. Generate a random ZSet of int keys and safe int weights
function generateRandomZSet() {
    const size = Math.floor(Math.random() * 12); // size 0..11
    const pairs = [];
    const keys = new Set();
    for (let i = 0; i < size; i++) {
        let k = Math.floor(Math.random() * 200) - 100; // key in -100..100
        while (keys.has(k)) {
            k = Math.floor(Math.random() * 200) - 100;
        }
        keys.add(k);
        let w = 0;
        while (w === 0) {
            w = Math.floor(Math.random() * 100) - 50; // weight in -50..50
        }
        pairs.push([k, w]);
    }
    // CBOR treaty requires ascending key order
    pairs.sort((a, b) => a[0] - b[0]);
    return pairs;
}
const ITERATIONS = 1000;
let passes = 0;
let failures = 0;
console.log(`Starting cross-oracle differential fuzzing: ${ITERATIONS.toString()} iterations...`);
for (let i = 0; i < ITERATIONS; i++) {
    const zset = generateRandomZSet();
    const zsetStr = JSON.stringify(zset);
    // 1. TS encode
    const tsZSet = ofEntries(numCompare, zset.map(([e, w]) => ({ e, w })));
    const tsEncoded = codec.encode(tsZSet);
    const tsHex = toHex(tsEncoded);
    // 2. Rust decode TS-encoded hex
    const rustDecodeProc = Bun.spawnSync([rustBin, "decode", tsHex]);
    if (rustDecodeProc.exitCode !== 0) {
        console.error(`Iteration ${i.toString()} Fail: Rust decode failed to execute.`);
        console.error(rustDecodeProc.stderr.toString());
        failures++;
        continue;
    }
    const rustDecodedStr = rustDecodeProc.stdout.toString().trim();
    const rustDecodedPairs = JSON.parse(rustDecodedStr);
    // Verify TS elements match Rust decoded elements
    const tsZSetEntries = tsZSet.map((e) => [e.e, e.w]);
    if (JSON.stringify(tsZSetEntries) !== JSON.stringify(rustDecodedPairs)) {
        console.error(`Iteration ${i.toString()} Fail: Rust decoded ZSet does not match original.`);
        console.error(`Original:     ${zsetStr}`);
        console.error(`TS Normalized:${JSON.stringify(tsZSetEntries)}`);
        console.error(`Rust Decoded: ${rustDecodedStr}`);
        failures++;
        continue;
    }
    // 3. Rust encode ZSet
    const rustEncodeProc = Bun.spawnSync([rustBin, "encode", zsetStr]);
    if (rustEncodeProc.exitCode !== 0) {
        console.error(`Iteration ${i.toString()} Fail: Rust encode failed to execute.`);
        console.error(rustEncodeProc.stderr.toString());
        failures++;
        continue;
    }
    const rustHex = rustEncodeProc.stdout.toString().trim();
    // Verify CBOR hex output is identical between TS and Rust
    if (tsHex !== rustHex) {
        console.error(`Iteration ${i.toString()} Fail: CBOR hex mismatch.`);
        console.error(`TS Hex:   ${tsHex}`);
        console.error(`Rust Hex: ${rustHex}`);
        failures++;
        continue;
    }
    // 4. TS decode Rust-encoded hex
    const tsDecodedFromRust = codec.decode(fromHex(rustHex));
    const tsDecodedFromRustEntries = tsDecodedFromRust.map((e) => [e.e, e.w]);
    if (JSON.stringify(tsZSetEntries) !== JSON.stringify(tsDecodedFromRustEntries)) {
        console.error(`Iteration ${i.toString()} Fail: TS decoded from Rust hex does not match original.`);
        console.error(`Original:     ${zsetStr}`);
        console.error(`TS Decoded:   ${JSON.stringify(tsDecodedFromRustEntries)}`);
        failures++;
        continue;
    }
    passes++;
}
console.log(`\nFuzzing completed: ${passes.toString()} passed, ${failures.toString()} failed.`);
if (failures > 0) {
    process.exit(1);
}
else {
    console.log("✅ Cross-oracle differential verification successful.");
    process.exit(0);
}
