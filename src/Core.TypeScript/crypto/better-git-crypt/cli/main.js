#!/usr/bin/env bun
/**
 * tools/crypto/better-git-crypt/cli/main.ts
 *
 * B-0883 v1 — better-git-crypt CLI (post-quantum file encryption; the rejected
 * legacy git-crypt's replacement).
 *
 * Scaffold modes (no crypto):
 *   --list-algs         Print ALG_REGISTRY as structured JSON
 *   --validate          Run registry invariants; exit non-zero on violation
 *   --dry-run-envelope  Construct + validate a synthetic FileEnvelope shape
 *
 * File modes (real PQ crypto — XWing KEM + ML-DSA-65 sig + ChaCha20-Poly1305):
 *   --gen-recipient <identity> [--out-dir <dir>] [--force]
 *       Generate a v1 keypair. Refuses to overwrite an existing keypair (that
 *       would destroy the only secret able to decrypt prior .zc) unless --force.
 *       Writes <identity>.recipient.json (PUBLIC,
 *       shareable/committable) + <identity>.secret.json (SECRET bundle — the
 *       ONLY thing that can decrypt; NEVER commit; store it safely).
 *
 *   --encrypt-file <path> --self-key <secret.json> [--recipient <r.json>]... [--out <path>] [--force]
 *       Encrypt <path> with your secret bundle as sender + self-recipient (plus
 *       any extra --recipient public keys). Writes <path>.zc (canonical CBOR
 *       envelope = ciphertext) unless --out; refuses to overwrite an existing
 *       output unless --force. Plaintext NEVER enters the output;
 *       commit the .zc, keep the plaintext out of git.
 *
 *   --decrypt-file <path.zc> --key <secret.json> [--sender-sig <r.json>] [--out <path>] [--force]
 *       Decrypt <path.zc> with your secret bundle. --sender-sig is the signer's
 *       PUBLIC recipient JSON (default: self, for self-encrypted files); its
 *       identity is bound (must match the envelope's signerIdentity). Writes
 *       the recovered plaintext to <path without .zc> unless --out; refuses to
 *       overwrite an existing output (may be an edited plaintext) unless --force.
 *
 * Exit codes:
 *   0 — operation successful
 *   1 — runtime failure (validation / crypto feedback / file I/O)
 *   2 — usage error
 *
 * Security model (load-bearing): encrypt SIGNS with the sender's secret key and
 * the sender is a self-recipient — so self-encryption means ONLY the holder of
 * the secret bundle can read the output. The secret bundle is yours; hold it.
 *
 * Per rule-0-no-sh-files (TS-first) + zeta-ships-with-skills-immediate-value.
 */
import { readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ALG_REGISTRY, validateAlgRegistry, validateEnvelopeStructure } from "../types";
import { generateKeyPairJSON, deserializeRecipient, deserializeSecretBundle, looksLikeSecretBundle, encryptBytes, decryptBytes, } from "../files";
function valueFlag(args, name) {
    const i = args.indexOf(name);
    if (i < 0)
        return { kind: "absent" };
    const v = args[i + 1];
    if (v === undefined || v.startsWith("--"))
        return { kind: "missing" };
    return { kind: "value", value: v };
}
/**
 * All values for the repeatable `--recipient` flag, or `null` if ANY occurrence is
 * missing its value (a usage error — silently dropping it would encrypt to fewer
 * recipients than the user intended).
 */
function recipientValues(args) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] !== "--recipient")
            continue;
        const v = args[i + 1];
        if (v === undefined || v.startsWith("--"))
            return null;
        out.push(v);
    }
    return out;
}
/** Filename-safe slug for an identity (keeps the common @ . _ + - chars; `+` is
 *  common in email identities like `user+tag@…`, and path separators are stripped). */
function slug(identity) {
    return identity.replace(/[^A-Za-z0-9._@+-]/g, "_");
}
/** Every flag the CLI recognizes — a typo'd/unsupported `--flag` must error, not be
 *  silently ignored once a mode flag is present (e.g. `--recipent` dropping a recipient). */
const KNOWN_FLAGS = new Set([
    "--list-algs", "--validate", "--dry-run-envelope",
    "--gen-recipient", "--out-dir", "--force",
    "--encrypt-file", "--self-key", "--recipient", "--out",
    "--decrypt-file", "--key", "--sender-sig",
]);
function parseArgs(argv) {
    const args = argv.slice(2);
    if (args.length === 0) {
        return { error: "no mode specified — see file header for usage" };
    }
    // Reject unknown flags BEFORE dispatch — otherwise a misspelled flag (e.g.
    // `--recipent`) is silently ignored once a mode flag is present, which for a
    // crypto CLI can mean encrypting to fewer recipients than intended. (Values that
    // begin with `--` are already treated as a missing value by `valueFlag`.)
    const unknown = args.filter((a) => a.startsWith("--") && !KNOWN_FLAGS.has(a));
    if (unknown.length > 0) {
        return { error: `unrecognized flag(s): ${unknown.join(", ")}` };
    }
    if (args.includes("--list-algs"))
        return { mode: "list-algs" };
    if (args.includes("--validate"))
        return { mode: "validate" };
    if (args.includes("--dry-run-envelope"))
        return { mode: "dry-run-envelope" };
    const gen = valueFlag(args, "--gen-recipient");
    if (gen.kind !== "absent") {
        if (gen.kind === "missing")
            return { error: "--gen-recipient requires an <identity> value" };
        const outDir = valueFlag(args, "--out-dir");
        if (outDir.kind === "missing")
            return { error: "--out-dir requires a <dir> value" };
        return { mode: "gen-recipient", identity: gen.value, outDir: outDir.kind === "value" ? outDir.value : ".", force: args.includes("--force") };
    }
    const enc = valueFlag(args, "--encrypt-file");
    if (enc.kind !== "absent") {
        if (enc.kind === "missing")
            return { error: "--encrypt-file requires a <path> value" };
        const selfKey = valueFlag(args, "--self-key");
        if (selfKey.kind !== "value")
            return { error: "--encrypt-file requires --self-key <secret.json>" };
        const recips = recipientValues(args);
        if (recips === null)
            return { error: "--recipient requires a <recipient.json> value" };
        const out = valueFlag(args, "--out");
        if (out.kind === "missing")
            return { error: "--out requires a <path> value" };
        return {
            mode: "encrypt-file",
            inPath: enc.value,
            selfKeyPath: selfKey.value,
            recipientPaths: recips,
            outPath: out.kind === "value" ? out.value : enc.value + ".zc",
            force: args.includes("--force"),
        };
    }
    const dec = valueFlag(args, "--decrypt-file");
    if (dec.kind !== "absent") {
        if (dec.kind === "missing")
            return { error: "--decrypt-file requires a <path.zc> value" };
        const key = valueFlag(args, "--key");
        if (key.kind !== "value")
            return { error: "--decrypt-file requires --key <secret.json>" };
        const senderSig = valueFlag(args, "--sender-sig");
        if (senderSig.kind === "missing")
            return { error: "--sender-sig requires a <recipient.json> value" };
        const out = valueFlag(args, "--out");
        if (out.kind === "missing")
            return { error: "--out requires a <path> value" };
        return {
            mode: "decrypt-file",
            inPath: dec.value,
            selfKeyPath: key.value,
            senderSigPath: senderSig.kind === "value" ? senderSig.value : null,
            outPath: out.kind === "value" ? out.value : null,
            force: args.includes("--force"),
        };
    }
    return { error: `unrecognized arguments: ${args.join(" ")}` };
}
function emitJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
function modeListAlgs() {
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
function modeValidate() {
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
    }
    catch (e) {
        emitJson({ rowId: "B-0883", subRow: "v1", mode: "validate", result: "failed", error: e.message });
        return 1;
    }
}
function modeDryRunEnvelope() {
    try {
        validateAlgRegistry(ALG_REGISTRY);
    }
    catch (e) {
        emitJson({ rowId: "B-0883", subRow: "v1", mode: "dry-run-envelope", result: "failed", stage: "registry-validation", error: e.message });
        return 1;
    }
    const synthetic = {
        version: 1,
        context: "zeta.git-crypt.file.v1",
        algKem: "ML-KEM-768+X25519",
        algKdf: "HKDF-SHA256",
        algWrap: "ChaCha20-Poly1305-AEAD",
        algContent: "ChaCha20-Poly1305",
        algSig: "ML-DSA-65",
        recipients: [{ identity: "otto-cli@zeta", kemCt: new Uint8Array(0), wrappedCek: new Uint8Array(0), kdfInfo: new Uint8Array(0) }],
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
                algorithms: { kem: synthetic.algKem, kdf: synthetic.algKdf, wrap: synthetic.algWrap, content: synthetic.algContent, signature: synthetic.algSig },
                recipientCount: synthetic.recipients.length,
                signerIdentity: synthetic.signerIdentity,
            },
            fileModes: {
                genRecipient: "--gen-recipient <id> [--out-dir <dir>]",
                encryptFile: "--encrypt-file <path> --self-key <secret.json> [--recipient <r.json>]... [--out <path>]",
                decryptFile: "--decrypt-file <path.zc> --key <secret.json> [--sender-sig <r.json>] [--out <path>]",
            },
            stillDeferred: {
                gitTextconv: "git clean/smudge or textconv filter integration (transparent encrypt-on-commit)",
                recipientRegistry: ".zeta-crypt/recipients.json multi-party registry + rotation (B-0883.3)",
                multiCipherHedge: "B-0883.2 — Saber / NTRU-Prime / FrodoKEM alternates when TS-native impls mature",
                metadataEncryption: "B-0883.5 — filenames / commit messages (v1 is content-only)",
            },
        });
        return 0;
    }
    catch (e) {
        emitJson({ rowId: "B-0883", subRow: "v1", mode: "dry-run-envelope", result: "failed", stage: "envelope-structure-validation", error: e.message });
        return 1;
    }
}
function modeGenRecipient(identity, outDir, force) {
    try {
        const base = slug(identity);
        const recPath = join(outDir, `${base}.recipient.json`);
        const secPath = join(outDir, `${base}.secret.json`);
        // P0 (data-loss) guard: regenerating a keypair for an existing identity would
        // destroy the ONLY secret bundle able to decrypt files already encrypted to it.
        if (!force && (existsSync(secPath) || existsSync(recPath))) {
            emitJson({
                rowId: "B-0883",
                mode: "gen-recipient",
                result: "failed",
                error: `refusing to overwrite an existing keypair for '${identity}' (${existsSync(secPath) ? secPath : recPath}). Regenerating destroys the ONLY secret bundle that can decrypt files already encrypted to it. Use a different --out-dir / identity, or pass --force if you are certain.`,
            });
            return 1;
        }
        const { recipient, secret } = generateKeyPairJSON(identity);
        writeFileSync(recPath, JSON.stringify(recipient, null, 2) + "\n");
        writeFileSync(secPath, JSON.stringify(secret, null, 2) + "\n", { mode: 0o600 });
        try {
            chmodSync(secPath, 0o600);
        }
        catch {
            /* best-effort on filesystems without POSIX modes */
        }
        emitJson({
            rowId: "B-0883",
            mode: "gen-recipient",
            result: "passed",
            identity,
            recipientPublic: recPath,
            secretBundle: secPath,
            warning: "the SECRET bundle is the ONLY way to decrypt — store it safely, NEVER commit it (gitignore it or keep it outside the repo). The .recipient.json (public) is shareable/committable.",
        });
        return 0;
    }
    catch (e) {
        emitJson({ rowId: "B-0883", mode: "gen-recipient", result: "failed", error: e.message });
        return 1;
    }
}
/**
 * Read a PUBLIC recipient JSON, REFUSING a secret bundle (P1 footgun guard): a
 * `.secret.json` passed where a public recipient is expected would treat private
 * key material as a public recipient and invites accidental sharing/committing.
 */
function loadPublicRecipient(path) {
    const obj = JSON.parse(readFileSync(path, "utf8"));
    if (looksLikeSecretBundle(obj)) {
        throw new Error(`refusing to use '${path}' as a recipient: it contains SECRET key material (a .secret.json bundle). Pass the PUBLIC .recipient.json instead.`);
    }
    return deserializeRecipient(obj);
}
function modeEncryptFile(inPath, selfKeyPath, recipientPaths, outPath, force) {
    try {
        // Don't silently destroy an existing output (e.g. --out pointed at the plaintext
        // itself, or an existing .zc the user meant to keep).
        if (!force && existsSync(outPath)) {
            emitJson({
                rowId: "B-0883",
                mode: "encrypt-file",
                result: "failed",
                in: inPath,
                error: `refusing to overwrite existing output '${outPath}' — it may be a file you meant to keep. Use --out <path> or --force.`,
            });
            return 1;
        }
        const plaintext = readFileSync(inPath); // Buffer IS a Uint8Array — pass directly (no copy)
        const self = deserializeSecretBundle(JSON.parse(readFileSync(selfKeyPath, "utf8")));
        const extras = recipientPaths.map((p) => loadPublicRecipient(p));
        const res = encryptBytes(plaintext, self, extras);
        if (!res.ok) {
            emitJson({ rowId: "B-0883", mode: "encrypt-file", result: "failed", in: inPath, feedback: res.feedback });
            return 1;
        }
        writeFileSync(outPath, res.envelopeBytes); // Uint8Array writes directly (no copy)
        emitJson({
            rowId: "B-0883",
            mode: "encrypt-file",
            result: "passed",
            in: inPath,
            out: outPath,
            plaintextBytes: plaintext.length,
            envelopeBytes: res.envelopeBytes.length,
            recipients: res.recipientIdentities,
            note: "commit the .zc (ciphertext); keep the plaintext out of git",
        });
        return 0;
    }
    catch (e) {
        emitJson({ rowId: "B-0883", mode: "encrypt-file", result: "failed", in: inPath, error: e.message });
        return 1;
    }
}
function modeDecryptFile(inPath, selfKeyPath, senderSigPath, outPath, force) {
    try {
        const envelopeBytes = readFileSync(inPath); // Buffer IS a Uint8Array — pass directly (no copy)
        const self = deserializeSecretBundle(JSON.parse(readFileSync(selfKeyPath, "utf8")));
        let senderSig;
        let expectedSignerIdentity;
        if (senderSigPath) {
            // P1: BIND the --sender-sig identity. signerIdentity is signed-but-self-declared;
            // decryptBytes enforces signerIdentity === expectedSignerIdentity (fail-closed) so
            // an envelope can't claim identity X while signed by key-for-Y.
            const senderRecipient = loadPublicRecipient(senderSigPath);
            senderSig = senderRecipient.publicSigKey;
            expectedSignerIdentity = senderRecipient.identity;
        }
        const out = outPath ?? (inPath.endsWith(".zc") ? inPath.slice(0, -3) : inPath + ".dec");
        // P2: don't silently destroy an existing (possibly edited) plaintext.
        if (!force && existsSync(out)) {
            emitJson({
                rowId: "B-0883",
                mode: "decrypt-file",
                result: "failed",
                in: inPath,
                error: `refusing to overwrite existing output '${out}' — it may be an edited plaintext. Use --out <path> or --force.`,
            });
            return 1;
        }
        const res = decryptBytes(envelopeBytes, self, senderSig, expectedSignerIdentity);
        if (!res.ok) {
            if ("identityMismatch" in res) {
                emitJson({
                    rowId: "B-0883",
                    mode: "decrypt-file",
                    result: "failed",
                    in: inPath,
                    error: `envelope signerIdentity '${res.identityMismatch.actual}' does not match --sender-sig identity '${res.identityMismatch.expected}'`,
                });
            }
            else {
                emitJson({ rowId: "B-0883", mode: "decrypt-file", result: "failed", in: inPath, feedback: res.feedback });
            }
            return 1;
        }
        writeFileSync(out, res.plaintext); // Uint8Array writes directly (no copy)
        emitJson({ rowId: "B-0883", mode: "decrypt-file", result: "passed", in: inPath, out, plaintextBytes: res.plaintext.length });
        return 0;
    }
    catch (e) {
        emitJson({ rowId: "B-0883", mode: "decrypt-file", result: "failed", in: inPath, error: e.message });
        return 1;
    }
}
function main(argv) {
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
        case "gen-recipient":
            return modeGenRecipient(parsed.identity, parsed.outDir, parsed.force);
        case "encrypt-file":
            return modeEncryptFile(parsed.inPath, parsed.selfKeyPath, parsed.recipientPaths, parsed.outPath, parsed.force);
        case "decrypt-file":
            return modeDecryptFile(parsed.inPath, parsed.selfKeyPath, parsed.senderSigPath, parsed.outPath, parsed.force);
    }
}
if (import.meta.main) {
    process.exit(main(process.argv));
}
