import { describe, expect, test } from "bun:test";
import { EXTENDED_HAMMING_8_4_4_GENERATOR, enumerateCodewords, isDoublyEven, isSelfDual, weight, dotMod2, deriveKeySeed, adinkraEccProof, } from "./adinkra-ecc-prototype";
describe("Adinkra [8,4,4] ECC — 081KRW63S0008QG0R000QJR08H acceptance #3 constructive proof path", () => {
    const cw = enumerateCodewords(EXTENDED_HAMMING_8_4_4_GENERATOR);
    test("16 codewords (dim 4)", () => expect(cw.length).toBe(16));
    test("generator rows are weight 4 (doubly-even generators)", () => EXTENDED_HAMMING_8_4_4_GENERATOR.forEach((r) => expect(weight(r)).toBe(4)));
    test("DOUBLY-EVEN: all codeword weights divisible by 4", () => {
        expect(isDoublyEven(cw)).toBe(true);
        cw.forEach((c) => expect(weight(c) % 4).toBe(0));
    });
    test("SELF-DUAL: self-orthogonal + dim n/2", () => {
        expect(isSelfDual(cw)).toBe(true);
        cw.forEach((a) => cw.forEach((b) => expect(dotMod2(a, b)).toBe(0)));
    });
    test("key-seed is deterministic (same code → same seed)", () => {
        const a = deriveKeySeed(cw);
        const b = deriveKeySeed(enumerateCodewords([...EXTENDED_HAMMING_8_4_4_GENERATOR].reverse()));
        expect(a).toBe(b); // order-independent (canonical material)
        expect(a).toHaveLength(64); // SHA-256 hex
    });
    test("full proof path holds", () => {
        const p = adinkraEccProof();
        expect(p.doublyEven && p.selfDual).toBe(true);
        expect(p.dimension).toBe(4);
    });
});
