// 1000x DST for the dual-key set — the "not done until regenerate/rotate retested
// 1000x" bar, for rotation. Two properties, each 1000 cycles, watchable here + in CI:
//   (1) DETERMINISM  — same seeds -> byte-identical public set, 1000x, 0 drift.
//   (2) GAPLESS CHAIN — rotate 1000 times in a chain; at EVERY link the set is
//                       well-formed (>=2 keys, never single-key) and the promoted
//                       active is byte-identical to the prior standby (continuity).
// Run: bun test keyset.dst1000.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { makeKeyringSet, rotate, assertWellFormed, publicSet } from "./keyset.js";
import { freshMnemonic } from "./derive.js";
const HERE = new URL(".", import.meta.url).pathname;
const gv = JSON.parse(readFileSync(HERE + "golden-vectors-keyring.json", "utf8"));
const A = gv.input.mnemonic;
const B = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const C = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const N = 1000;
test(`(1) rotation is byte-deterministic across ${N} cycles (0 drift)`, () => {
    const canonical = JSON.stringify(publicSet(rotate(makeKeyringSet(A, B, "zeta"), C)));
    let drift = 0;
    for (let i = 0; i < N; i++) {
        if (JSON.stringify(publicSet(rotate(makeKeyringSet(A, B, "zeta"), C))) !== canonical)
            drift++;
    }
    expect(drift).toBe(0);
}, 180_000);
test(`(2) a ${N}-link rotation chain is gapless + continuous at every link`, () => {
    let set = makeKeyringSet(A, B, "zeta");
    let breaks = 0, discontinuities = 0;
    for (let i = 0; i < N; i++) {
        const priorStandbyEth = set.standby[0].keyring.eth.address;
        set = rotate(set, freshMnemonic()); // fresh standby each link
        try {
            assertWellFormed(set);
        }
        catch {
            breaks++;
        } // never single-key
        if (set.active.keyring.eth.address !== priorStandbyEth)
            discontinuities++; // promoted == prior standby
    }
    expect(breaks).toBe(0);
    expect(discontinuities).toBe(0);
    expect(set.retired.length).toBe(N); // every retiring active recorded for revocation
}, 120_000);
