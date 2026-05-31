#!/usr/bin/env bun
/**
 * tools/crypto/better-git-crypt/cli/main.ts
 *
 * B-0883 v1 — better-git-crypt CLI dispatcher (PoC scaffold)
 *
 * Usage:
 *   bun tools/crypto/better-git-crypt/cli/main.ts --list-algs
 *   bun tools/crypto/better-git-crypt/cli/main.ts --validate
 *   bun tools/crypto/better-git-crypt/cli/main.ts --dry-run-envelope
 *
 * Modes:
 *   --list-algs         Print ALG_REGISTRY as structured JSON
 *   --validate          Run registry invariants; exit non-zero on violation
 *   --dry-run-envelope  Construct a synthetic FileEnvelope using ships-v1
 *                       algorithms + validate its structure; emit JSON
 *                       describing the envelope shape (NO crypto; NO bytes)
 *
 * Exit codes:
 *   0 — operation successful
 *   1 — runtime validation FAILED (registry invariant OR envelope structure)
 *   2 — usage error
 *
 * Per rule-0-no-sh-files (TS-first) + zeta-ships-with-skills-immediate-value
 * (TS PoC ships first; F# crystallization later).
 *
 * PoC scope: declarative dispatcher + invariant validation + envelope-
 * structure dry-run. Real Noble integration + KEM operations + CBOR
 * encoding + actual encrypt/decrypt = Phase 2 (operator-authorized
 * follow-up). The scaffold types the substrate + surfaces the integration
 * points for Phase 2.
 */

import { ALG_REGISTRY, validateAlgRegistry, validateEnvelopeStructure, type FileEnvelope } from "../types";

type Mode = "list-algs" | "validate" | "dry-run-envelope";

interface ParsedArgs {
  readonly mode: Mode;
}

function parseArgs(argv: readonly string[]): ParsedArgs | { error: string } {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { error: "no mode specified — use --list-algs, --validate, or --dry-run-envelope" };
  }
  if (args.includes("--list-algs")) return { mode: "list-algs" };
  if (args.includes("--validate")) return { mode: "validate" };
  if (args.includes("--dry-run-envelope")) return { mode: "dry-run-envelope" };
  return { error: `unrecognized arguments: ${args.join(" ")}` };
}

function emitJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function modeListAlgs(): number {
  emitJson({
    rowId: "B-0883",
    subRow: "v1",
    registrySize: ALG_REGISTRY.length,
    byClass: {
      kem: ALG_REGISTRY.filter((a) => a.class === "kem").map((a) => ({ id: a.id, status: a.status })),
      signature: ALG_REGISTRY.filter((a) => a.class === "signature").map((a) => ({ id: a.id, status: a.status })),
      kdf: ALG_REGISTRY.filter((a) => a.class === "kdf").map((a) => ({ id: a.id, status: a.status })),
      aead: ALG_REGISTRY.filter((a) => a.class === "aead").map((a) => ({ id: a.id, status: a.status })),
    },
  });
  return 0;
}

function modeValidate(): number {
  try {
    validateAlgRegistry(ALG_REGISTRY);
    emitJson({
      rowId: "B-0883",
      subRow: "v1",
      mode: "validate",
      result: "passed",
      registrySize: ALG_REGISTRY.length,
      shipsV1Counts: {
        kem: ALG_REGISTRY.filter((a) => a.class === "kem" && a.status === "ships-v1").length,
        signature: ALG_REGISTRY.filter((a) => a.class === "signature" && a.status === "ships-v1").length,
        kdf: ALG_REGISTRY.filter((a) => a.class === "kdf" && a.status === "ships-v1").length,
        aead: ALG_REGISTRY.filter((a) => a.class === "aead" && a.status === "ships-v1").length,
      },
    });
    return 0;
  } catch (e) {
    emitJson({
      rowId: "B-0883",
      subRow: "v1",
      mode: "validate",
      result: "failed",
      error: (e as Error).message,
    });
    return 1;
  }
}

function modeDryRunEnvelope(): number {
  try {
    validateAlgRegistry(ALG_REGISTRY);
  } catch (e) {
    emitJson({
      rowId: "B-0883",
      subRow: "v1",
      mode: "dry-run-envelope",
      result: "failed",
      stage: "registry-validation",
      error: (e as Error).message,
    });
    return 1;
  }
  // Construct a synthetic envelope using ships-v1 primary algorithms.
  const synthetic: FileEnvelope = {
    version: 1,
    context: "zeta.git-crypt.file.v1",
    algKem: "ML-KEM-768+X25519",
    algKdf: "HKDF-SHA256",
    algWrap: "ChaCha20-Poly1305-AEAD",
    algContent: "ChaCha20-Poly1305",
    algSig: "ML-DSA-65",
    recipients: [
      {
        identity: "otto-cli@zeta",
        kemCt: new Uint8Array(0),
        wrappedCek: new Uint8Array(0),
        kdfInfo: new Uint8Array(0),
      },
    ],
    ciphertext: new Uint8Array(0),
    contentNonce: new Uint8Array(12),
    signerIdentity: "otto-cli@zeta",
    signature: new Uint8Array(0),
  };
  try {
    validateEnvelopeStructure(synthetic);
    emitJson({
      rowId: "B-0883",
      subRow: "v1",
      mode: "dry-run-envelope",
      result: "passed",
      envelope: {
        version: synthetic.version,
        context: synthetic.context,
        algorithms: {
          kem: synthetic.algKem,
          kdf: synthetic.algKdf,
          wrap: synthetic.algWrap,
          content: synthetic.algContent,
          signature: synthetic.algSig,
        },
        recipientCount: synthetic.recipients.length,
        signerIdentity: synthetic.signerIdentity,
      },
      phase2Implemented: {
        crypto: "../crypto.ts — generateRecipientKeyPair / encrypt / decrypt / encodeEnvelope / decodeEnvelope",
        kem: "XWing (ML-KEM-768 + X25519) via @noble/post-quantum/hybrid",
        signature: "ML-DSA-65 via @noble/post-quantum/ml-dsa (sign + self-verify)",
        kdf: "HKDF-SHA256 via @noble/hashes",
        aead: "ChaCha20-Poly1305 via @noble/ciphers (content + CEK-wrap)",
        cbor: "canonical/deterministic envelope via cborg",
      },
      stillDeferred: {
        gitTextconv: "git textconv filter integration for diff-readable ciphertext",
        recipientManagement: ".zeta-crypt/recipients.json read/write + rotation",
        multiCipherHedge: "B-0883.2 — Saber / NTRU-Prime / FrodoKEM ship as alternates when TS-native impls mature",
        metadataEncryption: "B-0883.5 — filenames / commit messages (v1 is content-only)",
        seedSourcesBeyondRandom: "adinkra-derived (B-0623) + hsm-derived seed sources",
      },
      beforeRealUse: "KATs vs Noble vectors + formal-verification + security-ops review (crypto-don't-rush gate)",
    });
    return 0;
  } catch (e) {
    emitJson({
      rowId: "B-0883",
      subRow: "v1",
      mode: "dry-run-envelope",
      result: "failed",
      stage: "envelope-structure-validation",
      error: (e as Error).message,
    });
    return 1;
  }
}

function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`usage error: ${parsed.error}`);
    console.error("see file header for usage examples");
    return 2;
  }
  switch (parsed.mode) {
    case "list-algs":
      return modeListAlgs();
    case "validate":
      return modeValidate();
    case "dry-run-envelope":
      return modeDryRunEnvelope();
  }
}

if (import.meta.main) {
  process.exit(main(process.argv));
}
