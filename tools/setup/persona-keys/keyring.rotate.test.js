// Rotation conformance — drive keyring.sh `rotate` end-to-end (both paths) in TS,
// so rotation is proven correct in the TS oracle BEFORE the F#/C#/Rust buildout.
//   rotate -> [i]mport of the golden seed  == deterministic (reproduces golden), status self-custody
//   rotate -> [g]enerate                    == fresh, valid, differs from golden, status self-custody
//   generate                                == status bootstrap-test (provisional until rotated)
// Run: bun test keyring.rotate.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const HERE = new URL(".", import.meta.url).pathname;
const KEYRING = join(HERE, "keyring.sh");
const gv = JSON.parse(readFileSync(join(HERE, "golden-vectors-keyring.json"), "utf8"));
// run keyring.sh with piped stdin; --public-only (no sink) into a throwaway --out dir
async function run(mode, name, stdin) {
    const out = mkdtempSync(join(tmpdir(), "zk-rot-"));
    const p = Bun.spawn(["bash", KEYRING, mode, name, "--public-only", "--out", out], {
        stdin: new TextEncoder().encode(stdin), stdout: "pipe", stderr: "pipe",
    });
    await p.exited;
    const pub = JSON.parse(readFileSync(join(out, "keyring-public.json"), "utf8"));
    rmSync(out, { recursive: true, force: true });
    return { pub, code: p.exitCode };
}
test("rotate -> import of the golden seed is deterministic (reproduces golden) + self-custody", async () => {
    // choice 'i', then the seed on the hidden read
    const { pub, code } = await run("rotate", "zeta", `i\n${gv.input.mnemonic}\n`);
    expect(code).toBe(0);
    expect(pub.eth).toBe(gv.expected.eth.address);
    expect(pub.nostr_npub).toBe(gv.expected.nostr.npub);
    expect(pub.status).toBe("self-custody");
});
test("rotate -> generate yields a fresh self-custody keyring that differs from golden", async () => {
    // choice 'g', then 'SAVED' to confirm the shown seed
    const { pub, code } = await run("rotate", "zeta", `g\nSAVED\n`);
    expect(code).toBe(0);
    expect(pub.status).toBe("self-custody");
    expect(pub.eth).toMatch(/^0x[0-9a-f]{40}$/);
    expect(pub.eth).not.toBe(gv.expected.eth.address); // fresh random seed
});
test("generate marks keys bootstrap-test (provisional until rotated)", async () => {
    const { pub, code } = await run("generate", "zeta", "");
    expect(code).toBe(0);
    expect(pub.status).toBe("bootstrap-test");
});
