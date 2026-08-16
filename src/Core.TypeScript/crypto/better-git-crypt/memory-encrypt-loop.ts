#!/usr/bin/env bun
/**
 * src/Core.TypeScript/crypto/better-git-crypt/memory-encrypt-loop.ts
 *
 * Self-encrypt a folder of plaintext files into post-quantum `.zc` envelopes — the
 * loop over the file CLI's encrypt step, for the "encrypt a folder of private
 * memories" use case.
 *
 * SECURITY MODEL (load-bearing — read before running):
 *   `encryptBytes(bytes, self, [])` makes `self` the SENDER (it signs) AND the sole
 *   self-recipient (decryption-capable). With no extra recipients this is PURE
 *   self-encryption: ONLY the holder of `self`'s secret bundle can ever decrypt.
 *   Therefore "only the owner can decrypt" requires THE OWNER to be the sender → the
 *   key owner must run the real encrypt with their OWN secret bundle. An agent cannot
 *   run it: it has no secret bundle, and generating one for the owner + holding it
 *   would defeat the only-the-owner-decrypts property. An agent CAN run `--dry-run`
 *   (no key, no writes) to preview.
 *
 * RUNBOOK (the key owner runs steps 1-2 locally; an agent commits the .zc in step 3):
 *   1. one-time keygen (the agent never sees the secret):
 *        bun src/Core.TypeScript/crypto/better-git-crypt/cli/main.ts \
 *          --gen-recipient <identity> --out-dir ~/.zeta-keys
 *      → ~/.zeta-keys/<identity>.recipient.json  (public; shareable)
 *        ~/.zeta-keys/<identity>.secret.json     (SECRET — never commit; .zeta-keys/ is gitignored)
 *   2. self-encrypt the folder (this script):
 *        bun src/Core.TypeScript/crypto/better-git-crypt/memory-encrypt-loop.ts \
 *          --keys ~/.zeta-keys/<identity>.secret.json \
 *          --in <in-dir> --out <out-dir>
 *      → one `.zc` per `*.txt` in <in-dir> (keep plaintext in a gitignored dir)
 *   3. commit the `.zc` (the agent does this; plaintext never leaves the gitignored dir).
 *
 * The plaintext is preserved BYTE-FOR-BYTE inside the envelope — no edit, summary,
 * or redaction; decrypt returns the exact input bytes.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import {
  deserializeSecretBundle,
  looksLikeSecretBundle,
  encryptBytes,
  type SelfKeys,
  type SecretBundleJSON,
} from "./files";

// --- pure helpers (unit-testable without a CLI / without a key for listing) ---

/** Input files to encrypt: regular files under `inDir` with extension `inExt`. */
export function listInputs(inDir: string, inExt = ".txt"): string[] {
  if (!existsSync(inDir) || !statSync(inDir).isDirectory()) return [];
  return readdirSync(inDir)
    .filter((n) => n.toLowerCase().endsWith(inExt.toLowerCase()))
    .map((n) => join(inDir, n))
    .filter((p) => statSync(p).isFile())
    .sort();
}

/** `<outDir>/<basename-without-inExt>.zc` — preserves the source name. */
export function outPathFor(inFile: string, outDir: string, inExt = ".txt"): string {
  let stem = basename(inFile);
  if (stem.toLowerCase().endsWith(inExt.toLowerCase())) stem = stem.slice(0, stem.length - inExt.length);
  return join(outDir, `${stem}.zc`);
}

export interface EncryptDirResult {
  readonly encrypted: ReadonlyArray<{ readonly in: string; readonly out: string; readonly recipients: string[] }>;
  readonly skipped: ReadonlyArray<{ readonly in: string; readonly reason: string }>;
  readonly errors: ReadonlyArray<{ readonly in: string; readonly feedback: string }>;
}

/**
 * Self-encrypt every input under `inDir` to `<outDir>/<name>.zc`. `self` is the key
 * owner's secret bundle; pure self-encryption (no extra recipients) ⇒ only the
 * secret-bundle holder can decrypt. Existing `.zc` are skipped unless `force`. The
 * out dir is created if missing.
 */
export function encryptDir(
  self: SelfKeys,
  inDir: string,
  outDir: string,
  opts: { force?: boolean; inExt?: string } = {},
): EncryptDirResult {
  const inExt = opts.inExt ?? ".txt";
  const encrypted: Array<{ in: string; out: string; recipients: string[] }> = [];
  const skipped: Array<{ in: string; reason: string }> = [];
  const errors: Array<{ in: string; feedback: string }> = [];

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const inFile of listInputs(inDir, inExt)) {
    const out = outPathFor(inFile, outDir, inExt);
    if (existsSync(out) && !opts.force) {
      skipped.push({ in: inFile, reason: `output exists (use --force): ${out}` });
      continue;
    }
    const bytes = readFileSync(inFile); // Buffer is a Uint8Array
    const res = encryptBytes(bytes, self, []); // [] = pure self-encryption
    if (!res.ok) {
      errors.push({ in: inFile, feedback: JSON.stringify(res.feedback) });
      continue;
    }
    writeFileSync(out, res.envelopeBytes);
    encrypted.push({ in: inFile, out, recipients: res.recipientIdentities });
  }

  return { encrypted, skipped, errors };
}

// --- CLI ---------------------------------------------------------------------

/** Load the key owner's secret bundle; fail-closed if the file isn't a secret bundle. */
function loadSelf(keysPath: string): SelfKeys {
  if (!existsSync(keysPath)) throw new Error(`--keys not found: ${keysPath}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(keysPath, "utf8"));
  } catch (e) {
    throw new Error(`--keys is not valid JSON: ${keysPath} (${(e as Error).message})`);
  }
  if (!looksLikeSecretBundle(parsed)) {
    throw new Error(
      `--keys is not a secret bundle (need the SECRET key file, e.g. <identity>.secret.json — ` +
        `NOT the .recipient.json public file): ${keysPath}`,
    );
  }
  return deserializeSecretBundle(parsed as SecretBundleJSON);
}

function flagValue(args: readonly string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined || v.startsWith("--")) throw new Error(`${name} requires a value`);
  return v;
}

const USAGE = `memory-encrypt-loop — self-encrypt a folder of memories to post-quantum .zc

  Preview (no key, no writes — the only mode an agent should run):
    bun src/Core.TypeScript/crypto/better-git-crypt/memory-encrypt-loop.ts --dry-run --in <in-dir> --out <out-dir>

  Real run (key owner only — requires the owner's SECRET bundle as sender):
    bun src/Core.TypeScript/crypto/better-git-crypt/memory-encrypt-loop.ts \\
      --keys ~/.zeta-keys/<identity>.secret.json --in <in-dir> --out <out-dir>

  Flags:
    --in <dir>      input dir of plaintext files            (required)
    --out <dir>     output dir for .zc envelopes            (required)
    --keys <file>   the owner's SECRET bundle JSON          (required unless --dry-run)
    --in-ext <ext>  input extension filter                  (default .txt)
    --dry-run       list inputs → outputs; no key, no writes
    --force         overwrite existing .zc
`;

const KNOWN = new Set(["--in", "--out", "--keys", "--in-ext", "--dry-run", "--force", "--help", "-h"]);

async function main(argv: readonly string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(USAGE);
    return 0;
  }
  for (const a of args) {
    if (a.startsWith("--") && !KNOWN.has(a)) {
      process.stderr.write(`unknown flag: ${a}\n\n${USAGE}`);
      return 2;
    }
  }

  let inDir: string | undefined, outDir: string | undefined, keys: string | undefined, inExt: string;
  try {
    inDir = flagValue(args, "--in");
    outDir = flagValue(args, "--out");
    keys = flagValue(args, "--keys");
    inExt = flagValue(args, "--in-ext") ?? ".txt";
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  if (!inDir || !outDir) {
    process.stderr.write(`--in and --out are required\n\n${USAGE}`);
    return 2;
  }

  const inputs = listInputs(inDir, inExt);
  if (inputs.length === 0) {
    process.stderr.write(`no ${inExt} files found under ${inDir}\n`);
    return 1;
  }

  if (dryRun) {
    process.stdout.write(`DRY RUN — would self-encrypt ${inputs.length} file(s) (no key, no writes):\n`);
    for (const f of inputs) {
      const out = outPathFor(f, outDir, inExt);
      const exists = existsSync(out) && !force ? "  [SKIP: output exists, use --force]" : "";
      process.stdout.write(`  ${f}  →  ${out}${exists}\n`);
    }
    process.stdout.write(
      `\nTo actually encrypt, the key owner runs with --keys <secret-bundle> (the sender is the sole decryptor).\n`,
    );
    return 0;
  }

  if (!keys) {
    process.stderr.write(
      `--keys is required for a real run (only the key owner can run this — the secret bundle is the sender / sole decryptor).\n` +
        `Use --dry-run to preview without a key.\n\n${USAGE}`,
    );
    return 2;
  }

  let self: SelfKeys;
  try {
    self = loadSelf(keys);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }

  const result = encryptDir(self, inDir, outDir, { force, inExt });
  for (const e of result.encrypted) {
    process.stdout.write(`encrypted  ${e.in}  →  ${e.out}  (recipients: ${e.recipients.join(", ")})\n`);
  }
  for (const s of result.skipped) process.stdout.write(`skipped    ${s.in}  (${s.reason})\n`);
  for (const er of result.errors) process.stderr.write(`ERROR      ${er.in}  (${er.feedback})\n`);
  process.stdout.write(
    `\n${result.encrypted.length} encrypted, ${result.skipped.length} skipped, ${result.errors.length} errors.\n`,
  );
  return result.errors.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  main(process.argv).then((code) => process.exit(code));
}
