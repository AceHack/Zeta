// 1000× keyring DST — the "no friction" / done-bar harness, watchable right here.
// Derives the keyring 1000 times from the byte-locked golden seed and proves the
// DETERMINISTIC surface is byte-identical every time (Aaron: "retest both 1000 times to
// reduce friction"). This is a DST test = a deterministic tick you can watch; GitHub
// workflows just automate it.   Run: bun test keyring.dst1000.test.ts
//
// FINDING (this DST test caught it — test-as-meta-interface): the **public surface**
// (addresses / pubkeys / fingerprints / npub) AND the **raw private key material**
// (eth/btc/sol/nostr private values) are deterministic + byte-locked. But the **SSH and
// PGP private ARMOR** (`ssh.private`, `pgp.private`) is intentionally NON-deterministic —
// OpenSSH adds random checkbytes; PGP adds a random salt/IV to the encrypted key block —
// so the armor bytes differ each derivation while encoding the SAME key (proven by the
// identical SSH/PGP fingerprints in the public surface). So the byte-lock is over the
// public surface + raw private material, NOT the armor bytes. (To byte-lock the armor too
// you'd pass fixed checkbytes/salt/IV — a future option; recorded here, not silently
// papered over.)
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { deriveKeyring } from "./derive.js";
const gv = JSON.parse(readFileSync(new URL("./golden-vectors-keyring.json", import.meta.url), "utf8"));
const N = 1000;
const canon = (o) => JSON.stringify(o);
// deterministic private MATERIAL (raw keys) — excludes ssh/pgp armor (random checkbytes/salt/IV)
const detPriv = (f) => JSON.stringify({ eth: f.eth.privkey, btc: f.btc.priv_hex, sol: f.sol.secret_base58, nostr_nsec: f.nostr.nsec, nostr_pub: f.nostr.pub_hex });
test("1000× keyring derivation: public surface byte-identical to golden + private material stable (DST byte-lock)", () => {
    const goldenPub = canon(gv.expected);
    let firstPriv = "";
    let pubMismatch = 0, privMismatch = 0;
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
        const { full, pub } = deriveKeyring(gv.input.mnemonic, gv.input.user);
        if (canon(pub) !== goldenPub)
            pubMismatch++; // public surface == the byte-lock, every run
        const p = detPriv(full);
        if (i === 0)
            firstPriv = p;
        else if (p !== firstPriv)
            privMismatch++; // raw private material stable
        if ((i + 1) % 200 === 0)
            console.log(`  …${i + 1}/${N} byte-identical (pub + private material)`);
    }
    console.log(`  ${N}/${N} derivations in ${Date.now() - t0}ms — pub mismatches=${pubMismatch}, priv-material mismatches=${privMismatch}`);
    expect(pubMismatch).toBe(0);
    expect(privMismatch).toBe(0);
}, 120_000);
test("armor is non-deterministic by design (same key, different bytes) — documented, not a regression", () => {
    // ssh.private / pgp.private differ across runs (random checkbytes/salt/IV) BUT the
    // fingerprints (public) are identical -> same key. This test asserts that expectation
    // so the non-determinism is a known, asserted property, not a silent surprise.
    const a = deriveKeyring(gv.input.mnemonic, gv.input.user).full;
    const b = deriveKeyring(gv.input.mnemonic, gv.input.user).full;
    expect(a.ssh.fingerprint).toBe(b.ssh.fingerprint); // same key…
    expect(a.pgp.fingerprint).toBe(b.pgp.fingerprint);
    expect(a.ssh.private === b.ssh.private && a.pgp.private === b.pgp.private).toBe(false); // …different armor
}, 30_000);
