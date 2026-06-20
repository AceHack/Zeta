import { test, expect } from "bun:test";
import vectors from "./golden-vectors-merkle-proofs.json";
import { MerkleTree, verifyProof, toHex, type ProofStep } from "./merkle";

// Cross-language byte-lock: the TS Merkle inclusion-proof path must match the F#
// canonical shape (src/Core/Merkle.fs `Proof`/`verifyProof`) byte-for-byte over
// the same leaves. The fixture golden-vectors-merkle-proofs.json was frozen from
// the F# treaty (22 vectors, hex-in-JSON). Each row carries the leaves, the proven
// leaf index, the committed sibling path ({hash, right}), and the root. If this
// passes, the TS leg agrees with F#/C#/Rust on every inclusion proof — closing the
// TYPESCRIPT oracle leg of the 4-language Merkle proof byte-lock.

const hexToBytes = (s: string): Uint8Array => {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
};

interface Sibling {
  hash: string;
  right: boolean;
}

interface Case {
  leaves: string[];
  index: number;
  siblings: Sibling[];
  root: string;
}

const cases = vectors as Case[];

test("proof golden vectors are present", () => {
  expect(cases.length).toBe(22);
});

for (let i = 0; i < cases.length; i++) {
  const c = cases[i]!;
  test(`Merkle proof matches F# golden vector #${i} (${c.leaves.length} leaves, index ${c.index})`, () => {
    const leaves = c.leaves.map(hexToBytes);
    const tree = new MerkleTree(leaves);

    // (a) The computed sibling path reproduces the committed vector byte-for-byte
    //     (sibling hash hex + the right flag), in order.
    const steps: ProofStep[] = tree.proof(c.index);
    const got = steps.map((s) => ({ hash: toHex(s.sibling), right: s.right }));
    const expected = c.siblings.map((s) => ({ hash: s.hash, right: s.right }));
    expect(got).toEqual(expected);

    // (b) Root matches.
    expect(toHex(tree.root())).toBe(c.root);

    // (c) verifyProof folds the proven leaf up to the committed root.
    const rootHash = { hi: BigInt("0x" + c.root.slice(0, 16)), lo: BigInt("0x" + c.root.slice(16)) };
    expect(verifyProof(leaves[c.index]!, steps, rootHash)).toBe(true);

    // (d) Tampered leaf does not verify (flip byte 0, or use [0] if the leaf is empty).
    const tampered = new Uint8Array(leaves[c.index]!);
    if (tampered.length === 0) {
      expect(verifyProof(new Uint8Array([0]), steps, rootHash)).toBe(false);
    } else {
      tampered[0] = tampered[0]! ^ 0xff;
      expect(verifyProof(tampered, steps, rootHash)).toBe(false);
    }
  });
}
