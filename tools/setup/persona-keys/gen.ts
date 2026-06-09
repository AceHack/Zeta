// Zeta keyring generator — ONE BIP-39 seed phrase -> every key type on its own
// derivation path (type-separated, no bleed). Audited libs only (@noble/@scure/micro-key-producer).
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
const enc = (a:Uint8Array)=>Buffer.from(a).toString("hex");
function convertbits(data:Uint8Array, from:number, to:number, pad:boolean){
  let acc=0,bits=0;const ret:number[]=[];const maxv=(1<<to)-1;
  for(const b of data){acc=(acc<<from)|b;bits+=from;while(bits>=to){bits-=to;ret.push((acc>>bits)&maxv);}}
  if(pad&&bits>0)ret.push((acc<<(to-bits))&maxv);
  return Uint8Array.from(ret);
}
// SECURITY: the seed phrase is NEVER read from argv (visible in ps/shell history).
// Either --generate a fresh one in-process, or read an existing one from STDIN.
const args = process.argv.slice(2);
const flag = (n:string)=>args.includes(n);
const opt  = (n:string)=>{const i=args.indexOf(n);return i>=0?args[i+1]:undefined;};
const user = opt("--user") || "zeta";
const publicOnly = flag("--public-only");
let mnemonic:string;
if(flag("--generate")){ mnemonic = generateMnemonic(wordlist, 256); }
else { mnemonic = (await Bun.stdin.text()).trim(); }
if(!validateMnemonic(mnemonic, wordlist)) throw new Error("invalid/empty mnemonic on stdin (use --generate for a fresh one)");
const seed = mnemonicToSeedSync(mnemonic);
const sk = HDKey.fromMasterSeed(seed);          // secp256k1 (BIP-32)
const ed = ED.fromMasterSeed(seed);             // ed25519 (SLIP-0010)

// ETH m/44'/60'/0'/0/0
const eth = sk.derive("m/44'/60'/0'/0/0");
const ethAddr = "0x"+enc(keccak_256(secp256k1.getPublicKey(eth.privateKey!,false).slice(1)).slice(-20));
// BTC m/84'/0'/0'/0/0 -> P2WPKH bech32
const btc = sk.derive("m/84'/0'/0'/0/0");
const h160 = ripemd160(sha256(secp256k1.getPublicKey(btc.privateKey!,true)));
const btcAddr = bech32.encode("bc",[0,...convertbits(h160,8,5,true)]);
// Nostr NIP-06 m/44'/1237'/0'/0/0 (x-only)
const nos = sk.derive("m/44'/1237'/0'/0/0");
const nXonly = schnorr.getPublicKey(nos.privateKey!);
// SOL m/44'/501'/0'/0' (ed25519 slip10)
const solP = ed.derive("m/44'/501'/0'/0'").privateKey;
const solPub = ed25519.getPublicKey(solP);
// SSH m/44'/1110'/0'/0' (Zeta convention, ed25519)
const sshSeed = ed.derive("m/44'/1110'/0'/0'").privateKey;
const ssh = sshKeys(sshSeed, `${user}@lucent.financial`);
// PGP m/44'/1111'/0'/0' (Zeta convention, ed25519)
const pgpSeed = ed.derive("m/44'/1111'/0'/0'").privateKey;
const pgp = pgpKeys(pgpSeed, `${user} <${user}@lucent.financial>`, undefined, CREATED);

const full = {
  user, mnemonic,
  ssh:{ public: ssh.publicKey, fingerprint: ssh.fingerprint, private: ssh.privateKey, path:"m/44'/1110'/0'/0'" },
  pgp:{ keyId: pgp.keyId, fingerprint: pgp.fingerprint, public: pgp.publicKey, private: pgp.privateKey, path:"m/44'/1111'/0'/0'" },
  nostr:{ npub: bech32.encode("npub",bech32.toWords(nXonly)), nsec: bech32.encode("nsec",bech32.toWords(nos.privateKey!)), pub_hex: enc(nXonly), path:"m/44'/1237'/0'/0/0" },
  eth:{ address: ethAddr, privkey:"0x"+enc(eth.privateKey!), path:"m/44'/60'/0'/0/0" },
  btc:{ address: btcAddr, priv_hex: enc(btc.privateKey!), path:"m/84'/0'/0'/0/0" },
  sol:{ address: base58.encode(solPub), secret_base58: base58.encode(new Uint8Array([...solP,...solPub])), path:"m/44'/501'/0'/0'" }
};
const pub = {
  user,
  ssh:{ public: full.ssh.public, fingerprint: full.ssh.fingerprint, path: full.ssh.path },
  pgp:{ keyId: full.pgp.keyId, fingerprint: full.pgp.fingerprint, public: full.pgp.public, path: full.pgp.path },
  nostr:{ npub: full.nostr.npub, pub_hex: full.nostr.pub_hex, path: full.nostr.path },
  eth:{ address: full.eth.address, path: full.eth.path },
  btc:{ address: full.btc.address, path: full.btc.path },
  sol:{ address: full.sol.address, path: full.sol.path }
};
console.log(JSON.stringify(publicOnly ? pub : full, null, 2));
