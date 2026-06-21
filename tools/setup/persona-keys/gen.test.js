// Keyring derivation conformance — the TS oracle must reproduce the golden-vector
// byte-lock BIT-PERFECT from the fixed test seed. This is the first of the 4x4
// (4 language oracles x 4 serializers) points of certainty; F#/C#/Rust + CBOR/
// Arrow/protobuf oracles must assert against the SAME `expected` block.
// Run: bun test (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
const gv = JSON.parse(readFileSync(new URL("./golden-vectors-keyring.json", import.meta.url), "utf8"));
test("TS oracle reproduces the keyring golden vector bit-perfect", async () => {
    const proc = Bun.spawn(["bun", new URL("./gen.ts", import.meta.url).pathname, "--user", gv.input.user, "--public-only"], { stdin: new TextEncoder().encode(gv.input.mnemonic), stdout: "pipe" });
    const out = JSON.parse(await new Response(proc.stdout).text());
    await proc.exited;
    // deep byte-lock: the entire public surface must match the golden vector exactly
    expect(out).toEqual(gv.expected);
});
test("derivation is deterministic across runs (same seed -> same output)", async () => {
    const run = async () => {
        const p = Bun.spawn(["bun", new URL("./gen.ts", import.meta.url).pathname, "--user", "zeta", "--public-only"], { stdin: new TextEncoder().encode(gv.input.mnemonic), stdout: "pipe" });
        const t = await new Response(p.stdout).text();
        await p.exited;
        return t;
    };
    expect(await run()).toBe(await run()); // byte-identical
});
