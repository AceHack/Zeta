// Dual-key set conformance — proves "no single key, >=2 to rotate" as invariants.
// Run: bun test keyset.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { makeKeyringSet, rotate, assertWellFormed, publicSet, freshKeyringSet } from "./keyset.js";
const HERE = new URL(".", import.meta.url).pathname;
const gv = JSON.parse(readFileSync(HERE + "golden-vectors-keyring.json", "utf8"));
// two distinct known seeds for deterministic tests
const A = gv.input.mnemonic; // "test test ... junk"
const B = "legal winner thank year wave sausage worth useful legal winner thank yellow";
const C = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
test("a fresh set holds exactly one active + one standby (>=2), both well-formed", () => {
    const s = freshKeyringSet("zeta");
    expect(s.active.state).toBe("active");
    expect(s.standby.length).toBeGreaterThanOrEqual(1);
    assertWellFormed(s); // throws if malformed
});
test("active and standby derive from DIFFERENT seeds (one compromise must not take both)", () => {
    const s = makeKeyringSet(A, B, "zeta");
    expect(s.active.mnemonic).not.toBe(s.standby[0].mnemonic);
    expect(s.active.keyring.eth.address).not.toBe(s.standby[0].keyring.eth.address);
});
test("reusing a seed across slots is rejected (distinct-seed invariant)", () => {
    expect(() => makeKeyringSet(A, A, "zeta")).toThrow(/distinct/);
});
test("rotation is GAPLESS and CONTINUOUS: old standby becomes new active, byte-identical", () => {
    const s0 = makeKeyringSet(A, B, "zeta");
    const oldStandbyEth = s0.standby[0].keyring.eth.address;
    const s1 = rotate(s0, C);
    // continuity: the promoted keyring is byte-identical to what it was as standby
    expect(s1.active.keyring.eth.address).toBe(oldStandbyEth);
    expect(s1.active.keyring.eth.privkey).toBe(s0.standby[0].keyring.eth.privkey);
    // gapless: still >=2 keys at every step (1 active + >=1 standby), never single-key
    assertWellFormed(s1);
    // the retiring active is recorded for revocation, not silently dropped
    expect(s1.retired.map((r) => r.keyring.eth.address)).toContain(s0.active.keyring.eth.address);
    // the new standby is the fresh seed we supplied
    expect(s1.standby[s1.standby.length - 1].keyring.eth.address).toBe(makeKeyringSet(C, A, "zeta").active.keyring.eth.address);
});
test("rotation is deterministic given the fresh-standby seed (DST-replayable)", () => {
    const a = rotate(makeKeyringSet(A, B, "zeta"), C);
    const b = rotate(makeKeyringSet(A, B, "zeta"), C);
    expect(JSON.stringify(publicSet(a))).toBe(JSON.stringify(publicSet(b)));
});
test("rotating into a single-key state is forbidden", () => {
    // a hand-built malformed set with no standby must be rejected by both guards
    const s = makeKeyringSet(A, B, "zeta");
    const broken = { ...s, standby: [] };
    expect(() => assertWellFormed(broken)).toThrow(/single-key/);
    expect(() => rotate(broken, C)).toThrow(/single-key|no standby/);
});
test("publicSet leaks no private material", () => {
    const blob = JSON.stringify(publicSet(makeKeyringSet(A, B, "zeta")));
    expect(blob).not.toContain("nsec");
    expect(blob).not.toContain("privkey");
    expect(blob).not.toContain("priv_hex");
    expect(blob).not.toMatch(/BEGIN .*PRIVATE KEY/);
});
