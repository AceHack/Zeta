# Design memo — 081KSNY2Z0008QG0R002JKH50A v1 implementation (Noble + XWing + ML-DSA-65 + CBOR envelope)

**Status:** Design proposal post-decision-lock; pre-implementation. Operator locked 7 decisions on 081KSNY2Z0008QG0R0037X4DP4's open questions (per PR #5687). This memo extends 081KSNY2Z0008QG0R0037X4DP4's recommendation with those decisions baked in + sketches the v1 implementation surface.

**Author:** Otto-CLI synthesis (encryption-lane advance per 081KSNY2Z0008QG0R002QA720J three-lanes-concurrent operating discipline).

**Composition anchors:**

- [081KSNY2Z0008QG0R0037X4DP4 library landscape audit](./2026-05-28-pq-library-landscape-bouncy-castle-patterns-swapple-clarification-noble-recommendation.md) — parent audit; this memo extends with locked decisions
- 081KSNY2Z0008QG0R002JKH50A parent crypto substrate (P1 ASAP)
- 081KSNY2Z0008QG0R002ZAVMEK multi-cipher hedge (NIST + Saber + NTRU-Prime + FrodoKEM)
- 081KSNY2Z0008QG0R001FN4DDB side-channel scope boundary (git-at-rest only)
- 081KSNY2Z0008QG0R0020KXAPS metadata encryption follow-up (content-only v1)
- 081KSNY2Z0008QG0R0030V5ZVS agent private encrypted state (Otto + Addison ASAP consumer)
- 081KSNY2Z0008QG0R002QA720J three-lanes-concurrent operating discipline

---

## TL;DR

- **v1 ships with @noble/post-quantum** + XWing (ML-KEM-768 + X25519 hybrid) for KEM + ML-DSA-65 for signatures + CBOR envelope adapting RFC 9629 CMS+KEM pattern
- **Multi-cipher hedge** (081KSNY2Z0008QG0R002ZAVMEK): envelope alg-id is parameterized; Saber + NTRU Prime + FrodoKEM ship as alternates when TS-native impls mature
- **Content-only encryption** (081KSNY2Z0008QG0R0020KXAPS): filenames + commit messages + .gitattributes leak; metadata protection deferred to v2+
- **Bounded to git-at-rest threat model** (081KSNY2Z0008QG0R001FN4DDB): no timing-observable deployment; pure-JS Noble side-channel limitation explicit
- **Forward-only revocation** (081KSNY2Z0008QG0R0008EJDW1 future): recipient-set rotation supported; retroactive revocation needs content-addressed-store substrate (future B-NNNN)
- **Adinkras-ECC integration via parameterized seed source** (081KRW63S0008QG0R000QJR08H composes): ships v1 with random-bytes; 081KRW63S0008QG0R000QJR08H's Adinkra-derived seeds swap in later
- **Sonatype-guide as playbook step** (081KSNY2Z0008QG0R001NERKCY): NOT a PR-gated check; invoked from library-evaluation playbook before pull

---

## Module layout (recommended)

```text
tools/crypto/better-git-crypt/
  envelope.ts              # CBOR envelope spec + encode/decode
  types.ts                 # RecipientKey + FileEnvelope + EncryptionContext
  ciphers/
    registry.ts            # cipher dispatch by alg-id
    ml-kem-768.ts          # primary KEM (Noble; XWing hybrid)
    ml-dsa-65.ts           # primary signature (Noble)
    slh-dsa.ts             # signature alternate (hash-based; Noble)
    saber.ts               # KEM alternate (DEFERRED until TS-native impl)
    ntru-prime.ts          # KEM alternate (DEFERRED)
    frodo.ts               # KEM alternate (DEFERRED)
  recipients/
    manage.ts              # add/remove/rotate recipient keys
    storage.ts             # .zeta-crypt/recipients.json read/write
  files/
    encrypt.ts             # file → envelope
    decrypt.ts             # envelope → file
    textconv.ts            # git textconv filter integration (diff-readable)
  cli/
    main.ts                # bun CLI entry point
  seed/
    sources.ts             # SeedSource enum: random-bytes | adinkra-derived | hsm-derived
  test/
    *.test.ts              # unit tests + round-trip integration tests + KAT tests
```

## CBOR envelope format (v1)

Adapts RFC 9629 CMS+KEM pattern with CBOR encoding + signature-context-strings per BC 1.79+.

```cbor
{
  "v": 1,
  "ctx": "zeta.git-crypt.file.v1",                  // domain-separation
  "alg": {
    "kem": "ML-KEM-768+X25519",                     // XWing identifier; swappable via cipher registry
    "kdf": "HKDF-SHA256",
    "wrap": "ChaCha20-Poly1305-AEAD",
    "content": "ChaCha20-Poly1305"
  },
  "recipients": [
    {
      "id": "otto-cli@zeta",                        // matches RecipientKey.identity
      "kem_ct": <bytes>,                            // XWing ciphertext (per-recipient)
      "wrapped_cek": <bytes>,                       // CEK encrypted under KDF(shared_secret)
      "kdf_info": <bytes>                           // domain-separation tag for HKDF
    }
    // ... more recipients
  ],
  "content_nonce": <12 bytes>,                      // ChaCha20-Poly1305 nonce
  "content_ct": <bytes>,                            // file content encrypted under CEK
  "sig": {
    "alg": "ML-DSA-65",
    "signer": "otto-cli@zeta",
    "context": "zeta.git-crypt.file.v1",            // signature-context-string per BC 1.79+
    "value": <bytes>                                // ML-DSA-65 sig over (ctx || alg || recipients || content_nonce || content_ct)
  }
}
```

Per-recipient `kem_ct` + `wrapped_cek` is the RFC 9629 shape (one KEM per recipient; symmetric CEK shared). Single global `content_ct` so file body is encrypted once, not N times. Signature wraps entire envelope to prevent malleability.

## Type sketches (illustrative; not for commit until 081KSNY2Z0008QG0R002JKH50A implementation row activates)

```typescript
// types.ts
export type Identity = string;  // e.g., "otto-cli@zeta"

export type AlgId =
  | "ML-KEM-768+X25519"   // XWing; default
  | "ML-KEM-768"          // ML-KEM standalone
  | "Saber"               // Future; deferred to TS-native impl
  | "NTRU-Prime-sntrup761"
  | "Frodo-KEM-640";

export type SigAlgId = "ML-DSA-65" | "SLH-DSA-SHA2-128s";

export type RecipientKey = {
  identity: Identity;
  pqKemAlg: AlgId;
  pqKemPublic: Uint8Array;
  dsaAlg: SigAlgId;
  dsaPublic: Uint8Array;
  validFrom: string;       // ISO 8601
  validUntil?: string;     // forward-revocation surface
};

export type RecipientEntry = {
  id: Identity;
  kem_ct: Uint8Array;
  wrapped_cek: Uint8Array;
  kdf_info: Uint8Array;
};

export type EnvelopeAlg = {
  kem: AlgId;
  kdf: "HKDF-SHA256";
  wrap: "ChaCha20-Poly1305-AEAD" | "AES-256-KEYWRAP";
  content: "ChaCha20-Poly1305" | "AES-256-GCM";
};

export type EnvelopeSig = {
  alg: SigAlgId;
  signer: Identity;
  context: string;
  value: Uint8Array;
};

export type FileEnvelope = {
  v: 1;
  ctx: string;             // "zeta.git-crypt.file.v1"
  alg: EnvelopeAlg;
  recipients: ReadonlyArray<RecipientEntry>;
  content_nonce: Uint8Array;
  content_ct: Uint8Array;
  sig: EnvelopeSig;
};

export type SeedSource =
  | { kind: "random-bytes" }
  | { kind: "adinkra-derived"; descriptor: AdinkraDescriptor }   // future per 081KRW63S0008QG0R000QJR08H
  | { kind: "hsm-derived"; slot: string };                       // future per 081KRW63S0008QG0R0022SFKPM
```

## Cipher dispatch (parameterized hedge)

```typescript
// ciphers/registry.ts
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { xwing } from '@noble/post-quantum/hybrid';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';

export interface KemCipher {
  algId: AlgId;
  keygen(seed?: Uint8Array): { secretKey: Uint8Array; publicKey: Uint8Array };
  encapsulate(publicKey: Uint8Array): { cipherText: Uint8Array; sharedSecret: Uint8Array };
  decapsulate(cipherText: Uint8Array, secretKey: Uint8Array): Uint8Array;
}

export interface SigCipher {
  algId: SigAlgId;
  keygen(seed?: Uint8Array): { secretKey: Uint8Array; publicKey: Uint8Array };
  sign(message: Uint8Array, secretKey: Uint8Array, context?: string): Uint8Array;
  verify(sig: Uint8Array, message: Uint8Array, publicKey: Uint8Array, context?: string): boolean;
}

const kemRegistry = new Map<AlgId, KemCipher>([
  ["ML-KEM-768+X25519", xwingCipher],     // primary
  ["ML-KEM-768", mlKem768Cipher],         // alternate
  // Saber/NTRU-Prime/Frodo register here when TS-native impls mature
]);

const sigRegistry = new Map<SigAlgId, SigCipher>([
  ["ML-DSA-65", mlDsa65Cipher],           // primary
  ["SLH-DSA-SHA2-128s", slhDsaCipher],    // hash-based hedge per 081KSNY2Z0008QG0R002ZAVMEK
]);

export function getKem(algId: AlgId): KemCipher {
  const c = kemRegistry.get(algId);
  if (!c) throw new Error(`Unknown KEM alg: ${algId}`);
  return c;
}

export function getSig(algId: SigAlgId): SigCipher {
  const c = sigRegistry.get(algId);
  if (!c) throw new Error(`Unknown signature alg: ${algId}`);
  return c;
}
```

Cipher swap = register the new cipher's impl; envelope alg-id selects it. No structural envelope change. 081KSNY2Z0008QG0R002ZAVMEK multi-cipher hedge falls out for free.

## Encrypt / decrypt pseudocode

```typescript
// files/encrypt.ts
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/hashes/utils';
import * as cbor from '@stablelib/cbor';  // or another mature TS CBOR lib (Sonatype-gated)

export async function encryptFile(
  plaintext: Uint8Array,
  recipients: ReadonlyArray<RecipientKey>,
  signer: { identity: Identity; secretKey: Uint8Array; alg: SigAlgId },
  alg: EnvelopeAlg = DEFAULT_ALG,
): Promise<FileEnvelope> {
  // 1. Generate CEK (content encryption key) — 32 bytes
  const cek = randomBytes(32);
  const contentNonce = randomBytes(12);

  // 2. Per-recipient KEM encapsulation + CEK wrap
  const kem = getKem(alg.kem);
  const recipientEntries: RecipientEntry[] = recipients.map(r => {
    const { cipherText, sharedSecret } = kem.encapsulate(r.pqKemPublic);
    const kdfInfo = new TextEncoder().encode(`zeta.git-crypt.cek-wrap.v1:${r.identity}`);
    const wrapKey = hkdf(sha256, sharedSecret, undefined, kdfInfo, 32);
    const wrappedCek = chacha20poly1305(wrapKey).encrypt(new Uint8Array(12), cek);
    return { id: r.identity, kem_ct: cipherText, wrapped_cek: wrappedCek, kdf_info: kdfInfo };
  });

  // 3. Encrypt content with CEK
  const contentCt = chacha20poly1305(cek).encrypt(contentNonce, plaintext);

  // 4. Sign the envelope (everything except the signature itself)
  const sig = getSig(signer.alg);
  const toSign = cbor.encode({ v: 1, ctx: "zeta.git-crypt.file.v1", alg, recipients: recipientEntries, content_nonce: contentNonce, content_ct: contentCt });
  const sigValue = sig.sign(toSign, signer.secretKey, "zeta.git-crypt.file.v1");

  return {
    v: 1,
    ctx: "zeta.git-crypt.file.v1",
    alg,
    recipients: recipientEntries,
    content_nonce: contentNonce,
    content_ct: contentCt,
    sig: { alg: signer.alg, signer: signer.identity, context: "zeta.git-crypt.file.v1", value: sigValue },
  };
}

export async function decryptFile(
  envelope: FileEnvelope,
  recipient: { identity: Identity; secretKey: Uint8Array },
  signerPublicKeys: Map<Identity, { alg: SigAlgId; publicKey: Uint8Array }>,
): Promise<Result<Uint8Array, DecryptError>> {
  // 1. Verify signature first (catches tampering)
  const signerInfo = signerPublicKeys.get(envelope.sig.signer);
  if (!signerInfo) return err("unknown-signer");
  const sig = getSig(signerInfo.alg);
  const toVerify = cbor.encode({ v: envelope.v, ctx: envelope.ctx, alg: envelope.alg, recipients: envelope.recipients, content_nonce: envelope.content_nonce, content_ct: envelope.content_ct });
  if (!sig.verify(envelope.sig.value, toVerify, signerInfo.publicKey, envelope.sig.context)) {
    return err("signature-invalid");
  }

  // 2. Find recipient entry for this identity
  const entry = envelope.recipients.find(r => r.id === recipient.identity);
  if (!entry) return err("not-a-recipient");

  // 3. KEM decapsulate → shared secret → unwrap CEK
  //    Per FIPS 203 implicit rejection: decapsulate NEVER throws on bad ciphertext
  const kem = getKem(envelope.alg.kem);
  const sharedSecret = kem.decapsulate(entry.kem_ct, recipient.secretKey);
  const wrapKey = hkdf(sha256, sharedSecret, undefined, entry.kdf_info, 32);

  // CEK unwrap — MAC tag failure here = bad envelope (timing-safe)
  let cek: Uint8Array;
  try {
    cek = chacha20poly1305(wrapKey).decrypt(new Uint8Array(12), entry.wrapped_cek);
  } catch {
    return err("cek-unwrap-failed");   // ciphertext malformed OR wrong recipient
  }

  // 4. Decrypt content with CEK
  try {
    const plaintext = chacha20poly1305(cek).decrypt(envelope.content_nonce, envelope.content_ct);
    return ok(plaintext);
  } catch {
    return err("content-decrypt-failed");
  }
}
```

**Discipline points:**

- Verify signature FIRST (catches tampering before any decapsulation work)
- FIPS 203 implicit rejection: `kem.decapsulate` never throws on bad ciphertext (returns pseudo-random shared secret); MAC tag on `wrapped_cek` detects (timing-safe)
- Result-over-exception throughout per Zeta convention (`.claude/rules/...` — never-throw-on-decrypt is structural)

## Git textconv filter integration

```typescript
// files/textconv.ts
// Invoked by git when computing diffs for encrypted files
// Reads encrypted blob from disk; decrypts; prints plaintext to stdout
// Operator's recipient secret is loaded from 081KSKBP80008QG0R003AX2A69 USB-bound credentials (per 081KSNY2Z0008QG0R0011XCT94)

import { readFileSync } from 'fs';
import * as cbor from '@stablelib/cbor';
import { decryptFile } from './decrypt';

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: textconv.ts <encrypted-file-path>');
    process.exit(2);
  }
  const encBlob = readFileSync(path);
  const envelope = cbor.decode(encBlob) as FileEnvelope;
  const recipient = await loadOperatorRecipient();  // composes with 081KSNY2Z0008QG0R0011XCT94 USB-bound creds
  const signers = await loadSignerPublicKeys();     // .zeta-crypt/recipients.json
  const result = await decryptFile(envelope, recipient, signers);
  if (result.ok) {
    process.stdout.write(result.value);
  } else {
    console.error(`[textconv] decrypt failed: ${result.error}`);
    process.exit(1);
  }
}
```

`.gitattributes`:

```text
*.encrypted diff=zeta-crypt
```

`.gitconfig` (or repo `.git/config`):

```ini
[diff "zeta-crypt"]
    textconv = bun tools/crypto/better-git-crypt/files/textconv.ts
    cachetextconv = true
```

Reviewers see plaintext diffs locally via `git diff` / `git show`; CI sees raw ciphertext blobs (CI doesn't have operator's recipient secret). Same UX as git-agecrypt's textconv pattern.

## Recipient management

```typescript
// recipients/manage.ts
// .zeta-crypt/recipients.json — committed to repo
// {
//   "version": 1,
//   "recipients": [
//     { "identity": "otto-cli@zeta", "pqKemAlg": "ML-KEM-768+X25519", "pqKemPublic": "<base64>", ... },
//     { "identity": "addison@home", "pqKemAlg": "ML-KEM-768+X25519", "pqKemPublic": "<base64>", ... }
//   ]
// }

export async function addRecipient(newRecipient: RecipientKey): Promise<void> {
  const current = loadRecipients();
  current.recipients.push(newRecipient);
  saveRecipients(current);
  // Re-encrypt working tree files? Optional; depends on rotation policy
}

export async function revokeRecipient(identity: Identity): Promise<void> {
  // Forward-revocation: drop from current recipient set + re-encrypt all working-tree files
  const current = loadRecipients();
  current.recipients = current.recipients.filter(r => r.identity !== identity);
  saveRecipients(current);

  // Re-encrypt every encrypted file in working tree under new recipient set
  // (historical commits remain decryptable by the revoked recipient; retroactive revocation requires 081KSNY2Z0008QG0R0008EJDW1 substrate)
  await reEncryptWorkingTree();
}

export async function rotateKeyPair(identity: Identity): Promise<void> {
  // Generate new keypair for identity; update recipient entry; re-encrypt working tree
  const current = loadRecipients();
  const idx = current.recipients.findIndex(r => r.identity === identity);
  if (idx < 0) throw new Error(`Unknown identity: ${identity}`);
  const seed = generateSeed({ kind: "random-bytes" });  // or "adinkra-derived" per 081KRW63S0008QG0R000QJR08H
  const kem = getKem(current.recipients[idx].pqKemAlg);
  const newKeyPair = kem.keygen(seed);
  // Distribute newKeyPair.secretKey to the identity owner via secure channel (081KSNY2Z0008QG0R0011XCT94 USB-bound creds)
  current.recipients[idx].pqKemPublic = newKeyPair.publicKey;
  current.recipients[idx].validFrom = new Date().toISOString();
  saveRecipients(current);
  await reEncryptWorkingTree();
}
```

## CLI surface

```bash
# Generate keypair for identity (writes to 081KSNY2Z0008QG0R0011XCT94 USB-bound creds; commits public to recipients.json)
bun tools/crypto/better-git-crypt/cli/main.ts keygen --identity otto-cli@zeta

# Add file to encryption scope (writes .gitattributes entry; encrypts file)
bun tools/crypto/better-git-crypt/cli/main.ts add docs/private/notes.md

# Add recipient (after recipient generates their keypair + sends public key)
bun tools/crypto/better-git-crypt/cli/main.ts recipient add --identity addison@home --public-key <base64>

# Revoke recipient (forward-only; historical commits still decryptable by revoked recipient)
bun tools/crypto/better-git-crypt/cli/main.ts recipient revoke --identity addison@home

# Rotate own keypair (re-encrypt working tree under new key)
bun tools/crypto/better-git-crypt/cli/main.ts rotate --identity otto-cli@zeta
```

## Implementation phases

Per the 11-sub-row breakdown in the 081KSNY2Z0008QG0R0017JSTGD design memo's analog (apply same pattern):

| Phase | Sub-row | Scope | Effort |
|---|---|---|---|
| **P1** | 081KSNY2Z0008QG0R002JKH50A.6 | Types + envelope CBOR + cipher registry skeleton | 2-3 days |
| **P2** | 081KSNY2Z0008QG0R002JKH50A.7 | Primary cipher impls (XWing + ML-DSA-65 + ChaCha20-Poly1305) wired to registry | 3-5 days |
| **P3** | 081KSNY2Z0008QG0R002JKH50A.8 | Encrypt + decrypt + signature verify + KAT tests (per FIPS 203/204 test vectors) | 3-5 days |
| **P4** | 081KSNY2Z0008QG0R002JKH50A.9 | Recipient management (.zeta-crypt/recipients.json + add/revoke/rotate) | 2-3 days |
| **P5** | 081KSNY2Z0008QG0R002JKH50A.10 | Git textconv integration + smudge/clean filters | 3-5 days |
| **P6** | 081KSNY2Z0008QG0R002JKH50A.11 | CLI surface (`bun tools/.../cli/main.ts`) | 2-3 days |
| **P7** | 081KSNY2Z0008QG0R002JKH50A.12 | 081KSNY2Z0008QG0R0011XCT94 zflash USB-bound integration (operator secret loaded from USB blob) | 2-3 days |
| **P8** | 081KSNY2Z0008QG0R002JKH50A.13 | 081KSNY2Z0008QG0R0030V5ZVS Otto private state rollout (consumer; ASAP target) | 2-4 days |
| **P9** | 081KSNY2Z0008QG0R002JKH50A.14 | Empirical validation (round-trip; concurrent recipients; rotation; revocation) | 3-5 days |
| **P10** | 081KSNY2Z0008QG0R002JKH50A.15 | Documentation + skill update (`.claude/skills/better-git-crypt/SKILL.md`) | 1-2 days |

**Total estimate:** 22-38 days of focused implementation. P1+P2+P3 (foundation) → P5 (textconv) → P7+P8 (081KSNY2Z0008QG0R0011XCT94/081KSNY2Z0008QG0R0030V5ZVS integration) is the load-bearing critical path; P4/P6/P9/P10 are additive but improve operator-facing UX.

These sub-rows file separately when activated. This memo is the design substrate they're built FROM.

## Composition with 081KSNY2Z0008QG0R002QA720J three-lanes operating discipline

This memo advances the encryption lane per 081KSNY2Z0008QG0R002QA720J. The lane stays alive because:

- 081KSNY2Z0008QG0R002JKH50A v1 has a clear path to first implementation phase (081KSNY2Z0008QG0R002JKH50A.6 skeleton)
- Cross-lane integration with zflash lane (081KSNY2Z0008QG0R0011XCT94 + 081KSNY2Z0008QG0R0030V5ZVS cluster) is explicit
- Multi-cipher hedge (081KSNY2Z0008QG0R002ZAVMEK) means future TS-native impls (Saber / NTRU-Prime / FrodoKEM) plug in without rework
- Side-channel scope-boundary (081KSNY2Z0008QG0R001FN4DDB) bounds the work scope explicitly
- Metadata follow-up (081KSNY2Z0008QG0R0020KXAPS) means we don't scope-creep filename/commit-msg encryption into v1

Future-Otto cold-boot reading this memo can pick up the next phase (081KSNY2Z0008QG0R002JKH50A.6 skeleton implementation) without re-deriving the design.

## Open implementation questions (not blocking)

- **CBOR library choice** — `@stablelib/cbor` vs `cbor2` vs `borc` vs custom; needs Sonatype-guide invocation per 081KSNY2Z0008QG0R001NERKCY playbook substrate before pull
- **Test-vector source for KAT** — NIST FIPS 203/204 vectors + Noble's own vectors; cross-verify both
- **Operator key-distribution flow** — how does Addison's public key reach the repo? Initial flow: paste-public-key-into-PR (one-time bootstrap); ongoing: rotation via UI surface (deferred to 081KSNY2Z0008QG0R002JKH50A.11 CLI)
- **`.zeta-crypt/recipients.json` schema versioning** — bump `version: 1` when format evolves; old envelopes carry their own `v: 1` so backward-compat is bounded
- **Working-tree re-encrypt on rotation** — atomic vs per-file? Atomic is safer (all-or-nothing commit) but heavier for large repos; defer decision to 081KSNY2Z0008QG0R002JKH50A.9
- **Skill location for operator-facing CLI usage** — `.claude/skills/better-git-crypt/SKILL.md` recommended

## Substrate-honest framing

This memo is a DESIGN PROPOSAL extending 081KSNY2Z0008QG0R0037X4DP4's recommendation with operator-locked decisions. NO CODE COMMITTED; NO PR OPENED FOR IMPLEMENTATION. Implementation work files separately as 081KSNY2Z0008QG0R002JKH50A.6+ sub-rows when activated.

Per `.claude/rules/no-directives.md` + standing-direction `081KSNY2Z0008QG0R002JKH50A is P1 ASAP`: this memo is the engineering substrate the implementation builds from; operator authorizes per-phase as work proceeds.

The memo is research-grade substrate per `docs/research/` conventions; lands in encryption lane per 081KSNY2Z0008QG0R002QA720J.

---

## Section X — Operator sharpening 2026-05-28 (post-memo-write)

After this memo was drafted, operator sent substantial scope-sharpening that reframes 081KSNY2Z0008QG0R002JKH50A v1:

> *"a few things 1 we don't need to encrypt everything we are glass halo open by default agents and humans have to earn encryption budget and if we can do plane text encryption somehow instead of binary that would be best for git, if not we can discuss. Playbooks have runme and assumed jit when scripts dont exist and continue-with and other trigger annotations for agent swarm interaction, also playbook authoring is not just for human intent but also agent intent we should keep personal playbooks in the personas directory while having system ones in docs i guess or playbooks folder. we also have a lot of backlog around this. yes we are assuming good actors for now, we will harden later so we can work in that order just looking for some basic privacy but not stuck in old encryption from the start."*

6 substantive sharpenings:

### Sharpening 1 — Glass-halo open-by-default; encryption is EARNED, not default

This INVERTS the design memo's implicit "encrypt files via `.gitattributes`" assumption. Encryption is OPT-IN; most substrate stays glass-halo-open per `.claude/rules/glass-halo-bidirectional.md`; encryption reserved for content that EARNS budget via Agora V6 / reputation-weighted-encryption-budget (081KRW63S0008QG0R001Z10PVV + 081KSGS9H0008QG0R0006F4BGX). **Filed as 081KSNY2Z0008QG0R000459FRH.**

### Sharpening 2 — Plaintext-readable ciphertext > binary blob

Candidates: base64-encoded CBOR (recommended; smallest delta + text-safe + git-line-aligned); JSON-encoded envelope; per-line encryption with line-prefix nonce; format-preserving encryption (research-grade; defer); encrypted YAML (partial-readability respecting YAML diff semantics). **My v1 recommendation: base64-encoded CBOR envelope.** **Filed as 081KSNY2Z0008QG0R0034JR61Z.**

### Sharpening 3 — Playbooks have runme + assumed JIT + continue-with + trigger annotations

Composes with existing substrate (operator: "we have a lot of backlog around this"): 081KSE6WT0008QG0R003AJYMD3/081KSE6WT0008QG0R002YBWBB1/081KSE6WT0008QG0R00102H071/081KSGS9H0008QG0R0005P83AP/081KSGS9H0008QG0R001K8VPV4/081KSGS9H0008QG0R00123050G. Encryption substrate (081KSNY2Z0008QG0R002JKH50A) should be a playbook step (per 081KSNY2Z0008QG0R001NERKCY sonatype-guide pattern) invoked via continue-with annotations + JIT-script-creation when the script doesn't yet exist.

### Sharpening 4 — Playbook authoring is for AGENT intent too, not just human

Per 081KSNY2Z0008QG0R000S738W3 two-path interface ALREADY says this; operator re-emphasizing. Encryption playbooks can be authored by Otto/Alexa/Riven/Vera/Lior alongside Aaron/Addison/Max.

### Sharpening 5 — Personal vs system playbook directory convention

| Scope | Location |
|---|---|
| Personal (per-persona) | `memory/<persona>/{persona}/playbooks/{name}.md` |
| System (shared, framework-level) | `docs/playbooks/{name}.md` |

**Filed as 081KSNY2Z0008QG0R0016D7QGW.**

### Sharpening 6 — Good-actor assumption confirmed for v1

"Harden later." Composes with 081KSNY2Z0008QG0R001FN4DDB side-channel scope-boundary. Basic privacy, not maximalist crypto; forward-looking (PQ default) not legacy.

---

## Implication for the design memo

The memo above (sections 1-11) is structurally sound but the DEFAULTS need flipping per Sharpening 1:

- v1 ships with NO "encrypt by default" pattern
- Encryption is explicit operator-decision per file/path/scope
- Encryption-budget mechanics gate when encryption is even invoked
- Plaintext-readable format (base64-encoded CBOR) is v1 default per Sharpening 2 — supersedes binary CBOR recommendation
- Playbook integration per Sharpening 3 means encryption invocation is a playbook step, not `.gitattributes` filter
- Agent-authored playbooks per Sharpening 4 means Otto + Addison both author encryption playbooks for their own scope

### Updated TL;DR (post-sharpening)

- **Glass-halo open by default; encryption is opt-in + earned via Agora V6 budget** (per 081KSNY2Z0008QG0R000459FRH)
- **Plaintext-readable ciphertext format** (base64-encoded CBOR for v1; FPE deferred; per 081KSNY2Z0008QG0R0034JR61Z)
- **Encryption invocation as playbook step** (composes with runbook substrate cluster; not `.gitattributes` filter)
- **Agent-authored encryption playbooks** first-class (per 081KSNY2Z0008QG0R000S738W3 + Sharpening 4)
- **Personal vs system playbook directory convention** filed at 081KSNY2Z0008QG0R0016D7QGW
- **Good-actor assumption for v1**; harden later (Sharpening 6)
- **Multi-cipher hedge** per 081KSNY2Z0008QG0R002ZAVMEK; unchanged
- **Content-only encryption** per 081KSNY2Z0008QG0R0020KXAPS; unchanged
- **Forward-only revocation** per 081KSNY2Z0008QG0R0008EJDW1 future-state
- **Bounded to git-at-rest threat model** per 081KSNY2Z0008QG0R001FN4DDB; unchanged
- **Adinkras-ECC integration via parameterized seed source** per 081KRW63S0008QG0R000QJR08H compose; unchanged
- **Sonatype-guide as playbook step** per 081KSNY2Z0008QG0R001NERKCY; unchanged
