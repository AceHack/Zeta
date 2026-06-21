import { describe, expect, test } from "bun:test";
import { act, gen, permutation, writhe, writheParity } from "./braid";
import vectors from "./golden-vectors.json";
// Replays the shared golden seed (generated from the F# shelf, src/Core/Braid.fs) through the
// TS oracle; the C#/F#/Rust oracles replay the same file. Faithfulness (Artin 1925) means the
// action images pin braid identity exactly — agreement here is the four-oracle byte-lock for
// the REPORT #3 §2 kernel functor.
describe("Braid golden vectors", () => {
    test(`all ${vectors.vectors.length} vectors agree with the seed`, () => {
        const n = vectors.n;
        for (const v of vectors.vectors) {
            const label = JSON.stringify(v.braid);
            expect(writhe(v.braid), `writhe ${label}`).toBe(v.writhe);
            expect(writheParity(v.braid), `writheParity ${label}`).toBe(v.writheParity);
            expect(permutation(n, v.braid), `permutation ${label}`).toEqual(v.permutation);
            for (let i = 0; i < n; i++) {
                const image = act(v.braid, gen(i));
                expect(image.map((l) => [...l]), `action x_${i} ${label}`).toEqual(v.actions[i]);
            }
        }
    });
});
