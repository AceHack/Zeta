import { describe, it, expect } from "bun:test";
import { sha256, sha256Hex } from "./sha256";
describe("sha256", () => {
    it("NIST empty string vector", () => {
        const input = new TextEncoder().encode("");
        expect(sha256Hex(input)).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    });
    it("NIST abc vector", () => {
        const input = new TextEncoder().encode("abc");
        expect(sha256Hex(input)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });
    it("NIST two-block vector", () => {
        const input = new TextEncoder().encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq");
        expect(sha256Hex(input)).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
    });
    it("sha256 returns 32-byte Uint8Array", () => {
        const input = new TextEncoder().encode("test");
        const digest = sha256(input);
        expect(digest).toBeInstanceOf(Uint8Array);
        expect(digest.length).toBe(32);
    });
    it("sha256 raw bytes and hex agree", () => {
        const input = new TextEncoder().encode("abc");
        const rawDigest = sha256(input);
        const hexDigest = sha256Hex(input);
        expect(Buffer.from(rawDigest).toString("hex")).toBe(hexDigest);
    });
});
