// Fidelity tests for the ZSetMerkle inclusion-proof primitive (math-team row 4).
//
// These pin the third-party-verification property HERE (independent of the
// emitters): a committed proof string folds up to its embedded root, and any
// single-character corruption of the leaf, weight, sibling, or direction breaks
// that fold. Pairs with compare.ts (N-way agreement) — together they are the
// completeness + soundness witness, cross-language.
import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { ofBytes, toHex } from "../../../src/Core.TypeScript/merkle/merkle";
const dir = import.meta.dir;
const fsharp = JSON.parse(readFileSync(`${dir}/fsharp-output.json`, "utf8"));
const ts = JSON.parse(readFileSync(`${dir}/ts-output.json`, "utf8"));
function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
    return out;
}
function hashOfHex(hex) {
    return { hi: BigInt("0x" + hex.slice(0, 16)), lo: BigInt("0x" + hex.slice(16, 32)) };
}
function leafBytes(keyBytes, weight) {
    const buf = new Uint8Array(4 + keyBytes.length + 8);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setInt32(0, keyBytes.length, true);
    buf.set(keyBytes, 4);
    view.setBigInt64(4 + keyBytes.length, weight, true);
    return buf;
}
function combine(a, b) {
    const buf = new Uint8Array(32);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setBigUint64(0, a.hi, true);
    view.setBigUint64(8, a.lo, true);
    view.setBigUint64(16, b.hi, true);
    view.setBigUint64(24, b.lo, true);
    return ofBytes(buf);
}
function verifyProofString(s) {
    const parts = s.split("|");
    if (parts.length !== 3)
        return false;
    const [rootHex, leafPart, pathPart] = parts;
    const colon = leafPart.lastIndexOf(":");
    if (colon < 0)
        return false;
    const leafHex = leafPart.slice(0, colon);
    const weight = BigInt(leafPart.slice(colon + 1));
    let acc = ofBytes(leafBytes(hexToBytes(leafHex), weight));
    if (pathPart.length > 0) {
        for (const step of pathPart.split(",")) {
            const dir = step[0];
            const sib = hashOfHex(step.slice(1));
            if (dir === "R")
                acc = combine(acc, sib);
            else if (dir === "L")
                acc = combine(sib, acc);
            else
                return false;
        }
    }
    return toHex(acc) === rootHex;
}
test("the two oracles agree on every inclusion proof (byte-lock)", () => {
    const ids = Object.keys(fsharp).sort();
    expect(ids.length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(ts).sort()).toEqual(ids);
    for (const id of ids)
        expect(ts[id]).toBe(fsharp[id]);
});
test("every committed proof verifies against its embedded root", () => {
    for (const [id, proof] of Object.entries(fsharp)) {
        expect(verifyProofString(proof), `proof ${id} must verify`).toBe(true);
    }
});
test("corrupting the proven weight breaks verification", () => {
    const p = fsharp["pair-left"];
    const [root, leaf, path] = p.split("|");
    const [leafHex, w] = leaf.split(":");
    const tampered = `${root}|${leafHex}:${Number(w) + 1}|${path}`;
    expect(verifyProofString(tampered)).toBe(false);
});
test("corrupting a sibling digest breaks verification", () => {
    const p = fsharp["pair-left"];
    const last = p.slice(-1);
    const tampered = p.slice(0, -1) + (last === "0" ? "1" : "0");
    expect(verifyProofString(tampered)).toBe(false);
});
test("flipping an asymmetric direction flag breaks verification", () => {
    // eight-leaf-balanced's last step is `L<sib>` (combine(sib, acc)); flipping it to
    // `R` reorders the combine and must change the fold. (NB: a step whose sibling is
    // the node ITSELF — the odd-node self-pairing — is symmetric, so flipping THAT
    // flag is a genuine no-op; we deliberately target the asymmetric `,L` step.)
    const p = fsharp["eight-leaf-balanced"];
    const tampered = p.replace(",L", ",R");
    expect(tampered).not.toBe(p);
    expect(verifyProofString(tampered)).toBe(false);
});
test("single-leaf proof has an empty path and still verifies", () => {
    const p = fsharp["singleton"];
    expect(p.endsWith("|")).toBe(true); // no steps
    expect(verifyProofString(p)).toBe(true);
});
