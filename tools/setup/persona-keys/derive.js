// Zeta keyring derivation — the treaty's TS oracle, as a PURE importable function.
// ONE BIP-39 seed phrase -> every key type on its own derivation path (type-separated,
// no bleed). Audited libs only (@noble/@scure/micro-key-producer). Deterministic:
// same (mnemonic, user) -> byte-identical output (the byte-lock the DST tests prove).
import { secp256k1, schnorr } from "@noble/curves/secp256k1.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { HDKey as ED } from "micro-key-producer/slip10.js";
import { getKeys as sshKeys } from "micro-key-producer/ssh.js";
import { getKeys as pgpKeys } from "micro-key-producer/pgp.js";
import { bech32, base58 } from "@scure/base";
const CREATED = 1749427200; // fixed 2026-06-09 epoch -> deterministic PGP fingerprints
const enc = (a) => Buffer.from(a).toString("hex");
function convertbits(data, from, to, pad) {
    let acc = 0, bits = 0;
    const ret = [];
    const maxv = (1 << to) - 1;
    for (const b of data) {
        acc = (acc << from) | b;
        bits += from;
        while (bits >= to) {
            bits -= to;
            ret.push((acc >> bits) & maxv);
        }
    }
    if (pad && bits > 0)
        ret.push((acc << (to - bits)) & maxv);
    return Uint8Array.from(ret);
}
/** Fresh 24-word BIP-39 seed phrase (256-bit). The ONLY source of randomness here. */
export function freshMnemonic() { return generateMnemonic(wordlist, 256); }
/** Pure, deterministic keyring derivation. Returns { full (private), pub (public-only) }. */
export function deriveKeyring(mnemonic, user = "zeta") {
    if (!validateMnemonic(mnemonic, wordlist))
        throw new Error("invalid/empty mnemonic");
    const seed = mnemonicToSeedSync(mnemonic);
    const sk = HDKey.fromMasterSeed(seed); // secp256k1 (BIP-32)
    const ed = ED.fromMasterSeed(seed); // ed25519 (SLIP-0010)
    const eth = sk.derive("m/44'/60'/0'/0/0");
    const ethAddr = "0x" + enc(keccak_256(secp256k1.getPublicKey(eth.privateKey, false).slice(1)).slice(-20));
    const btc = sk.derive("m/84'/0'/0'/0/0");
    const h160 = ripemd160(sha256(secp256k1.getPublicKey(btc.privateKey, true)));
    const btcAddr = bech32.encode("bc", [0, ...convertbits(h160, 8, 5, true)]);
    const nos = sk.derive("m/44'/1237'/0'/0/0");
    const nXonly = schnorr.getPublicKey(nos.privateKey);
    const solP = ed.derive("m/44'/501'/0'/0'").privateKey;
    const solPub = ed25519.getPublicKey(solP);
    const sshSeed = ed.derive("m/44'/1110'/0'/0'").privateKey;
    const ssh = sshKeys(sshSeed, `${user}@lucent.financial`);
    const pgpSeed = ed.derive("m/44'/1111'/0'/0'").privateKey;
    const pgp = pgpKeys(pgpSeed, `${user} <${user}@lucent.financial>`, undefined, CREATED);
    const full = {
        user, mnemonic,
        ssh: { public: ssh.publicKey, fingerprint: ssh.fingerprint, private: ssh.privateKey, path: "m/44'/1110'/0'/0'" },
        pgp: { keyId: pgp.keyId, fingerprint: pgp.fingerprint, public: pgp.publicKey, private: pgp.privateKey, path: "m/44'/1111'/0'/0'" },
        nostr: { npub: bech32.encode("npub", bech32.toWords(nXonly)), nsec: bech32.encode("nsec", bech32.toWords(nos.privateKey)), pub_hex: enc(nXonly), path: "m/44'/1237'/0'/0/0" },
        eth: { address: ethAddr, privkey: "0x" + enc(eth.privateKey), path: "m/44'/60'/0'/0/0" },
        btc: { address: btcAddr, priv_hex: enc(btc.privateKey), path: "m/84'/0'/0'/0/0" },
        sol: { address: base58.encode(solPub), secret_base58: base58.encode(new Uint8Array([...solP, ...solPub])), path: "m/44'/501'/0'/0'" },
    };
    const pub = {
        user,
        ssh: { public: full.ssh.public, fingerprint: full.ssh.fingerprint, path: full.ssh.path },
        pgp: { keyId: full.pgp.keyId, fingerprint: full.pgp.fingerprint, public: full.pgp.public, path: full.pgp.path },
        nostr: { npub: full.nostr.npub, pub_hex: full.nostr.pub_hex, path: full.nostr.path },
        eth: { address: full.eth.address, path: full.eth.path },
        btc: { address: full.btc.address, path: full.btc.path },
        sol: { address: full.sol.address, path: full.sol.path },
    };
    return { full, pub };
}
